import {chromium,expect} from '@playwright/test';
import {build} from 'esbuild';
import {mkdtemp,rm,cp,readFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve,join} from 'node:path';
import assert from 'node:assert/strict';
const root = await mkdtemp(join(tmpdir(),'redflag-discovery-'));
let context;
let withOverview=false;
try {await readFile('src/ui/overview.ts');withOverview=true;} catch {}
try {
  const extension=join(root,'extension');await cp(resolve('dist/extension'),extension,{recursive:true});
  const manifest=JSON.parse(await readFile(join(extension,'manifest.json'),'utf8'));
  // Test-only initial permissions; normal builds retain optional grants.
  manifest.host_permissions=['https://service.com/*','https://documents.org/*'];
  await writeFile(join(extension,'manifest.json'),JSON.stringify(manifest));
  const helper=await build({stdin:{contents:"import {discoverLegalLinks,observeLegalLinks} from './src/discovery/dom.ts'; import {extractLegalText} from './src/background/extraction.ts'; window.testRedFlag={discoverLegalLinks,observeLegalLinks,extractLegalText};",resolveDir:process.cwd()},bundle:true,format:'iife',write:false});
  context=await chromium.launchPersistentContext(join(root,'profile'),{channel:'chromium',headless:true,args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`]});
  let worker=context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
  const id=new URL(worker.url()).host;
  await worker.evaluate(async () => {
    globalThis.testEpoch='initial';globalThis.requests=[];
    const nativeFetch=globalThis.fetch;
    globalThis.fetch=async (url,init) => {
      if(!String(url).startsWith('https:')&&!String(url).startsWith('http:'))return nativeFetch(url,init);
      globalThis.requests.push({url:String(url),credentials:init?.credentials,body:init?.body});
      if (String(url).endsWith('/api/analyze')) {
        if (globalThis.holdAi) return new Promise(() => {});
        const request=JSON.parse(init.body),doc=request.document;
        return new Response(JSON.stringify({schemaVersion:1,assessment:{documentId:doc.id,documentUrl:doc.url,kind:doc.kind,grade:'Unrated',reason:'incomplete',coverage:doc.coverage,findings:[],summary:'Partial evidence',provider:'gemini',analyzedAt:new Date().toISOString(),model:'gemini-test',promptVersion:'redflag.prompt.v2',rubricVersion:'redflag.rubric.v3',contentHash:doc.contentHash}}),{headers:{'content-type':'application/json'}});
      }
      if (String(url).endsWith('/suspend')) return new Promise(() => {});
      if (String(url).endsWith('/missing')) return new Response('Missing',{status:404,headers:{'content-type':'text/plain'}});
      if (String(url).endsWith('/auth')) return new Response('Sign in',{status:401,headers:{'content-type':'text/plain'}});
      if (String(url).endsWith('/redirect')) return new Response(null,{status:302,headers:{location:'http://127.0.0.1/private'}});
      return new Response('<main><h1>Public policy</h1><p>We retain your information indefinitely. We do not sell private account information. Public policy clauses apply to this service.</p><form><input value="private-account"><textarea>private-form-value</textarea></form><script>private-script-value</script></main>',{headers:{'content-type':'text/html'}});
    };
  });
  await expect.poll(async () => worker.evaluate(async () => (await chrome.scripting.getRegisteredContentScripts()).length)).toBe(1);
  const popup=await context.newPage();await popup.goto(`chrome-extension://${id}/popup.html`);
  const page=await context.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const fixture = `<main><form><h1>Create an account</h1><input value="private-account"><input type="checkbox" id="agree"><label for="agree">I agree to <a href="/terms#top">Terms of Service</a>, <a href="/use">Terms of Use</a>, <a href="/conditions">Terms &amp; Conditions</a>, <a href="https://documents.org/privacy">Privacy Policy</a>, <a href="/additional">Additional Terms</a>, <a href="/terms">Terms of Service</a>.</label><button>Sign up</button></form><a href="/unrelated">About us</a></main>`;
  await context.route('https://service.com/**',route => route.fulfill({body:fixture,contentType:'text/html'}));
  const getState=() => popup.evaluate(async () => (await chrome.runtime.sendMessage({type:'redflag/get-state'})).state);
  for (const [path,kind] of [['signup','signup'],['checkout','checkout'],['onboarding','onboarding'],['consent','consent']]) {
    await page.goto('https://service.com/'+path);
    await expect.poll(async () => (await getState())?.documents.length).toBe(5);
    await expect.poll(async () => (await getState())?.documents.every(d=>d.status==='unrated')).toBe(true);
    const state=await getState();assert.equal(state.context,kind);assert.ok(state.documents.every(d=>d.reason==='ai-consent-required'));assert.equal(state.documents.filter(d=>d.document.kind==='terms').length,3);
    if(withOverview){await expect(page.getByRole('region',{name:'RedFlag agreement review'})).toBeVisible();await expect(page.getByRole('region',{name:'RedFlag agreement review'})).toContainText('Overall grade');await expect(page.getByRole('region',{name:'RedFlag agreement review'}).locator('.overall-grade')).toHaveText('?');}
    assert.equal(await page.locator('#agree').isChecked(),false);assert.equal(page.url(),'https://service.com/'+path);
  }
  const oldPageKey=(await getState()).pageKey;
  await page.evaluate(()=>history.pushState({},'', '/onboarding-next'));
  await expect.poll(async()=> (await getState())?.pageUrl).toBe('https://service.com/onboarding-next');
  assert.notEqual((await getState()).pageKey,oldPageKey);
  await expect.poll(async()=> (await getState())?.documents.every(d=>d.status!=='pending')).toBe(true);
  const before=await worker.evaluate(() => requests.length);
  await page.evaluate(() => {window.siteEvents=[];document.addEventListener('click',e=>siteEvents.push(e.target.tagName));document.addEventListener('submit',()=>siteEvents.push('submit'));document.addEventListener('change',()=>siteEvents.push('change'));});
  await page.evaluate(() => {const dialog=document.createElement('div');dialog.setAttribute('role','dialog');dialog.innerHTML='<h2>Consent: by continuing you agree</h2><a href="/missing">Additional Terms</a><a href="/auth">Terms of Use</a><a href="/redirect">Terms and Conditions</a><a href="https://unpermitted.com/privacy">Privacy Policy</a>';document.body.append(dialog);});
  await expect.poll(async () => (await getState())?.documents.length).toBe(9);
  await expect.poll(async () => (await getState())?.documents.every(d=>d.status!=='pending')).toBe(true);
  const failed=(await getState()).documents;
  assert.equal(failed.find(d=>d.document.url.endsWith('/missing')).reason,'inaccessible');
  assert.equal(failed.find(d=>d.document.url.endsWith('/auth')).reason,'authentication-required');
  assert.equal(failed.find(d=>d.document.url.endsWith('/redirect')).reason,'inaccessible');
  assert.equal(failed.find(d=>d.document.url.includes('unpermitted')).reason,'permission-required');
  assert.deepEqual(await page.evaluate(()=>siteEvents),[]);
  assert.equal(await page.locator('#agree').isChecked(),false);
  await page.evaluate(() => {for(let i=0;i<50;i++){const div=document.createElement('div');div.innerHTML='<a href="/unrelated">Other page</a>';document.body.append(div);}});
  await new Promise(r=>setTimeout(r,250));assert.equal(await worker.evaluate(()=>requests.length),before+3);
  await page.locator('a[href="/additional"]').evaluate(e=>e.setAttribute('href','/new-additional'));
  await expect.poll(async () => (await getState())?.documents.some(d=>d.document.url.endsWith('/new-additional'))).toBe(true);
  assert.equal((await getState()).documents.some(d=>d.document.url.endsWith('/additional')),false);
  const requests=await worker.evaluate(()=>globalThis.requests);
  assert.ok(requests.every(r=>r.credentials==='omit'));assert.ok(requests.every(r=>r.body===undefined));assert.ok(!JSON.stringify(requests).includes('private-account'));
  // Check DOM extraction and accessible-name discovery in the actual browser DOM.
  await page.addScriptTag({content:helper.outputFiles[0].text});
  const extraction=await page.evaluate(()=>testRedFlag.extractLegalText('<main><p>We retain public document information indefinitely and use it only for the purposes described in this agreement.</p><input value="secret"><textarea>private form text</textarea></main>','html',new DOMParser()));
  assert.equal(extraction.coverage,'partial');assert.ok(!extraction.text.includes('secret'));assert.ok(!extraction.text.includes('private form'));
  await page.evaluate(()=>{const form=document.createElement('form');form.innerHTML='<h2>Checkout: by proceeding you agree</h2><span id="privacy-name">Privacy Policy</span><a href="/accessible" aria-labelledby="privacy-name">Read</a>';document.body.append(form);});
  const discovered=await page.evaluate(()=>testRedFlag.discoverLegalLinks(document,document.baseURI).map(({element,...link})=>link));
  assert.ok(discovered.some(d=>d.url.endsWith('/accessible') && d.kind==='privacy'));
  // Consented transport is simulated; verify transmitted text and revocation.
  await popup.evaluate(async()=>{
    const now=new Date().toISOString();
    await chrome.storage.local.set({'redflag.backend.v1':{baseUrl:'https://documents.org',accessToken:'synthetic-backend-access-token-123456',model:'gemini-test',promptVersion:'redflag.prompt.v2',rubricVersion:'redflag.rubric.v3'},'redflag.preferences.v1':{schemaVersion:1,enabled:true,priorities:[],aiConsent:{enabled:true,grantedAt:now,updatedAt:now,noticeVersion:'2026-10-11-v1'}}});
  });
  await expect.poll(async()=>worker.evaluate(()=>requests.filter(r=>r.url.endsWith('/api/analyze')).length)).toBeGreaterThan(0);
  await expect.poll(async()=> (await getState())?.documents.filter(d=>d.assessment).length).toBeGreaterThan(0);
  const transmissions=await worker.evaluate(()=>requests.filter(r=>r.url.endsWith('/api/analyze')));
  assert.ok(transmissions.every(r=>!r.body.includes('private-account')&&!r.body.includes('private-form-value')&&!r.body.includes('private-script-value')));
  for(const r of transmissions){const body=JSON.parse(r.body);assert.deepEqual(Object.keys(body).sort(),['document','schemaVersion']);assert.ok(body.document.url.includes('/'));assert.equal(body.document.coverage,'partial');}
  await worker.evaluate(()=>{globalThis.holdAi=true;});
  const sentBefore=await worker.evaluate(()=>requests.filter(r=>r.url.endsWith('/api/analyze')).length);
  await page.evaluate(()=>{const form=document.createElement('form');form.innerHTML='<p>Consent: I agree to <a href="/delayed">Additional Terms</a></p>';document.body.append(form);});
  await expect.poll(async()=>worker.evaluate(()=>requests.filter(r=>r.url.endsWith('/api/analyze')).length)).toBeGreaterThan(sentBefore);
  await page.locator('input:not([type])').fill('user can keep browsing');
  await popup.evaluate(async()=>{const value=(await chrome.storage.local.get('redflag.preferences.v1'))['redflag.preferences.v1'];value.aiConsent.enabled=false;value.aiConsent.updatedAt=new Date().toISOString();await chrome.storage.local.set({'redflag.preferences.v1':value});});
  await expect.poll(async()=> (await getState())?.documents.find(d=>d.document.url.endsWith('/delayed'))?.reason).toBe('ai-consent-required');
  const afterRevocation=await worker.evaluate(()=>requests.filter(r=>r.url.endsWith('/api/analyze')).length);
  await page.evaluate(()=>{const form=document.createElement('form');form.innerHTML='<p>Consent: I agree to <a href="/revoked">Additional Terms</a></p>';document.body.append(form);});
  await expect.poll(async()=> (await getState())?.documents.find(d=>d.document.url.endsWith('/revoked'))?.reason).toBe('ai-consent-required');
  assert.equal(await worker.evaluate(()=>requests.filter(r=>r.url.endsWith('/api/analyze')).length),afterRevocation);
  if(withOverview){await page.getByRole('button',{name:'Dismiss',exact:true}).click();await expect(page.locator('[data-redflag-ui]')).toHaveCount(0);}
  // Native worker suspension/restart: session storage preserves job/state data.
  await expect.poll(async()=> (await getState())?.documents.every(d=>d.status!=='pending')).toBe(true);
  await page.evaluate(()=>{const form=document.createElement('form');form.innerHTML='<p>Consent: I agree to <a href="/suspend">Additional Terms</a></p>';document.body.append(form);});
  await expect.poll(async()=>worker.evaluate(async()=> (await chrome.storage.session.get('redflag.jobs.v1'))['redflag.jobs.v1'].jobs.some(j=>j.attempts===1))).toBe(true);
  const saved=(await getState()).pageKey;
  const cdp=await context.newCDPSession(page);await cdp.send('ServiceWorker.enable');
  await context.setOffline(true);
  await cdp.send('ServiceWorker.stopAllWorkers');
  const recovered=await getState();assert.equal(recovered.pageKey,saved);
  await expect.poll(async()=> (await getState())?.documents.find(d=>d.document.url.endsWith('/suspend'))?.status,{timeout:15000}).toBe('unrated');
  assert.ok(['network-error','timeout','incomplete'].includes((await getState()).documents.find(d=>d.document.url.endsWith('/suspend')).reason));
  assert.equal((await getState()).documents.find(d=>d.document.url.endsWith('/suspend')).assessment,undefined);
  assert.equal(await worker.evaluate(()=>typeof globalThis.testEpoch),'undefined');
  assert.equal(await popup.evaluate(async()=> (await chrome.storage.session.get('redflag.jobs.v1'))['redflag.jobs.v1'].jobs.length),0);
  if(withOverview) await expect(page.locator('[data-redflag-ui]')).toHaveCount(0);
  assert.deepEqual(errors,[]);
  console.log('Discovery browser checks passed: four consent flows, five legal labels, dynamic dialogs/link replacement, independent failure states, credentials omitted, no control events, accessible names, inert extraction, consented transport/revocation, responsive browsing, in-flight worker suspension/recovery. Retrieval is simulated; no live AI/provider call.');
} finally {await context?.close();await rm(root,{recursive:true,force:true});}
