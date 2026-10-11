import {test} from 'node:test';
import assert from 'node:assert/strict';
import {publicDocumentUrl,exactDomain} from '../src/discovery/urls.ts';
import {retrievePublicDocument,RetrievalError} from '../src/background/retrieval.ts';
import {contentHash,cacheIdentity,applicableCache,currentCommunity,type CacheEntry} from '../src/background/cache.ts';
import {lookupCommunity,parseCommunityCatalog} from '../src/background/community.ts';
import {processDocument,failureReason,type ProcessorDependencies} from '../src/background/processor.ts';
import {pendingState,permitsAi,validateDiscovery,validateAssessment} from '../src/background/validation.ts';
import {createDefaultPreferences,type AnalysisDocument,type DocumentAssessment,type CommunityReference} from '../src/core/contracts.ts';
const url = 'https://service.com/terms';
const text = 'We retain your information indefinitely. These are the complete plain text terms for this public service.';
const versions = {model:'test-model',promptVersion:'p1',rubricVersion:'r1'};
const document:AnalysisDocument = {id:'terms',url,kind:'terms',text,retrievedAt:new Date().toISOString(),coverage:'complete',contentHash:await contentHash(text)};
const assessment:DocumentAssessment = {documentId:'terms',documentUrl:url,kind:'terms',grade:'D',coverage:'complete',findings:[{id:'f1',category:'retention',severity:'high',title:'Retention',explanation:'Indefinite retention',quote:'We retain your information indefinitely.',sourceUrl:url}],summary:'Retention concern',provider:'gemini',analyzedAt:new Date().toISOString(),...versions,contentHash:document.contentHash};
const reference:CommunityReference = {provider:'tosdr',serviceId:'1',serviceName:'Service',sourceUrl:'https://tosdr.org/en/service/1',rating:'B',scope:'service',reviewStatus:'reviewed',reviewedAt:new Date().toISOString(),fetchedAt:new Date().toISOString(),freshness:'current',attribution:'ToS;DR contributors — CC BY-SA 3.0'};
test('URL identities resolve actual bases, strip fragments and reject private/token/unsafe destinations',() => {
  assert.equal(publicDocumentUrl('../terms#clause','https://service.com/signup/start'),url);
  for (const raw of ['javascript:alert(1)','data:text/html,test','file:///terms','https://user:pass@service.com/terms','https://service.com/terms?token=private','http://localhost/','http://127.1/','http://2130706433/','http://[::1]/','https://10.0.0.1/','https://metadata.google.internal/','https://127.0.0.1.nip.io/','https://service.com:8080/']) assert.throws(() => publicDocumentUrl(raw));
  assert.equal(publicDocumentUrl('https://other.com/privacy#top'),'https://other.com/privacy');
});
test('domain matching uses explicit exact hosts including IDN; rejects lookalikes and shared tenants',() => {
  assert.ok(exactDomain('SERVICE.com','service.com'));
  assert.ok(exactDomain('bücher.de','xn--bcher-kva.de'));
  for (const host of ['service.com.attacker.com','evilservice.com','tenant.service.com','service.com/path','a.github.io']) assert.equal(exactDomain(host,'service.com'),false);
  assert.equal(exactDomain('a.github.io','b.github.io'),false);
});
test('retrieval permission, redirect, auth, partial, MIME and size failures stay explicit',async () => {
  let calls = 0;
  await assert.rejects(retrievePublicDocument(url,async () => false,async () => {calls++;return new Response();}),e => e instanceof RetrievalError && e.reason === 'permission-denied');
  assert.equal(calls,0);
  for (const [status,reason] of [[301,'redirect-unverified'],[401,'authentication-required'],[403,'authentication-required'],[404,'inaccessible'],[206,'incomplete']] as const) {
    await assert.rejects(retrievePublicDocument(url,async () => true,async () => new Response('body',{status,headers:{'content-type':'text/plain'}})),e => e instanceof RetrievalError && e.reason === reason);
  }
  for (const response of [new Response('pdf',{headers:{'content-type':'application/pdf'}}),new Response('x'.repeat(2000001),{headers:{'content-type':'text/plain'}}),new Response('',{headers:{'content-type':'text/plain'}})]) await assert.rejects(retrievePublicDocument(url,async () => true,async () => response));
  await assert.rejects(retrievePublicDocument(url,async () => true,async () => {throw new DOMException('timeout','TimeoutError');}),e => e instanceof RetrievalError && e.reason === 'timeout');
  await assert.rejects(retrievePublicDocument(url,async () => true,async () => {throw new TypeError('offline');}),e => e instanceof RetrievalError && e.reason === 'network-error');
});
test('retrieval omits cookies/referrer, forbids automatic redirects and bounds reads',async () => {
  const download = await retrievePublicDocument(url,async () => true,async (input,init) => {
    assert.equal(input,url);assert.equal(init?.credentials,'omit');assert.equal(init?.redirect,'manual');assert.equal(init?.referrerPolicy,'no-referrer');assert.ok(init?.signal);
    return new Response(text,{headers:{'content-type':'text/plain; charset=utf-8'}});
  });assert.equal(download.body,text);assert.equal(download.type,'text');
});
test('cache invalidates content, scope, expiry, coverage and analysis versions',() => {
  const entry:CacheEntry = {url,kind:'terms',contentHash:document.contentHash,expiresAt:new Date(Date.now()+60000).toISOString(),assessment};
  assert.equal(applicableCache(entry,document,versions)?.grade,'D');
  assert.notEqual(cacheIdentity(document,versions),cacheIdentity({...document,kind:'privacy'},versions));
  for (const input of [{...document,contentHash:'changed'},{...document,kind:'privacy' as const},{...document,coverage:'partial' as const}]) assert.equal(applicableCache(entry,input,versions),undefined);
  assert.equal(applicableCache({...entry,expiresAt:'invalid'},document,versions),undefined);
  assert.equal(applicableCache({...entry,expiresAt:new Date(0).toISOString()},document,versions),undefined);
  for (const key of ['model','promptVersion','rubricVersion'] as const) assert.equal(applicableCache(entry,document,{...versions,[key]:'new'}),undefined);
});
test('ToS;DR catalog preserves attribution/scope/review dates and cannot infer document grades',() => {
  const catalog = parseCommunityCatalog([{domains:['service.com'],reference}]);
  assert.equal(lookupCommunity('service.com',url,catalog)[0]?.attribution,reference.attribution);
  assert.equal(lookupCommunity('service.com.attacker.com',url,catalog).length,0);
  assert.equal(lookupCommunity('tenant.service.com',url,catalog).length,0);
  assert.equal(currentCommunity(reference,url),false);
  assert.equal(lookupCommunity('service.com',url,[{domains:['service.com'],reference:{...reference,reviewedAt:undefined}}])[0].freshness,'unknown');
  assert.equal(lookupCommunity('service.com',url,[{domains:['service.com'],reference:{...reference,reviewedAt:'2000-01-01T00:00:00Z'}}])[0].freshness,'stale');
  assert.equal(parseCommunityCatalog([{domains:['service.com'],reference:{...reference,sourceUrl:'https://attacker.com/'}}]).length,0);
});
function deps(overrides:Partial<ProcessorDependencies> = {}):ProcessorDependencies {
  return {preferences:async () => createDefaultPreferences(new Date().toISOString()),download:async () => ({url,body:text,type:'text',retrievedAt:document.retrievedAt}),extract:async () => ({text,coverage:'complete'}),versions:async () => versions,analyze:async () => assessment,catalog:async () => [{domains:['service.com'],reference}],cacheGet:async () => undefined,cachePut:async () => {},...overrides};
}
const review = () => pendingState('page','https://service.com/signup','signup',[{id:'terms',url,kind:'terms',label:'Terms of Service',discoveredAt:new Date().toISOString()}]).documents[0];
test('fresh verified cache avoids AI, missing consent never transmits, community stays separate',async () => {
  let calls = 0;let latest = review();
  const entry:CacheEntry = {url,kind:'terms',contentHash:document.contentHash,expiresAt:new Date(Date.now()+60000).toISOString(),assessment};
  await processDocument(review(),'service.com',deps({cacheGet:async () => entry,analyze:async () => {calls++;return assessment;}}),async r => {latest = r;});
  assert.equal(calls,0);assert.equal(latest.grade,'D');assert.equal(latest.cached,true);
  await processDocument(review(),'service.com',deps({analyze:async () => {calls++;return assessment;}}),async r => {latest = r;});
  assert.equal(calls,0);assert.equal(latest.grade,'Unrated');assert.equal(latest.reason,'ai-consent-required');assert.equal(latest.community[0].rating,'B');
});
test('independent document failures preserve other results; consented missing evidence uses AI',async () => {
  const prefs = createDefaultPreferences(new Date().toISOString());prefs.aiConsent.enabled=true;prefs.aiConsent.grantedAt=new Date().toISOString();
  let latest = review(),calls=0;
  await processDocument(review(),'service.com',deps({preferences:async () => prefs,analyze:async () => {calls++;return assessment;}}),async r => {latest=r;});
  assert.equal(latest.status,'ready');assert.equal(calls,1);
  let failed = review();
  await processDocument({...review(),document:{...review().document,id:'privacy',kind:'privacy'}},'service.com',deps({download:async () => {throw new RetrievalError('authentication-required');}}),async r => {failed=r;});
  assert.equal(failed.reason,'authentication-required');assert.equal(latest.grade,'D');
  prefs.aiConsent.noticeVersion='old';assert.equal(permitsAi(prefs),false);
});
test('message and assessment validation reject form payloads, stale page identity and fabricated evidence',() => {
  assert.throws(() => validateDiscovery({pageUrl:'https://attacker.com/signup',context:'signup',documents:[]},'https://service.com/signup'));
  assert.throws(() => validateDiscovery({pageUrl:'https://service.com/signup',context:'signup',documents:[{...review().document,url:url+'?account=123'}]},'https://service.com/signup'));
  const parsed=validateDiscovery({pageUrl:'https://service.com/signup',context:'signup',documents:[{...review().document,account:'secret'}]},'https://service.com/signup');
  assert.equal('account' in parsed.documents[0],false);
  assert.throws(() => validateAssessment({...assessment,findings:[{...assessment.findings[0],quote:'Made up policy evidence'}]},document,versions));
  assert.throws(() => validateAssessment({...assessment,contentHash:'wrong'},document,versions));
});
test('deadline covers stalled fetches and response streams even with non-cooperative adapters',async () => {
  // Keep Node alive: AbortSignal.timeout itself uses an unreferenced timer.
  const keepalive=setInterval(() => {},100);
  try {
    await assert.rejects(retrievePublicDocument(url,async () => true,async () => new Promise(() => {}),10),e => e instanceof RetrievalError && e.reason === 'timeout');
    await assert.rejects(retrievePublicDocument(url,async () => true,async () => new Response(new ReadableStream({start(){}}),{headers:{'content-type':'text/plain'}}),10),e => e instanceof RetrievalError && e.reason === 'timeout');
  } finally {clearInterval(keepalive);}
});
test('invalid cache evidence is discarded before consented fallback',async () => {
  const prefs=createDefaultPreferences(new Date().toISOString());prefs.aiConsent.enabled=true;prefs.aiConsent.grantedAt=new Date().toISOString();
  const invalid:CacheEntry={url,kind:'terms',contentHash:document.contentHash,expiresAt:new Date(Date.now()+60000).toISOString(),assessment:{...assessment,findings:[{...assessment.findings[0],quote:'This quote never appeared in the legal document.'}]}};
  let calls=0,latest=review();
  await processDocument(review(),'service.com',deps({preferences:async()=>prefs,cacheGet:async()=>invalid,analyze:async()=>{calls++;return assessment;}}),async r=>{latest=r;});
  assert.equal(calls,1);assert.equal(latest.cached,false);assert.equal(latest.grade,'D');
});

test('oversized extracted legal text retains its specific Unrated reason', () => {
  assert.equal(failureReason(new Error('oversized')), 'too-large');
});
