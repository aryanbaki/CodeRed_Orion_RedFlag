// Actual MV3 queue and toolbar; deterministic public-document/AI responses are mocked.
import {chromium,expect} from '@playwright/test';
import {mkdtemp,rm,cp,readFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join,resolve} from 'node:path';import assert from 'node:assert/strict';
const root=await mkdtemp(join(tmpdir(),'redflag-actions-'));let context;
try {
 const extension=join(root,'extension');await cp(resolve('dist/extension'),extension,{recursive:true});
 const manifest=JSON.parse(await readFile(join(extension,'manifest.json'),'utf8'));manifest.host_permissions=['https://service.com/*','https://documents.org/*'];await writeFile(join(extension,'manifest.json'),JSON.stringify(manifest));
 context=await chromium.launchPersistentContext(join(root,'profile'),{channel:'chromium',headless:true,args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`]});
 const worker=context.serviceWorkers()[0]??await context.waitForEvent('serviceworker');const id=new URL(worker.url()).host;
 await worker.evaluate(()=>{
   const originalFetch=globalThis.fetch;
   globalThis.requests=[];globalThis.hold=false;globalThis.active=0;globalThis.maximum=0;globalThis.policyVersion=1;
   const timer=globalThis.setTimeout;globalThis.setTimeout=(fn,ms,...args)=>timer(fn,ms===30000 ? 200 : ms,...args);
   globalThis.fetch=async(url,init)=>{
     if(!/^https?:/.test(String(url)))return originalFetch(url,init);
     const path=new URL(url).pathname;requests.push({url:String(url),credentials:init?.credentials,body:init?.body});
     if(path==='/api/health')return Response.json({schemaVersion:1,model:'gemini-test',fallbackModels:[],promptVersion:'redflag.prompt.v2',rubricVersion:'redflag.rubric.v3'});
     if(path==='/api/analyze') {
       active++;maximum=Math.max(maximum,active);
       try {
         if(hold) return await new Promise(()=>{});
         await new Promise(r=>timer(r,20));const doc=JSON.parse(init.body).document;
         if(doc.url.endsWith('/quota')) return new Response('{}',{status:429,headers:{'Retry-After':'1'}});
         if(doc.url.endsWith('/backend-auth')) return new Response('{}',{status:401});
         return new Response(JSON.stringify({schemaVersion:1,assessment:{documentId:doc.id,documentUrl:doc.url,kind:doc.kind,grade:doc.kind==='privacy'?'B':'E',coverage:doc.coverage,contentHash:doc.contentHash,provider:'gemini',model:'gemini-test',promptVersion:'redflag.prompt.v2',rubricVersion:'redflag.rubric.v3',analyzedAt:new Date().toISOString(),summary:'Synthetic supported finding',findings:[{id:'f1',category:'retention',severity:'high',title:'Retention concern',explanation:'Records retained indefinitely.',quote:'We retain your information indefinitely.',sourceUrl:doc.url}]}}),{headers:{'content-type':'application/json'}});
       } finally {active--;}
     }
     if(path==='/auth') return new Response('Authentication required',{status:401,headers:{'content-type':'text/plain'}});
     return new Response(`We retain your information indefinitely. This is a synthetic legal document fixture version ${policyVersion}, not a real website review.`,{headers:{'content-type':'text/plain'}});
   };
 });
 const controls=await context.newPage();await controls.goto(`chrome-extension://${id}/popup.html`);
 await controls.evaluate(async()=>{
  const now=new Date().toISOString();await chrome.storage.local.set({'redflag.backend.v1':{baseUrl:'https://documents.org',accessToken:'synthetic-backend-access-token-123456',model:'gemini-test',promptVersion:'redflag.prompt.v2',rubricVersion:'redflag.rubric.v3'},'redflag.preferences.v1':{schemaVersion:1,enabled:true,priorities:[],aiConsent:{enabled:false,updatedAt:now,noticeVersion:'2026-10-11-v1'}}});
 });
 const page=await context.newPage();const fixture='<form><h1>Signup</h1><input id="email"><label><input id="agree" type="checkbox">I agree to <a href="/terms">Terms of Service</a> and <a href="https://documents.org/privacy">Privacy Policy</a></label><button>Continue</button></form>';
 await context.route('https://service.com/**',route=>route.fulfill({body:fixture,contentType:'text/html'}));
 await page.goto('https://service.com/signup');
 const tabId=await controls.evaluate(async()=> (await chrome.tabs.query({url:'https://service.com/signup'}))[0].id);
 const state=()=>controls.evaluate(async tabId=>(await chrome.storage.session.get('redflag.jobs.v1'))['redflag.jobs.v1'].sessions[tabId]?.state,tabId);
 const action=(mode,documentId)=>controls.evaluate(async ({mode,documentId,tabId})=>{const state=(await chrome.storage.session.get('redflag.jobs.v1'))['redflag.jobs.v1'].sessions[tabId].state;return chrome.runtime.sendMessage({type:'redflag/analyze',mode,pageKey:state.pageKey,documentId,tabId});},{mode,documentId,tabId});
 await expect.poll(async()=> (await state())?.documents.every(d=>d.reason==='ai-consent-required')).toBe(true);
 assert.equal(await worker.evaluate(()=>requests.filter(r=>r.url.endsWith('/api/analyze')).length),0);
 const untrusted=await controls.evaluate(async tabId=>{const [result]=await chrome.scripting.executeScript({target:{tabId},func:async()=>chrome.runtime.sendMessage({type:'redflag/analyze',mode:'all',pageKey:'forged'})});return result.result;},tabId);assert.equal(untrusted.code,'untrusted');
 const first=await action('all');assert.equal(first.ok,true);assert.equal(first.queuedDocumentIds.length,2);
 await expect.poll(async()=> (await state()).documents.every(d=>d.status!=='pending')).toBe(true);
 assert.equal(await worker.evaluate(()=>requests.filter(r=>r.url.endsWith('/api/analyze')).length),0);
 await controls.evaluate(async()=>{const prefs=(await chrome.storage.local.get('redflag.preferences.v1'))['redflag.preferences.v1'];prefs.aiConsent.enabled=true;prefs.aiConsent.grantedAt=new Date().toISOString();await chrome.storage.local.set({'redflag.preferences.v1':prefs});});
 await expect.poll(async()=> (await state()).documents.every(d=>d.status==='ready')).toBe(true);
 assert.equal(await worker.evaluate(()=>maximum),2);
 await expect.poll(()=>worker.evaluate(async tabId=>chrome.action.getBadgeText({tabId}),tabId)).toBe('E');
 // Exercise the real popup controls against the actual worker, keeping the site tab active.
 await controls.evaluate(async tabId=>chrome.tabs.update(tabId,{active:true}),tabId);
 await controls.reload();
 await expect(controls.locator('#compact-review')).toContainText('Gemini policy review');
 await controls.getByRole('button',{name:'Analyze Terms of service',exact:true}).click();
 await expect.poll(async()=> (await state()).documents.every(d=>d.status==='ready')).toBe(true);
 const beforeRecheck=await worker.evaluate(()=>requests.filter(r=>r.url.endsWith('/api/analyze')).length);
 await controls.locator('#recheck').click();
 await expect.poll(()=>worker.evaluate(()=>requests.filter(r=>r.url.endsWith('/api/analyze')).length)).toBeGreaterThanOrEqual(beforeRecheck+2);
 await expect.poll(async()=> (await state()).documents.every(d=>d.status==='ready')).toBe(true);
 await expect(controls.locator('#recent-items')).toContainText('service.com');
 const before=await worker.evaluate(()=>requests.filter(r=>r.url.endsWith('/api/analyze')).length);const oneId=(await state()).documents[0].document.id;
 assert.equal((await action('one',oneId)).ok,true);await expect.poll(async()=> (await state()).documents.every(d=>d.status==='ready')).toBe(true);
 assert.equal(await worker.evaluate(()=>requests.filter(r=>r.url.endsWith('/api/analyze')).length),before);
 const recheck=await action('recheck');const duplicate=await action('recheck');assert.equal(recheck.queuedDocumentIds.length,2);assert.equal(duplicate.joinedDocumentIds.length,2);
 await controls.close();await expect.poll(async()=>worker.evaluate(async tabId=>(await chrome.storage.session.get('redflag.jobs.v1'))['redflag.jobs.v1'].sessions[tabId]?.state.documents.every(d=>d.status==='ready'),tabId)).toBe(true);
 const reopened=await context.newPage();await reopened.goto(`chrome-extension://${id}/popup.html`);
 const get=()=>reopened.evaluate(async tabId=>(await chrome.storage.session.get('redflag.jobs.v1'))['redflag.jobs.v1'].sessions[tabId]?.state,tabId);
 assert.equal(await worker.evaluate(()=>requests.filter(r=>r.url.endsWith('/api/analyze')).length),before+2);
 await page.evaluate(()=>{window.events=[];for(const name of ['click','change','submit'])document.addEventListener(name,()=>events.push(name));const div=document.createElement('div');div.setAttribute('role','dialog');div.innerHTML='<p>By continuing you agree to <a href="/auth">Additional Terms</a>, <a href="/quota">Additional Terms</a>, <a href="/backend-auth">Terms of Use</a>, <a href="https://unpermitted.com/privacy">Privacy Policy</a>.</p>';document.body.append(div);});
 await expect.poll(async()=> (await get())?.documents.length).toBe(6);await expect.poll(async()=> (await get()).documents.every(d=>d.status!=='pending')).toBe(true);
 const mixed=await get();assert.equal(mixed.documents.find(d=>d.document.url.endsWith('/terms')).grade,'E');
 assert.equal(mixed.documents.find(d=>d.document.url.endsWith('/auth')).failure.stage,'retrieval');assert.equal(mixed.documents.find(d=>d.document.url.endsWith('/backend-auth')).failure.stage,'analysis');
 assert.equal(mixed.documents.find(d=>d.document.url.endsWith('/quota')).failure.retryAfterSeconds,1);assert.equal(mixed.documents.find(d=>d.document.url.includes('unpermitted')).reason,'permission-required');
 await expect.poll(()=>worker.evaluate(async tabId=>chrome.action.getBadgeText({tabId}),tabId)).toBe('');
 assert.deepEqual(await page.evaluate(()=>events),[]);assert.equal(await page.locator('#agree').isChecked(),false);
 await page.waitForTimeout(1100);
 const staleKey=mixed.pageKey;await worker.evaluate(()=>{globalThis.hold=true;});
 const terms=mixed.documents.find(d=>d.document.kind==='terms');
 const sent=await reopened.evaluate(async ({tabId,pageKey,documentId})=>chrome.runtime.sendMessage({type:'redflag/analyze',mode:'one',tabId,pageKey,documentId}),{tabId,pageKey:staleKey,documentId:terms.document.id});assert.equal(sent.ok,true);
 // Uses valid cache, so force fresh check to exercise bounded stalled transport.
 await reopened.evaluate(async ({tabId,pageKey})=>chrome.runtime.sendMessage({type:'redflag/analyze',mode:'recheck',tabId,pageKey}),{tabId,pageKey:staleKey});
 await expect.poll(async()=> (await get()).documents.some(d=>d.reason==='timeout')).toBe(true);
 await worker.evaluate(()=>{globalThis.hold=false;});
 await page.goto('https://service.com/new-signup');
 const rejection=await reopened.evaluate(async ({tabId,pageKey})=>chrome.runtime.sendMessage({type:'redflag/analyze',mode:'all',tabId,pageKey}),{tabId,pageKey:staleKey});assert.equal(rejection.ok,false);assert.ok(['stale-page','no-review'].includes(rejection.code));
 await expect.poll(async()=> (await get())?.documents.every(d=>d.status==='ready')).toBe(true);
 const other=await context.newPage();await other.goto('https://service.com/empty');await other.evaluate(()=>document.querySelector('form').remove());
 const otherId=await reopened.evaluate(async()=> (await chrome.tabs.query({url:'https://service.com/empty'}))[0].id);
 await expect.poll(()=>worker.evaluate(async tabId=>chrome.action.getBadgeText({tabId}),otherId)).toBe('');
 // The unknown badge can precede the debounced removal discovery; wait for that state too.
 await expect.poll(()=>worker.evaluate(async tabId=>(await chrome.storage.session.get('redflag.jobs.v1'))['redflag.jobs.v1'].sessions[tabId]?.state.documents.length,otherId)).toBe(0);
 await page.bringToFront();await expect.poll(()=>worker.evaluate(async tabId=>chrome.action.getBadgeText({tabId}),tabId)).toBe('E');
 await reopened.reload();
 await expect(reopened.locator('#compact-review')).toContainText('Gemini policy review');
 const summaryOpened=context.waitForEvent('page');await reopened.locator('#open-summary').click();const summaryTab=await summaryOpened;await summaryTab.waitForLoadState();assert.equal(new URL(summaryTab.url()).hash,'');await expect(summaryTab.locator('main')).toContainText('service.com');
 const recentOpened=context.waitForEvent('page');await reopened.getByRole('button',{name:'Open saved review for service.com',exact:true}).click();const recentTab=await recentOpened;await recentTab.waitForLoadState();assert.equal(new URL(recentTab.url()).hash,'#site=https%3A%2F%2Fservice.com');
 const savedOrigin='https://service.com';
 const detached=await reopened.evaluate(async siteOrigin=>chrome.runtime.sendMessage({type:'redflag/recheck-site',siteOrigin}),savedOrigin);assert.equal(detached.ok,true);
 await expect.poll(async()=>reopened.evaluate(async()=>{const sites=(await chrome.storage.local.get('redflag.history.v1'))['redflag.history.v1'].sites;return sites.find(s=>s.origin==='https://service.com')?.documents.every(d=>d.status!=='pending');})).toBe(true);
 const missingSaved=await reopened.evaluate(async()=>chrome.runtime.sendMessage({type:'redflag/recheck-site',siteOrigin:'https://deleted.com'}));assert.equal(missingSaved.code,'history-unavailable');

 await worker.evaluate(()=>{globalThis.hold=true;});
 const delayedSaved=await reopened.evaluate(async siteOrigin=>chrome.runtime.sendMessage({type:'redflag/recheck-site',siteOrigin}),savedOrigin);assert.equal(delayedSaved.ok,true);
 // Match the history API lock so dashboard normalization cannot overwrite test tombstones.
 await reopened.evaluate(async()=>navigator.locks.request('redflag-history-v1',async()=>{const key='redflag.history.v1',data=(await chrome.storage.local.get(key))[key];data.deleted.push(...data.sites.map(s=>({origin:s.origin,generation:s.generation,at:new Date().toISOString()})));data.sites=[];await chrome.storage.local.set({[key]:data});}));
 await page.waitForTimeout(500);
 assert.equal(await reopened.evaluate(async()=> (await chrome.storage.local.get('redflag.history.v1'))['redflag.history.v1'].sites.length),0);
 const deletedRecheck=await reopened.evaluate(async siteOrigin=>chrome.runtime.sendMessage({type:'redflag/recheck-site',siteOrigin}),savedOrigin);assert.equal(deletedRecheck.code,'history-unavailable');
 await reopened.evaluate(async ({tabId})=>{const state=(await chrome.storage.session.get('redflag.jobs.v1'))['redflag.jobs.v1'].sessions[tabId].state;return chrome.runtime.sendMessage({type:'redflag/analyze',mode:'recheck',tabId,pageKey:state.pageKey});},{tabId});
 await page.goto('about:blank');
 await expect.poll(()=>worker.evaluate(async tabId=>chrome.action.getBadgeText({tabId}),tabId)).toBe('');
 await page.waitForTimeout(500);assert.equal(await get(),undefined);
 assert.equal(await worker.evaluate(async tabId=>chrome.action.getBadgeText({tabId}),tabId),'');
 const requests=await worker.evaluate(()=>globalThis.requests);assert.ok(requests.every(r=>r.credentials==='omit'));assert.ok(requests.every(r=>!r.body?.includes('email')));
 console.log('Actions browser checks passed: actual worker one/all/recheck, cache, duplicate joining, bounded concurrency/timeout, independent mixed failures, AI disabled, permissions, popup close/reopen, stale generation and per-tab badges; public responses and Gemini mocked.');
}finally{await context?.close();await rm(root,{recursive:true,force:true});}
