// Actual branding components with synthetic grades; no network or provider requests.
import {chromium,expect} from '@playwright/test';
import {build} from 'esbuild';
import {readFile,mkdir} from 'node:fs/promises';
const result=await build({stdin:{contents:`import {gradeBadge} from './src/ui/popup-review.ts';import {flagMark} from './src/ui/branding.ts';import {applyTheme} from './src/ui/theme.ts';import {mountOverview} from './src/ui/overview.ts';window.branding={gradeBadge,flagMark,applyTheme,mountOverview};`,resolveDir:process.cwd()},bundle:true,format:'iife',write:false});
const browser=await chromium.launch({headless:true});
try {
 const page=await browser.newPage({viewport:{width:900,height:540}});
 await page.setContent(`<style>${await readFile('src/extension/popup.css','utf8')}</style><style>html{width:auto}body{min-height:0;padding:32px;background:#fff}.gallery{display:flex;gap:28px}.sample{display:grid;justify-items:center;gap:12px;width:90px}.sample>.flag-mark{width:90px;height:90px}h2{color:#192234;margin-bottom:24px}.idle{margin-top:32px;color:#192234}.idle .grade-tile{width:64px;height:64px}</style><h2>RedFlag · grade colors</h2><div class="gallery"></div><div class="idle">Idle / unrated</div>`);
 await page.addScriptTag({content:result.outputFiles[0].text});
 await page.evaluate(()=>{
  window.branding.applyTheme();
  for(const grade of ['E','D','C','B','A','S']){const sample=document.createElement('div');sample.className='sample';sample.append(window.branding.flagMark(grade),window.branding.gradeBadge(grade));document.querySelector('.gallery').append(sample);}
  document.querySelector('.idle').append(window.branding.gradeBadge('Unrated'));
 });
 await page.evaluate(()=>document.fonts.ready);
 if(!await page.evaluate(()=>[...document.fonts].some(face=>face.family==='Avion'&&face.status==='loaded')))throw new Error('Avion did not load');
 for(const grade of ['S','A','B','C','D','E']){
  await expect(page.locator(`[data-grade=${grade}]`)).toHaveCSS('color','rgb(255, 255, 255)');
  await expect(page.locator(`[data-grade=${grade}]`)).toHaveCSS('height','58px');
  await expect(page.locator(`[data-grade=${grade}]`)).toHaveCSS('font-family','Avion, Arial, sans-serif');
 }
 await expect(page.locator('[data-grade=Unrated]')).toHaveText('?');await expect(page.locator('[data-grade=Unrated] svg')).toHaveCount(0);
 await expect(page.locator('[data-grade=Unrated]')).toHaveAttribute('aria-label','Unknown grade');

 await mkdir('docs/design/branding',{recursive:true});
 await page.screenshot({path:'docs/design/branding/grade-palette.png'});
 // A later unknown state removes the grade square from the bottom-right panel.
 await page.evaluate(()=>{
  const now=new Date().toISOString();const documents=['terms','privacy'].map(kind=>{const url=`https://fixture.example/${kind}`;return {document:{id:kind,kind,url,label:kind,discoveredAt:now},grade:'S',status:'ready',coverage:'complete',freshness:{},community:[],cached:false,assessment:{documentId:kind,documentUrl:url,kind,grade:'S',coverage:'complete',provider:'gemini',rubricVersion:'redflag.rubric.v3',contentHash:'a'.repeat(64),analyzedAt:now,findings:[]}};});
  window.brandingState={schemaVersion:1,pageKey:'test',pageUrl:'https://fixture.example/signup',context:'signup',documents,updatedAt:now};
  window.brandingPanel=window.branding.mountOverview(window.brandingState,undefined,{onDismiss(){},onOpenSettings(){}});
 });
 const panel=page.getByRole('region',{name:'RedFlag agreement review'});
 await expect(panel.locator('.overall-grade')).toHaveCSS('font-family','Avion, Arial, sans-serif');
 await expect(panel.getByRole('button',{name:'Dismiss'})).toHaveCSS('font-family','Avion, Arial, sans-serif');
 await expect(panel.locator('.overall-grade')).toHaveText('S');await expect(panel.locator('.flag-mark')).toHaveCount(1);
 await page.evaluate(()=>window.brandingPanel.update({...window.brandingState,documents:[]}));
 await expect(panel.locator('.overall-grade')).toHaveText('?');await expect(panel.locator('.flag-mark')).toHaveCount(0);
 console.log('Branding browser checks passed: white S–E squares, neutral unknown badges, Avion font, bottom-right rated/unknown transitions.');
} finally {await browser.close();}
