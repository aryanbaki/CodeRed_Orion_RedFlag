// Real Chromium MV3 → real local HTTP endpoint; injected output, no Google calls.
import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp, mkdir, writeFile, rm, realpath} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {once} from 'node:events';
import type {AddressInfo} from 'node:net';
import {createAnalysisServer} from '../src/server/http.ts';
import {gradeOutput} from '../src/server/grading.ts';
import type {AnalyzeRequest} from '../src/core/contracts.ts';
const directory=await realpath(await mkdtemp(join(tmpdir(),'redflag-backend-browser-')));
const extension=join(directory,'extension');
const profile=join(directory,'profile');
const id=createHash('sha256').update(extension).digest('hex').slice(0,32).replace(/[0-9a-f]/g,c=>String.fromCharCode(97+parseInt(c,16)));
const origin=`chrome-extension://${id}`;
const token='simulated-demo-token-'.repeat(2);
const config={apiKey:'simulated-only',model:'simulated-model',token,allowedOrigin:origin,port:8787};
const clauses=[
  {category:'renewal',quote:'Your subscription automatically renews each month.',severity:'medium'},
  {category:'cancellation',quote:'Cancellations must be requested thirty days before renewal.',severity:'medium'},
  {category:'arbitration',quote:'All disputes require binding arbitration and class actions are waived.',severity:'high'},
  {category:'content-rights',quote:'You grant us an irrevocable license to reuse your uploaded content.',severity:'high'},
];
const text=clauses.map(c=>c.quote).join('\n');
const request:AnalyzeRequest={schemaVersion:1,document:{id:'fixture-terms',kind:'terms',url:'https://example.com/terms',text,contentHash:createHash('sha256').update(text).digest('hex'),coverage:'complete',retrievedAt:new Date().toISOString()}};
let seenOrigin:string|undefined;
const server=createAnalysisServer(config,async r=>gradeOutput({findings:clauses.map(c=>({...c,explanation:'This explicit contractual restriction warrants review.'})),assessments:clauses.map(c=>({category:c.category,status:'risk',quote:c.quote,explanation:'This category has an explicit adverse provision.'}))},r.document,config.model));
server.on('request',req=>{if(req.method === 'POST') seenOrigin=req.headers.origin;});
let context:Awaited<ReturnType<typeof chromium.launchPersistentContext>>|undefined;
try {
  server.listen(0,'127.0.0.1');await once(server,'listening');
  const endpoint=`http://127.0.0.1:${(server.address() as AddressInfo).port}/api/analyze`;
  await mkdir(extension);
  await writeFile(join(extension,'manifest.json'),JSON.stringify({manifest_version:3,name:'RedFlag backend transport test fixture',version:'0.0.1',background:{service_worker:'background.js'},host_permissions:['http://127.0.0.1/*']}));
  await writeFile(join(extension,'background.js'),'chrome.runtime.onInstalled.addListener(() => {});');
  context=await chromium.launchPersistentContext(profile,{channel:'chromium',headless:true,args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`]});
  const worker=context.serviceWorkers().find(w=>w.url().startsWith(origin)) ?? await context.waitForEvent('serviceworker');
  assert.ok(worker.url().startsWith(origin+'/'));
  const response=await worker.evaluate(async ({endpoint,token,request})=>{
    const r=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify(request),credentials:'omit'});
    return {status:r.status,body:await r.json()};
  },{endpoint,token,request});
  assert.equal(seenOrigin,origin);assert.equal(response.status,200);assert.equal(response.body.schemaVersion,1);
  assert.equal(response.body.assessment.documentId,request.document.id);assert.equal(response.body.assessment.contentHash,request.document.contentHash);
  assert.equal(response.body.assessment.grade,'F');assert.equal(response.body.assessment.findings.length,4);
  const denied=await worker.evaluate(async ({endpoint,request})=>{
    const r=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(request),credentials:'omit'});
    return {status:r.status,body:await r.json()};
  },{endpoint,request});
  assert.equal(denied.status,401);assert.equal(denied.body.error.code,'authentication-required');
  console.log('Backend browser transport passed: real MV3 Origin and bearer authorization, canonical grade/evidence response, missing-token rejection. Provider analysis was simulated.');
} finally {
  await context?.close();server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));await rm(directory,{recursive:true,force:true});
}
