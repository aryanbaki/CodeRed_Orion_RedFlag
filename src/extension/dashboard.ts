import {requestAnalysis} from '../core/analysis-actions.ts';
import {supportedDocumentGrade,summarizeReview} from '../core/summary.ts';
import {PREFERENCES_STORAGE_KEY, type RedFlagPreferences} from '../core/contracts.ts';
import {listHistory,deleteHistory,clearHistory,subscribeHistory,type CheckedSite} from '../history/store.ts';
import {reviewFromSite,RETENTION_DAYS,MAX_SITES} from '../history/model.ts';
import {applyTheme} from '../ui/theme.ts';
import {loadPreferences,savePreferences,changeConsent} from '../ui/preferences.ts';
import {aiDisclosure} from '../ui/consent.ts';
import {renderReview,priorityLabels} from '../ui/review.ts';
import {element,dateLabel} from '../ui/dom.ts';
applyTheme();
document.querySelector('.skip-link')!.addEventListener('click',event=>{event.preventDefault();document.querySelector<HTMLElement>('#main')!.focus();});
const view=document.querySelector<HTMLElement>('#view')!,status=document.querySelector<HTMLElement>('#status')!;
let sites:CheckedSite[]=[],preferences:RedFlagPreferences,loadId=0,historyLoadError:string|undefined;
const say=(message:string)=>{status.textContent=message;};
const message=(error:unknown)=>error instanceof Error?error.message:'This operation could not be completed. Try again.';
function route(){const hash=location.hash.slice(1);if(hash==='settings')return {settings:true};if(hash.startsWith('site=')){try{return {origin:decodeURIComponent(hash.slice(5))};}catch{}}return {};}
function control(label:string,action:()=>void,className?:string){const button=element('button',label,className);button.type='button';button.addEventListener('click',action);return button;}
function heading(title:string,subtitle:string){const wrapper=element('div',undefined,'heading-row'),copy=element('div');copy.append(element('p','YOUR REVIEW LIBRARY','eyebrow'),element('h1',title),element('p',subtitle,'subtitle'));wrapper.append(copy);return wrapper;}
function confirmAction(container:HTMLElement,prompt:string,action:()=>Promise<void>) {
  container.querySelector('.confirm-box')?.remove();
  const box=element('div',undefined,'confirm-box');box.setAttribute('role','group');box.setAttribute('aria-label',prompt);
  const confirm=control('Confirm deletion',async()=>{confirm.disabled=true;try{await action();box.remove();say('Saved history deleted.');await refresh();}catch(error){say(message(error));confirm.disabled=false;}});
  const cancel=control('Cancel',()=>{box.remove();container.querySelector<HTMLButtonElement>('.danger')?.focus();});
  box.append(element('p',prompt),confirm,cancel);container.append(box);cancel.focus();
}
function badges(site:CheckedSite){const row=element('div',undefined,'policy-badges');for(const r of site.documents){const grade=r.status==='pending'?'Pending':supportedDocumentGrade(r);const badge=element('span',`${r.document.label} · ${grade}`,'policy-badge');badge.dataset.grade=grade;row.append(badge);}return row;}
function sitesView(){
  const title=heading('My Sites','Your recently checked sites, with each agreement kept independent.');
  title.append(control('Clear history',()=>confirmAction(view,'Delete all saved checked-site reviews on this device? Settings and AI consent will stay unchanged.',clearHistory),'danger'));
  view.append(title);
  if(!sites.length){const empty=element('section',undefined,'empty');empty.append(element('p','NOTHING SAVED YET','eyebrow'),element('h2','Your reviews belong here.'),element('p','When RedFlag checks agreements on a supported site, the review is saved locally. Open the popup on that site to grant reading access. No general browsing history is recorded.','subtitle'));view.append(empty);}
  const list=element('div',undefined,'sites-list');
  for(const site of sites){const row=element('article',undefined,'site-row'),copy=element('div');const link=element('a',new URL(site.origin).hostname,'site-title');link.href='#site='+encodeURIComponent(site.origin);copy.append(link,element('p',`Last checked ${dateLabel(site.lastCheckedAt)} · ${site.documents.length} agreement${site.documents.length===1?'':'s'}`,'site-meta'),badges(site));const remove=control('Delete',()=>confirmAction(row,`Delete the saved review for ${new URL(site.origin).hostname}?`,()=>deleteHistory(site.origin)),'danger');remove.setAttribute('aria-label',`Delete saved review for ${new URL(site.origin).hostname}`);row.append(copy,remove);list.append(row);}
  view.append(list,element('p',`Only checked-site reviews are saved here. Up to ${MAX_SITES} sites for ${RETENTION_DAYS} days, within a 1 MB limit. Source evidence may reflect an older document; recheck before relying on it.`,'retention'));
}
async function recheck(site:CheckedSite,button:HTMLButtonElement){
  button.disabled=true;say('Requesting a new review…');
  try{
    // Agreed Agent 2 command: authoritative saved snapshot loaded by the worker.
    const result=await requestAnalysis({type:'redflag/recheck-site',siteOrigin:site.origin});
    if(!result || result.ok!==true)throw new Error(result?.error??'Saved-site recheck is unavailable in this build. Integrate the analysis-actions worker.');
    say('Recheck queued. Public documents are reviewed in the background; browsing stays available.');
  }catch(error){say(message(error));}finally{button.disabled=false;}
}
function detailView(origin:string){
  const back=element('a','← All checked sites','back');back.href='#sites';view.append(back);
  const site=sites.find(s=>s.origin===origin);
  if(!site){view.append(heading('Review unavailable','This review was deleted, expired, or could not be saved.'));return;}
  const title=heading(new URL(site.origin).hostname,'Saved review · each agreement has its own coverage, evidence and grade.');
  const actions=element('div',undefined,'actions');const again=control('Re-check site',()=>{void recheck(site,again);},'primary');actions.append(again,control('Delete review',()=>confirmAction(view,'Delete this saved review? Settings and AI consent will stay unchanged.',()=>deleteHistory(site.origin)),'danger'));title.append(actions);view.append(title,element('p',`First checked ${dateLabel(site.firstCheckedAt)} · Last checked ${dateLabel(site.lastCheckedAt)}`,'meta'));
  const summary=summarizeReview(reviewFromSite(site));view.append(element('p',`Review status: ${summary.status} · Terms ${summary.termsGrade} · Privacy ${summary.privacyGrade} · Additional Terms ${summary.additionalGrade}. Missing or incomplete evidence stays Unrated.`,'note'));
  for(const review of site.documents)if(review.failure)view.append(element('p',`${review.document.label}: ${review.failure.message}${review.failure.retryAfterSeconds!==undefined?' Retry after '+review.failure.retryAfterSeconds+' seconds.':''}`,'uncertain'));
  const live=element('p',undefined,'detail-status');live.setAttribute('role','status');const details=element('div');view.append(live,details);renderReview(details,reviewFromSite(site),preferences,live);
}
function setting(label:string,description:string,checked:boolean,onChange:(checked:boolean)=>Promise<void>){
  const row=element('label',undefined,'setting-row'),input=element('input');input.type='checkbox';input.checked=checked;const copy=element('span',label);copy.append(element('small',description));row.append(input,copy);
  input.addEventListener('change',async()=>{const wanted=input.checked;input.disabled=true;try{await onChange(wanted);say('Settings saved on this device.');}catch(error){input.checked=!wanted;say(message(error));}finally{input.disabled=false;}});return row;
}
async function updatePreferences(change:(current:RedFlagPreferences)=>RedFlagPreferences){
  // Same canonical key as popup. Lock serializes dashboard mutations and always
  // reloads the latest settings; no stale dashboard snapshot overwrites consent.
  await navigator.locks.request('redflag-preferences-v1',async()=>{const current=await loadPreferences();await savePreferences(change(current));});
  preferences=await loadPreferences();
}
function settingsView(){
  view.append(heading('Settings','Your preferences and privacy choices, saved only on this device.'));
  const grid=element('div',undefined,'settings-grid');
  const general=element('section',undefined,'settings-card');general.append(element('h2','Automatic reviews'),setting('Enable RedFlag','Discover agreements on supported sites where you have granted reading permission.',preferences.enabled,enabled=>updatePreferences(p=>({...p,enabled}))));
  const priorities=element('section',undefined,'settings-card');priorities.append(element('h2','What matters to you'),element('p','Priorities reorder supported concerns. They never change document grades.','note'));const options=element('div',undefined,'priorities');
  for(const [category,label] of Object.entries(priorityLabels)){const key=category as keyof typeof priorityLabels;const row=setting(label,'',preferences.priorities.includes(key),enabled=>updatePreferences(p=>({...p,priorities:enabled?[...new Set([...p.priorities,key])]:p.priorities.filter(v=>v!==key)})));row.querySelector('input')!.dataset.priority=key;options.append(row);}priorities.append(options);
  const ai=element('section',undefined,'settings-card');ai.append(element('h2','Background AI analysis'),element('p','External analysis is optional. Reading access and AI consent are separate choices.','note'),setting('Allow background AI analysis',aiDisclosure,preferences.aiConsent.enabled,enabled=>updatePreferences(p=>changeConsent(p,enabled,new Date().toISOString()))));ai.querySelector('input')!.id='ai-consent';general.querySelector('input')!.id='enabled';
  const consentDate=element('p',`Consent last changed: ${dateLabel(preferences.aiConsent.updatedAt)}. Requests already sent cannot be recalled.`,'meta');consentDate.id='consent-date';ai.append(consentDate);
  const local=element('section',undefined,'settings-card');local.append(element('h2','Local review history'),element('p',`Up to ${MAX_SITES} checked sites are retained for ${RETENTION_DAYS} days within a 1 MB limit. Only site origins, public document links, supported evidence and review metadata are saved. Deleting history does not change settings or revoke reading permissions.`,'note'),control('Clear history',()=>confirmAction(local,'Delete all locally saved checked-site reviews?',clearHistory),'danger'));grid.append(general,priorities,ai,local);view.append(grid);
}
function syncSettings(){if(!route().settings)return;const consentDate=document.querySelector('#consent-date');if(consentDate)consentDate.textContent=`Consent last changed: ${dateLabel(preferences.aiConsent.updatedAt)}. Requests already sent cannot be recalled.`;const enabled=document.querySelector<HTMLInputElement>('#enabled'),ai=document.querySelector<HTMLInputElement>('#ai-consent');if(enabled)enabled.checked=preferences.enabled;if(ai)ai.checked=preferences.aiConsent.enabled;for(const input of document.querySelectorAll<HTMLInputElement>('[data-priority]'))input.checked=preferences.priorities.includes(input.dataset.priority as keyof typeof priorityLabels);}
function render(){const current=route();view.replaceChildren();document.querySelector('#sites-nav')!.setAttribute('aria-current',current.settings?'false':'page');document.querySelector('#settings-nav')!.setAttribute('aria-current',current.settings?'page':'false');if(current.settings)settingsView();else if(historyLoadError){view.append(heading('History unavailable','Your settings remain available. Retry or explicitly clear an unsupported history format.'),control('Retry',()=>{void refresh();}),control('Clear history',()=>confirmAction(view,'Reset saved history on this device?',clearHistory),'danger'));}else if(current.origin)detailView(current.origin);else sitesView();}
async function refresh(){const id=++loadId;try{const next=await listHistory();if(id!==loadId)return;sites=next;historyLoadError=undefined;if(route().settings){syncSettings();return;}const active=document.activeElement instanceof HTMLElement?document.activeElement:null;const key=active?.getAttribute('aria-label')??active?.textContent;render();if(key)[...view.querySelectorAll<HTMLElement>('button,a')].find(e=>(e.getAttribute('aria-label')??e.textContent)===key)?.focus({preventScroll:true});}catch(error){historyLoadError=message(error);say(historyLoadError);if(!route().settings)render();}}
subscribeHistory(()=>{void refresh();});
chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local' && changes[PREFERENCES_STORAGE_KEY])void loadPreferences().then(value=>{preferences=value;syncSettings();if(!route().settings)render();}).catch(error=>say(message(error)));});
addEventListener('hashchange',()=>{say('');render();document.querySelector<HTMLElement>('h1')?.setAttribute('tabindex','-1');document.querySelector<HTMLElement>('h1')?.focus({preventScroll:true});});
void (async()=>{try{preferences=await loadPreferences();if(route().settings)render();await refresh();}catch(error){say(message(error));view.append(heading('Settings unavailable','Local settings could not be loaded. Reload to try again.'));}})();
