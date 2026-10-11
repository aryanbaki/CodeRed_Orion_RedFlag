import {test} from 'node:test';
import assert from 'node:assert/strict';
import {summarizeReview} from '../src/core/summary.ts';
import {toolbarPresentation} from '../src/background/toolbar.ts';
import {pendingState} from '../src/background/validation.ts';
import {processDocument,type ProcessorDependencies} from '../src/background/processor.ts';
import {AnalysisFailure,failureMessage} from '../src/background/failures.ts';
import {contentHash} from '../src/background/cache.ts';
import {createDefaultPreferences,type DocumentAssessment,type DocumentReview} from '../src/core/contracts.ts';
const text='We retain your information indefinitely. These are complete public legal document terms for this service.';
const hash=await contentHash(text),now=new Date().toISOString(),versions={model:'model',promptVersion:'p',rubricVersion:'r'};
const review=(kind:'terms'|'privacy'='terms'):DocumentReview=>{
 const url=`https://service.com/${kind}`;
 return {document:{id:kind,url,kind,label:kind,discoveredAt:now},grade:'E',status:'ready',coverage:'complete',freshness:{},community:[],cached:false,
 assessment:{documentId:kind,documentUrl:url,kind,grade:'E',coverage:'complete',contentHash:hash,provider:'gemini',analyzedAt:now,...versions,summary:'Evidence',findings:[{id:'risk',category:'retention',severity:'high',title:'Retention',explanation:'Indefinite retention',quote:'We retain your information indefinitely.',sourceUrl:url}]}};
};
function state(documents:DocumentReview[]) {return {...pendingState('page','https://service.com/signup','signup',[]),documents};}
test('shared summary never averages a serious grade or hides missing, partial or stale coverage',()=>{
 const terms=review(),privacy=review('privacy');privacy.grade='A';privacy.assessment!.grade='A';
 assert.equal(summarizeReview(state([terms,privacy])).grade,'E');assert.equal(toolbarPresentation(state([terms,privacy])).text,'E');
 for(const incomplete of [{...privacy,coverage:'partial' as const},{...privacy,status:'pending' as const},{...privacy,freshness:{cacheExpiresAt:'2000-01-01T00:00:00Z'}}]) {
   const summary=summarizeReview(state([terms,incomplete]));assert.equal(summary.grade,'Unrated');assert.equal(summary.worstDocumentGrade,'E');assert.equal(toolbarPresentation(state([terms,incomplete])).text,'?');
 }
 assert.deepEqual(summarizeReview(state([terms])).missingKinds,['privacy']);
 const community={...terms,assessment:undefined,community:[],grade:'A' as const};assert.equal(summarizeReview(state([community])).worstDocumentGrade,'Unrated');
 assert.equal(toolbarPresentation().text,'?');assert.equal(toolbarPresentation(state([{...terms,status:'pending',assessment:undefined}])).text,'…');
});
function deps(overrides:Partial<ProcessorDependencies>={}):ProcessorDependencies {
 const prefs=createDefaultPreferences(now);prefs.aiConsent.enabled=true;prefs.aiConsent.grantedAt=now;
 return {preferences:async()=>prefs,download:async()=>({url:review().document.url,body:text,type:'text',retrievedAt:now}),extract:async()=>({text,coverage:'complete'}),versions:async()=>versions,analyze:async()=>review().assessment,catalog:async()=>[],cacheGet:async()=>undefined,cachePut:async()=>{},...overrides};
}
test('re-check discards prior assessment, bypasses cache and validates new exact quotations',async()=>{
 let calls=0,latest=review();
 await processDocument(review(),'service.com',deps({bypassCache:true,cacheGet:async()=>{throw new Error('Cache must be bypassed');},analyze:async()=>{calls++;return {...review().assessment,findings:[{...review().assessment!.findings[0],quote:'Invented new evidence'}]};}}),async r=>{latest=r;});
 assert.equal(calls,1);assert.equal(latest.grade,'Unrated');assert.equal(latest.reason,'invalid-response');assert.equal(latest.assessment,undefined);
});
test('source authentication and backend authentication are distinct and successful retry clears failures',async()=>{
 let latest=review();
 await processDocument(review(),'service.com',deps({analyze:async()=>{throw new AnalysisFailure('authentication-required');}}),async r=>{latest=r;});
 assert.equal(latest.failure?.stage,'analysis');assert.match(latest.failure!.message,/server or provider authorization/);
 assert.match(failureMessage('retrieval','authentication-required'),/public document requires authentication/);
 await processDocument(latest,'service.com',deps(),async r=>{latest=r;});assert.equal(latest.grade,'E');assert.equal(latest.failure,undefined);
 await processDocument(latest,'service.com',deps({analyze:async()=>{throw new AnalysisFailure('quota',Infinity);}}),async r=>{latest=r;});assert.equal((latest as DocumentReview).failure?.retryAfterSeconds,undefined);
});
