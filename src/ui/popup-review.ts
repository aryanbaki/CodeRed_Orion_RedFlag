import type {RedFlagPreferences,ReviewState} from '../core/contracts.ts';
import {summarizeReview,supportedAssessment,supportedDocumentGrade} from '../core/summary.ts';
import {element,safeLink} from './dom.ts';
import {orderedFindings} from './review.ts';
const names={terms:'Terms',privacy:'Privacy',additional:'Additional Terms',unknown:'Other agreement'};
export function renderPopupReview(container:HTMLElement,state:ReviewState|null,prefs:RedFlagPreferences,analyze:(id:string)=>void) {
  const focused=container.contains(document.activeElement) ? (document.activeElement as HTMLElement)?.dataset.key : undefined;
  const fragment=document.createDocumentFragment(),summary=summarizeReview(state);
  const card=element('div',undefined,'grade-summary');
  card.append(element('div',summary.worstDocumentGrade,'grade-tile'));
  const copy=element('div');copy.append(element('h3','Worst reviewed grade'),element('p',`${summary.graded} of ${summary.total} discovered documents graded · ${summary.pending} pending`),element('p',summary.status==='rated'?'Discovered policies reviewed. Other agreements may exist.':'Incomplete review · unknown policies remain Unrated.'));
  card.append(copy);fragment.append(card);
  for(const review of state?.documents ?? []) {
    const row=element('article',undefined,'policy-row'),info=element('div',undefined,'policy-copy');
    info.append(element('h3',`${names[review.document.kind]} · ${review.document.label}`));
    const failure=(review as typeof review & {failure?:{message:string}}).failure;
    info.append(element('p',`${supportedDocumentGrade(review)} · ${review.status==='pending'?'Analyzing / awaiting retrieval':review.coverage+' coverage'}`,'policy-grade'),element('p',failure?.message ?? (review.reason?.replaceAll('-',' ') ?? 'Open evidence for source and review details.')));
    const button=element('button','Analyze','secondary');button.type='button';button.dataset.key=review.document.id;button.setAttribute('aria-label',`Analyze ${review.document.label}`);button.disabled=!prefs.enabled || !prefs.aiConsent.enabled || review.status==='pending';button.addEventListener('click',()=>analyze(review.document.id));row.append(info,button);fragment.append(row);
  }
  for(const kind of ['terms','privacy','additional'] as const) if(!state?.documents.some(d=>d.document.kind===kind)) {
    const row=element('article',undefined,'policy-row');row.append(element('div',`${names[kind]} · Unrated. Not discovered; applicability unknown.`,'policy-copy'));fragment.append(row);
  }
  if(!prefs.aiConsent.enabled) fragment.append(element('p','AI disabled. Enable external-AI consent in settings to analyze public legal documents.','uncertain'));
  const entries=(state?.documents ?? []).filter(d=>d.status!=='pending').flatMap(review=>(supportedAssessment(review)?.findings ?? []).filter(f=>f.sourceUrl===review.document.url && f.quote.trim().length>=12).map(finding=>({review,finding})));
  for(const finding of orderedFindings(entries.map(e=>e.finding),prefs.priorities).slice(0,2)) {
    const review=entries.find(e=>e.finding===finding)!.review,warning=element('article',undefined,'important-warning');warning.append(element('h3',finding.title),element('p',`${names[review.document.kind]} · ${review.coverage} coverage · ${finding.severity} concern`,'meta'),element('p',finding.explanation),element('blockquote',finding.quote),safeLink('Supporting document ↗',finding.sourceUrl));fragment.append(warning);
  }
  container.replaceChildren(fragment);
  if(focused) [...container.querySelectorAll<HTMLElement>('[data-key]')].find(n=>n.dataset.key===focused)?.focus({preventScroll:true});
}
