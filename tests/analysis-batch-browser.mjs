// Actual MV3 background regression. Public documents and Gemini are synthetic.
import {chromium,expect} from '@playwright/test';
import {mkdtemp,rm,cp,readFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import assert from 'node:assert/strict';
const root=await mkdtemp(join(tmpdir(),'redflag-batch-'));let context;
try{
 const extension=join(root,'extension');await cp(resolve('dist/extension'),extension,{recursive:true});
 const manifest=JSON.parse(await readFile(join(extension,'manifest.json'),'utf8'));manifest.host_permissions=['https://service.com/*','https://empty.service.com/*','https://documents.org/*'];await writeFile(join(extension,'manifest.json'),JSON.stringify(manifest));
 context=await chromium.launchPersistentContext(join(root,'profile'),{channel:'chromium',headless:true,args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`]});
 const worker=context.serviceWorkers()[0]??await context.waitForEvent('serviceworker'),id=new URL(worker.url()).host;
 await worker.evaluate(()=>{
  const originalFetch=globalThis.fetch;
  globalThis.calls=[];globalThis.heldCommon=[];globalThis.heldAi=[];globalThis.holdCommon=false;globalThis.holdAi=false;
  const policy=path=>(path==='/privacy'?'Privacy Policy. ':path==='/cookie-policy'?'Cookie Policy. ':path==='/terms'?'Terms of Service. ':'')+'We retain your information indefinitely. This complete public legal document is a synthetic browser regression fixture.';
  globalThis.fetch=async(url,init)=>{
   if(!/^https?:/.test(String(url)))return originalFetch(url,init);
   const target=new URL(String(url)),path=target.pathname;
   if(target.hostname==='api.tosdr.org')return Response.json({services:[]});
   if(path==='/api/health')return Response.json({schemaVersion:1,model:'gemini-test',fallbackModels:[],promptVersion:'redflag.prompt.v2',rubricVersion:'redflag.rubric.v3'});
   if(path==='/api/analyze'){
    const doc=JSON.parse(init.body).document;calls.push({url:doc.url,kind:doc.kind});
    if(holdAi)await new Promise(resolve=>heldAi.push(resolve));
    return Response.json({schemaVersion:1,assessment:{documentId:doc.id,documentUrl:doc.url,kind:doc.kind,grade:doc.kind==='privacy'?'B':'D',coverage:doc.coverage,contentHash:doc.contentHash,provider:'gemini',model:'gemini-test',promptVersion:'redflag.prompt.v2',rubricVersion:'redflag.rubric.v3',analyzedAt:new Date().toISOString(),summary:'Explicit synthetic retention evidence.',findings:[{id:'retention',category:'retention',severity:'high',title:'Retention',explanation:'Indefinite retention is explicit.',quote:'We retain your information indefinitely.',sourceUrl:doc.url}]}});
   }
   if(path==='/missing')return new Response('Private source',{status:401,headers:{'content-type':'text/plain'}});
   if(holdCommon&&['/terms','/privacy','/cookie-policy'].includes(path))await new Promise(resolve=>heldCommon.push(resolve));
   return new Response(policy(path),{headers:{'content-type':'text/plain'}});
  };
 });
 const control=await context.newPage();await control.goto(`chrome-extension://${id}/data.html`);
 await control.evaluate(async()=>{
  const now=new Date().toISOString();await chrome.storage.local.set({'redflag.onboarding.v1':true,'redflag.backend.v1':{baseUrl:'https://documents.org',accessToken:'synthetic-backend-access-token-123456',model:'gemini-test',promptVersion:'redflag.prompt.v2',rubricVersion:'redflag.rubric.v3'},'redflag.preferences.v1':{schemaVersion:1,enabled:true,priorities:[],aiConsent:{enabled:true,grantedAt:now,updatedAt:now,noticeVersion:'2026-10-11-v1'}}});
 });
 await context.route(/^https:\/\/(?:empty\.)?service\.com\//,route=>{
  const path=new URL(route.request().url()).pathname;
  const links=path==='/warm'?'<a href="/terms">Terms of service</a><a href="/privacy">Privacy policy</a><a href="/cookie-policy">Cookie policy</a>':path==='/review'?'<a href="/first-terms">Terms of service</a>':'';
  return route.fulfill({body:`<main><h1>Controlled site</h1></main><footer>${links}</footer>`,contentType:'text/html'});
 });
 const page=await context.newPage();await page.goto('https://service.com/warm');
 const tabId=await control.evaluate(async()=> (await chrome.tabs.query({url:'https://service.com/warm'}))[0].id);
 const snapshot=()=>control.evaluate(async()=> (await chrome.storage.session.get('redflag.jobs.v1'))['redflag.jobs.v1']);
 const state=async()=> (await snapshot())?.sessions[tabId]?.state;
 const idle=async()=>{const stored=await snapshot(),review=stored?.sessions[tabId]?.state;return !!review&&!review.discoveryPending&&!stored.jobs.some(j=>j.tabId===tabId)&&review.documents.every(d=>d.status!=='pending');};
 const action=async mode=>control.evaluate(async({tabId,mode})=>{const stored=(await chrome.storage.session.get('redflag.jobs.v1'))['redflag.jobs.v1'];return chrome.runtime.sendMessage({type:'redflag/analyze',mode,pageKey:stored.sessions[tabId].state.pageKey,tabId});},{tabId,mode});
 await expect.poll(async()=> (await state())?.documents.length).toBe(3);await expect.poll(idle).toBe(true);
 assert.equal(await worker.evaluate(()=>calls.length),3);
 // A second page discovers cached common policies after Analyze all has started.
 await worker.evaluate(()=>{holdCommon=true;});await page.goto('https://service.com/review');
 await expect.poll(async()=> (await state())?.documents.length).toBe(1);
 await expect.poll(async()=> (await state())?.documents[0].status).toBe('ready');
 assert.equal((await state()).discoveryPending,true);
 const before=await worker.evaluate(()=>calls.length);
 await worker.evaluate(()=>{holdAi=true;});const admitted=await action('recheck');assert.equal(admitted.ok,true);assert.equal(admitted.queuedDocumentIds.length,1);
 await expect.poll(()=>worker.evaluate(()=>heldAi.length)).toBe(1);
 await page.evaluate(()=>{const dialog=document.createElement('div');dialog.setAttribute('role','dialog');dialog.innerHTML='<a href="/missing">Additional Terms</a>';document.body.append(dialog);});
 await expect.poll(async()=> (await state())?.documents.length).toBe(2);
 await worker.evaluate(()=>{holdCommon=false;for(const resolve of heldCommon.splice(0))resolve();});
 await expect.poll(async()=> (await state())?.documents.length).toBe(4);
 await expect.poll(()=>worker.evaluate(()=>heldAi.length)).toBe(2);
 const identities=(await state()).documents.map(d=>d.document.id).sort();
 await page.evaluate(()=>{document.querySelector('footer').remove();document.querySelector('[role="dialog"]').remove();});
 await expect.poll(async()=> (await state()).documents.length).toBe(5);
 await worker.evaluate(()=>{holdAi=false;for(const resolve of heldAi.splice(0))resolve();});
 await expect.poll(idle).toBe(true);
 const completed=await state();assert.ok(identities.every(id=>completed.documents.some(d=>d.document.id===id)));
 assert.equal(completed.documents.find(d=>d.document.url.endsWith('/missing')).reason,'authentication-required');
 assert.equal(completed.documents.filter(d=>d.status==='ready').length,4);
 assert.equal(await worker.evaluate(()=>calls.length),before+4);
 assert.equal((await snapshot()).sessions[tabId].analysisMode,undefined);
 // Reappearing identical links keep their original identities and results.
 await page.evaluate(()=>{const footer=document.createElement('footer');footer.innerHTML='<a href="/first-terms">Terms of service</a><a href="/privacy">Privacy policy</a><a href="/cookie-policy">Cookie policy</a><a href="/missing">Additional Terms</a>';document.body.append(footer);});
 await page.waitForTimeout(300);assert.deepEqual((await state()).documents.map(d=>d.document.id).sort(),completed.documents.map(d=>d.document.id).sort());assert.equal(await worker.evaluate(()=>calls.length),before+4);
 // Zero-document admission preserves all-policy intent until common discovery resolves.
 await worker.evaluate(()=>{holdCommon=true;});await page.goto('https://empty.service.com/empty');
 await expect.poll(async()=> (await state())?.documents.length).toBe(0);assert.equal((await state()).discoveryPending,true);
 const empty=await action('all');assert.equal(empty.ok,true);assert.deepEqual(empty.queuedDocumentIds,[]);
 assert.equal((await snapshot()).sessions[tabId].analysisMode,'all');
 await worker.evaluate(()=>{holdCommon=false;for(const resolve of heldCommon.splice(0))resolve();});
 await expect.poll(async()=> (await state())?.documents.length).toBe(3);await expect.poll(idle).toBe(true);
 assert.equal((await snapshot()).sessions[tabId].analysisMode,undefined);
 assert.ok((await state()).documents.every(d=>d.status==='ready'));
 assert.ok(!(await state()).documents.some(d=>d.document.url.endsWith('/missing')));
 console.log('Analysis batch regression passed: all-policy late common discovery honors fresh mode, removed/reappearing dynamic links retain independent success/failure and stable IDs, empty pending Analyze all admits discovery, navigation resets the set; documents and Gemini are synthetic.');
}finally{await context?.close();await rm(root,{recursive:true,force:true});}
