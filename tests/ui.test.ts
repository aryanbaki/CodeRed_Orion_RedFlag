import {test} from 'node:test';
import assert from 'node:assert/strict';
import {AI_NOTICE_VERSION, createDefaultPreferences} from '../src/core/contracts.ts';
import {changeConsent, normalizePreferences} from '../src/ui/preferences.ts';
import {permissionPattern} from '../src/ui/access.ts';
import {dateLabel} from '../src/ui/dom.ts';
test('legacy priorities never imply AI consent; unsupported values are removed',()=>{
  const p=normalizePreferences(undefined,['sharing','renewal','bogus','sharing'],'2026-10-11T00:00:00Z');
  assert.deepEqual(p.priorities,['sharing','renewal']);assert.equal(p.aiConsent.enabled,false);
});
test('explicit consent is revocable and notice changes require renewed consent',()=>{
  const defaults=createDefaultPreferences('2026-10-11T00:00:00Z');
  const opted=changeConsent(defaults,true,'2026-10-11T01:00:00Z');assert.equal(opted.aiConsent.enabled,true);assert.equal(defaults.aiConsent.enabled,false);
  assert.equal(opted.aiConsent.grantedAt,'2026-10-11T01:00:00Z');assert.equal(opted.aiConsent.noticeVersion,AI_NOTICE_VERSION);
  const revoked=changeConsent(opted,false,'2026-10-11T02:00:00Z');assert.equal(revoked.aiConsent.enabled,false);assert.equal(revoked.aiConsent.grantedAt,undefined);
  assert.equal(normalizePreferences({...opted,aiConsent:{...opted.aiConsent,noticeVersion:'older'}},null,'2026-10-11T03:00:00Z').aiConsent.enabled,false);
  assert.equal(normalizePreferences({...opted,aiConsent:{...opted.aiConsent,grantedAt:'invalid'}},null,'2026-10-11T03:00:00Z').aiConsent.enabled,false);
});
test('unknown dates stay unknown, exact timestamps retain UTC precision',()=>{
  assert.equal(dateLabel(undefined),'Unknown');assert.equal(dateLabel('invalid'),'Unknown');assert.equal(dateLabel('2026-10-11T01:00:00Z'),'2026-10-11 01:00:00 UTC');
});

test('site access requests are scoped to actual HTTP(S) origins',()=>{
  assert.equal(permissionPattern('https://example.com/privacy?token=ignore#section'),'https://example.com/*');
  assert.equal(permissionPattern('javascript:alert(1)'),null);assert.equal(permissionPattern('https://user:pass@example.com'),null);
});
