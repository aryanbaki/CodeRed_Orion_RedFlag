import {AI_NOTICE_VERSION, CONTRACT_VERSION, type AnalysisDocument, type DocumentAssessment, type RedFlagPreferences, type ReviewState, type ConsentContext, type DiscoveredDocument} from '../core/contracts.ts';
import {publicDocumentUrl} from '../discovery/urls.ts';
import type {AnalysisVersions} from './cache.ts';
const categories = ['sharing','retention','tracking','renewal','cancellation','arbitration','content-rights','other'];
export function validPreferences(raw: unknown): raw is RedFlagPreferences {
  if (!raw || typeof raw !== 'object') return false;
  const value = raw as RedFlagPreferences;
  return value.schemaVersion === CONTRACT_VERSION && typeof value.enabled === 'boolean' && Array.isArray(value.priorities) && value.priorities.length <= categories.length &&
    value.priorities.every(c => categories.includes(c)) && !!value.aiConsent && typeof value.aiConsent.enabled === 'boolean' &&
    typeof value.aiConsent.noticeVersion === 'string' && Number.isFinite(Date.parse(value.aiConsent.updatedAt)) &&
    (!value.aiConsent.enabled || (!!value.aiConsent.grantedAt && Number.isFinite(Date.parse(value.aiConsent.grantedAt))));
}
export function permitsAi(preferences: RedFlagPreferences): boolean {
  return preferences.enabled && validPreferences(preferences) && preferences.aiConsent.enabled && preferences.aiConsent.noticeVersion === AI_NOTICE_VERSION;
}
export function safePageUrl(raw: string): string {
  const url = new URL(raw);
  if (!['http:','https:'].includes(url.protocol) || url.username || url.password) throw new Error('Invalid page URL');
  url.search = ''; url.hash = '';
  return url.href;
}
export function validateDiscovery(raw: unknown, senderUrl: string): {pageUrl:string;context:ConsentContext;documents:DiscoveredDocument[]} {
  if (!raw || typeof raw !== 'object') throw new Error('Invalid discovery');
  const value = raw as Record<string,unknown>;
  if (typeof value.pageUrl !== 'string' || safePageUrl(value.pageUrl) !== safePageUrl(senderUrl) ||
    !['signup','checkout','onboarding','consent','browsing'].includes(value.context as string) || !Array.isArray(value.documents) || value.documents.length > 24) throw new Error('Invalid discovery');
  const seen = new Set<string>();
  const documents = value.documents.map((item: unknown) => {
    if (!item || typeof item !== 'object') throw new Error('Invalid document');
    const doc = item as DiscoveredDocument;
    if (typeof doc.id !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(doc.id) || !['terms','privacy','cookies','additional','unknown'].includes(doc.kind) ||
      typeof doc.url !== 'string' || publicDocumentUrl(doc.url) !== doc.url || typeof doc.label !== 'string' || doc.label.length > 100 || !Number.isFinite(Date.parse(doc.discoveredAt)) || seen.has(doc.id)) throw new Error('Invalid document');
    seen.add(doc.id);
    return {id:doc.id,url:doc.url,kind:doc.kind,label:doc.label,discoveredAt:doc.discoveredAt};
  });
  return {pageUrl:safePageUrl(senderUrl),context:value.context as ConsentContext,documents};
}
export function validateAssessment(raw: unknown, doc: AnalysisDocument, versions: AnalysisVersions): DocumentAssessment {
  if (!raw || typeof raw !== 'object') throw new Error('invalid-response');
  const a = raw as DocumentAssessment;
  if (a.documentId !== doc.id || a.documentUrl !== doc.url || a.kind !== doc.kind || a.contentHash !== doc.contentHash ||
      a.provider !== 'gemini' || ![versions.model,...(versions.fallbackModels??[])].includes(a.model??'') || a.promptVersion !== versions.promptVersion || a.rubricVersion !== versions.rubricVersion ||
      !['S','A','B','C','D','E','Unrated'].includes(a.grade) || !['complete','partial','unknown'].includes(a.coverage) || a.coverage !== doc.coverage ||
      (a.grade !== 'Unrated' && a.coverage !== 'complete') || (a.grade === 'Unrated' && !a.reason) ||
      !Number.isFinite(Date.parse(a.analyzedAt)) || typeof a.summary !== 'string' || a.summary.length > 4000 || !Array.isArray(a.findings) || a.findings.length > 30) throw new Error('invalid-response');
  if(a.protections!==undefined&&(!Array.isArray(a.protections)||a.protections.length>7))throw new Error('invalid-response');
  for (const f of [...a.findings,...a.protections??[]]) if (!f || typeof f.id !== 'string' || !categories.includes(f.category) || !['low','medium','high'].includes(f.severity) ||
      typeof f.title !== 'string' || f.title.length > 200 || typeof f.explanation !== 'string' || f.explanation.length > 2000 ||
      typeof f.quote !== 'string' || f.quote.trim().length < 12 || !doc.text.includes(f.quote) || f.sourceUrl !== doc.url ||
      (f.startOffset !== undefined && (!Number.isInteger(f.startOffset) || doc.text.slice(f.startOffset,f.endOffset) !== f.quote))) throw new Error('invalid-response');
  if(a.protections?.some(p=>a.findings.some(f=>f.category===p.category)))throw new Error('invalid-response');
  return a;
}
export function pendingState(pageKey:string,pageUrl:string,context:ConsentContext,documents:DiscoveredDocument[]): ReviewState {
  return {schemaVersion:CONTRACT_VERSION,pageKey,pageUrl,context,updatedAt:new Date().toISOString(),documents:documents.map(document => ({document,status:'pending',grade:'Unrated',coverage:'unknown',reason:'pending',freshness:{},community:[],cached:false}))};
}
