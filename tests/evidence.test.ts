import {test} from 'node:test';
import assert from 'node:assert/strict';
import {matchesDomain,prioritize,validateDocument,validateFindings} from '../src/core/evidence.ts';
import {demoDocument,demoFindings} from '../src/providers/demo.ts';
import {analyzeWithGemini} from '../src/providers/gemini.ts';
test('accepts exact evidence and rejects fabricated evidence',()=>{
  const f=demoFindings()[0];
  assert.equal(validateFindings([f],demoDocument)[0].source,'gemini');
  assert.throws(()=>validateFindings([{...f,quote:'We sell all your passwords.'}],demoDocument));
  assert.throws(()=>validateFindings([{...f,quote:''}],demoDocument));
  assert.throws(()=>validateFindings([{...f,category:'invented'}],demoDocument));
});
test('rejects oversized, empty, privileged and credential-bearing input',()=>{
  for(const text of ['', ' '.repeat(10),'a'.repeat(60001)]) assert.throws(()=>validateDocument({...demoDocument,text}));
  for(const url of ['chrome://settings','file:///tmp/policy','https://user:pass@example.com/']) assert.throws(()=>validateDocument({...demoDocument,url}));
});
test('matches domain boundaries, not substring lookalikes',()=>{
  assert.equal(matchesDomain('sub.example.com','example.com'),true);
  assert.equal(matchesDomain('EXAMPLE.COM.','example.com'),true);
  assert.equal(matchesDomain('notexample.com','example.com'),false);
  assert.equal(matchesDomain('example.com.attacker.test','example.com'),false);
});
test('personalization only reorders and does not change source evidence',()=>{
  const original=demoFindings(); const result=prioritize(original,['tracking']);
  assert.equal(result[0].category,'tracking');assert.equal(original[0].category,'sharing');
  assert.deepEqual(result.find(f=>f.category==='sharing'),original[0]);
});
test('Gemini adapter uses server credentials and validates returned evidence',async()=>{
  const fake = (async(url,init)=>{
    assert.match(String(url),/models\/test-model:generateContent$/);
    assert.equal((init?.headers as Record<string,string>)['x-goog-api-key'],'test-only');
    const request=JSON.parse(String(init?.body));
    assert.equal(request.contents[0].parts[0].text,demoDocument.text);
    assert.equal(request.generationConfig.responseMimeType,'application/json');
    return new Response(JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify(demoFindings())}]}}]}));
  }) as typeof fetch;
  assert.equal((await analyzeWithGemini(demoDocument,{apiKey:'test-only',model:'test-model'},fake)).length,3);
  await assert.rejects(()=>analyzeWithGemini(demoDocument,{apiKey:'test-only',model:'test-model'},async()=>new Response('',{status:429})),/429/);
  await assert.rejects(()=>analyzeWithGemini(demoDocument,{apiKey:'test-only',model:'test-model'},async()=>new Response('{}')),/no analysis/);
  await assert.rejects(()=>analyzeWithGemini(demoDocument,{apiKey:'',model:'test-model'},fake),/configuration/);
});
