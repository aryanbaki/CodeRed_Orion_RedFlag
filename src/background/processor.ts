import type {AnalysisDocument, DocumentReview, RedFlagPreferences, UnratedReason} from '../core/contracts.ts';
import {CACHE_TTL_MS, applicableCache, cacheIdentity, contentHash, type AnalysisVersions, type CacheEntry} from './cache.ts';
import {lookupCommunity, type CommunityRecord} from './community.ts';
import type {Download} from './retrieval.ts';
import {RetrievalError} from './retrieval.ts';
import type {Extraction} from './extraction.ts';
import {permitsAi, validateAssessment} from './validation.ts';
export interface ProcessorDependencies {
  preferences: () => Promise<RedFlagPreferences>;
  download: (url:string) => Promise<Download>;
  extract: (download:Download) => Promise<Extraction>;
  versions: () => Promise<AnalysisVersions | undefined>;
  analyze: (document:AnalysisDocument) => Promise<unknown>;
  catalog: () => Promise<CommunityRecord[]>;
  cacheGet: (key:string) => Promise<CacheEntry | undefined>;
  cachePut: (key:string,entry:CacheEntry) => Promise<void>;
}
export function failureReason(error: unknown): UnratedReason {
  if (error instanceof RetrievalError) return ({'permission-denied':'permission-required','redirect-unverified':'inaccessible','unsupported-content':'unsupported','oversized':'too-large'} as Record<string,UnratedReason>)[error.reason] ?? error.reason as UnratedReason;
  const allowed: UnratedReason[] = ['quota','timeout','invalid-response','unsafe-url','network-error','authentication-required','incomplete','too-large','inaccessible','unsupported','ai-consent-required'];
  return error instanceof Error && allowed.includes(error.message as UnratedReason) ? error.message as UnratedReason : 'network-error';
}
/** Each job processes exactly one independently scoped agreement. */
export async function processDocument(review:DocumentReview, pageHost:string, deps:ProcessorDependencies, publish:(review:DocumentReview)=>Promise<void>): Promise<void> {
  const next:DocumentReview = structuredClone(review);
  try {
    next.community = lookupCommunity(pageHost,next.document.url,await deps.catalog());
    await publish(next); // Community references can be shown while retrieval is pending.
    const download = await deps.download(next.document.url);
    next.freshness.retrievedAt = download.retrievedAt;
    const extraction = await deps.extract(download);
    next.coverage = extraction.coverage;
    if (extraction.reason || !extraction.text) throw new Error(extraction.reason ?? 'incomplete');
    const doc:AnalysisDocument = {id:next.document.id,url:download.url,kind:next.document.kind,text:extraction.text,coverage:extraction.coverage,retrievedAt:download.retrievedAt,contentHash:await contentHash(extraction.text)};
    const versions = await deps.versions();
    if (versions) {
      const key = cacheIdentity(doc,versions);
      const entry = await deps.cacheGet(key);
      const cached = applicableCache(entry,doc,versions);
      if (cached) {
        // Cache is never trusted without validating its quotes against today's download.
        try {
          next.assessment = validateAssessment(cached,doc,versions);
          next.cached = true;
          next.freshness.cacheExpiresAt = entry!.expiresAt;
        } catch { /* Invalid cached evidence requires consented fresh analysis. */ }
      }
    }
    if (!next.assessment) {
      if (!permitsAi(await deps.preferences())) throw new Error('ai-consent-required');
      if (!versions) throw new Error('inaccessible');
      // Consent is checked again by transport immediately before transmission.
      next.assessment = validateAssessment(await deps.analyze(doc),doc,versions);
      if (next.assessment.grade !== 'Unrated' && next.assessment.coverage === 'complete') {
        const expiresAt = new Date(Date.now() + CACHE_TTL_MS).toISOString();
        await deps.cachePut(cacheIdentity(doc,versions),{url:doc.url,kind:doc.kind,contentHash:doc.contentHash,expiresAt,assessment:next.assessment});
        next.freshness.cacheExpiresAt = expiresAt;
      }
    }
    next.grade = next.assessment.grade;
    next.status = next.grade === 'Unrated' ? 'unrated' : 'ready';
    next.reason = next.assessment.reason;
    next.freshness.analyzedAt = next.assessment.analyzedAt;
  } catch (error) { next.status = 'unrated'; next.grade = 'Unrated'; next.reason = failureReason(error); }
  await publish(next);
}
