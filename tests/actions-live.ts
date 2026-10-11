/** Opt-in manual verification only. Loads server env externally; never prints secrets.
 * Discovery screen is controlled; linked GitHub legal documents and Gemini are live.
 */
import {chromium,expect} from '@playwright/test';
import {mkdtemp,rm,cp,readFile,writeFile,realpath} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join,resolve} from 'node:path';import {createHash} from 'node:crypto';import {once} from 'node:events';import type {AddressInfo} from 'node:net';
import {readProviderConfig} from '../src/server/provider-config.ts';
import {readConfig} from '../src/server/config.ts';import {createAnalysisServer} from '../src/server/http.ts';
const root=await realpath(await mkdtemp(join(tmpdir(),'redflag-actions-live-')));const extension=join(root,'extension');
const id=createHash('sha256').update(extension).digest('hex').slice(0,32).replace(/[0-9a-f]/g,c=>String.fromCharCode(97+parseInt(c,16)));
const config=readConfig();const profile=readProviderConfig().profile;if(profile==='paid') throw new Error('This check uses a free/default server profile only.');
const server=createAnalysisServer({...config,allowedOrigin:`chrome-extension://${id}`});let context:Awaited<ReturnType<typeof chromium.launchPersistentContext>>|undefined;
const terms='https://raw.githubusercontent.com/github/site-policy/main/Policies/github-terms/github-terms-of-service.md';
const privacy='https://raw.githubusercontent.com/github/site-policy/main/Policies/privacy-policies/github-general-privacy-statement.md';
try {
 server.listen(0,'127.0.0.1');await once(server,'listening');const baseUrl=`http://127.0.0.1:${(server.address() as AddressInfo).port}`;
 await cp(resolve('dist/extension'),extension,{recursive:true});const manifest=JSON.parse(await readFile(join(extension,'manifest.json'),'utf8'));manifest.host_permissions=['https://service.com/*','https://raw.githubusercontent.com/*','http://127.0.0.1/*','https://www.dominos.com/*'];await writeFile(join(extension,'manifest.json'),JSON.stringify(manifest));
 context=await chromium.launchPersistentContext(join(root,'profile'),{headless:true,channel:'chromium',args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`]});
 const worker=context.serviceWorkers()[0]??await context.waitForEvent('serviceworker');
 const popup=await context.newPage();await popup.goto(`chrome-extension://${id}/popup.html`);
 await popup.evaluate(async ({baseUrl,token,model})=>{const now=new Date().toISOString();await chrome.storage.local.set({'redflag.backend.v1':{baseUrl,accessToken:token,model,promptVersion:'redflag.prompt.v1',rubricVersion:'redflag.rubric.v2'},'redflag.preferences.v1':{schemaVersion:1,enabled:true,priorities:[],aiConsent:{enabled:true,grantedAt:now,updatedAt:now,noticeVersion:'2026-10-11-v1'}}});},{baseUrl,token:config.token,model:config.model});
 await context.route('https://service.com/signup',route=>route.fulfill({body:`<form><h1>Controlled public-document signup fixture</h1><label><input type="checkbox" id="agree">I agree to <a href="${terms}">Terms of Service</a> and <a href="${privacy}">Privacy Policy</a>.</label><button>Continue</button></form>`,contentType:'text/html'}));
 const page=await context.newPage();await page.goto('https://service.com/signup');
 const tabId=await popup.evaluate(async()=> (await chrome.tabs.query({url:'https://service.com/signup'}))[0].id);
 await expect.poll(async()=>popup.evaluate(async tabId=>((await chrome.storage.session.get('redflag.jobs.v1'))['redflag.jobs.v1'] as any)?.sessions[tabId!]?.state.documents.length,tabId)).toBe(2);
 await expect.poll(async()=>popup.evaluate(async tabId=>((await chrome.storage.session.get('redflag.jobs.v1'))['redflag.jobs.v1'] as any)?.sessions[tabId!]?.state.documents.every((d:{status:string})=>d.status!=='pending'),tabId),{timeout:65000}).toBe(true);
 const results=await popup.evaluate(async tabId=>{
  const state=((await chrome.storage.session.get('redflag.jobs.v1'))['redflag.jobs.v1'] as any).sessions[tabId!].state;
  return {documents:state.documents.map((d:any)=>({kind:d.document.kind,url:d.document.url,status:d.status,grade:d.grade,reason:d.reason,coverage:d.coverage,provider:d.assessment?.provider,findings:d.assessment?.findings.length ?? 0,failureStage:d.failure?.stage})),badge:await chrome.action.getBadgeText({tabId})};
 },tabId);
 console.log(JSON.stringify({liveCheck:true,discoveryScreen:'controlled fixture',documentsAndGemini:'live',profile,model:config.model,consentUntouched:!await page.locator('#agree').isChecked(),...results}));
 const domino=await context.newPage();
 try {await domino.goto('https://www.dominos.com/',{waitUntil:'domcontentloaded',timeout:20000});await domino.waitForTimeout(2000);const domTabId=await popup.evaluate(async()=> (await chrome.tabs.query({url:'https://www.dominos.com/*'}))[0]?.id);console.log(JSON.stringify({liveDominos:true,title:await domino.title(),legalLinks:await domino.locator('a').evaluateAll(nodes=>nodes.filter(n=>/privacy|terms/i.test(n.textContent??'')).map(n=>({label:n.textContent?.trim().slice(0,80),url:(n as HTMLAnchorElement).href}))),state:await popup.evaluate(async tabId=>((await chrome.storage.session.get('redflag.jobs.v1'))['redflag.jobs.v1'] as any)?.sessions[tabId!]?.state?.documents.map((d:any)=>({kind:d.document.kind,status:d.status,reason:d.reason})),domTabId)}));}catch {console.log(JSON.stringify({liveDominos:true,error:'network-or-timeout'}));}
}finally{await context?.close();server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));await rm(root,{recursive:true,force:true});}
