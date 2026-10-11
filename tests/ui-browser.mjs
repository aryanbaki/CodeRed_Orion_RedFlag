// Synthetic current overview fixtures; provider/evidence paths have separate suites.
import {chromium,expect} from '@playwright/test';
import {build} from 'esbuild';
import {mkdir} from 'node:fs/promises';
await mkdir('dist/ui-tests',{recursive:true});await build({entryPoints:['tests/ui-fixture.ts'],bundle:true,format:'iife',platform:'browser',target:'chrome120',outfile:'dist/ui-tests/fixture.js'});
const browser=await chromium.launch({channel:'chromium',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1000,height:800}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setContent('<h1>Signup fixture</h1><form><label>Email <input type="email"></label><label><input id="agreement" type="checkbox">I agree</label><button type="submit">Continue</button></form>');await page.getByLabel('Email').focus();await page.addScriptTag({path:'dist/ui-tests/fixture.js'});await expect(page.getByLabel('Email')).toBeFocused();
 const region=page.getByRole('region',{name:'RedFlag agreement review'});await expect(region).toBeVisible();await expect(region.locator('.overall-grade')).toHaveText('?');await expect(region.locator('.flag-mark')).toHaveCount(0);
 await page.evaluate(()=>window.fixtureAllReady());await expect(region.locator('.overall-grade')).toHaveText('D');await expect(region.locator('.flag-mark')).toHaveCount(1);
 await page.evaluate(()=>window.fixtureOldGeneration());await expect(region.locator('.overall-grade')).toHaveText('D');
 await page.evaluate(()=>window.fixtureMissing());await expect(region.locator('.overall-grade')).toHaveText('?');await page.evaluate(()=>window.fixtureInvalidGrade());await expect(region.locator('.overall-grade')).toHaveText('?');
 await page.evaluate(()=>window.fixtureUnsafe());await expect(region.locator('img')).toHaveCount(0);await expect(region.locator('a[href^="javascript:"]')).toHaveCount(0);
 await page.getByLabel('Email').fill('fixture@example.com');await expect(page.locator('#agreement')).not.toBeChecked();await expect(page.getByRole('button',{name:'Continue',exact:true})).toBeEnabled();
 await region.getByRole('button',{name:'Open RedFlag'}).click();if((await page.evaluate(()=>window.fixtureCounts())).settings!==1)throw Error('Settings callback missing');
 await page.evaluate(()=>window.fixtureDisable());await expect(region).toHaveCount(0);await page.evaluate(()=>window.fixtureEnable());await expect(region).toBeVisible();await page.setViewportSize({width:360,height:640});await expect(region.getByRole('button',{name:'Dismiss'})).toBeInViewport();await region.getByRole('button',{name:'Dismiss'}).focus();await page.keyboard.press('Enter');await expect(region).toHaveCount(0);await page.evaluate(()=>window.fixtureUpdate());await expect(region).toHaveCount(0);if((await page.evaluate(()=>window.fixtureCounts())).dismissed!==1)throw Error('Dismiss callback missing');
 await page.evaluate(()=>window.fixtureDestroy());await page.evaluate(()=>window.fixtureAccess());const access=page.getByRole('region',{name:'Site access fixture'});await expect(access.getByRole('button')).toHaveCount(3);await access.getByRole('button',{name:'Allow access to https://signup.example',exact:true}).click();await expect(access.getByRole('button',{name:'Revoke access to https://signup.example',exact:true})).toBeFocused();await access.getByRole('button',{name:'Revoke access to https://signup.example',exact:true}).click();await expect(access.getByRole('button',{name:'Allow access to https://signup.example',exact:true})).toBeVisible();
 if(JSON.stringify(await page.evaluate(()=>window.fixturePermissionCalls()))!==JSON.stringify([['https://signup.example/*']]))throw Error('Unscoped site grant');if(errors.length)throw Error(errors.join('; '));console.log('Current overview passed: conservative unknown/rated transitions, generation guard, non-interference, unsafe metadata, responsive keyboard dismissal, settings callback and scoped site access.');
}finally{await browser.close();}
