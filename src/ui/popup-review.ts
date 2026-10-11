import type {RedFlagPreferences,ReviewState} from '../core/contracts.ts';
import {summarizeReview,supportedAssessment,supportedDocumentGrade} from '../core/summary.ts';
import {element,safeLink} from './dom.ts';
import {orderedFindings} from './review.ts';
const names={terms:'Terms',privacy:'Privacy',additional:'Additional Terms',unknown:'Other agreement'};
function gradeBadge(grade:string,className:string){const badge=element('span',grade==='Unrated'?'?':grade,className);badge.dataset.grade=grade;badge.setAttribute('aria-label',grade==='Unrated'?'Unrated':`Grade ${grade}`);return badge;}
export function renderPopupReview(container:HTMLElement,state:ReviewState|null,prefs:RedFlagPreferences,analyze:(id:string)=>void) {
  const focused=container.contains(document.activeElement) ? (document.activeElement as HTMLElement)?.dataset.key : undefined;
  const expanded=new Set([...container.querySelectorAll<HTMLDetailsElement>('details[open]')].map(n=>n.dataset.key));
  const fragment=document.createDocumentFragment(),summary=summarizeReview(state);
  if(!summary.total){container.replaceChildren();return;}
  const card=element('div',undefined,'grade-summary'),copy=element('div');
  copy.append(element('h3','Worst reviewed grade'),element('p',`${summary.graded} of ${summary.total} graded${summary.pending?` · ${summary.pending} pending`:''}`));
  card.append(gradeBadge(summary.worstDocumentGrade,'grade-tile'),copy);fragment.append(card);
  for(const review of state!.documents) {
    const row=element('article',undefined,'policy-row'),info=element('div',undefined,'policy-copy');
    info.append(element('h3',review.document.label || names[review.document.kind]));
    const reason=review.status==='pending'?'Analyzing…':review.reason==='permission-required'?'Reading access needed':review.reason==='ai-consent-required'?'AI disabled':review.reason==='inaccessible'?'Unavailable':review.coverage!=='complete'?'Partial · Unrated':supportedDocumentGrade(review)==='Unrated'?'Unrated · see details':'Reviewed';
    info.append(element('p',reason));
    const badge=gradeBadge(supportedDocumentGrade(review),'document-grade');
    const button=element('button','Analyze','secondary');button.type='button';button.dataset.key=review.document.id;button.setAttribute('aria-label',`Analyze ${review.document.label}`);button.disabled=!prefs.enabled || !prefs.aiConsent.enabled || review.status==='pending';button.addEventListener('click',()=>analyze(review.document.id));row.append(badge,info,button);fragment.append(row);
  }
  if(summary.status!=='rated')fragment.append(element('p','Incomplete review. Other policies may be unreviewed.','scope-note'));
  else fragment.append(element('p','Grades cover discovered documents only.','scope-note'));
  if(!prefs.aiConsent.enabled)fragment.append(element('p','AI disabled · enable in settings to analyze.','uncertain'));
  const entries=state!.documents.filter(d=>d.status!=='pending').flatMap(review=>(supportedAssessment(review)?.findings ?? []).filter(f=>f.sourceUrl===review.document.url && f.quote.trim().length>=12).map(finding=>({review,finding})));
  for(const finding of orderedFindings(entries.map(e=>e.finding),prefs.priorities).slice(0,2)) {
    const review=entries.find(e=>e.finding===finding)!.review,warning=element('details',undefined,'important-warning');warning.dataset.key='finding-'+review.document.id+'-'+finding.id;warning.open=expanded.has(warning.dataset.key);
    warning.append(element('summary',finding.title),element('p',`${names[review.document.kind]} · ${review.coverage} coverage`,'meta'),element('p',finding.explanation),element('blockquote',finding.quote),safeLink('Supporting document ↗',finding.sourceUrl));fragment.append(warning);
  }
  container.replaceChildren(fragment);
  if(focused)[...container.querySelectorAll<HTMLElement>('[data-key]')].find(n=>n.dataset.key===focused)?.focus({preventScroll:true});
}
