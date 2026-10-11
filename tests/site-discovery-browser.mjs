// Actual Chromium MV3 discovery/permissions/actions; public responses are synthetic fixtures.
import {chromium,expect} from '@playwright/test';
import {mkdtemp,rm,cp,readFile,writeFile,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join,resolve} from 'node:path';import assert from 'node:assert/strict';
const root=await mkdtemp(join(tmpdir(),'redflag-site-discovery-'));let context;
try {
 const extension=join(root,'extension');await cp(resolve('dist/extension'),extension,{recursive:true});
 const manifest=JSON.parse(await readFile(join(extension,'manifest.json'),'utf8'));manifest.host_permissions=['https://service.com/*'];manifest.optional_host_permissions=['https://*/*'];await writeFile(join(extension,'manifest.json'),JSON.stringify(manifest));
 // Only optional-permission approval/events are fixtures; actual script injection remains browser-enforced.
 const permissionHarness=`globalThis.fixtureGrants=[];globalThis.fixtureAdded=[];globalThis.fixtureRemoved=[];
 const realGet=chrome.permissions.getAll.bind(chrome.permissions),realContains=chrome.permissions.contains.bind(chrome.permissions);
 chrome.permissions.getAll=async()=>{const value=await realGet();return {...value,origins:[...(value.origins??[]),...fixtureGrants]};};
 chrome.permissions.contains=async value=>(value.origins?.length && value.origins.every(p=>fixtureGrants.includes(p))) || await realContains(value);
 for(const [event,list] of [[chrome.permissions.onAdded,fixtureAdded],[chrome.permissions.onRemoved,fixtureRemoved]]){const add=event.addListener.bind(event);event.addListener=fn=>{list.push(fn);add(fn);};}
`;
 const background=join(extension,'background.js');await writeFile(background,permissionHarness+await readFile(background,'utf8'));
 context=await chromium.launchPersistentContext(join(root,'profile'),{channel:'chromium',headless:true,args:['--enable-unsafe-extension-debugging',`--disable-extensions-except=${extension}`,`--load-extension=${extension}`]});
 const worker=context.serviceWorkers()[0]??await context.waitForEvent('serviceworker');const id=new URL(worker.url()).host;
 await worker.evaluate(()=>{globalThis.requests=[];const nativeFetch=globalThis.fetch;globalThis.fetch=async(url,init)=>{if(!String(url).startsWith('https:')&&!String(url).startsWith('http:'))return nativeFetch(url,init);requests.push({url:String(url),credentials:init?.credentials,body:init?.body});return new Response('This synthetic public policy describes retention of information for a specific service purpose.',{headers:{'content-type':'text/plain'}});};});
 await expect.poll(()=>worker.evaluate(async()=> (await chrome.scripting.getRegisteredContentScripts()).length)).toBe(1);
 const controls=await context.newPage();await controls.goto(`chrome-extension://${id}/popup.html`);
 const ordinary='<main><h1>Repository</h1>'+Array.from({length:650},(_,i)=>`<a href="/issues/${i}">Issue ${i}</a>`).join('')+'</main><footer><a href="/terms">Terms</a><a href="https://documents.org/privacy">Privacy</a><a href="/blog/privacy">Privacy</a><a href="/settings/privacy">Privacy</a></footer>';
 await context.route('https://service.com/**',route=>route.fulfill({body:ordinary,contentType:'text/html'}));
 await context.route('https://ungranted.org/**',route=>route.fulfill({body:ordinary.replace('https://documents.org/privacy','/privacy'),contentType:'text/html'}));
 const page=await context.newPage();await page.goto('https://service.com/repository');
 const tabId=await controls.evaluate(async()=> (await chrome.tabs.query({url:'https://service.com/repository'}))[0].id);
 const get=()=>controls.evaluate(async tabId=>(await chrome.storage.session.get('redflag.jobs.v1'))['redflag.jobs.v1'].sessions[tabId]?.state,tabId);
 await expect.poll(async()=> (await get())?.documents.length).toBe(2);
 await expect.poll(async()=> !(await get()).discoveryPending && (await get()).documents.every(d=>d.status!=='pending')).toBe(true);
 assert.equal((await get()).context,'browsing');assert.equal((await get()).documents.find(d=>d.document.kind==='privacy').reason,'permission-required');
 await expect(page.locator('[data-redflag-ui]')).toHaveCount(0);
 await mkdir('dist/site-review-v4',{recursive:true});await page.screenshot({path:'dist/site-review-v4/reminder.png'});
 assert.equal(await worker.evaluate(()=>requests.filter(r=>r.body).length),0);
 const key=(await get()).pageKey,before=await worker.evaluate(()=>requests.length);
 for(let i=0;i<3;i++){const scan=await controls.evaluate(async tabId=>chrome.runtime.sendMessage({type:'redflag/scan-current',tabId}),tabId);assert.equal(scan.ok,true);assert.equal(scan.state.pageKey,key);}
 assert.equal(await worker.evaluate(()=>requests.length),before);
 const untrusted=await controls.evaluate(async tabId=>{const [result]=await chrome.scripting.executeScript({target:{tabId},func:async()=>chrome.runtime.sendMessage({type:'redflag/scan-current'})});return result.result;},tabId);assert.equal(untrusted.code,'untrusted');
 // A dialog with the same URLs must update consent context without duplicate retrieval.
 await page.evaluate(()=>{window.events=[];for(const name of ['click','submit','change'])document.addEventListener(name,()=>events.push(name));const form=document.createElement('form');form.id='consent';form.innerHTML='<p>By continuing you agree to <a href="/terms">Terms</a> and <a href="https://documents.org/privacy">Privacy</a>.</p><input type="checkbox" id="agree"><button>Continue</button>';document.body.append(form);});
 await expect.poll(async()=> (await get()).context).toBe('consent');await expect(page.locator('[data-redflag-ui]')).toHaveCount(0);
 assert.equal(await worker.evaluate(()=>requests.length),before);assert.equal(await page.locator('#agree').isChecked(),false);assert.deepEqual(await page.evaluate(()=>events),[]);
 await page.locator('#consent').evaluate(e=>e.remove());await expect.poll(async()=> (await get()).context).toBe('browsing');await expect(page.locator('[data-redflag-ui]')).toHaveCount(0);
 // Adding consent text beside unchanged legal links also changes context.
 await page.evaluate(()=>{const p=document.createElement('p');p.id='text-context';p.innerHTML='<a href="/terms">Terms</a>';document.body.append(p);});
 await page.waitForTimeout(200);assert.equal((await get()).context,'browsing');
 await page.evaluate(()=>document.querySelector('#text-context').prepend(document.createTextNode('By continuing you agree to ')));
 await expect.poll(async()=> (await get()).context).toBe('consent');await expect(page.locator('[data-redflag-ui]')).toHaveCount(0);
 await page.locator('#text-context').evaluate(e=>e.remove());await expect.poll(async()=> (await get()).context).toBe('browsing');
 // A granted new navigation is automatic without clicking the action again.
 await page.goto('https://service.com/next');await expect.poll(async()=> (await get())?.pageUrl).toBe('https://service.com/next');assert.notEqual((await get()).pageKey,key);
 await expect.poll(async()=> !(await get()).discoveryPending && (await get()).documents.every(d=>d.status!=='pending')).toBe(true);
 const rechecked=await controls.evaluate(async tabId=>{const state=(await chrome.storage.session.get('redflag.jobs.v1'))['redflag.jobs.v1'].sessions[tabId].state;return chrome.runtime.sendMessage({type:'redflag/analyze',mode:'recheck',pageKey:state.pageKey,tabId});},tabId);assert.equal(rechecked.ok,true);
 await expect.poll(async()=> !(await get()).discoveryPending && (await get()).documents.every(d=>d.status!=='pending')).toBe(true);await mkdir('dist/site-review-v4',{recursive:true});await page.screenshot({path:'dist/site-review-v4/reminder.png'});
 assert.equal(await worker.evaluate(()=>requests.filter(r=>r.body).length),0);
 // Browser action invocation supplies actual temporary activeTab access, no host grant.
 const ungranted=await context.newPage();await ungranted.goto('https://ungranted.org/repo');await ungranted.bringToFront();
 const browserCdp=await context.browser().newBrowserCDPSession();const {targetInfos}=await browserCdp.send('Target.getTargets',{filter:[{type:'tab',exclude:false},{exclude:true}]});const target=targetInfos.find(t=>t.url===ungranted.url());assert.ok(target);await browserCdp.send('Extensions.triggerAction',{id,targetId:target.targetId});
 const ungrantedId=await controls.evaluate(async()=> (await chrome.tabs.query({active:true,currentWindow:true}))[0].id);
 const manual=await controls.evaluate(async tabId=>chrome.runtime.sendMessage({type:'redflag/scan-current',tabId}),ungrantedId);assert.equal(manual.ok,true);assert.equal(manual.state.context,'browsing');assert.equal(manual.state.documents.length,2);
 assert.equal(await controls.evaluate(async()=> (await chrome.permissions.getAll()).origins.some(p=>p.includes('ungranted.org'))),false);
 await expect(ungranted.locator('[data-redflag-ui]')).toHaveCount(0);
 // Chrome's trusted extension settings grants real host access; no page reload.
 // Native permission-dialog approval itself is outside this headless fixture.
 const settings=await context.newPage();await settings.goto('chrome://extensions');
 await settings.evaluate(async id=>{await chrome.developerPrivate.addHostPermission(id,'https://ungranted.org/*');await chrome.developerPrivate.addHostPermission(id,'https://documents.org/*');},id);await worker.evaluate(()=>{fixtureGrants=['https://ungranted.org/*','https://documents.org/*'];for(const listener of fixtureAdded)listener({origins:fixtureGrants});});
 await expect.poll(()=>controls.evaluate(async tabId=>(await chrome.storage.session.get('redflag.jobs.v1'))['redflag.jobs.v1'].sessions[tabId]?.state.documents.every(d=>d.status!=='pending'),ungrantedId)).toBe(true);
 await expect.poll(async()=> (await get()).documents.find(d=>d.document.kind==='privacy')?.reason).toBe('ai-consent-required');
 await ungranted.goto('https://ungranted.org/new');
 await expect.poll(()=>controls.evaluate(async tabId=>(await chrome.storage.session.get('redflag.jobs.v1'))['redflag.jobs.v1'].sessions[tabId]?.state.pageUrl,ungrantedId)).toBe('https://ungranted.org/new');
 await settings.evaluate(async id=>chrome.developerPrivate.removeHostPermission(id,'https://ungranted.org/*'),id);
 await worker.evaluate(()=>{fixtureGrants=fixtureGrants.filter(p=>!p.includes('ungranted.org'));for(const listener of fixtureRemoved)listener({origins:['https://ungranted.org/*']});});
 await expect.poll(()=>controls.evaluate(async tabId=>(await chrome.storage.session.get('redflag.jobs.v1'))['redflag.jobs.v1'].sessions[tabId],ungrantedId)).toBe(undefined);
 const revocationCount=await worker.evaluate(()=>requests.length);
 await ungranted.evaluate(()=>{const footer=document.createElement('footer');footer.innerHTML='<a href="/legal/privacy">Privacy</a>';document.body.append(footer);});await ungranted.waitForTimeout(300);assert.equal(await worker.evaluate(()=>requests.length),revocationCount);
 // A valid empty website is distinct from a restricted browser page and can be rescanned.
 await context.route('https://service.com/no-legal',route=>route.fulfill({body:'<main>No legal links on this ordinary page.</main>',contentType:'text/html'}));
 await page.goto('https://service.com/no-legal');await expect.poll(async()=> (await get())?.pageUrl).toBe('https://service.com/no-legal');assert.equal((await get()).documents.length,0);assert.equal((await get()).context,'browsing');
 const empty=await controls.evaluate(async tabId=>{const state=(await chrome.storage.session.get('redflag.jobs.v1'))['redflag.jobs.v1'].sessions[tabId].state;return chrome.runtime.sendMessage({type:'redflag/analyze',mode:'recheck',pageKey:state.pageKey,tabId});},tabId);assert.equal(empty.ok,true);assert.equal(empty.state.documents.length,0);
 const restricted=await context.newPage();await restricted.goto('chrome://extensions');const restrictedId=await controls.evaluate(async()=> (await chrome.tabs.query({active:true,currentWindow:true}))[0].id);const denied=await controls.evaluate(async tabId=>chrome.runtime.sendMessage({type:'redflag/scan-current',tabId}),restrictedId);assert.equal(denied.code,'unsupported-page');
 console.log('Site discovery passed: 650-link ordinary repository/footer, short legal names with blog/settings negatives, popup-only browsing discovery, same-URL consent context changes, automatic granted navigation, idempotent scan, actual activeTab action, optional permission events grant/revoke without reload, AI-off recheck. Public responses and optional permission approval/events are fixtures; actual injection/activeTab is browser-enforced. No live provider calls.');
}finally{await context?.close();await rm(root,{recursive:true,force:true});}
