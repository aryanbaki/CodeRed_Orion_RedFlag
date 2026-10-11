import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {flagSvg} from '../src/ui/branding.ts';
await mkdir('src/extension/icons',{recursive:true});
await mkdir('assets/brand',{recursive:true});
const browser=await chromium.launch({headless:true});
try {
 const page=await browser.newPage({viewport:{width:128,height:128},deviceScaleFactor:1});
 for (const grade of ['Unrated','S','A','B','C','D','E']) {
  const svg=flagSvg(grade);
  await writeFile(`assets/brand/redflag${grade==='Unrated'?'':`-${grade}`}.svg`,svg+'\n');
  for (const size of [16,32,48,128]) {
   await page.setViewportSize({width:size,height:size});
   await page.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block;width:100vw;height:100vh}</style>${svg}`);
   await page.screenshot({path:`src/extension/icons/redflag${grade==='Unrated'?'':`-${grade}`}-${size}.png`,omitBackground:true});
  }
 }
} finally {await browser.close();}
