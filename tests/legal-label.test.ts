import {test} from 'node:test';
import assert from 'node:assert/strict';
import {legalLabel} from '../src/discovery/legal-label.ts';
test('Boeing-style combined statements retain both privacy and cookie scope',()=>{
 assert.deepEqual(legalLabel('Privacy and Cookie Statement')?.kinds,['privacy','cookies']);
 assert.deepEqual(legalLabel('Privacy & Cookies Policy')?.kinds,['privacy','cookies']);
 assert.deepEqual(legalLabel('Site Terms')?.kinds,['terms']);
 assert.deepEqual(legalLabel('Privacy Notice')?.kinds,['privacy']);
 assert.equal(legalLabel('Privacy engineering news'),undefined);
 assert.equal(legalLabel('Cookie Settings'),undefined);
});
