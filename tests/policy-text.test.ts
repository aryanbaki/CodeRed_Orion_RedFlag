import {test} from 'node:test';
import assert from 'node:assert/strict';
import {policyWordCount} from '../src/core/policy-text.ts';
test('policy word count uses words rather than spaces or punctuation',()=>{
 assert.equal(policyWordCount('  Privacy\n policy\t words. '),3);
 assert.equal(policyWordCount('...  —'),0);
 assert.equal(policyWordCount('café résumé'),2);
 assert.ok(policyWordCount('隐私政策保护用户')>1);
});
