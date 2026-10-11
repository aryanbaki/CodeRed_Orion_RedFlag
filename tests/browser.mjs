import {chromium,expect} from '@playwright/test';
import {createHash} from 'node:crypto';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve,join} from 'node:path';
const extension=resolve('dist/extension');
const id=createHash('sha256').update(extension).digest('hex').slice(0,32).replace(/[0-9a-f]/g,c=>String.fromCharCode(97+parseInt(c,16)));
const profile=await mkdtemp(join(tmpdir(),'policy-review-test-'));
let context;
try {
  context=await chromium.launchPersistentContext(profile,{channel:'chromium',headless:true,args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`]});
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`chrome-extension://${id}/popup.html`);
  await expect(page.getByRole('heading',{name:'Before you agree.'})).toBeVisible();
  await page.getByRole('button',{name:'Try fictional example'}).click();
  await expect(page.locator('.card')).toHaveCount(3);
  await expect(page.locator('#status')).toContainText('Fictional example only');
  await page.getByLabel('Tracking',{exact:true}).check();
  await expect(page.locator('.card').first().getByRole('heading')).toHaveText('Tracking');
  await page.reload();await expect(page.getByLabel('Tracking',{exact:true})).toBeChecked();
  await expect(page.locator('.card')).toHaveCount(0);
  await page.getByRole('button',{name:'Review page text'}).click();
  await expect(page.locator('#status')).toContainText('Open an HTTP or HTTPS policy page first');
  await page.getByRole('button',{name:'Try fictional example'}).click();
  await page.setViewportSize({width:410,height:960});
  await page.screenshot({path:'dist/prototype-preview.png',fullPage:true});
  if(errors.length)throw new Error(errors.join('\n'));
  console.log('Browser checks passed: actual unpacked extension, demo, priorities, persistence, restricted-page error, no page exceptions.');
}finally{await context?.close();await rm(profile,{recursive:true,force:true});}
