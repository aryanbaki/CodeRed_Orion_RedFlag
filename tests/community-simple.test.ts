import test from 'node:test';
import assert from 'node:assert/strict';
import {parseTosdrSearch,lookupCommunity} from '../src/background/community.ts';
import {summarizeReview} from '../src/core/summary.ts';
import {snapshotReview,reviewFromSite} from '../src/history/model.ts';
import {findCommonPolicies} from '../src/background/common-policies.ts';
test('official community ratings match declared domains and survive local history without invented document grades',()=>{
 const records=parseTosdrSearch({services:[{id:217,name:'Google',urls:['google.com','https://google.de'],rating:'E',is_comprehensively_reviewed:true}]});
 const refs=lookupCommunity('google.com','',records);
 const state={schemaVersion:1 as const,pageKey:'community',pageUrl:'https://google.com/',context:'browsing' as const,documents:[],community:refs,updatedAt:new Date().toISOString()};
 assert.equal(summarizeReview(state).grade,'E');
 assert.equal(summarizeReview(state).privacyGrade,'Unrated');
 assert.equal(summarizeReview(reviewFromSite(snapshotReview(state))).grade,'E');
 assert.equal(lookupCommunity('www.google.com','',records).length,1);
 assert.equal(lookupCommunity('evilgoogle.com','',records).length,0);
 assert.equal(lookupCommunity('tenant.google.com','',records).length,0);
 refs[0].fetchedAt='2020-01-01T00:00:00Z';
 assert.equal(summarizeReview(state).grade,'Unrated');
});
test('common policy discovery rejects homepage fallbacks and verifies cookie headings',async()=>{
 const urls:string[]=[];
 const found=await findCommonPolicies('https://policy-fixture.com',[],async url=>{
  urls.push(url);return {url,type:'html',body:url.endsWith('/cookie-policy')?'<h1>Cookie Policy</h1>':'<title>Welcome home</title>',retrievedAt:new Date().toISOString()};
 });
 assert.deepEqual(found.map(d=>d.kind),['cookies']);assert.ok(urls.length<=7);
});
