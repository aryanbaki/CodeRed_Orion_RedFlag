import type {CheckedSite} from '../history/model.ts';
import type {RedFlagPreferences} from '../core/contracts.ts';
import {supportedDocumentGrade} from '../core/summary.ts';
import {element,dateLabel,safeLink} from './dom.ts';
import {orderedFindings} from './review.ts';
export function gradeLegend() {
  const details=element('details',undefined,'grade-legend');details.dataset.key='grade-legend';
  details.append(element('summary','What do the grades mean?'));
  details.append(element('p','Grades summarize supported concerns in one complete document. They are not a safety guarantee.'));
  const list=element('dl');
  for(const [grade,label] of [['S','Few supported concerns'],['A','Some supported concerns'],['B','Moderate supported concerns'],['C','Significant supported concerns'],['D','High supported concerns'],['E','Highest concern band'],['Unrated','No reliable grade yet: missing, partial, pending or failed review']]) {list.append(element('dt',grade),element('dd',label));}
  details.append(list,element('p','Partial evidence may still show useful concerns. Each agreement keeps its own grade; community service ratings are separate.','meta'));
  return details;
}
const reasons:Record<string,string>={pending:'Still checking this document.',incomplete:'Only part of this document was available.', 'permission-required':'Check browser site access, then recheck.', 'authentication-required':'The document needs a login. RedFlag will not use your cookies.', 'ai-consent-required':'Complete onboarding to enable Gemini analysis.',inaccessible:'This document could not be opened.',unsupported:'This document format is not supported.', 'too-large':'This document exceeds the review limit.', 'insufficient-evidence':'There is not enough evidence for a grade.',quota:'The analysis limit was reached. Try again later.',timeout:'The check timed out. Try again.', 'invalid-response':'The result could not be verified.', 'unsafe-url':'This document link was blocked.', 'network-error':'The connection failed. Try again.'};
/** Dashboard-only presentation; shared popup/proactive renderer is unchanged. */
export function renderDashboardReview(container:HTMLElement,site:CheckedSite,preferences:RedFlagPreferences) {
  const fragment=document.createDocumentFragment();
  for(const review of site.documents){
    const card=element('article',undefined,'card compact-policy');
    const header=element('div',undefined,'policy-header'),grade=supportedDocumentGrade(review);
    const badge=element('p',`Grade: ${grade}`,'grade');badge.dataset.grade=grade;
    header.append(element('h2',review.document.label),badge);
    card.append(header);
    if(grade==='Unrated')card.append(element('p',review.failure?.message??reasons[review.reason??'insufficient-evidence']??reasons['insufficient-evidence'],'uncertain'));
    if(review.failure?.retryAfterSeconds!==undefined)card.append(element('p',`Try again after ${review.failure.retryAfterSeconds} seconds.`,'meta'));
    const a=review.assessment;
    card.append(element('p',`${review.status==='pending'?'Checking':review.coverage==='complete'?'Complete document':'Incomplete review'} · ${a?.provider==='gemini'?'Google Gemini':a?'Community':'No assessment'}${review.cached?' · Saved result':''}`,'meta'),safeLink('Open document',review.document.url));
    const findings=orderedFindings(a?.findings??[],preferences.priorities);
    const evidence=element('details',undefined,'policy-evidence');evidence.dataset.key='evidence:'+review.document.id;
    evidence.append(element('summary',findings.length?`View ${findings.length} concern${findings.length===1?'':'s'} and evidence`:'Review details and dates'));
    if(a?.summary)evidence.append(element('p',a.summary,'meta'));
    for(const finding of findings){const section=element('section',undefined,'finding');section.append(element('h3',finding.title),element('p',finding.explanation),element('blockquote',finding.quote),safeLink('Evidence source',finding.sourceUrl));evidence.append(section);}
    const dates=element('dl',undefined,'review-dates');
    for(const [label,value]of [['Document updated',review.freshness.documentUpdatedAt],['Retrieved',review.freshness.retrievedAt],['Analyzed',a?.analyzedAt??review.freshness.analyzedAt],['Cache expires',review.freshness.cacheExpiresAt]])dates.append(element('dt',label),element('dd',dateLabel(value)));
    evidence.append(dates);
    if(a)evidence.append(element('p',`Model ${a.model??'Unknown'} · Prompt ${a.promptVersion} · Rubric ${a.rubricVersion}`,'meta'));
    for(const ref of review.community){const community=element('section',undefined,'community-reference');community.append(element('h3',`${ref.provider==='tosdr'?'ToS;DR':'PrivacySpy'} · ${ref.freshness} review`),element('p',`${ref.serviceName} · ${ref.scope} rating ${ref.rating??'Unrated'}. Separate from this document grade.`),element('p',`${ref.attribution} · ${ref.reviewStatus}`,'meta'),element('p',`Reviewed ${dateLabel(ref.reviewedAt)} · Record updated ${dateLabel(ref.recordUpdatedAt)} · Fetched ${dateLabel(ref.fetchedAt)}`,'meta'),safeLink('Community record',ref.sourceUrl));evidence.append(community);}
    card.append(evidence);fragment.append(card);
  }
  container.replaceChildren(fragment);
}
