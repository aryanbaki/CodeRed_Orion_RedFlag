import {chromium} from '@playwright/test';
import {build} from 'esbuild';
import assert from 'node:assert/strict';
const bundle=await build({entryPoints:['src/background/extraction.ts'],bundle:true,write:false,format:'iife',globalName:'extractionFixture',platform:'browser'});
const browser=await chromium.launch({channel:'chromium',headless:true});
try {
 const page=await browser.newPage();
 await page.addScriptTag({content:bundle.outputFiles[0].text});
 const results=await page.evaluate(()=>{
   const clause='We collect account information to provide the service. We delete records after thirty days. '.repeat(10);
   const parse=body=>extractionFixture.extractLegalText(body,'html',new DOMParser());
   return [
     parse('<main><h1>Privacy Policy</h1><p>'+clause+'</p></main>'),
     parse('<main><h1>Privacy Policy</h1><p>'+clause+'</p><div hidden>Additional policy terms</div></main>'),
     parse('<div><h1>Privacy Policy</h1><p>'+clause+'</p></div>'),
     parse('<main><h1>Cookie Policy</h1><p>'+clause+'</p></main>'),
     parse('<main><h1>Privacy Policy</h1><p>'+clause+'</p><input type="password"></main>'),
     parse('<main><header><h1>Terms of Service</h1></header>Opening clause<ul><li>List introduction<p>'+clause+'</p>List ending</li></ul>Final clause</main>'),
     parse('<main><h1>Privacy Policy</h1><p>'+clause.repeat(90)+'</p>LAST POLICY CLAUSE</main>'),
     extractionFixture.extractLegalText('x'.repeat(250001),'text',new DOMParser()),
     parse('<title>Privacy Policy</title><h1>Privacy Policy</h1><div class="cmp-text">'+clause+'</div>'),
     parse('<title>Privacy Policy</title><h1>Privacy Policy</h1><div class="cmp-text">'+clause+'<div hidden>Hidden clause</div></div>'),
   ];
 });
 assert.deepEqual(results.map(r=>r.coverage),['complete','partial','partial','complete','partial','complete','complete','partial','complete','partial']);
 assert.equal(results[4].reason,'authentication-required');
 assert.ok(results[0].text.includes('We delete records'));
 for(const phrase of ['Terms of Service','Opening clause','List introduction','List ending','Final clause']) assert.ok(results[5].text.includes(phrase));
 assert.ok(results[6].text.length>60000);assert.ok(results[6].text.endsWith('LAST POLICY CLAUSE'));
 assert.equal(results[7].reason,'oversized');assert.equal(results[7].text,'');
 console.log('Static legal extraction, cookie scope, hidden sections, unknown layouts, and login rejection verified in Chromium.');
}finally{await browser.close();}
