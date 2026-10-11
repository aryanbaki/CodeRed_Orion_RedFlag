import {chromium,expect} from '@playwright/test';
import {build} from 'esbuild';
import {mkdtemp,rm,cp,writeFile,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import assert from 'node:assert/strict';
const root=await mkdtemp(join(tmpdir(),'redflag-dashboard-')),extension=join(root,'extension'),profile=join(root,'profile');
let context;
await mkdir('dist/screenshots',{recursive:true});
try {
  await cp(resolve('dist/extension'),extension,{recursive:true});
  const helper=await build({stdin:{contents:"import {recordReview,listHistory,deleteHistory} from './src/history/store.ts';window.testHistory={recordReview,listHistory,deleteHistory};",resolveDir:process.cwd()},bundle:true,format:'iife',write:false});
  await writeFile(join(extension,'history-test.js'),helper.outputFiles[0].text);
  await writeFile(join(extension,'history-test.html'),'<!doctype html><title>History test helper</title><script src="history-test.js"></script>');
  const launch=()=>chromium.launchPersistentContext(profile,{channel:'chromium',headless:true,args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`]});
  context=await launch();
  const worker=context.serviceWorkers()[0]??await context.waitForEvent('serviceworker'),id=new URL(worker.url()).host,base=`chrome-extension://${id}`;
  const helperPage=await context.newPage();await helperPage.goto(base+'/history-test.html');
  const dashboard=await context.newPage(),errors=[];dashboard.on('pageerror',e=>errors.push(e.message));
  await dashboard.setViewportSize({width:1280,height:900});await dashboard.goto(base+'/dashboard.html');
  await expect(dashboard.getByRole('heading',{name:'Your reviews belong here.'})).toBeVisible();
  await dashboard.screenshot({path:'dist/screenshots/my-sites-empty.png',fullPage:true});
  const at=new Date().toISOString();
  const doc=(kind,grade='D',partial=false)=>{
    const url=`https://public-policies.com/${kind}`;
    return {document:{id:kind,url,kind,label:kind,discoveredAt:at},status:grade==='Unrated'?'unrated':'ready',grade,coverage:partial?'partial':'complete',reason:partial?'incomplete':undefined,freshness:{retrievedAt:at,analyzedAt:at},cached:false,community:kind==='terms'?[{provider:'tosdr',serviceId:'1',serviceName:'Fixture service',sourceUrl:'https://tosdr.org/en/service/1',rating:'B',scope:'service',reviewStatus:'reviewed',reviewedAt:'2025-01-01T00:00:00Z',recordUpdatedAt:'2025-01-02T00:00:00Z',fetchedAt:at,freshness:'stale',attribution:'Fixture: ToS;DR contributors · CC BY-SA 3.0'}]:[],assessment:{documentId:kind,documentUrl:url,kind,grade,coverage:partial?'partial':'complete',reason:partial?'incomplete':undefined,findings:[{id:'finding',category:'retention',severity:'high',title:'Indefinite retention — fixture',explanation:'This simulated finding illustrates evidence display.',quote:'We keep records indefinitely.',sourceUrl:url}],summary:'Fixture result; no live provider was used.',provider:'gemini',analyzedAt:at,model:'fixture-model',promptVersion:'p1',rubricVersion:'r1',contentHash:'a'.repeat(64)}};
  };
  const state=(host='university.edu',generation='test-generation')=>({schemaVersion:1,pageKey:generation,pageUrl:`https://${host}/signup?private=secret`,context:'signup',updatedAt:at,documents:[doc('terms','D'),doc('privacy','B'),doc('additional','Unrated',true)]});
  await helperPage.evaluate(async states=>{for(const s of states)await testHistory.recordReview(s);},[state(),state('shop.com')]);
  await expect(dashboard.locator('.site-row')).toHaveCount(2);
  await expect(dashboard.locator('.policy-badge').first()).toContainText('D');
  await dashboard.screenshot({path:'dist/screenshots/my-sites-list.png',fullPage:true});
  await dashboard.getByRole('link',{name:'university.edu',exact:true}).click();
  await expect(dashboard.getByRole('heading',{name:'university.edu',exact:true})).toBeVisible();
  await expect(dashboard.getByText('Grade: D',{exact:true})).toBeVisible();await expect(dashboard.getByText('Grade: B',{exact:true})).toBeVisible();await expect(dashboard.getByText('Grade: Unrated',{exact:true})).toBeVisible();
  await expect(dashboard.getByText('Only part of this document was available.')).toBeVisible();
  assert.ok((await dashboard.getByRole('link',{name:'Evidence source'}).first().getAttribute('href')).startsWith('https://public-policies.com/'));
  await dashboard.getByText('ToS;DR community reference · stale').click();await expect(dashboard.getByText(/Fixture: ToS;DR contributors/)).toBeVisible();
  await dashboard.screenshot({path:'dist/screenshots/my-sites-detail.png',fullPage:true});
  const update=state();update.updatedAt=new Date(Date.now()+1000).toISOString();update.documents[1]=doc('privacy','Unrated',true);
  await helperPage.evaluate(s=>testHistory.recordReview(s),update);
  await expect(dashboard.getByText('Grade: Unrated',{exact:true})).toHaveCount(2);
  // Shared local settings synchronize both ways with the actual popup.
  const popup=await context.newPage();await popup.goto(base+'/popup.html');
  await dashboard.getByRole('link',{name:'Settings',exact:true}).click();
  await dashboard.getByRole('checkbox',{name:'Allow background AI analysis',exact:false}).check();
  await expect(popup.getByRole('button',{name:'Turn off background AI analysis'})).toBeVisible();
  await popup.getByRole('button',{name:'Turn off background AI analysis'}).click();
  await expect(dashboard.getByRole('checkbox',{name:'Allow background AI analysis',exact:false})).not.toBeChecked();
  await dashboard.getByRole('checkbox',{name:'Data retention',exact:true}).check();
  await expect(popup.getByRole('checkbox',{name:'Data retention',exact:true})).toBeChecked();
  await dashboard.screenshot({path:'dist/screenshots/my-sites-settings.png',fullPage:true});
  await dashboard.setViewportSize({width:720,height:900});await dashboard.screenshot({path:'dist/screenshots/my-sites-settings-720.png',fullPage:true});
  assert.equal(await dashboard.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await dashboard.setViewportSize({width:480,height:900});assert.equal(await dashboard.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  // Keyboard links and controls can be reached without mouse interaction.
  await dashboard.reload();await dashboard.keyboard.press('Tab');await expect(dashboard.locator('.skip-link')).toBeFocused();await dashboard.keyboard.press('Enter');await expect(dashboard.locator('#main')).toBeFocused();
  await dashboard.keyboard.press('Tab');assert.ok(['INPUT','BUTTON','A'].includes(await dashboard.evaluate(()=>document.activeElement.tagName)));
  await dashboard.getByRole('checkbox',{name:'Enable RedFlag',exact:false}).focus();await dashboard.keyboard.press('Space');await expect(dashboard.getByRole('checkbox',{name:'Enable RedFlag',exact:false})).not.toBeChecked();await expect(dashboard.getByRole('checkbox',{name:'Enable RedFlag',exact:false})).toBeEnabled();await dashboard.getByRole('checkbox',{name:'Enable RedFlag',exact:false}).focus();await dashboard.keyboard.press('Space');await expect(dashboard.getByRole('checkbox',{name:'Enable RedFlag',exact:false})).toBeChecked();
  await dashboard.getByRole('link',{name:'My Sites',exact:true}).click();await dashboard.getByRole('link',{name:'shop.com',exact:true}).click();
  // Write rejection uses an actual extension page with injected storage failure.
  await dashboard.evaluate(()=>{globalThis.originalStorageSet=chrome.storage.local.set.bind(chrome.storage.local);chrome.storage.local.set=async()=>{throw new Error('simulated quota');};});
  await dashboard.getByRole('button',{name:'Delete review',exact:true}).click();await dashboard.getByRole('button',{name:'Confirm deletion'}).click();
  await expect(dashboard.locator('#status')).toContainText('could not be saved');await expect(dashboard.getByRole('heading',{name:'shop.com',exact:true})).toBeVisible();
  await dashboard.evaluate(()=>{chrome.storage.local.set=globalThis.originalStorageSet;});await dashboard.getByRole('button',{name:'Confirm deletion'}).click();await expect(dashboard.getByRole('heading',{name:'Review unavailable'})).toBeVisible();
  await dashboard.getByRole('link',{name:'My Sites',exact:true}).click();await expect(dashboard.locator('.site-row')).toHaveCount(1);
  assert.deepEqual(errors,[]);
  // Restart the complete browser/profile, not merely reload a component.
  await context.close();context=await launch();
  const reopened=await context.newPage();await reopened.goto(base+'/dashboard.html');await expect(reopened.locator('.site-row')).toHaveCount(1);
  await reopened.getByRole('link',{name:'Settings',exact:true}).click();await expect(reopened.getByRole('checkbox',{name:'Data retention',exact:true})).toBeChecked();await expect(reopened.getByRole('checkbox',{name:'Allow background AI analysis',exact:false})).not.toBeChecked();
  await reopened.getByRole('link',{name:'My Sites',exact:true}).click();await reopened.getByRole('button',{name:'Clear history',exact:true}).click();await reopened.getByRole('button',{name:'Confirm deletion'}).click();await expect(reopened.getByRole('heading',{name:'Your reviews belong here.'})).toBeVisible();
  await reopened.getByRole('link',{name:'Settings',exact:true}).click();await expect(reopened.getByRole('checkbox',{name:'Data retention',exact:true})).toBeChecked();
  console.log('Dashboard unpacked-extension checks passed: empty/multiple/independent/partial reviews, updates, attribution/source links, popup consent sync, responsive widths, keyboard navigation, failed deletion, restart persistence, delete/clear. Provider data is explicitly simulated.');
}finally{await context?.close();await rm(root,{recursive:true,force:true});}
