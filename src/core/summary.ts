import {RUBRIC_VERSION} from '../server/versions.ts';
import type {DocumentKind, DocumentReview, ReviewState, RiskGrade} from './contracts.ts';
export interface ReviewSummary {
  status:'unknown'|'pending'|'partial'|'rated';
  /** Conservative summary of discovered policies, not proof every site agreement was found. */
  grade:RiskGrade;
  worstDocumentGrade:RiskGrade;
  termsGrade:RiskGrade;
  privacyGrade:RiskGrade;
  additionalGrade:RiskGrade;
  cookiesGrade:RiskGrade;
  source:'gemini'|'tosdr'|'unknown';
  total:number;graded:number;pending:number;unrated:number;
  missingKinds:DocumentKind[];
  highConcern:boolean;
}
const rank:RiskGrade[]=['S','A','B','C','D','E'];
export function supportedAssessment(review:DocumentReview) {
  const a=review.assessment;
  return a?.provider === 'gemini' && a.rubricVersion===RUBRIC_VERSION && a.documentId === review.document.id && a.documentUrl === review.document.url && a.kind === review.document.kind && /^[a-f0-9]{64}$/.test(a.contentHash) && Number.isFinite(Date.parse(a.analyzedAt)) ? a : undefined;
}
export function supportedDocumentGrade(review:DocumentReview):RiskGrade {
  const a=supportedAssessment(review);
  if(review.freshness.cacheExpiresAt && (!Number.isFinite(Date.parse(review.freshness.cacheExpiresAt)) || Date.parse(review.freshness.cacheExpiresAt)<=Date.now())) return 'Unrated';
  return review.status === 'ready' && review.coverage === 'complete' && a?.coverage === 'complete' && a.grade === review.grade && rank.includes(a.grade) ? a.grade : 'Unrated';
}
function worst(grades:RiskGrade[]):RiskGrade {return grades.filter(g=>rank.includes(g)).sort((a,b)=>rank.indexOf(b)-rank.indexOf(a))[0] ?? 'Unrated';}
export function summarizeReview(state:ReviewState | null | undefined):ReviewSummary {
  const documents=state?.documents ?? [];
  const grades=documents.map(supportedDocumentGrade);
  const graded=grades.filter(g=>g !== 'Unrated').length;
  const pending=documents.filter(d=>d.status === 'pending').length;
  const missingKinds=(['terms','privacy'] as DocumentKind[]).filter(k=>!documents.some(d=>d.document.kind === k));
  const scopeGrade=(kind:DocumentKind):RiskGrade=>{
    const scope=documents.filter(d=>d.document.kind === kind || kind==='terms' && d.document.kind==='additional');
    return scope.length && scope.every(d=>supportedDocumentGrade(d) !== 'Unrated') ? worst(scope.map(supportedDocumentGrade)) : 'Unrated';
  };
  const reference=(state?.community ?? documents.flatMap(d=>d.community)).find(r=>r.provider==='tosdr' && r.scope==='service' && r.reviewStatus==='reviewed' && r.freshness!=='stale' && ['A','B','C','D','E'].includes(r.rating ?? '') && Date.now()-Date.parse(r.fetchedAt)<7*86400000);
  const communityGrade=reference?.rating as RiskGrade | undefined;
  const complete=documents.length>0 && graded === documents.length && missingKinds.length === 0;
  return {status:complete || communityGrade ? 'rated' : !documents.length ? 'unknown' : pending && !graded ? 'pending' : 'partial',
    grade:complete ? worst(grades) : communityGrade ?? 'Unrated',worstDocumentGrade:worst(grades),termsGrade:scopeGrade('terms'),privacyGrade:scopeGrade('privacy'),additionalGrade:scopeGrade('additional'),cookiesGrade:scopeGrade('cookies'),source:complete?'gemini':communityGrade?'tosdr':'unknown',
    total:documents.length,graded,pending,unrated:documents.length-graded,missingKinds,
    highConcern:documents.some(d=>d.status !== 'pending' && supportedAssessment(d)?.findings.some(f=>f.severity === 'high' && f.sourceUrl === d.document.url && f.quote.trim().length >= 12)),
  };
}
