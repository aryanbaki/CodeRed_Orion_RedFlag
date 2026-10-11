import {CONTRACT_VERSION, type ReviewState, type DocumentReview, type DocumentAssessment, type CommunityReference, type RiskCategory, type UnratedReason} from '../core/contracts.ts';
import {reviewFailure} from '../background/failures.ts';
import {supportedDocumentGrade} from '../core/summary.ts';
import {publicDocumentUrl} from '../discovery/urls.ts';
export const HISTORY_STORAGE_KEY='redflag.history.v1';
export const HISTORY_VERSION=1 as const;
export const RETENTION_DAYS=30;
export const MAX_SITES=50;
export const MAX_HISTORY_BYTES=1_000_000;
export interface CheckedSite {
  origin:string;
  firstCheckedAt:string;
  lastCheckedAt:string;
  generation:string;
  context:ReviewState['context'];
  documents:DocumentReview[];
}
export interface HistoryData {schemaVersion:typeof HISTORY_VERSION;sites:CheckedSite[];deleted:{origin:string;generation:string;at:string}[]}
const kinds=['terms','privacy','additional','unknown'];
const reasons:UnratedReason[]=['pending','permission-required','authentication-required','inaccessible','unsupported','too-large','incomplete','insufficient-evidence','ai-consent-required','quota','timeout','invalid-response','unsafe-url','network-error'];
const categories:RiskCategory[]=['sharing','retention','tracking','renewal','cancellation','arbitration','content-rights','other'];
const text=(value:unknown,max:number):string => typeof value==='string' ? value.slice(0,max) : '';
const date=(value:unknown):string | undefined => typeof value==='string' && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : undefined;
function source(value:unknown):string | undefined {try{return typeof value==='string' ? publicDocumentUrl(value) : undefined;}catch{return undefined;}}
export function checkedOrigin(value:string):string {
  const url=new URL(value);
  if (url.username || url.password) throw new Error('Invalid checked-site origin.');
  return new URL(publicDocumentUrl(url.origin)).origin;
}
function community(raw:unknown):CommunityReference | undefined {
  if (!raw || typeof raw!=='object') return;
  const r=raw as CommunityReference,url=source(r.sourceUrl),fetchedAt=date(r.fetchedAt);
  if (!url || !fetchedAt || !['tosdr','privacyspy'].includes(r.provider) || !['service','document'].includes(r.scope)) return;
  return {provider:r.provider,serviceId:text(r.serviceId,100),serviceName:text(r.serviceName,200),sourceUrl:url,
    ...(typeof r.rating==='string'?{rating:text(r.rating,30)}:{}),scope:r.scope,...(source(r.documentUrl)?{documentUrl:source(r.documentUrl)}:{}),
    reviewStatus:['reviewed','unreviewed','unknown'].includes(r.reviewStatus)?r.reviewStatus:'unknown',
    recordUpdatedAt:date(r.recordUpdatedAt),reviewedAt:date(r.reviewedAt),fetchedAt,
    freshness:['current','stale','unknown'].includes(r.freshness)?r.freshness:'unknown',attribution:text(r.attribution,1000)};
}
function assessment(raw:unknown,document:DocumentReview['document']):DocumentAssessment | undefined {
  if (!raw || typeof raw!=='object') return;
  const a=raw as DocumentAssessment;
  if (a.documentId!==document.id || source(a.documentUrl)!==document.url || a.kind!==document.kind || !date(a.analyzedAt) ||
    !['gemini','community'].includes(a.provider) || !['complete','partial','unknown'].includes(a.coverage) ||
    !['A','B','C','D','E','F','Unrated'].includes(a.grade) || !Array.isArray(a.findings)) return;
  const findings=a.findings.slice(0,30).flatMap(f=>{
    if(!f || !categories.includes(f.category) || !['low','medium','high'].includes(f.severity) || source(f.sourceUrl)!==document.url || typeof f.quote!=='string' || f.quote.length>2000) return [];
    return [{id:text(f.id,100),category:f.category,severity:f.severity,title:text(f.title,200),explanation:text(f.explanation,2000),quote:f.quote,sourceUrl:document.url}];
  });
  const evidenceIncomplete=findings.length!==a.findings.length;
  return {documentId:document.id,documentUrl:document.url,kind:document.kind,grade:evidenceIncomplete?'Unrated':a.grade,coverage:evidenceIncomplete?'partial':a.coverage,findings,summary:text(a.summary,2000),
    reason:evidenceIncomplete?'incomplete':reasons.includes(a.reason!)?a.reason:undefined,provider:a.provider,analyzedAt:date(a.analyzedAt)!,model:text(a.model,200)||undefined,
    promptVersion:text(a.promptVersion,100),rubricVersion:text(a.rubricVersion,100),contentHash:text(a.contentHash,64)};
}
function documentReview(raw:unknown,index:number):DocumentReview | undefined {
  if(!raw || typeof raw!=='object') return;
  const r=raw as DocumentReview,d=r.document;
  if(!d || !kinds.includes(d.kind) || !date(d.discoveredAt)) return;
  const url=source(d.url);
  // Keep an independent blocked agreement, without storing its sensitive URL.
  const document={id:text(d.id,100)||`document-${index}`,url:url??'',kind:d.kind,label:({terms:'Terms of Service',privacy:'Privacy Policy',additional:'Additional Terms',unknown:'Other agreement'})[d.kind],discoveredAt:date(d.discoveredAt)!};
  const a=url?assessment(r.assessment,document):undefined;
  const coverage=['complete','partial','unknown'].includes(r.coverage)?r.coverage:'unknown';
  const grade=supportedDocumentGrade({...r,document,assessment:a,coverage});
  const status=grade!=='Unrated'?'ready':r.status==='pending' && url?'pending':'unrated';
  const freshness=r.freshness??{};
  return {document,status,grade,coverage,reason:!url?'unsafe-url':status==='pending'?'pending':grade==='Unrated'?(reasons.includes(r.reason!)?r.reason:a?.reason??'insufficient-evidence'):undefined,
    freshness:{retrievedAt:date(freshness.retrievedAt),documentUpdatedAt:date(freshness.documentUpdatedAt),analyzedAt:date(freshness.analyzedAt),cacheExpiresAt:date(freshness.cacheExpiresAt)},
    ...(r.failure && ['retrieval','analysis'].includes(r.failure.stage) && reasons.includes(r.failure.code)?{failure:reviewFailure(r.failure.stage,r.failure.code,r.failure.retryAfterSeconds)}:{}),
    community:Array.isArray(r.community)?r.community.slice(0,4).map(community).filter((v):v is CommunityReference=>!!v):[],assessment:a,cached:r.cached===true};
}
export function snapshotReview(raw:ReviewState):CheckedSite {
  if(raw.schemaVersion!==CONTRACT_VERSION || !['signup','checkout','onboarding','consent'].includes(raw.context) || !Array.isArray(raw.documents) || !raw.documents.length || !date(raw.updatedAt)) throw new Error('Only checked-site reviews can be saved.');
  const origin=checkedOrigin(raw.pageUrl),documents=raw.documents.slice(0,24).map(documentReview).filter((v):v is DocumentReview=>!!v);
  if(!documents.length) throw new Error('No supported review documents to save.');
  const at=date(raw.updatedAt)!;
  return {origin,firstCheckedAt:at,lastCheckedAt:at,generation:text(raw.pageKey,100),context:raw.context,documents};
}
export function reviewFromSite(site:CheckedSite):ReviewState {
  return {schemaVersion:CONTRACT_VERSION,pageKey:site.generation,pageUrl:site.origin+'/',context:site.context,documents:site.documents,updatedAt:site.lastCheckedAt};
}
export function pruneHistory(data:HistoryData,now=Date.now()):HistoryData {
  const cutoff=now-RETENTION_DAYS*86400000;
  const sites=data.sites.filter(s=>Date.parse(s.lastCheckedAt)>=cutoff && Date.parse(s.lastCheckedAt)<=now+60000).sort((a,b)=>b.lastCheckedAt.localeCompare(a.lastCheckedAt)).slice(0,MAX_SITES);
  const result:HistoryData={schemaVersion:HISTORY_VERSION,sites,deleted:data.deleted.filter(d=>Date.parse(d.at)>=cutoff).slice(-100)};
  while(new TextEncoder().encode(JSON.stringify(result)).byteLength>MAX_HISTORY_BYTES && result.sites.length) result.sites.pop();
  return result;
}
export function decodeHistory(raw:unknown,now=Date.now()):{data:HistoryData;unsupported:boolean} {
  const empty:HistoryData={schemaVersion:HISTORY_VERSION,sites:[],deleted:[]};
  if(raw===undefined) return {data:empty,unsupported:false};
  if(!raw || typeof raw!=='object' || (raw as HistoryData).schemaVersion!==HISTORY_VERSION) return {data:empty,unsupported:true};
  const data=raw as HistoryData;
  if(!Array.isArray(data.sites) || !Array.isArray(data.deleted)) return {data:empty,unsupported:true};
  const sites:CheckedSite[]=[];
  for(const s of data.sites.slice(0,MAX_SITES*2)) {
    try {const clean=snapshotReview(reviewFromSite(s));clean.firstCheckedAt=date(s.firstCheckedAt)??clean.lastCheckedAt;sites.push(clean);}catch{/* Discard malformed older entries, never render arbitrary storage objects. */}
  }
  const deleted=data.deleted.slice(-100).flatMap(d=>{try{return date(d.at)?[{origin:checkedOrigin(d.origin),generation:text(d.generation,100),at:date(d.at)!}]:[];}catch{return [];}});
  return {data:pruneHistory({schemaVersion:HISTORY_VERSION,sites,deleted},now),unsupported:false};
}
