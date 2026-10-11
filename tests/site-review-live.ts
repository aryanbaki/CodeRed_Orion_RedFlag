/** Opt-in live check: public GitHub policies, locally running backend and real Gemini.
 * Controlled site-discovery page; temporary browser profile, no everyday Chrome configuration changes.
 */
import {chromium,expect} from '@playwright/test';
import {mkdtemp,rm,readFile,writeFile,mkdir} from 'node:fs/promises';
import {tmpdir,homedir} from 'node:os';
import {join,resolve} from 'node:path';
import {extensionId} from '../scripts/extension-id.mjs';
import type {ReviewState} from '../src/core/contracts.ts';
const extension=resolve('dist/extension'),id=extensionId(extension),root=await mkdtemp(join(tmpdir(),'redflag-live-v3-'));
const connection=JSON.parse(await readFile(join(homedir(),'Downloads','RedFlag-Local-Connection.json'),'utf8'));
const terms='https://raw.githubusercontent.com/github/site-policy/main/Policies/github-terms/github-terms-of-service.md',privacy='https://raw.githubusercontent.com/github/site-policy/main/Policies/privacy-policies/github-general-privacy-statement.md';
let context:Awaited<ReturnType<typeof chromium.launchPersistentContext>>|undefined;
try{
 context=await chromium.launchPersistentContext(join(root,'profile'),{channel:'chromium',headless:true,args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`],viewport:{width:400,height:680}});
 const worker=context.serviceWorkers()[0]??await context.waitForEvent('serviceworker');
 await context.route('https://service.com/**',route=>route.fulfill({body:`<h1>Discovery fixture only</h1><a href="${privacy}">Privacy policy</a><a href="${terms}">Terms of service</a>`,contentType:'text/html'}));
 // Common addresses/community lookup are unavailable on the fixture host; linked policies and backend stay live.
 await worker.evaluate(()=>{const original=globalThis.fetch;globalThis.fetch=async(url,init)=>{const hostname=new URL(String(url)).hostname;if(hostname==='service.com'||hostname==='api.tosdr.org')return new Response('',{status:404});return original(url,init);};});
 const site=await context.newPage();await site.goto('https://service.com/home');const popup=await context.newPage();await popup.goto(`chrome-extension://${id}/popup.html`);
 const tabId=await popup.evaluate(async()=> (await chrome.tabs.query({url:'https://service.com/home'}))[0].id);await popup.evaluate(async id=>chrome.tabs.update(id,{active:true}),tabId);await popup.reload();
 await popup.locator('#connection-file').setInputFiles({name:'connection.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(connection))});await expect(popup.locator('#connection-status')).toContainText('Backend connected');await popup.locator('#start').click();
 const getState=()=>popup.evaluate(async tabId=>{const jobs=(await chrome.storage.session.get('redflag.jobs.v1'))['redflag.jobs.v1'] as {sessions:Record<number,{state:ReviewState}>};return jobs.sessions[tabId!]?.state;},tabId);
 await expect.poll(async()=> (await getState())?.documents.length,{timeout:10000}).toBe(2);
 await expect.poll(async()=> (await getState())?.documents.every(d=>d.status!=='pending'),{timeout:65000}).toBe(true);
 const state=(await getState())!,documents=state.documents.map(d=>({kind:d.document.kind,url:d.document.url,words:d.wordCount,coverage:d.coverage,grade:d.grade,reason:d.reason,model:d.assessment?.model,findings:d.assessment?.findings.length??0,protections:d.assessment?.protections?.length??0}));
 await popup.locator('#tab-summary').click();await mkdir('dist/live-v3',{recursive:true});await popup.screenshot({path:'dist/live-v3/summary.png',fullPage:true});
 await popup.locator('#tab-chat').click();await popup.locator('#chat-input').fill('What does GitHub say about sharing personal information with service providers?');await popup.locator('#chat-send').click();
 await expect.poll(async()=> (await popup.locator('.chat-bubble.assistant').count())>0||!(await popup.locator('#chat-status').textContent())?.includes('Reading policies'),{timeout:55000}).toBe(true);
 const answerCount=await popup.locator('.chat-bubble.assistant').count(),error=answerCount?null:await popup.locator('#chat-status').textContent();await popup.screenshot({path:'dist/live-v3/chat.png',fullPage:true});
 const report={checkedAt:new Date().toISOString(),discovery:'controlled fixture',policies:'live public GitHub documents',backend:'actual local server',provider:'live Gemini',modelStatus:await popup.locator('#chat-model').textContent(),documents,chat:{answered:answerCount>0,error,citationCount:answerCount?await popup.locator('.chat-bubble.assistant details summary').textContent():null},profile:'temporary Chromium, not everyday Chrome'};
 await writeFile('dist/live-v3/report.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
 if(!answerCount||!documents.every(d=>d.model&&(d.findings+d.protections)>0&&d.words!>0))throw Error('Live Gemini analysis or chat failed; see the report.');
}finally{await context?.close();await rm(root,{recursive:true,force:true});}
