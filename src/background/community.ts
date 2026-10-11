import type {CommunityReference} from '../core/contracts.ts';
import {exactDomain} from '../discovery/urls.ts';
/** Original, strict ToS;DR adapter. No copied upstream extension/database code.
 * Accepts a licensed local catalog; no browsing-domain query is made by default. */
export interface CommunityRecord {domains: string[]; reference: CommunityReference}
export const COMMUNITY_CATALOG_KEY = 'redflag.community-catalog.v1';
export function parseCommunityCatalog(raw: unknown): CommunityRecord[] {
  if (!Array.isArray(raw) || raw.length > 5000) return [];
  const records: CommunityRecord[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const record = item as CommunityRecord;
    const ref = record.reference;
    if (!Array.isArray(record.domains) || !record.domains.length || record.domains.length > 100 || !record.domains.every(d => typeof d === 'string' && exactDomain(d,d)) || !ref ||
      ref.provider !== 'tosdr' || typeof ref.serviceId !== 'string' || typeof ref.serviceName !== 'string' || ref.serviceName.length > 200 ||
      typeof ref.attribution !== 'string' || !ref.attribution.trim() || ref.attribution.length > 1000 ||
      !['service','document'].includes(ref.scope) || !['reviewed','unreviewed','unknown'].includes(ref.reviewStatus) ||
      !['current','stale','unknown'].includes(ref.freshness) || !Number.isFinite(Date.parse(ref.fetchedAt))) continue;
    try {
      const source = new URL(ref.sourceUrl);
      if (source.protocol !== 'https:' || !['tosdr.org','edit.tosdr.org'].includes(source.hostname) || source.username || source.password) continue;
      if (ref.documentUrl && !/^https?:\/\//.test(ref.documentUrl)) continue;
      if (ref.rating !== undefined && (typeof ref.rating !== 'string' || ref.rating.length > 30)) continue;
      records.push({domains:[...record.domains],reference:{...ref}});
    } catch { /* Schema/source validation failed. */ }
  }
  return records;
}
export function lookupCommunity(hostname: string, documentUrl: string, catalog: CommunityRecord[], now = Date.now()): CommunityReference[] {
  return catalog.filter(record => record.domains.some(domain => exactDomain(hostname,domain)))
    .map(record => ({...record.reference}))
    .filter(ref => ref.scope === 'service' || ref.documentUrl === documentUrl)
    .map(ref => {
      if (!ref.reviewedAt || !Number.isFinite(Date.parse(ref.reviewedAt))) ref.freshness = 'unknown';
      else if (Date.parse(ref.reviewedAt) > now || now - Date.parse(ref.reviewedAt) > 90 * 86400000) ref.freshness = 'stale';
      return ref;
    });
}
