// Actual unpacked popup checks; current policy actions/chat are in popup-redesign.mjs.
import {extensionId} from '../scripts/extension-id.mjs';
import {chromium,expect} from '@playwright/test';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve,join} from 'node:path';
const extension=resolve('dist/extension'),id=extensionId(extension),profile=await mkdtemp(join(tmpdir(),'redflag-popup-basic-'));let context;
try{
 context=await chromium.launchPersistentContext(profile,{channel:'chromium',headless:true,args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`]});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(()=>{const send=chrome.runtime.sendMessage.bind(chrome.runtime);chrome.runtime.sendMessage=async message=>message.type==='redflag/backend-status'?{connected:false,error:'Connection unavailable.'}:send(message);});await page.goto(`chrome-extension://${id}/popup.html`);
 await expect(page.getByRole('heading',{name:'RedFlag',exact:true})).toBeVisible();await expect(page.locator('#onboarding')).toBeVisible();await expect(page.locator('#domain')).toHaveText('Open a website');await expect(page.locator('#chat-send')).toBeDisabled();
 if(await page.locator('#onboarding-next').isVisible())await page.locator('#onboarding-next').click();await page.locator('#start').click();await expect(page.locator('#connection-status')).toHaveText('Start the RedFlag backend, then retry.');
 await page.locator('#community-only').click();await expect(page.locator('#onboarding')).toBeHidden();await expect(page.locator('#ai-state')).toHaveText('Community ratings only');
 const consent=await page.evaluate(async()=> (await chrome.storage.local.get('redflag.preferences.v1'))['redflag.preferences.v1'].aiConsent);if(consent.enabled||consent.grantedAt)throw Error('Community setup granted AI consent');
 await page.locator('#settings-link').click();await page.locator('#review-enabled').uncheck();await page.reload();await expect(page.locator('#review-enabled')).not.toBeChecked();await page.locator('#settings-link').click();await page.locator('#review-enabled').check();await expect(page.locator('#settings input[type=checkbox]')).toHaveCount(1);
 await page.locator('#setup').click();await page.locator('#onboarding-next').click();await expect(page.locator('#consent-step')).toBeVisible();await page.evaluate(()=>{chrome.storage.local.set=async()=>{throw Error('Fixture storage failure');};});await page.locator('#community-only').click();await expect(page.locator('#action-status')).toHaveText('Setup could not be saved. Try again.');await expect(page.locator('#community-only')).toBeEnabled();
 if(errors.length)throw Error(errors.join('; '));console.log('Unpacked popup passed: restricted-page behavior, checked onboarding, no implicit AI consent, preference persistence, minimal settings, and storage failure recovery.');
}finally{await context?.close();await rm(profile,{recursive:true,force:true});}
