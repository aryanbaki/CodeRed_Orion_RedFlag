import {type AnalysisDocument, type DocumentAssessment, type RiskCategory, type EvidenceFinding, type UnratedReason} from '../core/contracts.ts';
import {PROMPT_VERSION, RUBRIC_VERSION} from './versions.ts';
const riskCategories: RiskCategory[] = ['sharing','retention','tracking','renewal','cancellation','arbitration','content-rights'];
const titles: Partial<Record<RiskCategory,string>> = {sharing:'Data sharing',retention:'Data retention',tracking:'Behavioral tracking',renewal:'Automatic renewal',cancellation:'Cancellation limits',arbitration:'Dispute restrictions','content-rights':'Content rights'};
interface CategoryAssessment {category:RiskCategory; status:'risk'|'protective'|'not-found'; quote:string|null; explanation:string}
import {object, keys, string} from './validation.ts';
export function requiredCategories(document: AnalysisDocument): RiskCategory[] {
  return document.kind === 'privacy' ? ['sharing', 'retention', 'tracking'] : document.kind === 'terms' ? ['renewal', 'cancellation', 'arbitration', 'content-rights'] : [...riskCategories];
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
    const quote = string(f.quote, 4000, 12), explanation = string(f.explanation, 2000, 12);
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
    const explanation = string(a.explanation, 2000, 12);
    if (a.status === 'not-found') {
      if (a.quote !== null || findings.some(f => f.category === a.category)) throw new Error('Contradictory assessment.');
    } else {
      const quote = string(a.quote, 4000, 12);
      if (!document.text.includes(quote)) throw new Error('Unsupported coverage evidence.');
      const risks = findings.filter(f => f.category === a.category);
      if ((a.status === 'risk' && (!risks.length || !risks.some(f => f.quote === quote))) || (a.status === 'protective' && risks.length)) throw new Error('Contradictory assessment.');
    }
    return {category:a.category as RiskCategory, status:a.status as CategoryAssessment['status'], quote:a.quote as string | null, explanation};
  });
  const reason = document.coverage !== 'complete' ? 'incomplete' : assessments.some(a => a.status === 'not-found') || !findings.length ? 'insufficient-evidence' : null;
  // Per-category maximum prevents repeated quotations multiplying the penalty.
  const weights = {low:5, medium:15, high:30};
  const penalty = required.reduce((total, category) => total + Math.max(0, ...findings.filter(f => f.category === category).map(f => weights[f.severity])), 0);
  const score = reason ? null : Math.max(0, 100 - penalty);
  const grade = score === null ? 'Unrated' : score >= 90 ? 'A' : score >= 75 ? 'B' : score >= 60 ? 'C' : score >= 40 ? 'D' : 'F';
  return {...base(document,model), grade, ...(reason ? {reason} : {}), findings, summary:reason ? unratedSummary(reason) : `Evidence-backed ${document.kind} risk grade ${grade}; ${findings.length} supported finding(s), score ${score}/100 under ${RUBRIC_VERSION}.`};
}

function unratedSummary(reason: UnratedReason): string {
  return `Unrated (${reason}): sufficient complete, validated evidence is required. This result does not establish safety.`;
}
