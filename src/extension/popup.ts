import {CUSTOM_INTERESTS_KEY,interestChoices,normalizeCustomInterests,prioritizeFindings} from '../core/interests.ts';
import {summarizeReview} from '../core/summary.ts';
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
let customInterests:string[]=[],chosenInterests=new Set<import('../core/contracts.ts').RiskCategory>();
let chatHistory:ChatTurn[]=[],selectedTab='flags',analysisStarted=false;
const busyIds=new Set<string>(),onboardingKey='redflag.onboarding.v1';
const recent=mountRecentItems(get('recent-items'),[],origin=>void chrome.tabs.create({url:chrome.runtime.getURL('dashboard.html')+'#site='+encodeURIComponent(origin)}));
async function refreshSites(){try{recent.update(await listHistory());}catch{get('recent-items').textContent='Sites unavailable.';}}
subscribeHistory(()=>void refreshSites());
function acceptState(next:ReviewState|null){
 if(next?.pageUrl!==pageUrl)return;
 if(state&&state.pageKey!==next.pageKey){chatHistory=[];chatGeneration++;chatBusy=false;analysisStarted=false;get('chat-messages').replaceChildren();get('chat-status').textContent='';get('chat-model').textContent='Ask about this site’s policies';}
 state=next;
 if(summarizeReview(next).grade!=='Unrated'||next.documents.some(d=>d.assessment))analysisStarted=true;
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
 const findings=prioritizeFindings(insights.findings,preferences.priorities,customInterests);
 for(const f of findings)flags.append(citedCard(f));
 if(!findings.length)flags.append(element('p',insights.pending?'Reading policies…':insights.summaries.length?'No supported red flags in the text reviewed.':'Analyze policies to see what matters.','empty-state'));
 if(!insights.summaries.length){summary.append(element('p',insights.pending?'Reading policies…':'Your overview will appear after analysis.','empty-state'));return;}
 const overview=element('article',undefined,'summary-overview');overview.append(element('p','THE QUICK READ','eyebrow'),element('h2','What these policies mean'));
 const positive=insights.protections[0]?.explanation,negative=findings[0]?.explanation;
 overview.append(element('p',[positive,negative].filter(Boolean).join(' ')||'The reviewed text does not provide enough supported evidence to describe the main benefits or risks.','summary-prose'));
 const kinds=new Set(insights.summaries.map(s=>s.label)),partial=insights.summaries.some(s=>s.partial);
 overview.append(element('p',`${kinds.size} policy ${kinds.size===1?'type':'types'} reviewed${partial?' · Some text is incomplete':''}.`,'summary-coverage'));summary.append(overview);
 summary.append(element('h3','On your side','summary-section-title'));
 if(insights.protections.length)for(const p of insights.protections.slice(0,3))summary.append(citedCard(p,true));
 else summary.append(element('p','No positive clauses could be confirmed in the reviewed text.','summary-neutral'));
 const profile=element('section',undefined,'grade-profile'),grades=summarizeReview(state);
 profile.append(element('h3','Policy grade profile'),element('p','S is strongest · E is weakest · ? needs more evidence','meta'));
 for(const [label,grade] of [['Privacy',grades.privacyGrade],['Cookies',grades.cookiesGrade],['Terms',grades.termsGrade]]){
  const row=element('div',undefined,'grade-profile-row'),bar=element('div',undefined,'grade-bar'),rank=['E','D','C','B','A','S'].indexOf(grade);
  const fill=element('span');fill.style.width=rank<0?'0%':`${(rank+1)/6*100}%`;bar.append(fill);bar.setAttribute('role','img');bar.setAttribute('aria-label',`${label}: ${rank<0?'unknown grade':grade}`);row.append(element('span',label),bar,element('strong',rank<0?'?':grade));profile.append(row);
 }summary.append(profile);
 summary.append(element('h3','Keep in mind','summary-section-title'));
 if(findings.length)for(const f of findings.slice(0,3))summary.append(citedCard(f));
 else summary.append(element('p','No supported red flags were identified. Missing evidence can still prevent a grade.','summary-neutral'));
 const notes=element('details',undefined,'summary-card summary-detail');notes.append(element('summary','More about each policy'));
 for(const s of insights.summaries){notes.append(element('h3',s.label+(s.partial?' · Partial':'')),element('p',s.text));}summary.append(notes);
}

function paintInterests(){
 const choices=get('interest-choices');choices.replaceChildren();
 for(const choice of interestChoices){const button=element('button',choice.label,'interest-choice');button.type='button';button.dataset.category=choice.category;button.setAttribute('aria-pressed',String(chosenInterests.has(choice.category)));button.append(element('span',choice.detail));button.addEventListener('click',()=>{chosenInterests.has(choice.category)?chosenInterests.delete(choice.category):chosenInterests.add(choice.category);paintInterests();});choices.append(button);}
 const chips=get('custom-interests');chips.replaceChildren();for(const label of customInterests){const button=element('button',label+' ×','custom-chip');button.setAttribute('aria-label','Remove interest '+label);button.addEventListener('click',()=>{customInterests=customInterests.filter(v=>v!==label);paintInterests();});chips.append(button);}
}
async function saveInterests(skip=false){
 try{await navigator.locks.request('redflag-preferences-v1',async()=>{const latest=await loadPreferences();preferences={...latest,priorities:skip?[]:[...chosenInterests]};await savePreferences(preferences);await chrome.storage.local.set({[CUSTOM_INTERESTS_KEY]:skip?[]:customInterests});});if(skip){chosenInterests.clear();customInterests=[];}get('interest-step').hidden=true;get('consent-step').hidden=false;paint();}catch{get('interest-status').textContent='Could not save your choices. Try again.';}
}

function paint(){
 if(!preferences)return;
 const scanning=busy||Boolean(state?.discoveryPending);
 get('no-policies').hidden=Boolean(scanning||!pageUrl||state?.documents.length);
 const showInsights=analysisStarted||summarizeReview(state).grade!=='Unrated';
 get('tab-flags').parentElement!.hidden=!showInsights;
 for(const tab of tabs)get('panel-'+tab).hidden=!showInsights||tab!==selectedTab;
 get('loading').hidden=!scanning;get('compact-review').hidden=!pageUrl;
 if(pageUrl)renderPopupReview(get('compact-review'),state,preferences,id=>void analyzePolicy(id),busyIds,()=>void analyzeAll(),busy,siteName);
 get<HTMLButtonElement>('chat-send').disabled=chatBusy||!pageUrl||!preferences.enabled;
 get<HTMLTextAreaElement>('chat-input').disabled=chatBusy||!pageUrl||!preferences.enabled;
 paintInsights();
}
function showSetup(message?:string){get('onboarding').hidden=false;get('interest-step').hidden=true;get('consent-step').hidden=false;if(message)get('connection-status').textContent=message;get('onboarding').scrollIntoView({block:'start'});}
function canAnalyze(){if(!preferences.aiConsent.enabled||!connected){showSetup(!connected?'Start the RedFlag backend, then retry.':'Enable checks to continue.');return false;}return true;}
async function scan(){
 if(!pageUrl||busy||!preferences.enabled)return;
 busy=true;get('action-status').textContent='';paint();
 try{const response=await requestCurrentScan();if(response.ok)acceptState(response.state??null);else get('action-status').textContent=response.code==='permission-required'?'Allow site access in your browser.':'Could not check this site.';}
 catch{get('action-status').textContent='Could not check this site.';}finally{busy=false;paint();}
}
async function analyzePolicy(documentId:string){
 if(!state||busyIds.has(documentId)||!canAnalyze())return;
 const pageKey=state.pageKey;analysisStarted=true;busyIds.add(documentId);get('action-status').textContent='';paint();
 try{const result=await requestAnalysis({type:'redflag/analyze',mode:'one',pageKey,documentId});if(result.ok&&state?.pageKey===pageKey)acceptState(result.state);else if(!result.ok)get('action-status').textContent=result.error;}
 catch{get('action-status').textContent='Could not start analysis. Try again.';}finally{busyIds.delete(documentId);paint();}
}
async function analyzeAll(){
 if(busy)return;
 // Discover public policies before requiring AI consent or a connected Gemini backend.
 // Sites with no policies should report that directly instead of opening setup.
 analysisStarted=true;paint();await scan();if(!state?.documents.length){get('action-status').textContent=state?.discoveryPending?'Still looking for policies…':'No public policies found.';return;}
 if(!canAnalyze())return;
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
get('find-policies').addEventListener('click',()=>void (async()=>{busy=true;paint();try{const result=await chrome.runtime.sendMessage({type:'redflag/rescan-policies'});if(result?.ok)acceptState(result.state);else get('action-status').textContent=result?.error??'Could not check this site.';}finally{busy=false;paint();}})());
get('onboarding-next').addEventListener('click',()=>void saveInterests());get('skip-interests').addEventListener('click',()=>void saveInterests(true));
get('add-interest').addEventListener('click',()=>{const input=get<HTMLInputElement>('custom-interest');if(customInterests.length>=5){get('interest-status').textContent='Choose up to five custom interests.';return;}customInterests=normalizeCustomInterests([...customInterests,input.value]);input.value='';paintInterests();});
get('connect').addEventListener('click',()=>get<HTMLInputElement>('connection-file').click());
get('connection-file').addEventListener('change',()=>void (async()=>{
 const input=get<HTMLInputElement>('connection-file'),file=input.files?.[0],button=get<HTMLButtonElement>('connect');if(!file)return;
 button.disabled=true;get('connection-status').textContent='Checking connection…';
 try{if(file.size>8000)throw Error('Choose a RedFlag connection JSON file.');const config=JSON.parse(await file.text());const result=await chrome.runtime.sendMessage({type:'redflag/connect-backend',config});connected=result?.connected===true;get('connection-status').textContent=connected?'Backend connected. Enable checks to continue.':result?.error??'Connection unavailable.';}
 catch{get('connection-status').textContent='Choose a valid RedFlag connection file.';}finally{button.disabled=false;input.value='';paint();}
})());
async function finishSetup(ai:boolean){
 if(ai&&!connected){showSetup('Start the RedFlag backend, then retry.');return;}
 const start=get<HTMLButtonElement>('start'),community=get<HTMLButtonElement>('community-only');start.disabled=true;community.disabled=true;
 try{await navigator.locks.request('redflag-preferences-v1',async()=>{const latest=await loadPreferences();const next={...changeConsent(latest,ai,new Date().toISOString()),enabled:true};await savePreferences(next);preferences=next;});await chrome.storage.local.set({[onboardingKey]:true});get('onboarding').hidden=true;await scan();if(ai)await analyzeAll();}
 catch{get('action-status').textContent='Setup could not be saved. Try again.';}finally{start.disabled=false;community.disabled=false;paint();}
}
get('retry-connection').addEventListener('click',()=>void (async()=>{get('connection-status').textContent='Connecting…';const result=await chrome.runtime.sendMessage({type:'redflag/backend-status'});connected=result?.connected===true;get('connection-status').textContent=connected?'Connected.':result?.error??'Connection unavailable.';paint();})());
get('start').addEventListener('click',()=>void finishSetup(true));get('community-only').addEventListener('click',()=>void finishSetup(false));
chrome.runtime.onMessage.addListener(message=>{if(message?.type==='redflag/state'&&message.state?.schemaVersion===1&&message.state.pageUrl===pageUrl){acceptState(message.state);paint();}});
chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&changes[PREFERENCES_STORAGE_KEY]){preferences=normalizePreferences(changes[PREFERENCES_STORAGE_KEY].newValue,undefined,new Date().toISOString());paint();}});
void (async()=>{
 preferences=await loadPreferences();customInterests=normalizeCustomInterests((await chrome.storage.local.get(CUSTOM_INTERESTS_KEY))[CUSTOM_INTERESTS_KEY]);chosenInterests=new Set(preferences.priorities);paintInterests();get('onboarding').hidden=location.hash!=='#onboarding'&&Boolean((await chrome.storage.local.get(onboardingKey))[onboardingKey]);
 const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
 if(tab?.url&&/^https?:\/\//.test(tab.url)){const url=new URL(tab.url);url.search='';url.hash='';url.username='';url.password='';pageUrl=url.href;get('domain').textContent=url.hostname;siteName=url.hostname.replace(/^www\./,'');}
 else {get('domain').textContent='Open a website';get('status').textContent='Open a website to review its policies.';}
 paint();await refreshSites();
 const connection=await chrome.runtime.sendMessage({type:'redflag/backend-status'});connected=connection?.connected===true;get('connection-status').textContent=connected?'Backend connected.':connection?.error??'Start the RedFlag backend, then retry.';
 if(preferences.aiConsent.enabled&&!connected)showSetup();
 const response=await chrome.runtime.sendMessage({type:'redflag/get-state'});if(response?.ok)acceptState(response.state);await scan();paint();
})().catch(()=>{get('status').textContent='RedFlag is unavailable. Try reopening it.';get('loading').hidden=true;});
