import type {AnalysisDocument, DocumentAssessment, CommunityReference} from '../core/contracts.ts';
export const CACHE_KEY = 'redflag.analysis-cache.v1';
export const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
export interface AnalysisVersions {model: string; promptVersion: string; rubricVersion: string}
export interface CacheEntry {url: string; kind: string; contentHash: string; expiresAt: string; assessment: DocumentAssessment}
export async function contentHash(text: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(bytes)].map(byte => byte.toString(16).padStart(2,'0')).join('');
}
export function cacheIdentity(document: AnalysisDocument, versions: AnalysisVersions): string {
  return JSON.stringify([document.url,document.kind,document.contentHash,document.coverage,versions.model,versions.promptVersion,versions.rubricVersion]);
}
export function applicableCache(entry: CacheEntry | undefined, document: AnalysisDocument, versions: AnalysisVersions, now = Date.now()): DocumentAssessment | undefined {
  if (!entry || !Number.isFinite(Date.parse(entry.expiresAt)) || Date.parse(entry.expiresAt) <= now ||
    entry.url !== document.url || entry.kind !== document.kind || entry.contentHash !== document.contentHash ||
    entry.assessment.coverage !== 'complete' || document.coverage !== 'complete' || entry.assessment.grade === 'Unrated' ||
    entry.assessment.model !== versions.model || entry.assessment.promptVersion !== versions.promptVersion || entry.assessment.rubricVersion !== versions.rubricVersion) return;
  return {...entry.assessment,documentId:document.id};
}
export function currentCommunity(reference: CommunityReference, url: string, now = Date.now()): boolean {
  // Service ratings never suppress independent document analysis. Unknown dates
  // and merely downloaded records never satisfy reviewed freshness.
  return reference.scope === 'document' && reference.documentUrl === url && reference.reviewStatus === 'reviewed' &&
    reference.freshness === 'current' && !!reference.reviewedAt && Number.isFinite(Date.parse(reference.reviewedAt)) &&
    Date.parse(reference.reviewedAt) <= now && now - Date.parse(reference.reviewedAt) <= 90 * CACHE_TTL_MS;
}
