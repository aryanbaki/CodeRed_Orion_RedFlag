import {reviewDates} from '../core/review-dates.ts';
import {readingTimeSaved} from '../core/reading-time.ts';
import {isFlagGrade} from './branding.ts';
import type {RedFlagPreferences,ReviewState,UnratedReason} from '../core/contracts.ts';
import {summarizeReview} from '../core/summary.ts';
import {policyLabels} from '../core/site-insights.ts';
import {element} from './dom.ts';
const failureLabels:Partial<Record<UnratedReason,string>>={quota:'Limit reached',timeout:'Timed out',inaccessible:'Unavailable',unsupported:'Unsupported format','too-large':'Policy too large','network-error':'Connection failed','invalid-response':'Could not verify','permission-required':'Site access needed','authentication-required':'Authorization needed','ai-consent-required':'Enable checks',incomplete:'Partial policy','insufficient-evidence':'More evidence needed','unsafe-url':'Link unavailable'};
export function gradeBadge(grade:string,className='grade-tile') {
 const rated=isFlagGrade(grade),badge=element('span',rated?grade:'?',className);
 badge.dataset.grade=rated?grade:'Unrated';badge.setAttribute('aria-label',rated?`Grade ${grade}`:'Unknown grade');return badge;
}
/** All four grades are visible on first render, including missing-policy states. */
export function renderPopupReview(container:HTMLElement,state:ReviewState|null,prefs:RedFlagPreferences,analyze:(id:string)=>void,busyIds:ReadonlySet<string>=new Set(),analyzeAll:()=>void=()=>{},scanning=false,siteName='This site',analyzing=false){
 const saved=readingTimeSaved(state),summary=summarizeReview(state),fragment=document.createDocumentFragment();
 const brand=container.ownerDocument.querySelector<HTMLImageElement>('.brand-logo');
 if(brand)brand.src=`icons/redflag${isFlagGrade(summary.grade)?`-${summary.grade}`:''}-128.png`;
 const card=element('article',undefined,'grade-summary'),copy=element('div',undefined,'overall-copy');
 copy.append(element('p','Overall','eyebrow'),element('h2',siteName),element('p',scanning?'Looking for policies…':summary.pending?'Analyzing…':saved.label|| (summary.source==='tosdr'?'ToS;DR community rating':'Not enough evidence'),'meta'));
 if(saved.words){copy.lastElementChild?.setAttribute('title',`Estimated reading time for ${saved.words.toLocaleString()} analyzed words at 238 words per minute.`);}
 const dates=reviewDates(state);if(dates.label){const date=element('p',dates.label,'review-date');date.title=dates.updated?'Publisher date from retrieved policy metadata.':'Review date; the publisher’s update date was not available.';copy.append(date);}
 const pending=analyzing||Boolean(summary.pending);const all=element('button',scanning?'Searching…':pending?'Analyzing…':'Analyze all');all.id='recheck';all.type='button';all.disabled=scanning||pending||!prefs.enabled;all.setAttribute('aria-label','Analyze all policies');all.addEventListener('click',analyzeAll);
 card.append(gradeBadge(summary.grade),copy,all);fragment.append(card);
 const grid=element('div',undefined,'policy-grid');
 for(const [kind,grade] of [['privacy',summary.privacyGrade],['cookies',summary.cookiesGrade],['terms',summary.termsGrade]] as const){
  const row=element('article',undefined,'policy-row'),info=element('div',undefined,'policy-copy');row.dataset.kind=kind;
  const reviews=state?.documents.filter(d=>d.document.kind===kind||kind==='terms'&&d.document.kind==='additional')??[],pending=reviews.some(d=>d.status==='pending'||busyIds.has(d.document.id));
  info.append(element('h3',policyLabels[kind]));row.append(gradeBadge(grade,'document-grade'),info);
  const count=reviews.filter(d=>d.wordCount!==undefined),metadata=element('p',pending?'Analyzing…':!reviews.length?scanning||state?.discoveryPending?'Searching…':'Not found':grade==='Unrated'?'More evidence needed':'Reviewed','policy-meta');
  const failure=reviews.find(d=>d.failure)?.failure;
  if(!pending&&failure){metadata.textContent=failureLabels[failure.code]??'Could not analyze';metadata.title=failure.message+(failure.retryAfterSeconds!==undefined?` Try again in ${failure.retryAfterSeconds} seconds.`:'');}
  else if(!pending&&count.length)metadata.textContent=`${count.reduce((n,d)=>n+d.wordCount!,0).toLocaleString()} words${count.some(d=>d.coverage!=='complete')?' · Partial':''}`;
  row.append(metadata);
  if(reviews.length){
   const action=element('button',pending?'Analyzing…':'Analyze','analyze-policy');action.type='button';action.disabled=pending||scanning||analyzing||!prefs.enabled;action.setAttribute('aria-label',`Analyze ${policyLabels[kind]}`);action.dataset.documentId=reviews[0]?.document.id??'';
   action.addEventListener('click',()=>reviews.forEach(d=>analyze(d.document.id)));row.append(action);
  }
  grid.append(row);
 }
 fragment.append(grid);container.replaceChildren(fragment);
}
