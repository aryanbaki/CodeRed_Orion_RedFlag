// Presentation fixtures exercise the real packaged popup. These are not live site ratings.
import {chromium,expect} from '@playwright/test';
import {extensionId} from '../scripts/extension-id.mjs';
import {mkdtemp,rm,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve,join} from 'node:path';
const extension=resolve('dist/extension'),profile=await mkdtemp(join(tmpdir(),'redflag-popup-')),id=extensionId(extension),domain='an-extremely-long-subdomain-for-layout-checking.fixture-preview.com',now=new Date().toISOString();
const quote='Your subscription renews automatically unless you cancel before renewal.';
const review=(kind,grade='Unrated',status='pending',coverage='unknown')=>({document:{id:kind,kind,url:`https://${domain}/${kind}`,label:kind,discoveredAt:now},grade,status,coverage,wordCount:12345,reason:status==='pending'?'pending':undefined,freshness:{analyzedAt:now},community:[],cached:false,...(status==='ready'?{assessment:{documentId:kind,documentUrl:`https://${domain}/${kind}`,kind,grade,coverage,findings:kind==='terms'?[{id:'f',category:'renewal',severity:'high',title:'Automatic renewal',explanation:'Your subscription renews unless you cancel before the renewal date.',quote,sourceUrl:`https://${domain}/${kind}`}]:[],protections:kind==='privacy'?[{id:'p',category:'sharing',severity:'low',title:'Data sharing',explanation:'Your information is not sold to third parties.',quote:'We do not sell your information to third parties.',sourceUrl:`https://${domain}/${kind}`}]:[],summary:kind==='terms'?'Your subscription renews unless you cancel before the renewal date.':'Your information is not sold to third parties.',provider:'gemini',analyzedAt:now,model:'gemini-test',promptVersion:'redflag.prompt.v2',rubricVersion:'redflag.rubric.v3',contentHash:'a'.repeat(64)}}:{})});
let context;
try{
 await mkdir('dist/site-review-v2',{recursive:true});
 context=await chromium.launchPersistentContext(profile,{channel:'chromium',headless:true,viewport:{width:480,height:680},args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`]});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(({domain})=>{
  const listeners=[];window.commands=[];window.fixtureState=null;window.connected=false;window.chatCalls=[];
  chrome.tabs.query=async()=>[{id:99,url:`https://${domain}/signup`}];
  chrome.runtime.sendMessage=async message=>{
   if(message.type==='redflag/backend-status')return {ok:false,connected:false,error:'Import your backend connection file.'};
   if(message.type==='redflag/connect-backend'){window.connected=true;return {ok:true,connected:true};}
   if(message.type==='redflag/scan-current')return {ok:true,state:window.fixtureState};
   if(message.type==='redflag/analyze'){window.commands.push(message);return {ok:true,state:window.fixtureState,queuedDocumentIds:[],joinedDocumentIds:[]};}
   if(message.type==='redflag/chat'){window.chatCalls.push(message);if(window.chatFail)return {ok:false,error:'Gemini limit reached. Try again in a minute.'};return {ok:true,schemaVersion:1,pageKey:message.pageKey,answer:'Your subscription renews unless you cancel before renewal. [1]',citations:[{documentId:'terms',sourceUrl:`https://${domain}/terms`,quote:'Your subscription renews automatically unless you cancel before renewal.'}],model:'gemini-test'};}
   return {ok:true,state:window.fixtureState};
  };
  chrome.runtime.onMessage.addListener=fn=>listeners.push(fn);
  window.setFixture=state=>{window.fixtureState=state;listeners.forEach(fn=>fn({type:'redflag/state',state}));};
 },{domain});
 await page.goto(`chrome-extension://${id}/popup.html`);await expect(page.locator('#domain')).toHaveText(domain);
 await page.locator('#domain').evaluate(node=>node.textContent='example.com');
 await expect(page.locator('#onboarding')).toBeVisible();await page.screenshot({path:'dist/site-review-v2/01-connect.png',fullPage:true});
 if(await page.locator('#onboarding-next').isVisible())await page.locator('#onboarding-next').click();await page.locator('#start').click();await expect(page.locator('#onboarding')).toBeVisible();await expect(page.locator('#connection-status')).toHaveText('Start the RedFlag backend, then retry.');
 await page.locator('#connection-file').setInputFiles({name:'connection.json',mimeType:'application/json',buffer:Buffer.from('{}')});
 await expect(page.locator('#connection-status')).toContainText('Backend connected');await page.locator('#start').click();await expect(page.locator('#onboarding')).toBeHidden();
 const state=(documents,extra={})=>({schemaVersion:1,pageKey:'fixture',pageUrl:`https://${domain}/signup`,context:'signup',documents,updatedAt:now,...extra});
 await page.evaluate(s=>window.setFixture(s),state([],{discoveryPending:true}));await expect(page.locator('.policy-row')).toHaveCount(3);for(const row of await page.locator('.policy-row').all())await expect(row).toBeVisible();await expect(page.locator('#loading')).toBeVisible();await expect(page.locator('[data-grade=Unrated]')).toHaveCount(4);for(const badge of await page.locator('[data-grade=Unrated]').all()){await expect(badge).toHaveText('?');await expect(badge).toHaveAttribute('aria-label','Unknown grade');}await expect(page.locator('.policy-row svg')).toHaveCount(0);await page.screenshot({path:'dist/site-review-v2/02-searching.png',fullPage:true});
 await page.evaluate(s=>window.setFixture(s),state([review('terms','C','ready','complete'),review('privacy','A','ready','complete'),review('cookies','B','ready','complete')]));
 await expect(page.locator('.grade-summary .grade-tile')).toHaveText('C');await expect(page.locator('.grade-summary')).toContainText('Saved you ~156 minutes');
 await expect(page.locator('.policy-row').first()).toContainText('Privacy policy');await expect(page.locator('.policy-row').nth(1)).toContainText('Cookie policy');await expect(page.locator('.policy-row').nth(2)).toContainText('Terms of service');
 await expect(page.locator('.policy-meta').first()).toHaveText('12,345 words');await expect(page.locator('.policy-row details')).toHaveCount(0);await expect(page.locator('.policy-row')).not.toContainText(['Source','Open policy','Source']);await expect(page.locator('#flags-content')).toContainText('Automatic renewal');
 await page.locator('.overall-copy h2').evaluate(n=>n.textContent='Example');await page.screenshot({path:'dist/site-review-v2/03-red-flags.png',fullPage:true});
 await page.locator('#flags-content summary').click();await expect(page.locator('#flags-content blockquote')).toHaveText(quote);
 for(const [index,kind] of ['privacy','cookies','terms'].entries()){await page.locator('.analyze-policy').nth(index).click();await expect.poll(()=>page.evaluate(()=>window.commands.at(-1)?.documentId)).toBe(kind);}
 await page.evaluate(()=>window.commands=[]);await page.locator('#recheck').click();await expect.poll(()=>page.evaluate(()=>window.commands.map(c=>c.mode).join(','))).toBe('recheck');
 await page.locator('#tab-summary').click();await expect(page.locator('#panel-summary')).toBeVisible();await expect(page.locator('#summary-content')).toContainText('On your side');await expect(page.locator('#summary-content')).not.toContainText('score');await page.locator('.overall-copy h2').evaluate(n=>n.textContent='Example');await page.screenshot({path:'dist/site-review-v2/04-summary.png',fullPage:true});
 await page.locator('#tab-chat').click();await page.locator('#chat-input').fill('Does my subscription renew?');await page.locator('#chat-send').click();await expect(page.locator('.chat-bubble.assistant')).toContainText('Your subscription renews');await expect(page.locator('#chat-model')).toContainText('gemini-test');
 await page.locator('.overall-copy h2').evaluate(n=>n.textContent='Example');await page.screenshot({path:'dist/site-review-v2/05-chat.png',fullPage:true});await page.locator('.chat-bubble.assistant summary').click();await expect(page.locator('.chat-bubble.assistant blockquote')).toHaveText('[1] '+quote);
 await page.evaluate(()=>window.chatFail=true);await page.locator('#chat-input').fill('A follow-up question');await page.locator('#chat-input').press('Enter');await expect(page.locator('#chat-status')).toContainText('Gemini limit reached');await expect(page.locator('#chat-input')).toHaveValue('A follow-up question');await expect(page.locator('.chat-bubble.assistant')).toHaveCount(1);
 await page.evaluate(s=>window.setFixture(s),state([],{pageKey:'new-generation'}));await expect(page.locator('.chat-bubble')).toHaveCount(0);await expect(page.locator('#chat-model')).not.toContainText('Powered by');
 await page.locator('#tab-chat').focus();await page.keyboard.press('Home');await expect(page.locator('#tab-flags')).toBeFocused();await expect(page.locator('#panel-flags')).toBeVisible();
 await page.evaluate(s=>window.setFixture(s),state(['privacy','terms','cookies'].map(kind=>review(kind))));await expect(page.locator('.analyze-policy').first()).toBeDisabled();
 await page.locator('#settings-link').click();await expect(page.locator('#settings')).toHaveAttribute('open','');await page.locator('#setup').click();await page.locator('#onboarding-next').click();await page.locator('#community-only').click();await expect(page.locator('#ai-state')).toHaveText('Community ratings only');
 const unavailable={...review('privacy','Unrated','unrated','complete'),reason:'ai-consent-required',failure:{stage:'analysis',code:'ai-consent-required',message:'Background AI is disabled. No new document text was sent.'}};
 await page.evaluate(async ({unavailable,now})=>{const d={...unavailable,document:{...unavailable.document,url:'https://www.figma.com/privacy',label:'Privacy policy'}};await chrome.storage.local.set({'redflag.history.v1':{schemaVersion:1,sites:[{origin:'https://www.figma.com',firstCheckedAt:now,lastCheckedAt:now,generation:'figma-unknown',context:'browsing',documents:[d]}],deleted:[]}});},{unavailable,now});
 await expect(page.locator('.recent-item')).toContainText('www.figma.com');await expect(page.locator('.recent-item .document-grade')).toHaveText('?');await expect(page.locator('.recent-item svg')).toHaveCount(0);
 await page.evaluate(s=>window.setFixture(s),state([unavailable]));await page.locator('#tab-summary').click();await expect(page.locator('#summary-content')).not.toContainText('Background AI is disabled');await expect(page.locator('#summary-content')).not.toContainText('Cookie policy not found');await expect(page.locator('#summary-content .gap')).toHaveCount(0);await expect(page.locator('.policy-row details')).toHaveCount(0);
 await page.evaluate(()=>{document.querySelector('.overall-copy h2').textContent='Figma';document.querySelector('#domain').textContent='www.figma.com';});await page.screenshot({path:'dist/site-review-v2/06-unknown.png',fullPage:true});
await page.locator('.analyze-policy').first().click();await expect(page.locator('#onboarding')).toBeVisible();
 await page.evaluate(()=>document.fonts.ready);if(!await page.evaluate(()=>[...document.fonts].some(face=>face.family==='Merriweather'&&face.status==='loaded')))throw Error('Merriweather font did not load');
 const metrics=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>480,logo:document.querySelector('.brand-logo').naturalWidth}));if(metrics.overflow||metrics.logo!==128)throw Error(JSON.stringify(metrics));if(errors.length)throw Error(errors.join('; '));
 console.log('Popup verified: checked setup, always-visible policy cards, Analyze all/individual, evidence, Summary, Chat, citation expansion, quota retry, navigation reset, keyboard tabs, no horizontal overflow. Screenshot data are fixtures.');
}finally{await context?.close();await rm(profile,{recursive:true,force:true});}
