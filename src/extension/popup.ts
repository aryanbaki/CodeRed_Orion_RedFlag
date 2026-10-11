import {requestCurrentScan} from '../core/discovery-actions.ts';
import {applyTheme} from '../ui/theme.ts';
import {renderPopupReview} from '../ui/popup-review.ts';
import {requestAnalysis,type AnalysisMode} from '../core/analysis-actions.ts';
import {listHistory,subscribeHistory} from '../history/store.ts';
import {mountRecentItems} from '../ui/recent-items.ts';
applyTheme();
import {validateDocument} from '../core/evidence.ts';
import {PREFERENCES_STORAGE_KEY, type ExtensionResponse, type ReviewState, type RiskCategory} from '../core/contracts.ts';
import {demoDocument, demoFindings} from '../providers/demo.ts';
import {element} from '../ui/dom.ts';
import {renderSiteAccess} from '../ui/access.ts';
import {aiDisclosure} from '../ui/consent.ts';
import {changeConsent, loadPreferences, normalizePreferences, savePreferences} from '../ui/preferences.ts';
import {orderedFindings, priorityLabels, renderReview} from '../ui/review.ts';
const status = document.querySelector<HTMLElement>('#status')!;
const results = document.querySelector<HTMLElement>('#results')!;
const settingsStatus = document.querySelector<HTMLElement>('#settings-status')!;
const aiState = document.querySelector<HTMLElement>('#ai-state')!;
const aiToggle = document.querySelector<HTMLButtonElement>('#ai-toggle')!;
const previewStatus = document.querySelector<HTMLElement>('#preview-status')!;
const preview = document.querySelector<HTMLDetailsElement>('#preview')!;
const text = document.querySelector<HTMLElement>('#text')!;
const demoResults = document.querySelector<HTMLElement>('#demo-results')!;
let preferences: Awaited<ReturnType<typeof loadPreferences>>;
let state: ReviewState | null = null;
let activePageUrl: string | null = null;
let demoVisible = false;
let saving = false;
let actionBusy=false;
let scanIssue:string|null=null;
const allButton=document.querySelector<HTMLButtonElement>('#analyze-all')!;
const recheckButton=document.querySelector<HTMLButtonElement>('#recheck')!;
async function analyze(mode:AnalysisMode,documentId?:string) {
  if(!state || actionBusy || (!preferences?.aiConsent.enabled && mode!=='recheck')) return;
  actionBusy=true;paint();
  try {const response=await requestAnalysis({type:'redflag/analyze',mode,pageKey:state.pageKey,...(documentId ? {documentId} : {})});
    if(response.ok && response.state.pageKey===state.pageKey) {state=response.state;paint();document.querySelector('#action-status')!.textContent='Queued · waiting for results.';}
    else if(!response.ok) document.querySelector('#action-status')!.textContent=response.error;
  } catch {document.querySelector('#action-status')!.textContent='Could not queue analysis. Try again.';} finally {actionBusy=false;paint();}
}
allButton.addEventListener('click',()=>void analyze('all'));
async function scanCurrent(){
  if(actionBusy || !activePageUrl || !preferences.enabled)return;
  actionBusy=true;scanIssue=null;paint();document.querySelector('#action-status')!.textContent='Checking policy links…';
  try{const response=await requestCurrentScan();if(response.ok){if(response.state?.pageUrl===activePageUrl)state=response.state;else if(!response.state)state=null;document.querySelector('#action-status')!.textContent=state?.documents.length?'Policy links updated.':'';}else{scanIssue=response.code;document.querySelector('#action-status')!.textContent=response.code==='permission-required'?'':response.error;}}catch{document.querySelector('#action-status')!.textContent='Could not check this site. Try again.';}finally{actionBusy=false;paint();refreshAccess();}
}
recheckButton.addEventListener('click',()=>void (!state?.documents.length ? scanCurrent() : analyze('recheck')));
function openSummary(origin?:string) {void chrome.tabs.create({url:chrome.runtime.getURL('dashboard.html')+(origin ? '#site='+encodeURIComponent(origin) : '')});}
document.querySelector('#open-summary')!.addEventListener('click',()=>openSummary(activePageUrl ? new URL(activePageUrl).origin : undefined));
document.querySelector('#setup-site')!.addEventListener('click',()=>{const settings=document.querySelector<HTMLDetailsElement>('#settings')!;settings.open=true;settings.scrollIntoView();document.querySelector<HTMLElement>('#access-heading')!.setAttribute('tabindex','-1');document.querySelector<HTMLElement>('#access-heading')!.focus();});
document.querySelector('#settings-link')!.addEventListener('click',event=>{event.preventDefault();const settings=document.querySelector<HTMLDetailsElement>('#settings')!;settings.open=true;settings.scrollIntoView();settings.querySelector('summary')!.focus();});
const recent=mountRecentItems(document.querySelector('#recent-items')!,[],openSummary);
async function refreshRecent() {try {recent.update(await listHistory());}catch {document.querySelector('#recent-items')!.textContent='Local checked-site history is unavailable.';}}
subscribeHistory(()=>void refreshRecent());
void refreshRecent();
const boxes: HTMLInputElement[] = [];
aiToggle.disabled=true;
const demoButton=document.querySelector<HTMLButtonElement>('#demo')!; demoButton.disabled=true;
const enabled = element('input'); enabled.type = 'checkbox'; enabled.id = 'review-enabled'; enabled.disabled=true;
const enabledLabel = element('label'); enabledLabel.append(enabled,' Show proactive reviews on supported screens');
document.querySelector('#priorities')!.before(enabledLabel);
document.querySelector('#ai-disclosure')!.textContent = aiDisclosure;
for (const [category,label] of Object.entries(priorityLabels)) {
  const box = element('input'); box.type='checkbox'; box.value=category; box.disabled=true;
  const row=element('label'); row.append(box, ` ${label}`); document.querySelector('#priorities')!.append(row); boxes.push(box);
  box.addEventListener('change', () => void persist({...preferences, priorities:boxes.filter(b=>b.checked).map(b=>b.value as RiskCategory)}));
}
enabled.addEventListener('change', () => void persist({...preferences,enabled:enabled.checked}));
function renderDemo() {
  demoResults.replaceChildren(); demoResults.hidden=!demoVisible;
  if (!demoVisible || !preferences) return;
  demoResults.className='fictional';
  demoResults.append(element('p','FICTIONAL EXAMPLE ONLY · NOT THIS WEBSITE','badge'));
  const findings = demoFindings().map((f,i)=>({...f,id:String(i),severity:'medium' as const,title:priorityLabels[f.category]}));
  for (const f of orderedFindings(findings,preferences.priorities)) {
    const card = element('article',undefined,'card');
    card.append(element('p',`FICTIONAL EXAMPLE${preferences.priorities.includes(f.category) ? ' · YOUR PRIORITY' : ''}`,'badge'), element('h3',f.title), element('p',f.explanation),element('blockquote',f.quote));demoResults.append(card);
  }
}
function paint() {
  if (!preferences) return;
  boxes.forEach(b=>{if(!saving) b.checked=preferences.priorities.includes(b.value as RiskCategory);b.disabled=saving;}); if(!saving) enabled.checked=preferences.enabled; enabled.disabled=saving;
  aiToggle.disabled=saving; demoButton.disabled=false;
  aiToggle.textContent=preferences.aiConsent.enabled ? 'Turn off background AI analysis' : 'Enable background AI analysis';
  aiState.textContent=preferences.aiConsent.enabled ? 'On. Public legal documents may be analyzed automatically in the background.' : 'Off. New AI transmissions are disabled. Local and community results may still be available.';
  if (state?.documents.length) renderReview(results,state,preferences);
  const hasDocuments=Boolean(state?.documents.length);
  document.querySelector('#empty-state')!.toggleAttribute('hidden',hasDocuments);
  document.querySelector('#empty-heading')!.textContent=activePageUrl ? (scanIssue==='permission-required'?'Allow site access':'Check this website') : 'Open a website';
  document.querySelector('#empty-copy')!.textContent=activePageUrl ? (scanIssue==='permission-required'?'Allow RedFlag to read public policy links on this site.':'No public policies found yet. Check this site or allow reading access.') : 'Open an HTTP or HTTPS website to find its public policies.';
  document.querySelector('#setup-site')!.toggleAttribute('hidden',!activePageUrl);
  status.textContent=activePageUrl || hasDocuments ? '' : 'This browser page cannot be reviewed.';
  allButton.hidden=!hasDocuments;
  document.querySelector('#open-summary')!.toggleAttribute('hidden',!hasDocuments);
  renderPopupReview(document.querySelector('#compact-review')!,state,preferences,id=>void analyze('one',id));
  allButton.disabled=actionBusy || !state?.documents.length || !preferences.enabled || !preferences.aiConsent.enabled;
  recheckButton.disabled=actionBusy || !activePageUrl || !preferences.enabled;
  document.querySelector('#evidence')!.toggleAttribute('hidden',!state?.documents.length);
  renderDemo();
}
async function persist(next: typeof preferences) {
  if (saving || !preferences) return;
  const previous=preferences;
  const patch={...(next.enabled!==previous.enabled ? {enabled:next.enabled} : {}),...(JSON.stringify(next.priorities)!==JSON.stringify(previous.priorities) ? {priorities:next.priorities} : {}),...(JSON.stringify(next.aiConsent)!==JSON.stringify(previous.aiConsent) ? {aiConsent:next.aiConsent} : {})};
  saving=true;paint();settingsStatus.textContent='Saving settings…';
  try {await navigator.locks.request('redflag-preferences-v1',async()=>{const latest=await loadPreferences();const updated={...latest,...patch};await savePreferences(updated);preferences=updated;});settingsStatus.textContent='Saved on this device.';}
  catch {settingsStatus.textContent='Could not save settings. The change was not applied.';}
  finally {saving=false;paint();}
}
aiToggle.addEventListener('click', () => void persist(changeConsent(preferences,!preferences.aiConsent.enabled,new Date().toISOString())));
function refreshAccess() {void renderSiteAccess(document.querySelector('#site-access')!,document.querySelector('#access-status')!,state).catch(()=>{document.querySelector('#access-status')!.textContent='Site access settings are unavailable in this build.';});}
async function init() {
  preferences=await loadPreferences(); paint();
  const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
  if (tab?.url && /^https?:\/\//.test(tab.url)) {const url=new URL(tab.url);url.search='';url.hash='';url.username='';url.password='';activePageUrl=url.href;document.querySelector('#domain')!.textContent=url.hostname;} else {document.querySelector('#domain')!.textContent='Open a website';status.textContent='This browser page cannot be reviewed. Open an HTTP or HTTPS website.';}
  try {
    const response: ExtensionResponse = await chrome.runtime.sendMessage({type:'redflag/get-state'});
    if (response?.ok && response.state && response.state.pageUrl === activePageUrl) {state=response.state;paint();}
    else if(activePageUrl && response && !response.ok)document.querySelector('#action-status')!.textContent=response.error;
  } catch {status.textContent='Automatic discovery is not connected in this build. No real website analysis is available.';}
  paint();refreshAccess();await scanCurrent();
}
chrome.storage.onChanged.addListener((changes,area)=>{
  if (area === 'local' && changes[PREFERENCES_STORAGE_KEY]) {
    preferences=normalizePreferences(changes[PREFERENCES_STORAGE_KEY].newValue,undefined,new Date().toISOString());paint();
  }
});
chrome.runtime.onMessage.addListener(message=>{
  if (message?.type === 'redflag/state' && message.state?.schemaVersion === 1 && message.state.pageUrl === activePageUrl && (!state || message.state.pageKey === state.pageKey)) {state=message.state;scanIssue=null;document.querySelector('#action-status')!.textContent='';paint();refreshAccess();}
});
void init().catch(()=>{status.textContent='Settings could not be loaded. Background AI remains off.';aiToggle.disabled=true;});
document.querySelector('#demo')!.addEventListener('click',()=>{demoVisible=true;renderDemo();previewStatus.textContent='Fictional example only. These findings do not describe your current page.';});
document.querySelector('#capture')!.addEventListener('click',async()=>{
  demoVisible=false;renderDemo();preview.hidden=true;text.textContent='';
  const button=document.querySelector<HTMLButtonElement>('#capture')!;button.disabled=true;previewStatus.textContent='Reading page text locally…';
  try {
    const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
    if (!tab?.id || !tab.url || !/^https?:\/\//.test(tab.url)) throw new Error('Open an HTTP or HTTPS policy page first.');
    const [result]=await chrome.scripting.executeScript({target:{tabId:tab.id},func:()=>{
      const selection=window.getSelection()?.toString().trim();
      const value=selection || (document.querySelector<HTMLElement>('main, article') ?? document.body).innerText;
      return {text:value.slice(0,60001),partial:Boolean(selection),url:location.href};
    }});
    if (!result?.result) throw new Error('This page could not be read.');
    validateDocument({url:result.result.url,text:result.result.text,capturedAt:new Date().toISOString()});
    text.textContent=result.result.text;preview.hidden=false;
    previewStatus.textContent=`Captured ${result.result.text.length.toLocaleString()} characters${result.result.partial ? ' from your selection (partial review)' : ' from the page'}. No analysis has been run on this manual preview.`;
  } catch(error) {previewStatus.textContent=error instanceof Error ? error.message : 'Could not read this page.';}
  finally {button.disabled=false;}
});
