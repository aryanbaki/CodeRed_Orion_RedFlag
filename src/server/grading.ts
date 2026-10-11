import {type AnalysisDocument, type DocumentAssessment, type RiskCategory, type EvidenceFinding, type UnratedReason} from '../core/contracts.ts';
import {PROMPT_VERSION, RUBRIC_VERSION} from './versions.ts';
const riskCategories: RiskCategory[] = ['sharing','retention','tracking','renewal','cancellation','arbitration','content-rights'];
const titles: Partial<Record<RiskCategory,string>> = {sharing:'Data sharing',retention:'Data retention',tracking:'Behavioral tracking',renewal:'Automatic renewal',cancellation:'Cancellation limits',arbitration:'Dispute restrictions','content-rights':'Content rights'};
interface CategoryAssessment {category:RiskCategory; status:'risk'|'protective'|'not-found'; quote:string|null; explanation:string}
import {object, keys, string} from './validation.ts';
export function requiredCategories(document: AnalysisDocument): RiskCategory[] {
  return (document.kind === 'privacy' || document.kind === 'cookies') ? ['sharing', 'retention', 'tracking'] : document.kind === 'terms' ? ['renewal', 'cancellation', 'arbitration', 'content-rights'] : [...riskCategories];
}
function base(document: AnalysisDocument, model: string) {
  return {documentId:document.id, documentUrl:document.url, kind:document.kind, coverage:document.coverage, contentHash:document.contentHash, analyzedAt:new Date().toISOString(), provider:'gemini' as const, model, rubricVersion:RUBRIC_VERSION, promptVersion:PROMPT_VERSION};
}
export function unrated(document: AnalysisDocument, model: string, reason: UnratedReason): DocumentAssessment {
  return {...base(document, model), grade:'Unrated', reason, findings:[], summary:unratedSummary(reason)};
}
export function gradeOutput(raw: unknown, document: AnalysisDocument, model: string): DocumentAssessment {
  const root = object(raw); keys(root, ['findings', 'assessments']);
  if (!Array.isArray(root.findings) || root.findings.length > 30 || !Array.isArray(root.assessments)) throw new Error('Invalid analysis output.');
  const required = requiredCategories(document);
  const findings: EvidenceFinding[] = root.findings.map((value, index) => {
    const f = object(value); keys(f, ['category', 'severity', 'quote', 'explanation']);
    if (!required.includes(f.category as RiskCategory) || typeof f.severity !== 'string' || !['low','medium','high'].includes(f.severity)) throw new Error('Invalid finding category or severity.');
    const quote = string(f.quote, 4000, 12), explanation = string(f.explanation, 280, 12);
    const start = document.text.indexOf(quote);
    if (start < 0) throw new Error('Unsupported evidence.');
    return {category:f.category as RiskCategory, severity:f.severity as EvidenceFinding['severity'], quote, explanation, id:`${document.id}-finding-${index + 1}`, title:titles[f.category as RiskCategory]!, sourceUrl:document.url, startOffset:start, endOffset:start + quote.length};
  });
  if (root.assessments.length !== required.length) throw new Error('Missing category assessments.');
  const seen = new Set<string>();
  const assessments: CategoryAssessment[] = root.assessments.map(value => {
    const a = object(value); keys(a, ['category', 'status', 'quote', 'explanation']);
    if (!required.includes(a.category as RiskCategory) || seen.has(String(a.category)) || typeof a.status !== 'string' || !['risk','protective','not-found'].includes(a.status)) throw new Error('Invalid coverage assessment.');
    seen.add(String(a.category));
    const explanation = string(a.explanation, 280, 12);
    if (a.status === 'not-found') {
      if (a.quote !== null || findings.some(f => f.category === a.category)) throw new Error('Contradictory assessment.');
    } else {
      const quote = string(a.quote, 4000, 12);
      const risks = findings.filter(f => f.category === a.category);
      if (a.status === 'protective' && risks.length) throw new Error('Contradictory assessment.');
      if (!document.text.includes(quote)) {
        if(a.status!=='protective')throw new Error('Unsupported coverage evidence.');
        // Keep independently verified adverse findings; discard an unsupported
        // favorable claim and require more evidence instead of issuing a grade.
        return {category:a.category as RiskCategory,status:'not-found',quote:null,explanation:'An exact quotation for this protection could not be verified.'};
      }
      if ((a.status === 'risk' && (!risks.length || !risks.some(f => f.quote === quote))) || (a.status === 'protective' && risks.length)) throw new Error('Contradictory assessment.');
    }
    return {category:a.category as RiskCategory, status:a.status as CategoryAssessment['status'], quote:a.quote as string | null, explanation};
  });
  const reason = document.coverage !== 'complete' ? 'incomplete' : assessments.some(a => a.status === 'not-found') ? 'insufficient-evidence' : null;
  // Per-category maximum prevents repeated quotations multiplying the penalty.
  const weights = {low:5, medium:15, high:30};
  const penalty = required.reduce((total, category) => total + Math.max(0, ...findings.filter(f => f.category === category).map(f => weights[f.severity])), 0);
  const score = reason ? null : Math.max(0, 100 - penalty);
  const grade = score === null ? 'Unrated' : score >= 90 ? 'S' : score >= 75 ? 'A' : score >= 60 ? 'B' : score >= 40 ? 'C' : score >= 20 ? 'D' : 'E';
  const protections:EvidenceFinding[]=assessments.filter(a=>a.status==='protective').map((a,i)=>({id:`${document.id}-protection-${i+1}`,category:a.category,severity:'low',title:titles[a.category]!,explanation:a.explanation,quote:a.quote!,sourceUrl:document.url,startOffset:document.text.indexOf(a.quote!),endOffset:document.text.indexOf(a.quote!)+a.quote!.length}));
  const points=[...findings.slice().sort((a,b)=>weights[b.severity]-weights[a.severity]).slice(0,1).map(f=>f.explanation),...protections.slice(0,1).map(f=>f.explanation)];
  const summary=(points.join(' ')+(reason==='incomplete'?' Only part of this policy could be read.':reason==='insufficient-evidence'?' Some grading categories lack evidence.':'' )).trim()||unratedSummary(reason??'insufficient-evidence');
  return {...base(document,model), grade, ...(reason ? {reason} : {}), findings, protections, summary:summary.slice(0,4000)};
}

function unratedSummary(reason: UnratedReason): string {
  return `Unrated (${reason}): sufficient complete, validated evidence is required. This result does not establish safety.`;
}
