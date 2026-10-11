import {AI_NOTICE_VERSION, CONTRACT_VERSION, PREFERENCES_STORAGE_KEY, createDefaultPreferences, type RedFlagPreferences, type RiskCategory} from '../core/contracts.ts';
import {priorityLabels} from './review.ts';
export function normalizePreferences(raw: unknown, legacy: unknown, now: string): RedFlagPreferences {
  const defaults = createDefaultPreferences(now);
  if (!raw || typeof raw !== 'object') {
    defaults.priorities = validPriorities(legacy); return defaults;
  }
  const value = raw as Partial<RedFlagPreferences>;
  if (value.schemaVersion !== CONTRACT_VERSION) return defaults;
  const consent = value.aiConsent;
  return {...defaults, enabled:value.enabled !== false, priorities:validPriorities(value.priorities), aiConsent: {
    enabled:consent?.enabled === true && consent.noticeVersion === AI_NOTICE_VERSION && Boolean(consent.grantedAt) && !Number.isNaN(Date.parse(consent.grantedAt!)),
    grantedAt:consent?.grantedAt,
    updatedAt:consent?.updatedAt ?? now,
    noticeVersion:AI_NOTICE_VERSION,
  }};
}
function validPriorities(value: unknown): RiskCategory[] {
  return Array.isArray(value) ? [...new Set(value.filter((v): v is RiskCategory => typeof v === 'string' && Object.hasOwn(priorityLabels,v)))] : [];
}
export function changeConsent(preferences: RedFlagPreferences, enabled: boolean, now: string): RedFlagPreferences {
  return {...preferences,aiConsent:{enabled, ...(enabled ? {grantedAt:now} : {}), updatedAt:now, noticeVersion:AI_NOTICE_VERSION}};
}
export async function loadPreferences(): Promise<RedFlagPreferences> {
  const stored = await chrome.storage.local.get([PREFERENCES_STORAGE_KEY,'priorities']);
  const preferences = normalizePreferences(stored[PREFERENCES_STORAGE_KEY], stored.priorities, new Date().toISOString());
  if (!stored[PREFERENCES_STORAGE_KEY]) await chrome.storage.local.set({[PREFERENCES_STORAGE_KEY]:preferences});
  return preferences;
}
/** Trusted extension settings only. Background observes this canonical storage key. */
export async function savePreferences(preferences: RedFlagPreferences): Promise<void> {
  await chrome.storage.local.set({[PREFERENCES_STORAGE_KEY]:preferences});
}
