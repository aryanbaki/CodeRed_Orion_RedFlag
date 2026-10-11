import {extensionId} from '../scripts/extension-id.mjs';
/** Opt-in manual verification. Supply an ignored server env file with --env-file.
 * The site is controlled; GitHub policies and the three button-triggered Gemini
 * analyses are live. No credential, document text or provider body is printed.
 */
import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,cp,readFile,writeFile,realpath} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {once} from 'node:events';
import type {AddressInfo} from 'node:net';
import type {ReviewState,DocumentAssessment,RedFlagPreferences} from '../src/core/contracts.ts';
import {readProviderConfig} from '../src/server/provider-config.ts';
import {readConfig} from '../src/server/config.ts';
import {createAnalysisServer} from '../src/server/http.ts';
import {analyzeDocument} from '../src/providers/gemini.ts';

const config=readConfig(),profile=readProviderConfig().profile;
if(profile==='paid')throw Error('This check uses a free/default server profile only.');
const terms='https://raw.githubusercontent.com/github/site-policy/main/Policies/github-terms/github-terms-of-service.md';
const privacy='https://raw.githubusercontent.com/github/site-policy/main/Policies/privacy-policies/github-general-privacy-statement.md';
const root=await realpath(await mkdtemp(join(tmpdir(),'redflag-actions-live-'))),extension=join(root,'extension');
let context:Awaited<ReturnType<typeof chromium.launchPersistentContext>>|undefined;
let server:ReturnType<typeof createAnalysisServer>|undefined;
let phase:'setup'|'individual'|'all'='setup',setupRequests=0,pageErrors=0;
const liveRequests:{phase:'individual'|'all';kind:string;grade?:string;reason?:string;model?:string}[]=[];
type Snapshot={sessions:Record<number,{state:ReviewState}>;jobs:{tabId:number}[]};
function outcome(state:ReviewState){
 return state.documents.map(d=>({kind:d.document.kind,url:d.document.url,status:d.status,grade:d.grade,reason:d.reason??null,coverage:d.coverage,provider:d.assessment?.provider??null,model:d.assessment?.model??null,findings:d.assessment?.findings.length??0,failureStage:d.failure?.stage??null,validatedAssessment:Boolean(d.assessment)}));
}
function upstreamFailure(assessment:DocumentAssessment|undefined){
 return !assessment||assessment.grade==='Unrated'&&!['insufficient-evidence','incomplete'].includes(assessment.reason??'');
}
try{
 await cp(resolve('dist/extension'),extension,{recursive:true});
 const id=extensionId(extension);
 const manifest=JSON.parse(await readFile(join(extension,'manifest.json'),'utf8'));
 manifest.host_permissions=['https://service.com/*','https://raw.githubusercontent.com/*','http://127.0.0.1/*'];
 await writeFile(join(extension,'manifest.json'),JSON.stringify(manifest));
 server=createAnalysisServer({...config,allowedOrigin:`chrome-extension://${id}`},async request=>{
  // Enabling consent normally starts two automatic jobs. Make those fail
  // explicitly during setup so only actual popup button presses invoke Gemini.
  // A failed transport response has no assessment and cannot populate the cache.
  if(phase==='setup'){setupRequests++;throw Error('Manual live-check setup gate');}
  const record={phase,kind:request.document.kind} as typeof liveRequests[number];liveRequests.push(record);
  const result=await analyzeDocument(request.document,config);
  record.grade=result.grade;record.reason=result.reason;record.model=result.model;
  return result;
 });
 server.listen(0,'127.0.0.1');await once(server,'listening');
 const baseUrl=`http://127.0.0.1:${(server.address() as AddressInfo).port}`;
 context=await chromium.launchPersistentContext(join(root,'profile'),{headless:true,channel:'chromium',args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`]});
 const worker=context.serviceWorkers()[0]??await context.waitForEvent('serviceworker');
 await worker.evaluate(()=>{
  const originalFetch=globalThis.fetch;
  globalThis.fetch=(url,init)=>{
   // Only the controlled site and community lookup are synthetic. Legal text
   // retrieval and the local HTTP/Gemini transport retain their actual fetch.
   const target=new URL(String(url));
   if(target.hostname==='service.com')return Promise.resolve(new Response('',{status:404}));
   if(target.hostname==='api.tosdr.org')return Promise.resolve(Response.json({services:[]}));
   return originalFetch(url,init);
  };
 });
 const popup=await context.newPage();popup.on('pageerror',()=>{pageErrors++;});
 // The device-data page has no automatic backend pairing during test setup.
 await popup.goto(`chrome-extension://${id}/data.html`);
 await popup.evaluate(async ({baseUrl,token,model,fallbackModels})=>{
  const now=new Date().toISOString();
  await chrome.storage.local.set({'redflag.backend.v1':{baseUrl,accessToken:token,model,fallbackModels,promptVersion:'redflag.prompt.v2',rubricVersion:'redflag.rubric.v3'},'redflag.onboarding.v1':true,'redflag.preferences.v1':{schemaVersion:1,enabled:true,priorities:[],aiConsent:{enabled:false,updatedAt:now,noticeVersion:'2026-10-11-v1'}}});
 },{baseUrl,token:config.token,model:config.model,fallbackModels:config.fallbackModels??[]});
 await context.route('https://service.com/**',route=>route.fulfill({body:`<form><h1>Controlled public-document signup fixture</h1><label><input type="checkbox" id="agree">I agree to <a href="${terms}">Terms of Service</a> and <a href="${privacy}">Privacy Policy</a>.</label><button>Continue</button></form>`,contentType:'text/html'}));
 const page=await context.newPage();page.on('pageerror',()=>{pageErrors++;});await page.goto('https://service.com/signup');
 const tabId=await popup.evaluate(async()=> (await chrome.tabs.query({url:'https://service.com/signup'}))[0].id!);
 const snapshot=()=>popup.evaluate(async()=> (await chrome.storage.session.get('redflag.jobs.v1'))['redflag.jobs.v1'] as Snapshot|undefined);
 const state=async()=> (await snapshot())?.sessions[tabId]?.state;
 const idle=async()=>{const stored=await snapshot(),review=stored?.sessions[tabId]?.state;return Boolean(review?.documents.length===2&&!review.discoveryPending&&review.documents.every(d=>d.status!=='pending')&&!stored?.jobs.some(j=>j.tabId===tabId));};
 await expect.poll(async()=> (await state())?.documents.length,{timeout:20000}).toBe(2);
 await expect.poll(idle,{timeout:30000}).toBe(true);
 assert.ok((await state())!.documents.every(d=>d.reason==='ai-consent-required'));
 assert.equal(setupRequests,0);assert.equal(liveRequests.length,0);
 await popup.evaluate(async()=>{
  const key='redflag.preferences.v1',prefs=(await chrome.storage.local.get(key))[key] as RedFlagPreferences,now=new Date().toISOString();
  prefs.aiConsent={enabled:true,grantedAt:now,updatedAt:now,noticeVersion:'2026-10-11-v1'};
  await chrome.storage.local.set({[key]:prefs});
 });
 await expect.poll(()=>setupRequests,{timeout:20000}).toBe(2);
 await expect.poll(idle,{timeout:20000}).toBe(true);
 assert.ok((await state())!.documents.every(d=>d.failure?.stage==='analysis'&&!d.assessment));
 await popup.evaluate(async tabId=>{await chrome.tabs.update(tabId,{active:true});},tabId);
 await popup.goto(`chrome-extension://${id}/popup.html`);
 await expect(popup.locator('.overall-copy h2')).toHaveText('service.com');
 await expect(popup.locator('#onboarding')).toBeHidden();
 const individual=popup.getByRole('button',{name:'Analyze Terms of service',exact:true});
 await expect(individual).toBeEnabled();
 phase='individual';await individual.click();
 await expect.poll(()=>liveRequests.filter(r=>r.phase==='individual').length,{timeout:15000}).toBe(1);
 await expect.poll(idle,{timeout:65000}).toBe(true);
 await expect(individual).toBeEnabled();
 const individualResult=(await state())!.documents.find(d=>d.document.kind==='terms')!;
 assert.equal(liveRequests.length,1);
 phase='all';await popup.getByRole('button',{name:'Analyze all policies',exact:true}).click();
 await expect.poll(()=>liveRequests.filter(r=>r.phase==='all').length,{timeout:20000}).toBe(2);
 await expect.poll(idle,{timeout:65000}).toBe(true);
 await expect(popup.getByRole('button',{name:'Analyze all policies',exact:true})).toBeEnabled();
 const final=(await state())!;
 assert.equal(liveRequests.length,3);assert.equal(pageErrors,0);assert.equal(await page.locator('#agree').isChecked(),false);
 assert.deepEqual(final.documents.map(d=>d.document.url).sort(),[terms,privacy].sort());
 const failures=[{phase:'individual',review:individualResult},...final.documents.map(review=>({phase:'all',review}))].filter(({review})=>upstreamFailure(review.assessment)).map(({phase,review})=>({phase,kind:review.document.kind,reason:review.reason??'transport-unavailable',stage:review.failure?.stage??'analysis'}));
 console.log(JSON.stringify({liveCheck:true,popupButtons:'individual Analyze and Analyze all',discoveryScreen:'controlled fixture',documentsAndGemini:'live',profile,model:config.model,setupAutoAnalysesSuppressed:setupRequests,liveAnalysisRequests:liveRequests.length,pageErrors,consentControlUntouched:true,individual:outcome({...final,documents:[individualResult]}),documents:outcome(final),upstreamFailures:failures,completedWithoutUpstreamFailure:failures.length===0}));
 if(failures.length)process.exitCode=1;
}finally{
 await context?.close();
 if(server?.listening){server.closeAllConnections();await new Promise<void>(r=>server!.close(()=>r()));}
 await rm(root,{recursive:true,force:true});
}
