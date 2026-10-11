/** Static Figma handoff images from the actual extension, with synthetic reviews. */
import {chromium,expect} from '@playwright/test';
import {build} from 'esbuild';
import {mkdtemp,mkdir,cp,writeFile,rm} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
const output=resolve('dist/dashboard-handoff');await mkdir(output,{recursive:true});
const temporary=await mkdtemp(join(tmpdir(),'redflag-dashboard-capture-')),extension=join(temporary,'extension');
let context;
const frames=[];
try{
 await cp(resolve('dist/extension'),extension,{recursive:true});
 const helper=await build({stdin:{contents:"import {recordReview,clearHistory} from './src/history/store.ts'; window.captureHistory={recordReview,clearHistory};",resolveDir:process.cwd()},bundle:true,format:'iife',write:false});
 await writeFile(join(extension,'capture.js'),helper.outputFiles[0].text);await writeFile(join(extension,'capture.html'),'<!doctype html><script src="capture.js"></script>');
 context=await chromium.launchPersistentContext(join(temporary,'profile'),{channel:'chromium',headless:true,args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`]});
 const worker=context.serviceWorkers()[0]??await context.waitForEvent('serviceworker'),base='chrome-extension://'+new URL(worker.url()).host;
 const helperPage=await context.newPage();await helperPage.goto(base+'/capture.html');
 const page=await context.newPage();await page.setViewportSize({width:1280,height:900});
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 async function capture(name,type,description){
  // Label pixels themselves, not just JSON, so imported static frames cannot be
  // mistaken for live site/provider results. This is never in the shipped UI.
  await page.evaluate(()=>{document.querySelector('#capture-label')?.remove();const label=document.createElement('div');label.id='capture-label';label.textContent='DESIGN REVIEW · SYNTHETIC FIXTURE · NO LIVE SITE RATING';label.style.cssText='padding:10px 24px;background:#ffce85;color:#141414;font:12px monospace;letter-spacing:.5px';document.body.prepend(label);});
  const path=join(output,name+'.png');await page.screenshot({path,fullPage:true});
  const dimensions=await page.evaluate(()=>({width:innerWidth,height:document.documentElement.scrollHeight}));
  frames.push({name,path,type,description,synthetic:true,source:'Actual unpacked RedFlag extension with seeded fixture reviews; no provider requests',...dimensions});
 }
 const stamp=()=>new Date().toISOString();
 const review=(kind,grade,mode='rated')=>{
  const url='https://fixture-policies.org/'+kind,at=stamp();const rated=mode==='rated';
  return {document:{id:kind,url,kind,label:kind,discoveredAt:at},status:mode==='pending'?'pending':rated?'ready':'unrated',grade:rated?grade:'Unrated',coverage:mode==='partial'?'partial':mode==='pending'?'unknown':'complete',reason:mode==='partial'?'incomplete':mode==='permission'?'permission-required':mode==='ai-off'?'ai-consent-required':mode==='pending'?'pending':undefined,freshness:{retrievedAt:mode==='pending'?undefined:at,documentUpdatedAt:undefined},community:kind==='terms'?[{provider:'tosdr',serviceId:'fixture',serviceName:'Synthetic service',sourceUrl:'https://tosdr.org/en/service/1',rating:'B',scope:'service',reviewStatus:'reviewed',reviewedAt:'2025-01-01T00:00:00Z',fetchedAt:at,freshness:'stale',attribution:'Synthetic ToS;DR reference — fixture only'}]:[],cached:false,...(mode==='rated'||mode==='partial'?{assessment:{documentId:kind,documentUrl:url,kind,grade:mode==='partial'?'Unrated':grade,coverage:mode==='partial'?'partial':'complete',reason:mode==='partial'?'incomplete':undefined,findings:[{id:kind+'-finding',category:'retention',severity:'medium',title:'Records may be kept after closure',explanation:'Fixture concern: check the deletion terms before agreeing.',quote:'Records may be retained after account closure.',sourceUrl:url}],summary:'Synthetic fixture assessment; not a live policy rating.',provider:'gemini',analyzedAt:at,model:'fixture-only',promptVersion:'fixture',rubricVersion:'fixture',contentHash:'a'.repeat(64)}}:{})};
 };
 async function seed(origin,documents){await helperPage.evaluate(({origin,documents})=>captureHistory.recordReview({schemaVersion:1,pageKey:crypto.randomUUID(),pageUrl:origin+'/',context:'consent',updatedAt:new Date().toISOString(),documents}),{origin,documents});}
 async function visit(hash){await page.goto(base+'/dashboard.html'+hash);await expect(page.locator('h1')).toBeVisible();}
 await visit('#sites');await expect(page.getByRole('heading',{name:'Your reviews belong here.'})).toBeVisible();await capture('01-my-sites-empty','empty','No stored checked reviews; real empty state');
 await seed('https://rated-fixture.org',[review('terms','D'),review('privacy','B')]);
 await seed('https://partial-fixture.org',[review('terms','D'),review('privacy','Unrated','partial'),review('additional','Unrated','pending')]);
 await visit('#sites');await expect(page.locator('.site-row')).toHaveCount(2);await capture('02-my-sites-list','list','Independent document badges; no combined invented site rating');
 await page.getByRole('button',{name:'Clear history',exact:true}).click();await expect(page.getByRole('button',{name:'Confirm deletion'})).toBeVisible();await capture('03-clear-history-confirmation','deletion-confirmation','Explicit confirmation; settings preserved');await page.getByRole('button',{name:'Cancel',exact:true}).click();
 await visit('#site='+encodeURIComponent('https://rated-fixture.org'));await expect(page.getByText('Grade: D',{exact:true})).toBeVisible();await capture('04-site-detail-rated','rated','Document grades and collapsed evidence');
 await page.locator('.grade-legend summary').click();await capture('05-grade-legend','grade-legend','A-F/? explanations; rubric bands owned by Agent 2');await page.locator('.grade-legend summary').click();
 await page.locator('.policy-evidence summary').first().click();await expect(page.getByRole('link',{name:'Evidence source'}).first()).toBeVisible();await capture('06-site-detail-evidence','evidence-expanded','Exact quote, document link, provider, dates and stale attributed community reference');
 await page.getByRole('button',{name:'Delete review',exact:true}).click();await capture('07-delete-site-confirmation','delete-one-confirmation','Deletion confirmation on site detail');await page.getByRole('button',{name:'Cancel',exact:true}).click();
 await page.evaluate(()=>{globalThis.captureOriginalSet=chrome.storage.local.set.bind(chrome.storage.local);chrome.storage.local.set=async()=>{throw new Error('fixture quota failure');};});
 await page.getByRole('button',{name:'Delete review',exact:true}).click();await page.getByRole('button',{name:'Confirm deletion'}).click();await expect(page.locator('#status')).toContainText('could not be saved');await capture('17-history-write-failure','storage-write-failure','Failed deletion preserves the review and exposes retry');await page.evaluate(()=>{chrome.storage.local.set=globalThis.captureOriginalSet;});await page.getByRole('button',{name:'Cancel',exact:true}).click();
 await visit('#site='+encodeURIComponent('https://partial-fixture.org'));await expect(page.getByText('Grade: Unrated',{exact:true})).toHaveCount(2);await capture('08-site-detail-partial-pending','partial-pending','Separate Unrated partial and pending agreements');
 await seed('https://permission-fixture.org',[review('terms','Unrated','permission'),review('privacy','Unrated','ai-off')]);await visit('#site='+encodeURIComponent('https://permission-fixture.org'));await capture('09-site-detail-permission-ai-off','permission-required','Missing reading access and AI disabled; no settings permission controls are invented');
 await visit('#settings');await expect(page.locator('#ai-consent')).not.toBeChecked();await capture('10-settings-ai-off','settings-ai-off','Canonical preferences with AI off by default');
 await page.getByRole('checkbox',{name:'Data retention',exact:true}).check();await expect(page.locator('#status')).toContainText('saved');await capture('11-settings-preferences','preferences','Explicit priority choice, separate from grades and AI consent');
 // Only this affirmative click enables consent, in a disposable profile with no
 // configured backend/reading grants. No automatic opt-in or policy transmission.
 await page.locator('#ai-consent').check();await expect(page.locator('#status')).toContainText('saved');await capture('12-settings-ai-opt-in','settings-ai-on','Affirmative fixture opt-in with full disclosure and saved consent date');
 await page.locator('#ai-consent').uncheck();await expect(page.locator('#status')).toContainText('saved');await capture('13-settings-ai-revoked','settings-ai-revoked','Explicit revocation; already sent requests cannot be recalled');
 await page.locator('#enabled').uncheck();await expect(page.locator('#status')).toContainText('saved');await capture('18-settings-reviews-disabled','reviews-disabled','Automatic checks disabled independently of AI consent and history');await page.locator('#enabled').check();await expect(page.locator('#status')).toContainText('saved');
 await page.setViewportSize({width:720,height:900});await capture('14-settings-720','responsive-settings','Usable full-tab layout at 720 pixels');
 if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw new Error('Horizontal overflow');
 await page.setViewportSize({width:1280,height:900});
 await helperPage.evaluate(async()=>chrome.storage.local.set({'redflag.history.v1':{schemaVersion:99,sites:[]}}));await visit('#sites');await expect(page.getByRole('heading',{name:'History unavailable'})).toBeVisible();await capture('15-history-unsupported-version','storage-error','Unsupported saved format reported without silent overwrite');
 await helperPage.evaluate(()=>captureHistory.clearHistory());await visit('#site='+encodeURIComponent('https://deleted-fixture.org'));await expect(page.getByRole('heading',{name:'Review unavailable'})).toBeVisible();await capture('16-site-deleted-or-expired','deleted-expired','Missing saved detail after deletion/retention');
 if(errors.length)throw new Error(errors.join('\n'));
 await writeFile(join(output,'manifest.json'),JSON.stringify({schemaVersion:1,createdAt:stamp(),baseCommit:'99997f5',synthetic:true,font:'Temporary shared system monospace; Monoglyphic unavailable',frames,screenshots:frames.map(frame=>({path:frame.path,name:frame.name,state:frame.type,synthetic:true})),excluded:['Permission management lives in popup (Agent 1), not dashboard','No accounts/cloud/billing views','Live provider state not captured']},null,2)+'\n');
 console.log(`Captured ${frames.length} full-page extension fixture screenshots and manifest: ${output}`);
}finally{await context?.close();await rm(temporary,{recursive:true,force:true});}
