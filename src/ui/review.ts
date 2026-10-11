import type {DocumentReview, EvidenceFinding, RedFlagPreferences, ReviewState, RiskCategory} from '../core/contracts.ts';
import {dateLabel, element, safeLink} from './dom.ts';

export const priorityLabels: Record<RiskCategory, string> = {
  sharing:'Data sharing', retention:'Data retention', tracking:'Tracking', renewal:'Automatic renewal',
  cancellation:'Cancellation', arbitration:'Arbitration', 'content-rights':'Content rights', other:'Other concerns',
};
const names = {terms:'Terms', privacy:'Privacy', cookies:'Cookie Policy',additional:'Additional Terms', unknown:'Other agreement'};
const advice: Record<RiskCategory,string> = {
  sharing:'Review who receives your data and whether sharing can be limited.',
  retention:'Check deletion options and how long records remain after closing your account.',
  tracking:'Check cookie and tracking settings before continuing.',
  renewal:'Check the renewal date, price, and how to turn renewal off.',
  cancellation:'Check the cancellation steps and deadline before subscribing.',
  arbitration:'Review dispute options and any opt-out deadline.',
  'content-rights':'Check what rights you grant over content you upload.',
  other:'Review this clause before deciding whether to agree.',
};
export {supportedAssessment as usableAssessment} from '../core/summary.ts';
import {supportedAssessment as usableAssessment} from '../core/summary.ts';
export function visibleGrade(review: DocumentReview): string {
  const a = usableAssessment(review);
  // A service rating, pending result, or partial extraction cannot imply a whole-document grade.
  return review.status === 'ready' && review.coverage === 'complete' && a?.coverage === 'complete' && a.provider === 'gemini' && a.grade === review.grade ? review.grade : 'Unrated';
}
export function orderedFindings(findings: EvidenceFinding[], priorities: RiskCategory[]) {
  const severity = {high:3,medium:2,low:1};
  return [...findings].sort((a,b) => Number(priorities.includes(b.category)) - Number(priorities.includes(a.category)) || severity[b.severity] - severity[a.severity]);
}
const reasonLabels: Record<string,string> = {
  'ai-consent-required':'Background AI is off. Enable it in Privacy settings if you want automatic external analysis.',
  'permission-required':'Site permission is required to retrieve this document.',
  'authentication-required':'This document requires authentication and cannot be retrieved publicly.',
  inaccessible:'The document could not be accessed.', unsupported:'This document format is unsupported.',
  'too-large':'The document exceeds the analysis size limit.', incomplete:'Only part of this document was available.',
  'insufficient-evidence':'There is not enough supported evidence to assign a grade.', quota:'The analysis quota was reached.',
  timeout:'Analysis timed out.', 'invalid-response':'The analysis did not pass evidence validation.',
  'unsafe-url':'The document destination was blocked.', 'network-error':'The document could not be retrieved over the network.',
  pending:'Review is pending.',
};

/** Render trusted contract structure; all provider strings use textContent. */
export function renderReview(container: HTMLElement, state: ReviewState, preferences?: RedFlagPreferences, liveStatus?: HTMLElement) {
  const doc = container.ownerDocument;
  const priorities = preferences?.priorities ?? [];
  const expanded = new Set([...container.querySelectorAll<HTMLDetailsElement>('details[open]')].map(n=>n.dataset.key));
  const active = container.getRootNode() instanceof ShadowRoot ? (container.getRootNode() as ShadowRoot).activeElement : doc.activeElement;
  const focusKey = active instanceof HTMLElement && container.contains(active) ? active.dataset.key : undefined;
  const fragment = doc.createDocumentFragment();
  const graded = state.documents.filter(d=>visibleGrade(d) !== 'Unrated').length;
  const pending = state.documents.filter(d=>d.status === 'pending').length;
  const unknown = state.documents.length - graded;
  const summary = `${state.documents.length} discovered agreement${state.documents.length === 1 ? '' : 's'} · ${graded} graded · ${pending} pending · ${unknown} Unrated. Grades are separate; incomplete reviews do not imply safety.`;
  if (liveStatus && liveStatus.textContent !== summary) liveStatus.textContent = summary;
  if (!liveStatus) fragment.append(element('p', summary, 'meta', doc));
  const combined = state.documents.flatMap(review=>(usableAssessment(review)?.findings ?? []).map(finding=>({review,finding})));
  const top = orderedFindings(combined.map(v=>v.finding), priorities).slice(0,3);
  if (top.length) {
    const overview = element('section', undefined, undefined, doc); overview.setAttribute('aria-label','Combined concerns');
    overview.append(element('h3','Concerns to review',undefined,doc));
    for (const finding of top) {
      const entry = combined.find(v=>v.finding === finding)!;
      overview.append(element('p', `${names[entry.review.document.kind]}: ${finding.title}. ${advice[finding.category]}`, undefined, doc));
    }
    fragment.append(overview);
  } else fragment.append(element('p', 'No supported findings are available yet. This does not establish that the agreements are safe.', 'uncertain', doc));
  for (const kind of ['terms','privacy','cookies','additional'] as const) {
    if (!state.documents.some(d=>d.document.kind === kind)) {
      fragment.append(element('p', `${names[kind]} · Unrated · Not discovered; applicability and coverage unknown.`, 'uncertain', doc));
    }
  }
  for (const review of state.documents) {
    const a = usableAssessment(review);
    const card = element('article', undefined, 'card', doc);
    card.append(element('h3',`${names[review.document.kind]} — ${review.document.label}`,undefined,doc));
    card.append(element('p', `Grade: ${visibleGrade(review)}${review.status === 'pending' ? ' · Pending' : ''}`, 'grade', doc));
    const source = safeLink('Source document',review.document.url,doc); source.dataset.key = `source:${review.document.id}`; card.append(source);
    if (review.status !== 'ready' || visibleGrade(review) === 'Unrated') card.append(element('p', (review.failure?.message ?? reasonLabels[review.reason ?? a?.reason ?? 'insufficient-evidence']) ?? 'This document remains Unrated.', 'uncertain', doc));
    if (a?.summary) card.append(element('p',a.summary,undefined,doc));
    card.append(element('p', `Coverage: ${review.coverage}. Provider: ${a ? (a.provider === 'gemini' ? 'Google Gemini' : 'Community reference (not an AI grade)') : 'No document assessment'}. ${review.cached ? 'Cached result.' : ''}`, 'meta', doc));
    card.append(element('p', `Document updated: ${dateLabel(review.freshness.documentUpdatedAt)}. Retrieved: ${dateLabel(review.freshness.retrievedAt)}. Analyzed: ${dateLabel(a?.analyzedAt ?? review.freshness.analyzedAt)}. Cache expiry: ${dateLabel(review.freshness.cacheExpiresAt)}.`, 'meta', doc));
    if (review.freshness.cacheExpiresAt && Date.parse(review.freshness.cacheExpiresAt) <= Date.now()) card.append(element('p','Stale cached analysis — the current document may differ.','uncertain',doc));
    if (a) card.append(element('p',`Model: ${a.model ?? 'Unknown'} · Prompt: ${a.promptVersion} · Rubric: ${a.rubricVersion}`, 'meta', doc));
    for (const finding of orderedFindings(a?.findings ?? [], priorities)) {
      const section = element('section',undefined,'finding',doc);
      if (priorities.includes(finding.category)) section.append(element('p','YOUR PRIORITY','priority',doc));
      const evidence = safeLink('Evidence source',finding.sourceUrl,doc); evidence.dataset.key = `evidence:${review.document.id}:${finding.id}`;
      section.append(element('h4', `${finding.title} · ${finding.severity} concern`, undefined, doc), element('p',finding.explanation,undefined,doc), element('p',advice[finding.category],undefined,doc), element('blockquote',finding.quote,undefined,doc),evidence);
      card.append(section);
    }
    for (const reference of review.community) {
      const details = element('details',undefined,undefined,doc);
      details.dataset.key = `community:${review.document.id}:${reference.provider}:${reference.serviceId}`;
      details.open = expanded.has(details.dataset.key);
      const toggle = element('summary',`${reference.provider === 'tosdr' ? 'ToS;DR' : 'PrivacySpy'} community reference · ${reference.freshness}`,undefined,doc); toggle.dataset.key = details.dataset.key;
      details.append(toggle, element('p',`${reference.serviceName} · ${reference.scope} rating: ${reference.rating ?? 'Unrated'}. This is a community reference, not a document-specific AI grade.`,undefined,doc),element('p',`${reference.attribution} · Review status: ${reference.reviewStatus}. Reviewed: ${dateLabel(reference.reviewedAt)}. Record updated: ${dateLabel(reference.recordUpdatedAt)}. Fetched: ${dateLabel(reference.fetchedAt)}.`, 'meta',doc),safeLink('Community record',reference.sourceUrl,doc));
      if (reference.freshness !== 'current') details.append(element('p', `${reference.freshness === 'stale' ? 'Stale review' : 'Review freshness unknown'} — may not describe the current agreement.`, 'uncertain',doc));
      card.append(details);
    }
    fragment.append(card);
  }
  container.replaceChildren(fragment);
  if (focusKey) [...container.querySelectorAll<HTMLElement>('[data-key]')].find(n=>n.dataset.key === focusKey && ['SUMMARY','A'].includes(n.tagName))?.focus({preventScroll:true});
}
