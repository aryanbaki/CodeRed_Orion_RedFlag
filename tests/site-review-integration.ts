import type {ReviewState} from '../src/core/contracts.ts';
/** Real MV3 → authenticated local server → simulated Google response. Public/legal data are fixtures. */
import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {once} from 'node:events';
import type {AddressInfo} from 'node:net';
import {createAnalysisServer} from '../src/server/http.ts';
import {gradeOutput,requiredCategories} from '../src/server/grading.ts';
import {answerPolicyQuestion} from '../src/server/chat.ts';
import {extensionId} from '../scripts/extension-id.mjs';
const extension=resolve('dist/extension'),id=extensionId(extension),root=await mkdtemp(join(tmpdir(),'redflag-integrated-'));
const token='synthetic-backend-access-token-123456',model='gemini-3.5-flash',now=new Date().toISOString();
const clauses={sharing:'We share your data with advertising partners for their own purposes.',retention:'We retain your personal data indefinitely even after account deletion.',tracking:'We track your browsing across websites for behavioral advertising.',renewal:'Your subscription automatically renews each month unless cancelled.',cancellation:'You must cancel thirty days before renewal or pay for another month.',arbitration:'All disputes require binding arbitration and class actions are waived.','content-rights':'You grant us an irrevocable license to reuse your uploaded content.'};
const text=Object.values(clauses).join('\n')+'\nYou can request deletion by contacting our support team.';
const config={apiKey:'simulated-Google-only',model,fallbackModels:[],token,allowedOrigin:`chrome-extension://${id}`,port:8787,retries:0};
let analyzeCalls=0,chatCalls=0,holdChat=false,release:()=>void=()=>{},started:()=>void=()=>{};
const server=createAnalysisServer(config,async r=>{analyzeCalls++;const cats=requiredCategories(r.document),findings=cats.map((category,i)=>({category,severity:i===0?'high':i===1?'medium':'low',quote:clauses[category as keyof typeof clauses],explanation:'The policy explicitly states: '+clauses[category as keyof typeof clauses]}));return gradeOutput({findings,assessments:findings.map(f=>({category:f.category,status:'risk',quote:f.quote,explanation:f.explanation}))},r.document,model);},async r=>{
 chatCalls++;if(holdChat){started();await new Promise<void>(resolve=>release=resolve);}
 return answerPolicyQuestion(r,config,async(_url,init)=>{const payload=JSON.parse(String(init?.body)),input=JSON.parse(payload.contents[0].parts[0].text);assert.equal(input.documents.length,3);assert.ok(input.documents.every((d:{text:string})=>d.text===text));const doc=input.documents.find((d:{kind:string})=>d.kind==='terms');return Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify({claims:[{text:'Your subscription renews each month unless you cancel.',documentId:doc.id,quote:clauses.renewal}],missingEvidence:false})}]}}]});});
 },{allowLocalConnect:true});
let context:Awaited<ReturnType<typeof chromium.launchPersistentContext>>|undefined;
try{
 server.listen(0,'127.0.0.1');await once(server,'listening');const baseUrl=`http://127.0.0.1:${(server.address() as AddressInfo).port}`;
 context=await chromium.launchPersistentContext(join(root,'profile'),{channel:'chromium',headless:true,args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`],viewport:{width:400,height:680}});
 const worker=context.serviceWorkers()[0]??await context.waitForEvent('serviceworker');
 await worker.evaluate(({text,baseUrl})=>{const original=globalThis.fetch;globalThis.fetch=async(url,init)=>{const parsed=new URL(String(url));if(parsed.hostname==='127.0.0.1')return original(parsed.port==='8787'?baseUrl+parsed.pathname:url,init);if(parsed.hostname==='service.com'&&['/privacy','/terms','/cookies'].includes(parsed.pathname))return new Response(text,{headers:{'Content-Type':'text/plain'}});return new Response('',{status:404});};},{text,baseUrl});
 await context.route('https://service.com/**',route=>route.fulfill({body:'<h1>Public fixture website</h1><footer><a href="/privacy">Privacy policy</a><a href="/terms">Terms of service</a><a href="/cookies">Cookie policy</a></footer>',contentType:'text/html'}));
 const site=await context.newPage();await site.goto('https://service.com/home');const controls=await context.newPage();await controls.goto(`chrome-extension://${id}/popup.html`);
 const tabId=await controls.evaluate(async()=> (await chrome.tabs.query({url:'https://service.com/home'}))[0].id);
 const state=()=>controls.evaluate(async tabId=>{const data=(await chrome.storage.session.get('redflag.jobs.v1'))['redflag.jobs.v1'] as {sessions:Record<number,{state:ReviewState}>}|undefined;return data?.sessions[tabId!]?.state;},tabId);
 const connection={baseUrl,accessToken:token,model,fallbackModels:[],promptVersion:'redflag.prompt.v2',rubricVersion:'redflag.rubric.v3'};
 const rejected=await controls.evaluate(async config=>chrome.runtime.sendMessage({type:'redflag/connect-backend',config}),{...connection,accessToken:'invalid-token-but-long-enough-123456'});assert.equal(rejected.connected,false);
 await controls.evaluate(async id=>chrome.tabs.update(id,{active:true}),tabId);await controls.reload();await expect(controls.locator('#domain')).toHaveText('service.com');
 await expect(controls.locator('#connection-status')).toContainText('Backend connected');await controls.locator('#start').click();
 await expect.poll(async()=> (await state())?.documents.filter(d=>d.assessment).length,{timeout:15000}).toBe(3);
 await expect(controls.locator('.policy-row')).toHaveCount(3);for(const card of await controls.locator('.policy-row').all())await expect(card).toBeVisible();
 await expect(controls.locator('.grade-summary .meta')).toContainText('Saved you');
 await expect(controls.locator('.policy-meta').first()).toContainText('words');await expect(controls.locator('#flags-content')).toContainText('Data sharing');
 await controls.locator('#tab-summary').click();await expect(controls.locator('#summary-content')).toContainText('advertising partners');await expect(controls.locator('#summary-content')).not.toContainText('Synthetic');
 const before=analyzeCalls;await controls.locator('#recheck').click();await expect.poll(()=>analyzeCalls,{timeout:15000}).toBeGreaterThanOrEqual(before+3);await expect.poll(async()=> (await state())!.documents.every(d=>d.status!=='pending')).toBe(true);
 await controls.locator('#tab-chat').click();await controls.locator('#chat-input').fill('Does my subscription renew?');await controls.locator('#chat-send').click();await expect(controls.locator('.chat-bubble.assistant')).toContainText('renews each month');await controls.locator('.chat-bubble.assistant summary').click();await expect(controls.locator('.chat-bubble blockquote')).toContainText(clauses.renewal);assert.equal(chatCalls,1);
 const storage=await controls.evaluate(async()=>JSON.stringify(await chrome.storage.local.get(null))+JSON.stringify(await chrome.storage.session.get(null)));assert.ok(!storage.includes(text));assert.ok(!storage.includes('Does my subscription renew?'));assert.ok(!storage.includes(config.apiKey));
 // Reject untrusted content script chat and stale generation.
 const untrusted=await controls.evaluate(async tabId=>{const [r]=await chrome.scripting.executeScript({target:{tabId:tabId!},func:async()=>chrome.runtime.sendMessage({type:'redflag/chat',schemaVersion:1,pageKey:'forged',question:'Question',history:[]})});return r.result;},tabId);assert.equal(untrusted.ok,false);
 holdChat=true;const chatStarted=new Promise<void>(resolve=>started=resolve),pageKey=(await state())!.pageKey;
 const delayed=controls.evaluate(async pageKey=>chrome.runtime.sendMessage({type:'redflag/chat',schemaVersion:1,pageKey,question:'What else?',history:[]}),pageKey);
 await chatStarted;await site.goto('https://service.com/other');release();const late=await delayed;assert.equal(late.ok,false);assert.equal(late.code,'stale-page');
 console.log('Integrated extension verified: automatic connection + origin/token checks, automatic three-policy analysis, words, Summary, red flags, recheck, real HTTP chat with citations, no raw-text/chat/key persistence, untrusted and stale chat rejection. Google responses were simulated.');
}finally{release();await context?.close();server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));await rm(root,{recursive:true,force:true});}
