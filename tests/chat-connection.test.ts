import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {createHash} from 'node:crypto';
import type {AddressInfo} from 'node:net';
import {answerPolicyQuestion,validateChatRequest} from '../src/server/chat.ts';
import {parseBackend,checkBackend} from '../src/background/backend.ts';
import {validateChatAnswer} from '../src/background/chat.ts';
import {createAnalysisServer} from '../src/server/http.ts';
import {gradeOutput} from '../src/server/grading.ts';
import {validateAssessment} from '../src/background/validation.ts';
import type {ChatCommand,ChatRequest} from '../src/core/chat-contracts.ts';
const quote='You may delete your account and all personal data at any time.';
const text='Public privacy policy. '+('Ordinary public legal text. '.repeat(8500))+'\n'+quote;
const document={id:'privacy',url:'https://example.com/privacy',kind:'privacy' as const,text,contentHash:createHash('sha256').update(text).digest('hex'),coverage:'complete' as const,retrievedAt:new Date().toISOString()};
const command:ChatCommand={type:'redflag/chat',schemaVersion:1,pageKey:'current',question:'Can I delete my account?',history:[]};
const request:ChatRequest={schemaVersion:1,pageKey:command.pageKey,question:command.question,history:[],documents:[document]};
const backend={baseUrl:'http://127.0.0.1:8787',accessToken:'test-token-'.repeat(4),model:'gemini-3.5-flash',fallbackModels:['gemini-3.1-flash-lite','gemini-2.5-flash-lite'],promptVersion:'redflag.prompt.v2',rubricVersion:'redflag.rubric.v3'};
const config={apiKey:'test-only',model:backend.model,fallbackModels:backend.fallbackModels,timeoutMs:30000,retries:0,allowedOrigin:'chrome-extension://'+'a'.repeat(32),token:backend.accessToken,port:8787};
const output={claims:[{text:'You can delete your account and personal data at any time.',documentId:document.id,quote}],missingEvidence:false};
const provider=(value:unknown):typeof fetch=>async()=>new Response(JSON.stringify({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(value)}]}}]}));
test('chat sends the entire legal text including the final clause, ignores document instructions, and derives source URLs',async()=>{
 const answer=await answerPolicyQuestion(request,config,async(url,init)=>{
  const body=JSON.parse(String(init?.body)),input=JSON.parse(body.contents[0].parts[0].text);
  assert.equal(input.documents[0].text,text);assert.ok(input.documents[0].text.endsWith(quote));assert.match(body.systemInstruction.parts[0].text,/untrusted data/);assert.equal(body.store,false);assert.equal(body.tools,undefined);
  return provider(output)(url,init);
 });
 assert.equal(answer.model,backend.model);assert.equal(answer.citations[0].sourceUrl,document.url);assert.equal(answer.citations[0].quote,quote);assert.match(answer.answer,/\[1\]/);
 assert.deepEqual(validateChatAnswer(answer,command,[document],backend),answer);
 assert.throws(()=>validateChatAnswer({...answer,pageKey:'old'},command,[document],backend));
 assert.throws(()=>validateChatAnswer({...answer,citations:[{...answer.citations[0],sourceUrl:'https://attacker.com'}]},command,[document],backend));
});
test('chat rejects fabricated, altered and cross-document evidence and malformed provider output without backup',async()=>{
 for(const raw of [{...output,claims:[{...output.claims[0],quote:'Your passwords are never stored by any company.'}]},{...output,claims:[{...output.claims[0],documentId:'terms'}]},{...output,claims:[{...output.claims[0],quote:quote.toUpperCase()}]},null,{...output,grade:'S'}]){
  let calls=0;await assert.rejects(answerPolicyQuestion(request,config,async(...args)=>{calls++;return provider(raw)(...args);}),error=>(error as {code:string}).code==='invalid-provider-output');assert.equal(calls,1);
 }
});
test('missing policy evidence and partial coverage remain explicit; authentication never falls back',async()=>{
 const r=await answerPolicyQuestion({...request,documents:[{...document,coverage:'partial'}]},config,provider({claims:[],missingEvidence:true}));
 assert.match(r.answer,/available policy text/);assert.match(r.answer,/do not state enough/);assert.equal(r.citations.length,0);
 let calls=0;await assert.rejects(answerPolicyQuestion(request,config,async()=>{calls++;return new Response('',{status:403});}));assert.equal(calls,1);
});
test('approved chat backup preserves the credential and records actual model on quota',async()=>{
 const models:string[]=[];
 const r=await answerPolicyQuestion(request,config,async(url,init)=>{models.push(String(url));assert.equal((init?.headers as Record<string,string>)['x-goog-api-key'],config.apiKey);return models.length===1?new Response('',{status:429}):provider(output)(url,init);});
 assert.equal(r.model,'gemini-3.1-flash-lite');assert.equal(models.length,2);
});
test('chat input rejects bad hashes, repeated documents, arbitrary URLs and unbounded questions/history',()=>{
 for(const bad of [{...request,question:'x'.repeat(2001)},{...request,history:Array(11).fill({role:'user',text:'hi'})},{...request,documents:[document,document]},{...request,documents:[{...document,url:'http://127.0.0.1/private'}]},{...request,documents:[{...document,contentHash:'0'.repeat(64)}]},{...request,secret:'do not send'}])assert.throws(()=>validateChatRequest(bad));
});
test('connection requires a bounded token, public HTTPS or loopback HTTP and compatible backend versions',async()=>{
 assert.ok(parseBackend(backend));
 for(const bad of [{...backend,accessToken:'short'},{...backend,baseUrl:'http://example.com'},{...backend,baseUrl:'https://user:password@example.com'},{...backend,baseUrl:'https://10.1.2.3'},{...backend,rubricVersion:'old'},{...backend,baseUrl:'https://example.com?secret=yes'}])assert.equal(parseBackend(bad),undefined);
 await checkBackend(backend,async(_url,init)=>{assert.equal((init?.headers as Record<string,string>).Authorization,'Bearer '+backend.accessToken);assert.equal(init?.credentials,'omit');return Response.json({schemaVersion:1,model:backend.model,fallbackModels:backend.fallbackModels,promptVersion:backend.promptVersion,rubricVersion:backend.rubricVersion});});
 await assert.rejects(checkBackend(backend,async()=>Response.json({schemaVersion:1,model:'different'})));
});
test('health and chat endpoints authenticate exact extension origin and validate input before the provider',async()=>{
 let calls=0;const server=createAnalysisServer(config,undefined,async r=>{calls++;return {schemaVersion:1,pageKey:r.pageKey,answer:'Supported answer [1]',model:config.model,citations:[{documentId:document.id,sourceUrl:document.url,quote}]};});
 server.listen(0,'127.0.0.1');await once(server,'listening');const base=`http://127.0.0.1:${(server.address() as AddressInfo).port}`,headers={Origin:config.allowedOrigin,Authorization:'Bearer '+config.token,'Content-Type':'application/json'};
 try{
  assert.equal((await fetch(base+'/api/health',{headers})).status,200);
  assert.equal((await fetch(base+'/api/health',{headers:{Origin:config.allowedOrigin}})).status,401);
  assert.equal((await fetch(base+'/api/health',{headers:{...headers,Origin:'https://example.com'}})).status,403);
  const good=await fetch(base+'/api/chat',{method:'POST',headers,body:JSON.stringify(request)});assert.equal(good.status,200);assert.equal((await good.json()).pageKey,'current');
  assert.equal((await fetch(base+'/api/chat',{method:'POST',headers,body:JSON.stringify({...request,documents:[]})})).status,400);assert.equal(calls,1);
 }finally{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));}
});
test('summary retains exact protective evidence and supported adverse clauses even with incomplete grade evidence',()=>{
 const raw={findings:[],assessments:[{category:'sharing',status:'protective',quote,explanation:'You can delete your account and personal data at any time.'},{category:'retention',status:'not-found',quote:null,explanation:'Retention limits are not stated in the supplied text.'},{category:'tracking',status:'not-found',quote:null,explanation:'Tracking restrictions are not stated in the supplied text.'}]};
 const a=gradeOutput(raw,document,config.model);assert.equal(a.grade,'Unrated');assert.equal(a.protections?.[0].quote,quote);assert.match(a.summary,/delete/);assert.doesNotMatch(a.summary,/score/);
 validateAssessment(a,document,backend);assert.throws(()=>validateAssessment({...a,protections:[{...a.protections![0],quote:'Invented favorable privacy protection.'}]},document,backend));
});
test('an unsupported favorable quotation is discarded while independent exact adverse findings remain Unrated',()=>{
 const riskQuote='We share your personal data with advertising partners.';
 const d={...document,text:riskQuote,contentHash:createHash('sha256').update(riskQuote).digest('hex')};
 const finding={category:'sharing',severity:'high',quote:riskQuote,explanation:'Personal data may be shared with advertising partners.'};
 const a=gradeOutput({findings:[finding],assessments:[{category:'sharing',status:'risk',quote:riskQuote,explanation:finding.explanation},{category:'retention',status:'protective',quote:'An invented favorable retention protection.',explanation:'Invented favorable retention explanation.'},{category:'tracking',status:'not-found',quote:null,explanation:'Tracking restrictions are not stated in the text.'}]},d,config.model);
 assert.equal(a.grade,'Unrated');assert.equal(a.reason,'insufficient-evidence');assert.equal(a.findings[0].quote,riskQuote);assert.deepEqual(a.protections,[]);assert.ok(!a.summary.includes('Invented'));validateAssessment(a,d,backend);
 assert.throws(()=>gradeOutput({findings:[finding],assessments:[{category:'sharing',status:'protective',quote:'An invented favorable sharing protection.',explanation:'Invented favorable sharing explanation.'},{category:'retention',status:'not-found',quote:null,explanation:'Retention limits are not stated in the text.'},{category:'tracking',status:'not-found',quote:null,explanation:'Tracking restrictions are not stated in the text.'}]},d,config.model),/Contradictory/);
});
