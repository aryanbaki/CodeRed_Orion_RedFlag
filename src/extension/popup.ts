import {requestCurrentScan} from '../core/discovery-actions.ts';
import {requestAnalysis} from '../core/analysis-actions.ts';
import {applyTheme} from '../ui/theme.ts';
import {renderPopupReview} from '../ui/popup-review.ts';
import {siteInsights} from '../core/site-insights.ts';
import {element,safeLink} from '../ui/dom.ts';
import {listHistory,subscribeHistory} from '../history/store.ts';
import {mountRecentItems} from '../ui/recent-items.ts';
import {PREFERENCES_STORAGE_KEY,type ReviewState,type EvidenceFinding} from '../core/contracts.ts';
import type {ChatTurn,ChatResponse} from '../core/chat-contracts.ts';
import {changeConsent,loadPreferences,normalizePreferences,savePreferences} from '../ui/preferences.ts';
applyTheme();
const get=<T extends HTMLElement=HTMLElement>(id:string)=>document.querySelector<T>('#'+id)!;
let preferences:Awaited<ReturnType<typeof loadPreferences>>,state:ReviewState|null=null,pageUrl:string|null=null,busy=false,connected=false,siteName='This site',chatBusy=false,chatGeneration=0;
let chatHistory:ChatTurn[]=[],selectedTab='flags';
const busyIds=new Set<string>(),onboardingKey='redflag.onboarding.v1';
const recent=mountRecentItems(get('recent-items'),[],origin=>void chrome.tabs.create({url:chrome.runtime.getURL('dashboard.html')+'#site='+encodeURIComponent(origin)}));
async function refreshSites(){try{recent.update(await listHistory());}catch{get('recent-items').textContent='Sites unavailable.';}}
subscribeHistory(()=>void refreshSites());
function acceptState(next:ReviewState|null){
 if(next?.pageUrl!==pageUrl)return;
 if(state&&state.pageKey!==next.pageKey){chatHistory=[];chatGeneration++;chatBusy=false;get('chat-messages').replaceChildren();get('chat-status').textContent='';get('chat-model').textContent='Ask about this site’s policies';}
 state=next;
 if(next.documents.length&&/^(No public policies|Still looking for policies)/.test(get('action-status').textContent??''))get('action-status').textContent='';
}
function citedCard(f:EvidenceFinding&{policyLabel?:string},benefit=false){
 const card=element('article',undefined,benefit?'finding benefit':'finding');card.dataset.severity=f.severity;
 const heading=element('div',undefined,'finding-heading');heading.append(element('h3',f.title),element('span',f.policyLabel??'Policy','tag'));
 const source=element('details');source.append(element('summary','Why this matters'),element('blockquote',f.quote),safeLink('Read source ↗',f.sourceUrl));
 card.append(heading,element('p',f.explanation),source);return card;
}
function paintInsights(){
 const insights=siteInsights(state),flags=get('flags-content'),summary=get('summary-content');flags.replaceChildren();summary.replaceChildren();
 for(const f of insights.findings)flags.append(citedCard(f));
 if(!insights.findings.length)flags.append(element('p',insights.pending?'Reading policies…':insights.summaries.length?'No supported red flags in the text reviewed. Missing evidence can still prevent a grade.':'Analyze policies to see supported red flags.','empty-state'));
 for(const s of insights.summaries){const card=element('article',undefined,'summary-card');card.append(element('h3',s.label),element('p',s.text));if(s.model)card.append(element('p',s.model,'meta'));summary.append(card);}
 if(!insights.summaries.length)summary.append(element('p',insights.pending?'Reading policies…':'Analyze policies to see a summary.','empty-state'));
 if(insights.protections.length){summary.append(element('h3','In your favor'));for(const p of insights.protections)summary.append(citedCard(p,true));}
}
function paint(){
 if(!preferences)return;
 get<HTMLInputElement>('review-enabled').checked=preferences.enabled;
 get('ai-state').textContent=preferences.aiConsent.enabled?connected?'Gemini connected':'Gemini connection needed':'Community ratings only';
 const scanning=busy||Boolean(state?.discoveryPending);
 get('loading').hidden=!scanning;get('compact-review').hidden=!pageUrl;
 if(pageUrl)renderPopupReview(get('compact-review'),state,preferences,id=>void analyzePolicy(id),busyIds,()=>void analyzeAll(),busy,siteName);
 get<HTMLButtonElement>('chat-send').disabled=chatBusy||!pageUrl||!preferences.enabled;
 get<HTMLTextAreaElement>('chat-input').disabled=chatBusy||!pageUrl||!preferences.enabled;
 paintInsights();
}
function showSetup(message?:string){get('onboarding').hidden=false;if(message)get('connection-status').textContent=message;get('onboarding').scrollIntoView({block:'start'});}
function canAnalyze(){if(!preferences.aiConsent.enabled||!connected){showSetup(!connected?'Import your backend connection file to use Gemini.':'Enable Gemini checks to continue.');return false;}return true;}
async function scan(){
 if(!pageUrl||busy||!preferences.enabled)return;
 busy=true;get('action-status').textContent='';paint();
 try{const response=await requestCurrentScan();if(response.ok)acceptState(response.state??null);else get('action-status').textContent=response.code==='permission-required'?'Allow site access in your browser.':'Could not check this site.';}
 catch{get('action-status').textContent='Could not check this site.';}finally{busy=false;paint();}
}
async function analyzePolicy(documentId:string){
 if(!state||busyIds.has(documentId)||!canAnalyze())return;
 const pageKey=state.pageKey;busyIds.add(documentId);get('action-status').textContent='';paint();
 try{const result=await requestAnalysis({type:'redflag/analyze',mode:'one',pageKey,documentId});if(result.ok&&state?.pageKey===pageKey)acceptState(result.state);else if(!result.ok)get('action-status').textContent=result.error;}
 catch{get('action-status').textContent='Could not start analysis. Try again.';}finally{busyIds.delete(documentId);paint();}
}
async function analyzeAll(){
 if(busy||!canAnalyze())return;
 await scan();if(!state?.documents.length){get('action-status').textContent=state?.discoveryPending?'Still looking for policies…':'No public policies found.';return;}
 const pageKey=state.pageKey;
 try{const result=await requestAnalysis({type:'redflag/analyze',mode:'recheck',pageKey});if(result.ok&&state?.pageKey===pageKey){acceptState(result.state);paint();}else if(!result.ok)get('action-status').textContent=result.error;}
 catch{get('action-status').textContent='Could not start analysis. Try again.';}
}
const tabs=['flags','summary','chat'];
function selectTab(name:string){selectedTab=name;for(const tab of tabs){get<HTMLButtonElement>('tab-'+tab).setAttribute('aria-selected',String(tab===name));get('tab-'+tab).tabIndex=tab===name?0:-1;get('panel-'+tab).hidden=tab!==name;}}
for(const name of tabs){get('tab-'+name).addEventListener('click',()=>selectTab(name));get('tab-'+name).addEventListener('keydown',event=>{const e=event as KeyboardEvent;let index=tabs.indexOf(selectedTab);if(e.key==='ArrowRight')index=(index+1)%3;else if(e.key==='ArrowLeft')index=(index+2)%3;else if(e.key==='Home')index=0;else if(e.key==='End')index=2;else return;e.preventDefault();selectTab(tabs[index]);get('tab-'+tabs[index]).focus();});}
function chatBubble(role:ChatTurn['role'],text:string,response?:Extract<ChatResponse,{ok:true}>){
 const bubble=element('article',text,'chat-bubble '+role);bubble.setAttribute('aria-label',role==='user'?'Your question':'Gemini answer');
 if(response?.citations.length){const sources=element('details');sources.append(element('summary',`${response.citations.length} source${response.citations.length===1?'':'s'}`));response.citations.forEach((citation,i)=>sources.append(element('blockquote',`[${i+1}] ${citation.quote}`),safeLink('Read policy ↗',citation.sourceUrl)));bubble.append(sources);}
 get('chat-messages').append(bubble);bubble.scrollIntoView({block:'nearest'});
}
get('chat-form').addEventListener('submit',event=>{event.preventDefault();void sendChat();});
get('chat-input').addEventListener('keydown',event=>{const e=event as KeyboardEvent;if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();void sendChat();}});
async function sendChat(){
 if(chatBusy||!canAnalyze())return;
 const question=get<HTMLTextAreaElement>('chat-input').value.trim();if(!question||question.length>2000)return;
 if(!state){get('chat-status').textContent='Find policies with Analyze all first.';return;}
 const generation=chatGeneration,pageKey=state.pageKey;chatBusy=true;chatBubble('user',question);get('chat-status').textContent='Reading policies…';paint();
 try{
  const result=await chrome.runtime.sendMessage({type:'redflag/chat',schemaVersion:1,pageKey,question,history:chatHistory.slice(-10)}) as ChatResponse;
  if(generation!==chatGeneration||state?.pageKey!==pageKey)return;
  if(!result?.ok){get('chat-status').textContent=result?.error??'Gemini could not answer. Try again.';return;}
  chatBubble('assistant',result.answer,result);chatHistory.push({role:'user',text:question},{role:'assistant',text:result.answer.slice(0,4000)});chatHistory=chatHistory.slice(-10);
  get('chat-model').textContent=`Powered by Gemini · ${result.model}`;get('chat-status').textContent='';get<HTMLTextAreaElement>('chat-input').value='';
 }catch{if(generation===chatGeneration)get('chat-status').textContent='Gemini could not answer. Try again.';}
 finally{if(generation===chatGeneration){chatBusy=false;paint();}}
}
get('settings-link').addEventListener('click',()=>{get<HTMLDetailsElement>('settings').open=!get<HTMLDetailsElement>('settings').open;get('settings').scrollIntoView();});
get('open-summary').addEventListener('click',()=>void chrome.tabs.create({url:chrome.runtime.getURL('dashboard.html')}));
get('setup').addEventListener('click',()=>showSetup());
get('connect').addEventListener('click',()=>get<HTMLInputElement>('connection-file').click());
get('connection-file').addEventListener('change',()=>void (async()=>{
 const input=get<HTMLInputElement>('connection-file'),file=input.files?.[0],button=get<HTMLButtonElement>('connect');if(!file)return;
 button.disabled=true;get('connection-status').textContent='Checking connection…';
 try{if(file.size>8000)throw Error('Choose a RedFlag connection JSON file.');const config=JSON.parse(await file.text());const result=await chrome.runtime.sendMessage({type:'redflag/connect-backend',config});connected=result?.connected===true;get('connection-status').textContent=connected?'Backend connected. Enable Gemini checks to continue.':result?.error??'Connection unavailable.';}
 catch{get('connection-status').textContent='Choose a valid RedFlag connection file.';}finally{button.disabled=false;input.value='';paint();}
})());
async function finishSetup(ai:boolean){
 if(ai&&!connected){showSetup('Import your backend connection file first.');return;}
 const start=get<HTMLButtonElement>('start'),community=get<HTMLButtonElement>('community-only');start.disabled=true;community.disabled=true;
 try{await navigator.locks.request('redflag-preferences-v1',async()=>{const latest=await loadPreferences();const next={...changeConsent(latest,ai,new Date().toISOString()),enabled:true};await savePreferences(next);preferences=next;});await chrome.storage.local.set({[onboardingKey]:true});get('onboarding').hidden=true;await scan();if(ai)await analyzeAll();}
 catch{get('action-status').textContent='Setup could not be saved. Try again.';}finally{start.disabled=false;community.disabled=false;paint();}
}
get('start').addEventListener('click',()=>void finishSetup(true));get('community-only').addEventListener('click',()=>void finishSetup(false));
get('review-enabled').addEventListener('change',()=>void (async()=>{preferences={...preferences,enabled:get<HTMLInputElement>('review-enabled').checked};await savePreferences(preferences);paint();if(preferences.enabled)await scan();})());
chrome.runtime.onMessage.addListener(message=>{if(message?.type==='redflag/state'&&message.state?.schemaVersion===1&&message.state.pageUrl===pageUrl){acceptState(message.state);paint();}});
chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&changes[PREFERENCES_STORAGE_KEY]){preferences=normalizePreferences(changes[PREFERENCES_STORAGE_KEY].newValue,undefined,new Date().toISOString());paint();}});
void (async()=>{
 preferences=await loadPreferences();get('onboarding').hidden=location.hash!=='#onboarding'&&Boolean((await chrome.storage.local.get(onboardingKey))[onboardingKey]);
 const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
 if(tab?.url&&/^https?:\/\//.test(tab.url)){const url=new URL(tab.url);url.search='';url.hash='';url.username='';url.password='';pageUrl=url.href;get('domain').textContent=url.hostname;siteName=url.hostname.replace(/^www\./,'');}
 else {get('domain').textContent='Open a website';get('status').textContent='Open a website to review its policies.';}
 paint();await refreshSites();
 const connection=await chrome.runtime.sendMessage({type:'redflag/backend-status'});connected=connection?.connected===true;get('connection-status').textContent=connected?'Backend connected.':connection?.error??'Import your backend connection file.';
 if(preferences.aiConsent.enabled&&!connected)showSetup();
 const response=await chrome.runtime.sendMessage({type:'redflag/get-state'});if(response?.ok)acceptState(response.state);await scan();paint();
})().catch(()=>{get('status').textContent='RedFlag is unavailable. Try reopening it.';get('loading').hidden=true;});
