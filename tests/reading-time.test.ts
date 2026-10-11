import test from 'node:test';
import assert from 'node:assert/strict';
import type {DocumentReview,ReviewState} from '../src/core/contracts.ts';
import {readingTimeSaved} from '../src/core/reading-time.ts';
const review:DocumentReview={document:{id:'p',url:'https://example.com/privacy',kind:'privacy',label:'Privacy',discoveredAt:new Date().toISOString()},status:'unrated',grade:'Unrated',coverage:'complete',cached:false,freshness:{},community:[],wordCount:2380,assessment:{documentId:'p',documentUrl:'https://example.com/privacy',kind:'privacy',grade:'Unrated',reason:'insufficient-evidence',coverage:'complete',summary:'Evidence is incomplete.',provider:'gemini',analyzedAt:new Date().toISOString(),model:'gemini-3.1-flash-lite',promptVersion:'redflag.prompt.v2',rubricVersion:'redflag.rubric.v3',contentHash:'a'.repeat(64),findings:[]}};
const state=(documents:DocumentReview[]):ReviewState=>({schemaVersion:1,pageKey:'site',pageUrl:'https://example.com',context:'browsing',documents,updatedAt:new Date().toISOString()});
test('estimated reading time counts real reviewed words once per URL without accumulating rechecks',()=>{
 const s=state([review,review]);assert.equal(readingTimeSaved(s).label,'Saved you ~10 minutes');assert.equal(readingTimeSaved(s).words,2380);assert.deepEqual(readingTimeSaved(s),readingTimeSaved(s));assert.equal(readingTimeSaved(state([{...review,wordCount:100}])).label,'Saved you <1 minute');
});
test('unread, failed, stale, invalid and pending policies never claim saved minutes',()=>{
 for(const d of [{...review,status:'pending' as const},{...review,assessment:undefined},{...review,assessment:{...review.assessment!,reason:'quota' as const}},{...review,freshness:{cacheExpiresAt:'2020-01-01T00:00:00Z'}},{...review,wordCount:NaN},{...review,wordCount:-100},{...review,wordCount:undefined}])assert.equal(readingTimeSaved(state([d])).words,0);
});
