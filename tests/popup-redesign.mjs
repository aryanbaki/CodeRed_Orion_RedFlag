// Real unpacked extension, synthetic provider/review states. Screenshots are fixtures, not live grades.
import {chromium,expect} from '@playwright/test';
import {createHash} from 'node:crypto';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve,join} from 'node:path';
const extension=resolve('dist/extension'),profile=await mkdtemp(join(tmpdir(),'redflag-popup-'));
const id=createHash('sha256').update(extension).digest('hex').slice(0,32).replace(/[0-9a-f]/g,c=>String.fromCharCode(97+parseInt(c,16)));
const domain='an-extremely-long-subdomain-for-layout-checking.fixture-preview.com';
const now=new Date().toISOString();
const review=(kind,grade='Unrated',status='pending',coverage='unknown')=>({document:{id:kind,kind,url:`https://${domain}/${kind}`,label:kind==='terms'?'Synthetic Subscription Agreement With An Extremely Long Policy Name':'Synthetic '+kind,discoveredAt:now},grade,status,coverage,reason:status==='pending'?'pending':undefined,freshness:{analyzedAt:now},community:[],cached:false,...(status==='ready'?{assessment:{documentId:kind,documentUrl:`https://${domain}/${kind}`,kind,grade,coverage,findings:kind==='terms'?[{id:'f',category:'renewal',severity:'high',title:'Automatic renewal',explanation:'Synthetic fixture: review cancellation before the renewal deadline.',quote:'Your subscription renews automatically unless you cancel before renewal.',sourceUrl:`https://${domain}/${kind}`}]:[],summary:'Synthetic fixture only',provider:'gemini',analyzedAt:now,model:'fixture-model',promptVersion:'fixture-v1',rubricVersion:'fixture-v1',contentHash:'a'.repeat(64)}}:{})});
let context;
try{
 context=await chromium.launchPersistentContext(profile,{channel:'chromium',headless:true,viewport:{width:400,height:600},args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`]});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(({domain,now})=>{
  const listeners=[];window.commands=[];window.fixtureState=null;
  chrome.tabs.query=async()=>[{id:99,url:`https://${domain}/signup`}];
  chrome.runtime.sendMessage=async message=>{if(message.type==='redflag/scan-current')return window.scanDenied?{ok:false,code:'permission-required',error:'Allow access to check this site.'}:{ok:true,state:window.fixtureState};if(message.type==='redflag/analyze'){window.commands.push(message);return {ok:true,state:window.fixtureState,queuedDocumentIds:[],joinedDocumentIds:[]};}return {ok:true,state:window.fixtureState};};
  chrome.runtime.onMessage.addListener=fn=>listeners.push(fn);
  window.setFixture=state=>{window.fixtureState=state;listeners.forEach(fn=>fn({type:'redflag/state',state}));};
 },{domain,now});
 await page.goto(`chrome-extension://${id}/popup.html`);
 await expect(page.locator('#domain')).toHaveText(domain);await expect(page.locator('.grade-summary')).toHaveCount(0);await expect(page.locator('.policy-row')).toHaveCount(0);await expect(page.locator('#recheck')).toBeEnabled();await page.screenshot({path:'dist/popup-fixture-discovering.png'});
 await page.locator('#settings-link').click();await page.locator('#ai-toggle').click();await page.locator('#settings > summary').click();
 const state=documents=>({schemaVersion:1,pageKey:'fixture',pageUrl:`https://${domain}/signup`,context:'signup',documents,updatedAt:now});
 for(const [name,documents] of [
  ['analyzing',[review('terms')]],
  ['partial',[review('terms','D','ready','complete'),review('privacy')]],
  ['rated',[review('terms','D','ready','complete'),review('privacy','B','ready','complete'),review('additional','C','ready','complete')]],
  ['empty',[]],
  ['unrated',[{...review('terms','Unrated','unrated','partial'),reason:'insufficient-evidence'}]],
  ['permission-required',[{...review('terms','Unrated','unrated'),reason:'permission-required'}]],
  ['inaccessible',[{...review('terms','Unrated','unrated'),reason:'inaccessible'}]],
 ]){
  await page.evaluate(s=>window.setFixture(s),state(documents));
  if(name==='empty'){await expect(page.locator('.policy-row')).toHaveCount(0);await expect(page.locator('.grade-summary')).toHaveCount(0);await page.evaluate(()=>{window.scanDenied=true;});await page.locator('#recheck').click();await expect(page.locator('#empty-heading')).toHaveText('Allow site access');await page.screenshot({path:'dist/popup-fixture-permission-empty.png'});await page.evaluate(()=>{window.scanDenied=false;});await page.locator('#recheck').click();}else await expect(page.locator('.policy-row').first()).toContainText('Synthetic');
  if(name==='partial'){await expect(page.locator('.grade-summary')).toContainText('1 of 2');await expect(page.locator('.scope-note')).toContainText('Incomplete');}
  if(name==='rated'){await page.evaluate(async ({domain,now,documents})=>chrome.storage.local.set({'redflag.history.v1':{schemaVersion:1,sites:[{origin:'https://'+domain,firstCheckedAt:now,lastCheckedAt:now,generation:'fixture',context:'signup',documents}],deleted:[]}}),{domain,now,documents});await page.getByRole('button',{name:'Analyze Synthetic Subscription',exact:false}).click();await page.locator('#analyze-all').click();await page.locator('#recheck').click();}
  await page.locator('.important-warning').evaluateAll(nodes=>nodes.forEach(n=>n.open=false));
  await page.evaluate(()=>{window.scrollTo(0,0);document.body.scrollTop=0;document.documentElement.scrollTop=0;});
  await page.screenshot({path:`dist/popup-fixture-${name}.png`});if(name==='rated'){await page.locator('#recent-items').scrollIntoViewIfNeeded();await page.screenshot({path:'dist/popup-fixture-recent.png'});}
  if(name==='partial'){await page.locator('.important-warning summary').first().click();await page.locator('.important-warning').scrollIntoViewIfNeeded();await page.screenshot({path:'dist/popup-fixture-evidence.png'});}
 }
 const commands=await page.evaluate(()=>window.commands);if(commands.map(c=>c.mode).join(',')!=='one,all,recheck')throw Error('Real action command binding failed');
 await page.locator('#settings-link').click();await page.locator('#ai-toggle').click();await page.locator('#settings > summary').click();
 await expect(page.locator('#analyze-all')).toBeDisabled();await expect(page.locator('#compact-review')).toContainText('AI disabled');
 await page.evaluate(()=>{window.scrollTo(0,0);document.body.scrollTop=0;document.documentElement.scrollTop=0;});await page.screenshot({path:'dist/popup-fixture-ai-disabled.png'});
 const metrics=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>400,font:getComputedStyle(document.body).fontFamily,logo:document.querySelector('.brand-logo').naturalWidth,remoteFonts:[...document.fonts].length}));
 const overlap=await page.locator('.grade-tile').evaluateAll(nodes=>nodes.some(n=>n.scrollWidth>n.clientWidth));if(overlap)throw Error('Grade badge overflow');
 if(metrics.overflow||metrics.logo!==128||metrics.remoteFonts!==0||!metrics.font.includes('monospace'))throw Error(JSON.stringify(metrics));
 await page.locator('#settings-link').focus();await page.keyboard.press('Enter');await expect(page.locator('#settings')).toHaveAttribute('open','');await page.screenshot({path:'dist/popup-fixture-settings.png'});await page.keyboard.press('Tab');await expect(page.locator('#site-access button').first()).toBeFocused();
 await page.reload();await expect(page.locator('#ai-state')).toContainText('Off.');await expect(page.locator('.grade-summary')).toHaveCount(0);
 const restricted=await context.newPage();await restricted.goto(`chrome-extension://${id}/popup.html`);await expect(restricted.locator('#domain')).toHaveText('Open a website');await expect(restricted.locator('.grade-summary')).toHaveCount(0);await expect(restricted.locator('.policy-row')).toHaveCount(0);await expect(restricted.locator('#status')).toContainText('cannot be reviewed');await restricted.screenshot({path:'dist/popup-restricted-browser.png'});
 // WCAG contrast on the actual shared tokens; disabled controls are excluded.
 const tokens=await page.evaluate(()=>{const s=getComputedStyle(document.documentElement);return Object.fromEntries(['background','surface','text','muted','red','red-contrast','warning','focus'].map(k=>[k,s.getPropertyValue('--rf-'+k).trim()]));});
 const luminance=h=>{const c=h.match(/[a-f0-9]{2}/gi).map(x=>parseInt(x,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return c[0]*.2126+c[1]*.7152+c[2]*.0722;};
 const contrast=(a,b)=>{const values=[luminance(a),luminance(b)].sort((x,y)=>y-x);return (values[0]+.05)/(values[1]+.05);};
 for(const [a,b] of [['text','background'],['muted','surface'],['warning','surface'],['red','background'],['red-contrast','red'],['focus','background']])if(contrast(tokens[a],tokens[b])<4.5)throw Error(`Contrast failure ${a}/${b}`);
 if(errors.length)throw Error(errors.join('\n'));
 console.log('Unpacked popup fixture checks passed: all presentation states, one/all/recheck command wiring, keyboard settings access, consent/reopening, long domain/policy wrapping, supplied logo and temporary font. No live grades asserted.');
}finally{await context?.close();await rm(profile,{recursive:true,force:true});}
