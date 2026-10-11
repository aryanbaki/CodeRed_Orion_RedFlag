import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHistoryApi,HistoryError} from '../src/history/store.ts';
import {snapshotReview,decodeHistory,HISTORY_STORAGE_KEY,MAX_HISTORY_BYTES} from '../src/history/model.ts';
import type {ReviewState,DocumentReview} from '../src/core/contracts.ts';
const now=Date.parse('2026-10-11T12:00:00Z');
function doc(kind:'terms'|'privacy'='terms',grade:'D'|'B'|'Unrated'='D'):DocumentReview {
  const url=`https://policies.com/${kind}`,at=new Date(now).toISOString();
  return {document:{id:kind,url,kind,label:kind,discoveredAt:at},status:grade==='Unrated'?'unrated':'ready',grade,coverage:grade==='Unrated'?'partial':'complete',reason:grade==='Unrated'?'incomplete':undefined,freshness:{retrievedAt:at},community:[],cached:false,assessment:{documentId:kind,documentUrl:url,kind,grade,coverage:grade==='Unrated'?'partial':'complete',reason:grade==='Unrated'?'incomplete':undefined,findings:[{id:'f1',category:'retention',severity:'high',title:'Retention',explanation:'Records are retained.',quote:'We keep records indefinitely.',sourceUrl:url}],summary:'Supported evidence',provider:'gemini',analyzedAt:at,model:'fixture',promptVersion:'p1',rubricVersion:'r1',contentHash:'a'.repeat(64)}};
}
const state=(host='service.com',at=now):ReviewState=>({schemaVersion:1,pageKey:'generation1',pageUrl:`https://${host}/signup?account=private#secret`,context:'signup',updatedAt:new Date(at).toISOString(),documents:[doc(),doc('privacy','B')]});
function memory(){let value:Record<string,unknown>={},fail=false;return {storage:{get:async()=>structuredClone(value),set:async(items:Record<string,unknown>)=>{if(fail)throw new Error('quota');value=structuredClone({...value,...items});}},read:()=>value,replace:(raw:unknown)=>{value={[HISTORY_STORAGE_KEY]:raw};},fail:(wanted:boolean)=>{fail=wanted;}};}
const lock=async<T>(task:()=>Promise<T>)=>task();
test('empty, multiple sites, independent grades, update and restart persist only checked reviews',async()=>{
  const m=memory(),api=createHistoryApi(m.storage,lock,()=>now);
  assert.deepEqual(await api.list(),[]);
  await api.recordReview(state());await api.recordReview(state('other.com'));
  assert.equal((await api.list()).length,2);assert.deepEqual((await api.get('https://service.com'))!.documents.map(d=>d.grade),['D','B']);
  const updated=state('service.com',now+1000);updated.documents[1]=doc('privacy','Unrated');await api.recordReview(updated);
  const restart=createHistoryApi(m.storage,lock,()=>now+1000);assert.equal((await restart.get('https://service.com'))!.documents[1].grade,'Unrated');
  assert.equal((await restart.get('https://service.com'))!.firstCheckedAt,new Date(now).toISOString());
  const serialized=JSON.stringify(m.read());assert.ok(!serialized.includes('account=private'));assert.ok(!serialized.includes('/signup'));assert.ok(!serialized.includes('#secret'));
  await assert.rejects(api.recordReview({...state(),documents:[]}));
});
test('delete and clear are independent of preferences and late generations cannot resurrect history',async()=>{
  const m=memory(),api=createHistoryApi(m.storage,lock,()=>now);await api.recordReview(state());
  await api.remove('https://service.com');assert.deepEqual(await api.list(),[]);await api.recordReview(state());assert.deepEqual(await api.list(),[]);
  const newer={...state(),pageKey:'generation2'};await api.recordReview(newer,{requireExisting:true});assert.deepEqual(await api.list(),[]);
  await api.recordReview(newer);assert.equal((await api.list()).length,1);await api.clear();assert.deepEqual(await api.list(),[]);await api.recordReview(newer);assert.deepEqual(await api.list(),[]);
});
test('failed writes retain committed data and expose actionable errors',async()=>{
  const m=memory(),api=createHistoryApi(m.storage,lock,()=>now);await api.recordReview(state());m.fail(true);
  await assert.rejects(api.recordReview(state('other.com')),HistoryError);await assert.rejects(api.remove('https://service.com'),HistoryError);assert.equal((await api.list()).length,1);
  const bad=createHistoryApi({get:async()=>{throw new Error('storage');},set:async()=>{}},lock,()=>now);await assert.rejects(bad.list(),HistoryError);
});
test('unknown older/future formats are preserved until explicit reset; malformed data is not trusted',async()=>{
  const m=memory(),api=createHistoryApi(m.storage,lock,()=>now);m.replace({schemaVersion:0,sites:[{secret:'old'}]});await assert.rejects(api.list(),HistoryError);await assert.rejects(api.recordReview(state()),HistoryError);await api.clear();assert.deepEqual(await api.list(),[]);
  assert.equal(decodeHistory({schemaVersion:1,sites:[{origin:'javascript:evil'}],deleted:[]},now).data.sites.length,0);
});
test('retention, count and byte caps bound history; unknown fields and unsafe URLs are discarded',async()=>{
  const m=memory(),api=createHistoryApi(m.storage,lock,()=>now);for(let i=0;i<60;i++)await api.recordReview(state(`service${i}.com`));assert.equal((await api.list()).length,50);assert.ok(new TextEncoder().encode(JSON.stringify(m.read())).byteLength<MAX_HISTORY_BYTES);
  await api.recordReview(state('old.com',now-31*86400000));assert.equal(await api.get('https://old.com'),undefined);
  const raw=state() as ReviewState & {formFields?:string;credentials?:string};raw.formFields='private-form';raw.credentials='private-token';raw.documents[0].document.url+='?token=secret';raw.documents[1].document.label='private name';
  const clean=snapshotReview(raw),serialized=JSON.stringify(clean);assert.equal(clean.documents[0].grade,'Unrated');assert.equal(clean.documents[0].reason,'unsafe-url');assert.ok(!serialized.includes('token=secret'));assert.ok(!serialized.includes('private name'));assert.ok(!serialized.includes('private-form'));assert.ok(!serialized.includes('private-token'));
});
