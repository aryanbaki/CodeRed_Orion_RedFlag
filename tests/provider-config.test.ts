import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readProviderConfig} from '../src/server/provider-config.ts';
const keys={GEMINI_FREE_API_KEY:'simulated-free',GEMINI_PAID_API_KEY:'simulated-paid',GEMINI_API_KEY:'simulated-legacy',GEMINI_MODEL:'test-model'};
test('selects free and paid credentials explicitly, retaining the legacy single-key configuration',()=>{
  assert.equal(readProviderConfig({...keys,GEMINI_PROFILE:'free'}).apiKey,'simulated-free');
  assert.equal(readProviderConfig({...keys,GEMINI_PROFILE:'paid'}).apiKey,'simulated-paid');
  assert.equal(readProviderConfig(keys).apiKey,'simulated-legacy');
  assert.equal(readProviderConfig({...keys,GEMINI_PROFILE:'free',GEMINI_FREE_MODEL:'test-free-model'}).model,'test-free-model');
  assert.equal(readProviderConfig({...keys,GEMINI_PROFILE:'paid',GEMINI_PAID_MODEL:'test-paid-model'}).model,'test-paid-model');
});
test('missing selected key never falls back to a paid/default key; unsupported providers fail explicitly',()=>{
  assert.throws(()=>readProviderConfig({...keys,GEMINI_PROFILE:'free',GEMINI_FREE_API_KEY:''}),/configuration/);
  assert.throws(()=>readProviderConfig({...keys,GEMINI_PROFILE:'paid',GEMINI_PAID_API_KEY:''}),/configuration/);
  assert.throws(()=>readProviderConfig({...keys,GEMINI_PROFILE:'automatic'}),/profile/);
  for(const AI_PROVIDER of ['openai','anthropic','custom','unknown']) assert.throws(()=>readProviderConfig({...keys,AI_PROVIDER}),/not implemented/);
  const active=readProviderConfig({...keys,AI_PROVIDER:'gemini',GEMINI_PROFILE:'free',OPENAI_API_KEY:'inactive-key',ANTHROPIC_API_KEY:'inactive-key',CUSTOM_API_KEY:'inactive-key'});
  assert.equal(active.provider,'gemini');assert.equal(active.profile,'free');assert.equal(Object.values(active).includes('inactive-key'),false);
});
test('user-approved backups preserve the selected key, allow disabling, and reject malformed lists',()=>{
 const selected=readProviderConfig({...keys,GEMINI_PROFILE:'free',GEMINI_MODEL:'gemini-3.5-flash'});
 assert.deepEqual(selected.fallbackModels,['gemini-3.1-flash-lite','gemini-2.5-flash-lite']);
 assert.equal(selected.apiKey,keys.GEMINI_FREE_API_KEY);
 assert.deepEqual(readProviderConfig({...keys,GEMINI_FALLBACK_MODELS:''}).fallbackModels,[]);
 for(const GEMINI_FALLBACK_MODELS of ['invalid/model','one,two,three','same,same']){
  assert.throws(()=>readProviderConfig({...keys,GEMINI_FALLBACK_MODELS}),/configuration/);
 }
});
