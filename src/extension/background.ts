import {BACKEND_KEY,parseBackend,checkBackend,connectLocalBackend,type Backend} from '../background/backend.ts';
import {requestPolicyChat} from '../background/chat.ts';
import {validChatInput,type ChatCommand,type ChatResponse} from '../core/chat-contracts.ts';
import {contentHash} from '../background/cache.ts';
import {MAX_POLICY_CHARACTERS} from '../core/policy-text.ts';
import {abortable, boundedText} from '../background/io.ts';
import {CONTRACT_VERSION, PREFERENCES_STORAGE_KEY, createDefaultPreferences, type ReviewState, type RedFlagPreferences, type DiscoveredDocument, type ConsentContext, type AnalysisDocument} from '../core/contracts.ts';
import {pendingState, safePageUrl, validateDiscovery, validPreferences, permitsAi} from '../background/validation.ts';
import {retrievePublicDocument, type Download} from '../background/retrieval.ts';
import {processDocument} from '../background/processor.ts';
import {CACHE_KEY, type CacheEntry, type AnalysisVersions} from '../background/cache.ts';
import {COMMUNITY_CATALOG_KEY, parseCommunityCatalog, parseTosdrSearch, lookupCommunity} from '../background/community.ts';
import {GEMINI_BACKUP_MODELS,validFallbackModels} from '../core/model-routing.ts';
import {findCommonPolicies} from '../background/common-policies.ts';
import {seedServices,seedFetchedAt} from '../background/community-seed.ts';
import type {Extraction} from '../background/extraction.ts';
import {publicDocumentUrl} from '../discovery/urls.ts';
import {ToolbarController} from '../background/toolbar.ts';
import {AnalysisFailure,reviewFailure} from '../background/failures.ts';
import type {AnalysisActionResponse,AnalysisCommand} from '../core/analysis-actions.ts';
import type {ScanCurrentCommand,ScanCurrentResponse} from '../core/discovery-actions.ts';
import {getHistory,recordReview} from '../history/store.ts';
import {reviewFromSite,checkedOrigin} from '../history/model.ts';
const toolbar=new ToolbarController();
const navigationEpoch=new Map<number,number>();
const manualAccess=new Map<number,{pageUrl:string;documentId?:string}>();
const scans=new Map<number,Promise<ScanCurrentResponse>>();
const SESSION_KEY = 'redflag.jobs.v1';
interface Job {tabId:number;pageKey:string;documentId:string;attempts:number;bypassCache?:boolean}
interface Session {browserDocumentId?:string;state:ReviewState;historyOrigin?:string;analysisMode?:'all'|'recheck'}
interface Snapshot {sessions:Record<string,Session>;jobs:Job[];cooldowns?:Record<string,number>}
let snapshot:Snapshot = {sessions:{},jobs:[]};
let resetting=false,erasingDevice=false,dataEpoch=0;
let running = 0;
const inFlight = new Set<string>();
let creatingOffscreen:Promise<void> | undefined;
let writes = Promise.resolve();
async function preferences():Promise<RedFlagPreferences> {
  const raw = (await chrome.storage.local.get(PREFERENCES_STORAGE_KEY))[PREFERENCES_STORAGE_KEY];
  return validPreferences(raw) ? raw : createDefaultPreferences(new Date().toISOString());
}
async function backend():Promise<Backend | undefined> {
 return parseBackend((await chrome.storage.local.get(BACKEND_KEY))[BACKEND_KEY]);
}
function persist():Promise<void> {
  const value = structuredClone(snapshot);
  writes = writes.catch(() => {}).then(() => chrome.storage.session.set({[SESSION_KEY]:value}));
  return writes;
}
const initialized = (async () => {
  await chrome.storage.local.setAccessLevel({accessLevel:'TRUSTED_CONTEXTS'});
  await chrome.storage.session.setAccessLevel({accessLevel:'TRUSTED_CONTEXTS'});
  const stored = (await chrome.storage.session.get(SESSION_KEY))[SESSION_KEY] as Snapshot | undefined;
  if (stored?.sessions && Array.isArray(stored.jobs)) snapshot = stored;
})();
const commonRequests=new Map<string,Promise<DiscoveredDocument[]>>();
function clearCommonRequests(origin:string) {for(const key of commonRequests.keys())if(key.startsWith(origin+'|'))commonRequests.delete(key);}
const communityRequests=new Map<string,Promise<import('../core/contracts.ts').CommunityReference[]>>();
const communityAttempts=new Map<string,number>();
async function communityFor(host:string) {
  host=host.replace(/^www\./,'');
  const stored=parseCommunityCatalog((await chrome.storage.local.get(COMMUNITY_CATALOG_KEY))[COMMUNITY_CATALOG_KEY]);
  const seeds=parseTosdrSearch(seedServices,seedFetchedAt);
  const refs=lookupCommunity(host,'',stored.concat(seeds));
  if(refs.some(r=>Date.now()-Date.parse(r.fetchedAt)<86400000) || Date.now()-(communityAttempts.get(host)??0)<3600000)return refs;
  let request=communityRequests.get(host);
  if(!request){
    communityAttempts.set(host,Date.now());
    request=(async()=>{
      try{
        const response=await fetch('https://api.tosdr.org/search/v5?query='+encodeURIComponent(host),{credentials:'omit',redirect:'error',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(8000)});
        if(!response.ok)throw Error('community unavailable');
        const records=parseTosdrSearch(JSON.parse(await boundedText(response,256000,AbortSignal.timeout(8000))));
        const matched=records.filter(r=>r.domains.some(d=>d.replace(/^www\./,'')===host));
        writes=writes.catch(()=>{}).then(async()=>{
          const latest=parseCommunityCatalog((await chrome.storage.local.get(COMMUNITY_CATALOG_KEY))[COMMUNITY_CATALOG_KEY]);
          if(!resetting)await chrome.storage.local.set({[COMMUNITY_CATALOG_KEY]:latest.filter(r=>!r.domains.some(d=>d.replace(/^www\./,'')===host)).concat(matched).slice(-500)});
        });await writes;
        return lookupCommunity(host,'',matched);
      }catch{return refs;}
    })();
    communityRequests.set(host,request);
    void request.finally(()=>communityRequests.delete(host));
  }
  return request;
}
async function extract(download:Download):Promise<Extraction> {
  creatingOffscreen ??= (async () => {
    if (!await chrome.offscreen.hasDocument()) await chrome.offscreen.createDocument({url:'offscreen.html',reasons:[chrome.offscreen.Reason.DOM_PARSER],justification:'Extract public legal documents in a detached DOM without opening policy tabs.'});
  })().finally(() => {creatingOffscreen = undefined;});
  await creatingOffscreen;
  const result = await abortable(chrome.runtime.sendMessage({type:'redflag/internal-extract',body:download.body,format:download.type}),AbortSignal.timeout(5000)) as Extraction;
  if (!result || typeof result.text !== 'string' || result.text.length > MAX_POLICY_CHARACTERS || !['complete','partial'].includes(result.coverage)) throw new Error('invalid-response');
  return result;
}
async function permitted(url:string) {return chrome.permissions.contains({origins:[new URL(url).origin + '/*']});}
const controllers = new Set<AbortController>();
function setCooldown(origin:string,seconds:number) {snapshot.cooldowns ??={};snapshot.cooldowns[origin]=Date.now()+seconds*1000;void persist();}
const downloads = new Map<string,Promise<Download>>();
async function download(url:string):Promise<Download> {
  let request = downloads.get(url);
  if (!request) {request = retrievePublicDocument(url,permitted);downloads.set(url,request);}
  try {return await request;} finally {if (downloads.get(url) === request) downloads.delete(url);}
}
async function analyze(document:AnalysisDocument,isCurrent:()=>boolean=()=>true) {
  const config = await backend();
  if (!config) throw new AnalysisFailure('inaccessible');
  const wait=(snapshot.cooldowns?.[config.baseUrl]??0)-Date.now();
  if(wait>0) throw new AnalysisFailure('quota',Math.ceil(wait/1000));
  if (!await permitted(config.baseUrl)) throw new AnalysisFailure('permission-required');
  if (!await permitted(document.url)) throw new AnalysisFailure('permission-required');
  if (!permitsAi(await preferences())) throw new Error('ai-consent-required');
  if(!isCurrent()) throw new Error('inaccessible');
  const controller = new AbortController(); controllers.add(controller);
  const timeout = setTimeout(() => controller.abort(),30000);
  try {
    const response = await abortable(fetch(new URL('/api/analyze',config.baseUrl),{
      method:'POST',credentials:'omit',redirect:'error',referrerPolicy:'no-referrer',signal:controller.signal,
      headers:{'Content-Type':'application/json','Authorization':'Bearer ' + config.accessToken},
      body:JSON.stringify({schemaVersion:CONTRACT_VERSION,document})
    }),controller.signal);
    if (!response.ok) {
      const header=response.headers.get('retry-after');
      const delay=header && /^\d+$/.test(header) ? Math.min(86400,Number(header)) : 60;
      if(response.status===429) setCooldown(config.baseUrl,delay);
      throw new AnalysisFailure(response.status === 429 ? 'quota' : response.status === 408 || response.status === 504 ? 'timeout' : response.status === 401 || response.status === 403 ? 'authentication-required' : 'inaccessible',response.status===429 && Number.isFinite(delay) ? delay : undefined);
    }
    const body = await boundedText(response,120000,controller.signal);
    if (body.length > 120000) throw new Error('invalid-response');
    if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('invalid-response');
    let data;
    try {data = JSON.parse(body);} catch {throw new Error('invalid-response');}
    if (data.schemaVersion !== CONTRACT_VERSION || !data.assessment) throw new Error('invalid-response');
    if(data.assessment.reason==='quota') setCooldown(config.baseUrl,60);
    if (!permitsAi(await preferences())) throw new Error('ai-consent-required');
    return data.assessment;
  } catch (error) {
    if (controller.signal.aborted) throw new Error(permitsAi(await preferences()) ? 'timeout' : 'ai-consent-required');
    throw error;
  } finally {clearTimeout(timeout);controllers.delete(controller);}
}
async function publish(tabId:number,pageKey:string) {
  if(resetting)return;
  const session = snapshot.sessions[tabId];
  if (!session || session.state.pageKey !== pageKey) return;
  session.state.updatedAt = new Date().toISOString();
  await persist();
  const published=structuredClone(session.state);
  if (session.historyOrigin) {
    const saved=await getHistory(session.historyOrigin).catch(()=>undefined);
    if (!saved || saved.generation !== pageKey) return;
  }
  if (!resetting && (published.documents.length || published.community?.length)) await recordReview(published,{requireExisting:!!session.historyOrigin}).catch(()=>{});
  if (snapshot.sessions[tabId]?.state.pageKey !== pageKey) return;
  if (tabId>=0) await toolbar.update(tabId,published);
  const options:chrome.tabs.MessageSendOptions = session.browserDocumentId ? {documentId:session.browserDocumentId} : {frameId:0};
  if(tabId>=0) await chrome.tabs.sendMessage(tabId,{type:'redflag/state',state:published},options).catch(() => {});
  await chrome.runtime.sendMessage({type:'redflag/state',state:published}).catch(() => {});
}
function jobKey(job:Job) {return job.pageKey + ':' + job.documentId;}
function finishAnalysisBatch(tabId:number,pageKey:string) {
  const session=snapshot.sessions[tabId];
  if(session?.state.pageKey===pageKey && !session.state.discoveryPending && !snapshot.jobs.some(job=>job.tabId===tabId && job.pageKey===pageKey))delete session.analysisMode;
}
let pumping=false;
async function pump() {
  if(pumping) return; pumping=true;
  try {
  await initialized;
  if (!(await preferences()).enabled) return;
  for (const job of snapshot.jobs) {
    if (running >= 2) break;
    const key = jobKey(job);
    if (inFlight.has(key)) continue;
    const session = snapshot.sessions[job.tabId];
    const review = session?.state.documents.find(d => d.document.id === job.documentId);
    if (!session || session.state.pageKey !== job.pageKey || !review) {snapshot.jobs = snapshot.jobs.filter(j => j !== job);await persist();continue;}
    if (job.attempts >= 2) {
      review.status = 'unrated';review.grade = 'Unrated';review.reason = 'timeout';
      delete review.assessment;review.cached=false;delete review.freshness.cacheExpiresAt;
      review.failure=reviewFailure('analysis','timeout');
      snapshot.jobs = snapshot.jobs.filter(j => j !== job);finishAnalysisBatch(job.tabId,job.pageKey);await publish(job.tabId,job.pageKey);continue;
    }
    job.attempts++;running++;inFlight.add(key);
    await persist(); // Persist retry budget before any network work.
    void processDocument(review,new URL(session.state.pageUrl).hostname,{
      preferences:async () => { const prefs = await preferences(); const savedSession=snapshot.sessions[job.tabId];
        if(savedSession?.historyOrigin && !(await getHistory(savedSession.historyOrigin).catch(()=>undefined))) return {...prefs,enabled:false};
        return snapshot.sessions[job.tabId]?.state.pageKey === job.pageKey && snapshot.sessions[job.tabId]?.state.documents.some(d => d.document.id === job.documentId) ? prefs : {...prefs,enabled:false}; },download,extract,
      versions:backend,analyze:doc=>analyze(doc,()=>snapshot.sessions[job.tabId]?.state.pageKey===job.pageKey && snapshot.sessions[job.tabId]?.state.documents.some(d=>d.document.id===job.documentId)===true),get bypassCache(){return job.bypassCache;},
      catalog:async () => parseCommunityCatalog((await chrome.storage.local.get(COMMUNITY_CATALOG_KEY))[COMMUNITY_CATALOG_KEY]).concat(parseTosdrSearch(seedServices,seedFetchedAt)),
      cacheGet:async key => ((await chrome.storage.local.get(CACHE_KEY))[CACHE_KEY] as Record<string,CacheEntry> | undefined)?.[key],
      cachePut:async (cacheKey,entry) => {
        // Cache mutations share the serialization queue with session writes.
        writes = writes.catch(() => {}).then(async () => {
          if(resetting)return;
          const cache = ((await chrome.storage.local.get(CACHE_KEY))[CACHE_KEY] ?? {}) as Record<string,CacheEntry>;
          cache[cacheKey] = entry;
          const entries = Object.entries(cache as Record<string,CacheEntry>).filter(([,v]) => Date.parse(v.expiresAt) > Date.now()).slice(-50);
          await chrome.storage.local.set({[CACHE_KEY]:Object.fromEntries(entries)});
        });await writes;
      }
    }, async updated => {
      const active = snapshot.sessions[job.tabId];
      if (!active || active.state.pageKey !== job.pageKey) return;
      const index = active.state.documents.findIndex(d => d.document.id === job.documentId);
      if (index >= 0) active.state.documents[index] = updated;
      await publish(job.tabId,job.pageKey);
    }).catch(() => {}).finally(async () => {
      snapshot.jobs = snapshot.jobs.filter(j => j !== job);inFlight.delete(key);running--;
      finishAnalysisBatch(job.tabId,job.pageKey);
      if(job.tabId<0 && !snapshot.jobs.some(j=>j.tabId===job.tabId)) delete snapshot.sessions[job.tabId];
      await persist();void pump();
    });
  }
  } finally {pumping=false;}
}
async function discover(tabId:number,browserDocumentId:string | undefined,pageUrl:string,context:ConsentContext,documents:DiscoveredDocument[]) {
  const old = snapshot.sessions[tabId];
  if (!old || old.browserDocumentId !== browserDocumentId || old.state.pageUrl !== pageUrl) {
    snapshot.jobs = snapshot.jobs.filter(j => j.tabId !== tabId);
    snapshot.sessions[tabId] = {browserDocumentId,state:pendingState(crypto.randomUUID(),pageUrl,context,[])};
  }
  const session = snapshot.sessions[tabId];
  const generation=session.state.pageKey;
  void communityFor(new URL(pageUrl).hostname).then(async refs=>{
    const active=snapshot.sessions[tabId];
    if(!active || active.state.pageKey!==generation)return;
    active.state.community=refs;
    for(const review of active.state.documents)review.community=refs;
    await publish(tabId,generation);
  });
  session.state.discoveryPending=true;
  const origin=new URL(pageUrl).origin;
  // A prior page that linked Privacy directly must not suppress probing Privacy
  // on another page of the same origin where that kind is missing.
  const commonKey=origin+'|'+['terms','privacy','cookies'].filter(kind=>!documents.some(document=>document.kind===kind)).join(',');
  let common=commonRequests.get(commonKey);
  if(!common){
    common=findCommonPolicies(origin,documents,url=>retrievePublicDocument(url,permitted,fetch,4000));
    commonRequests.set(commonKey,common);
    setTimeout(()=>{if(commonRequests.get(commonKey)===common)commonRequests.delete(commonKey);},3600000);
  }
  void common.then(async found=>{
    const active=snapshot.sessions[tabId];
    if(!active || active.state.pageKey!==generation)return;
    active.state.discoveryPending=false;
    for(const document of found){
      if(active.state.documents.some(d=>d.document.url===document.url && d.document.kind===document.kind) || active.state.documents.length>=24)continue;
      active.state.documents.push(...pendingState(generation,pageUrl,context,[document]).documents);
      snapshot.jobs.push({tabId,pageKey:generation,documentId:document.id,attempts:0,bypassCache:active.analysisMode==='recheck'});
    }
    finishAnalysisBatch(tabId,generation);
    await publish(tabId,generation);void pump();
  });
  session.state.context=context;
  // A link disappearing from a dialog/footer does not invalidate an agreement
  // already discovered on this page. Retain its job, evidence and failure until
  // browser navigation establishes a new review generation.
  for (const document of documents) {
    if (session.state.documents.some(d => d.document.url === document.url && d.document.kind === document.kind)) continue;
    if (session.state.documents.length >= 24) break;
    session.state.documents.push(...pendingState(session.state.pageKey,pageUrl,context,[document]).documents);
    snapshot.jobs.push({tabId,pageKey:session.state.pageKey,documentId:document.id,attempts:0,bypassCache:session.analysisMode==='recheck'});
  }
  await publish(tabId,session.state.pageKey);
  // Return the initial state first; later updates are routed by browser document id.
  setTimeout(() => {void pump();},0);
  return session.state;
}
function trustedUi(sender:chrome.runtime.MessageSender) {return sender.id === chrome.runtime.id && !!sender.url?.startsWith(chrome.runtime.getURL(''));}
function matchesGrant(raw:string,pattern:string):boolean {
  try {const url=new URL(raw);const match=pattern.match(/^(\*|https?|file):\/\/([^/]+)\//);if(!match)return false;
    if(match[1]!=='*' && match[1]+':'!==url.protocol)return false;
    const host=match[2];return host==='*' || host===url.host || host.startsWith('*.') && (url.hostname===host.slice(2) || url.hostname.endsWith('.'+host.slice(2)));
  } catch{return false;}
}
async function persistentAccess(url:string) {return ((await chrome.permissions.getAll()).origins ?? []).some(pattern=>matchesGrant(url,pattern));}
async function scanTab(tabId:number):Promise<ScanCurrentResponse> {
  const reject=(code:Extract<ScanCurrentResponse,{ok:false}>['code'],error:string):ScanCurrentResponse=>({ok:false,code,error});
  if(!(await preferences()).enabled)return reject('disabled','RedFlag reviews are disabled.');
  const tab=await chrome.tabs.get(tabId).catch(()=>undefined);
  let pageUrl:string;try {pageUrl=safePageUrl(tab?.url ?? '');}catch{return reject('unsupported-page','Open an HTTP or HTTPS website to scan for legal links.');}
  const epoch=navigationEpoch.get(tabId) ?? 0;
  let frames:chrome.scripting.InjectionResult[];
  try {frames=await chrome.scripting.executeScript({target:{tabId,frameIds:[0]},files:['content.js']});}
  catch{return reject('permission-required','Allow site access, or open RedFlag using its toolbar button on this page.');}
  const documentId=frames[0]?.documentId;
  const current=await chrome.tabs.get(tabId).catch(()=>undefined);
  let samePage=false;try{samePage=!!current?.url && safePageUrl(current.url)===pageUrl;}catch{}
  if(epoch!==(navigationEpoch.get(tabId) ?? 0) || !samePage)return reject('stale-page','The page changed during discovery. Try again.');
  // The browser, not a content-script payload, grants this current document access.
  manualAccess.set(tabId,{pageUrl,documentId});
  try {await chrome.tabs.sendMessage(tabId,{type:'redflag/internal-scan'},documentId ? {documentId} : {frameId:0});}
  catch{return reject('stale-page','The page changed or discovery is unavailable. Try again.');}
  const state=snapshot.sessions[tabId]?.state;
  if(epoch!==(navigationEpoch.get(tabId) ?? 0) || !state || state.pageUrl!==pageUrl || snapshot.sessions[tabId]?.browserDocumentId!==documentId)return reject('stale-page','The page changed during discovery. Try again.');
  return {ok:true,state:structuredClone(state)};
}
async function scanCurrent(message:ScanCurrentCommand,sender:chrome.runtime.MessageSender):Promise<ScanCurrentResponse> {
  if(!trustedUi(sender))return {ok:false,code:'untrusted',error:'Scanning requires trusted extension controls.'};
  const tabId=message.tabId ?? (await chrome.tabs.query({active:true,currentWindow:true}))[0]?.id;
  if(!Number.isInteger(tabId) || tabId!<0)return {ok:false,code:'unsupported-page',error:'No website tab is available.'};
  let operation=scans.get(tabId!);
  if(!operation){operation=scanTab(tabId!).catch(()=>({ok:false as const,code:'stale-page' as const,error:'Discovery is unavailable or the page changed. Try again.'}));scans.set(tabId!,operation);void operation.then(()=>{if(scans.get(tabId!)===operation)scans.delete(tabId!);});}
  return operation;
}
async function analysisAction(message:AnalysisCommand,sender:chrome.runtime.MessageSender):Promise<AnalysisActionResponse> {
  const reject=(code:import('../core/analysis-actions.ts').ActionRejection,error:string):AnalysisActionResponse=>({ok:false,code,error});
  if (!trustedUi(sender)) return reject('untrusted','Analysis commands require trusted extension controls.');
  if (!(await preferences()).enabled) return reject('disabled','RedFlag reviews are disabled.');
  let tabId:number | undefined;
  if(message.type === 'redflag/recheck-site') {
    let origin:string;
    try {origin=checkedOrigin(message.siteOrigin);if(message.siteOrigin !== origin) throw new Error();} catch {return reject('invalid-command','Choose a saved site origin.');}
    const saved=await getHistory(origin).catch(()=>undefined);
    if(!saved) return reject('history-unavailable','This saved review was deleted or is unavailable.');
    const existing=Object.entries(snapshot.sessions).find(([,s])=>s.historyOrigin===origin);
    tabId=existing ? Number(existing[0]) : Math.min(-1,...Object.keys(snapshot.sessions).map(Number))-1;
    // Preserve saved generation so its deletion tombstone suppresses late writes.
    if(!existing || existing[1].state.pageKey!==saved.generation) snapshot.sessions[tabId]={historyOrigin:origin,state:reviewFromSite(saved)};
  } else {
    if(!['one','all','recheck'].includes(message.mode) || typeof message.pageKey!=='string' || (message.mode==='one' && typeof message.documentId!=='string') || (message.mode!=='one' && message.documentId !== undefined)) return reject('invalid-command','Choose one document or all discovered policies.');
    tabId=message.tabId ?? (await chrome.tabs.query({active:true,currentWindow:true}))[0]?.id;
    if(!Number.isInteger(tabId) || tabId!<0) return reject('no-review','No current tab review is available.');
    const tab=await chrome.tabs.get(tabId!).catch(()=>undefined);
    let current=snapshot.sessions[tabId!];
    if(!current)return reject('no-review','The page changed. Reopen the current review.');
    if(current && message.pageKey!==current.state.pageKey)return reject('stale-page','The page changed. Reload the current review.');
    if(message.mode!=='one' && (!current || !current.state.documents.length)) {
      const priorPageKey=current?.state.pageKey;
      const scan=await scanCurrent({type:'redflag/scan-current',tabId:tabId!},sender);
      if(!scan.ok)return reject('no-review',scan.error);
      current=snapshot.sessions[tabId!];
      // A fresh scan may establish the first generation; use that authoritative identity.
      if(current && !priorPageKey)message={...message,pageKey:current.state.pageKey};
    }
    if(!current) return reject('no-review','No discovered policies are available in this tab.');
    try {if(!tab?.url || safePageUrl(tab.url)!==current.state.pageUrl || message.pageKey!==current.state.pageKey) return reject('stale-page','The page changed. Reload the current review.');} catch {return reject('stale-page','The page changed.');}
  }
  const session=snapshot.sessions[tabId!];
  const targets=message.type==='redflag/analyze' && message.mode==='one' ? session.state.documents.filter(d=>d.document.id===message.documentId) : session.state.documents;
  if(message.type==='redflag/analyze' && message.mode==='one' && !targets.length)return reject('document-not-found','No matching discovered document is available.');
  if(message.type==='redflag/recheck-site' && !targets.length)return reject('document-not-found','No matching discovered document is available.');
  if(message.type==='redflag/recheck-site' || message.mode!=='one') {
    // Keep all-policy intent while asynchronous common URLs and dynamic legal
    // links arrive. Jobs already in progress join the same independent queue.
    session.analysisMode=session.analysisMode==='recheck' || message.type==='redflag/recheck-site' || message.mode==='recheck' ? 'recheck' : 'all';
  }
  const queuedDocumentIds:string[]=[],joinedDocumentIds:string[]=[];
  for(const review of targets) {
    const bypassCache=message.type==='redflag/recheck-site' || message.mode==='recheck';
    const existing=snapshot.jobs.find(j=>j.tabId===tabId && j.pageKey===session.state.pageKey && j.documentId===review.document.id);
    if(existing) {if(bypassCache)existing.bypassCache=true;joinedDocumentIds.push(review.document.id);continue;}
    const replacement=pendingState(session.state.pageKey,session.state.pageUrl,session.state.context,[review.document]).documents[0];
    session.state.documents[session.state.documents.indexOf(review)]=replacement;
    snapshot.jobs.push({tabId:tabId!,pageKey:session.state.pageKey,documentId:review.document.id,attempts:0,bypassCache});queuedDocumentIds.push(review.document.id);
  }
  finishAnalysisBatch(tabId!,session.state.pageKey);
  await publish(tabId!,session.state.pageKey);setTimeout(()=>void pump(),0);
  return {ok:true,state:structuredClone(session.state),queuedDocumentIds,joinedDocumentIds};
}
const chatRequests=new Set<number>();
async function chatAction(command:ChatCommand,sender:chrome.runtime.MessageSender):Promise<ChatResponse>{
 const reject=(code:string,error:string):ChatResponse=>({ok:false,schemaVersion:1,pageKey:typeof command.pageKey==='string'?command.pageKey:'',code,error});
 if(!trustedUi(sender)||!validChatInput(command))return reject('invalid-command','Choose a question about the current site.');
 if(!permitsAi(await preferences()))return reject('ai-consent-required','Complete Gemini setup first.');
 const [tab]=await chrome.tabs.query({active:true,currentWindow:true}),session=tab?.id!==undefined?snapshot.sessions[tab.id]:undefined;
 if(!session||command.pageKey!==session.state.pageKey||!tab?.url||safePageUrl(tab.url)!==session.state.pageUrl)return reject('stale-page','The website changed. Reopen RedFlag.');
 const current=async()=>{
  const active=(await chrome.tabs.query({active:true,currentWindow:true}))[0];
  return active?.id===tab.id&&snapshot.sessions[tab.id!]?.state.pageKey===command.pageKey&&!!active.url&&safePageUrl(active.url)===session.state.pageUrl&&permitsAi(await preferences());
 };
 if(chatRequests.has(tab.id!))return reject('pending','An answer is already in progress.');
 const config=await backend();if(!config)return reject('backend-required','Connect Gemini in setup.');
 const selected=session.state.documents.filter(d=>['privacy','terms','cookies','additional'].includes(d.document.kind)).filter((d,i,all)=>all.findIndex(v=>v.document.url===d.document.url)===i);
 if(!selected.length)return reject('no-policy','No policies found yet. Try Analyze all.');
 if(selected.length>6)return reject('too-large','This site has too many linked policies for one chat.');
 chatRequests.add(tab.id!);
 const controller=new AbortController();controllers.add(controller);const timer=setTimeout(()=>controller.abort(),45000);
 try{
  const documents:AnalysisDocument[]=[];
  for(const review of selected){
   if(!await current())return reject('stale-page','The site or consent changed.');
   const retrieved=await abortable(download(review.document.url),controller.signal),extracted=await abortable(extract(retrieved),controller.signal);
   if(!extracted.text.trim())throw Error('A policy could not be read. Try Analyze all again.');
   documents.push({id:review.document.id,url:review.document.url,kind:review.document.kind,text:extracted.text,coverage:extracted.coverage,retrievedAt:retrieved.retrievedAt,contentHash:await contentHash(extracted.text)});
  }
  if(!await current())return reject('stale-page','The site or consent changed.');
  const answer=await requestPolicyChat(command,documents,config,controller.signal);
  if(!await current())return reject('stale-page','The site or consent changed.');
  return {ok:true,...answer};
 }catch(error){return reject(controller.signal.aborted?'timeout':'unavailable',controller.signal.aborted?'Chat stopped or timed out. Try again.':error instanceof Error&&error.message.length<=150?error.message:'The policies could not be read. Try again.');}
 finally{clearTimeout(timer);controllers.delete(controller);chatRequests.delete(tab.id!);}
}
let localConnection:Promise<Backend>|undefined;
async function connectionAction(message:{type:string;config?:unknown},sender:chrome.runtime.MessageSender){
 if(!trustedUi(sender))return {ok:false,connected:false,error:'Trusted setup required.'};
 if(erasingDevice)return {ok:false,connected:false,error:'Device reset in progress.'};
 const epoch=dataEpoch;
 let config=message.type==='redflag/connect-backend'?parseBackend(message.config):await backend();
 try{
  if(!config&&message.type==='redflag/backend-status'){
   if(!await permitted('http://127.0.0.1:8787'))throw Error('Allow browser access to the backend.');
   localConnection??=connectLocalBackend().finally(()=>{localConnection=undefined;});
   config=await localConnection;if(epoch!==dataEpoch)throw Error('Device was reset. Reopen RedFlag.');await chrome.storage.local.set({[BACKEND_KEY]:config});
  }
  if(!config)throw Error('Connection unavailable. Retry or use advanced setup.');
  if(!await permitted(config.baseUrl))throw Error('Allow browser access to the backend.');
  await checkBackend(config);
  if(epoch!==dataEpoch)throw Error('Device was reset. Reopen RedFlag.');
  if(message.type==='redflag/connect-backend')await chrome.storage.local.set({[BACKEND_KEY]:config});
  return {ok:true,connected:true,model:config.model};
 }catch(error){return {ok:false,connected:false,error:error instanceof Error&&error.message.length<=150?error.message:'Start the RedFlag backend, then reconnect.'};}
}
chrome.runtime.onMessage.addListener((message,sender,reply) => {
  if (sender.id !== chrome.runtime.id || !message || typeof message !== 'object') return;
  if (message.type === 'redflag/internal-extract' || message.type === 'redflag/state') return;
  void (async () => {
    await initialized;
    switch (message.type) {
      case 'redflag/rescan-policies': {
        if(!trustedUi(sender))return {ok:false,error:'Trusted controls required.'};
        const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
        if(!tab?.id||!tab.url||!/^https?:/.test(tab.url))return {ok:false,error:'Open a website.'};
        clearCommonRequests(new URL(tab.url).origin);return scanCurrent({type:'redflag/scan-current',tabId:tab.id},sender);
      }
      case 'redflag/add-policy': {
        if(!trustedUi(sender)||typeof message.url!=='string'||message.url.length>2000||!['privacy','terms','cookies','unknown'].includes(message.kind))return {ok:false,error:'Choose a public policy link and type.'};
        if(!permitsAi(await preferences()))return {ok:false,error:'Enable checks first.'};
        const [tab]=await chrome.tabs.query({active:true,currentWindow:true}),session=tab?.id!==undefined?snapshot.sessions[tab.id]:undefined;
        if(!session||session.state.pageKey!==message.pageKey||!tab?.url||safePageUrl(tab.url)!==session.state.pageUrl)return {ok:false,error:'The website changed. Reopen RedFlag.'};
        let url:string;try{url=publicDocumentUrl(message.url);}catch{return {ok:false,error:'Use a public HTTP or HTTPS link without sign-in tokens.'};}
        if(!await permitted(url))return {ok:false,error:'Allow browser access to that policy site.'};
        if(session.state.documents.length>=24)return {ok:false,error:'This review has reached its policy limit.'};
        let review=session.state.documents.find(d=>d.document.url===url);
        if(!review){const document:DiscoveredDocument={id:'manual-'+crypto.randomUUID(),url,kind:message.kind,label:message.kind==='unknown'?'Supplied page':'Supplied policy',discoveredAt:new Date().toISOString()};review=pendingState(session.state.pageKey,session.state.pageUrl,session.state.context,[document]).documents[0];session.state.documents.push(review);}
        if(!snapshot.jobs.some(j=>j.pageKey===session.state.pageKey&&j.documentId===review!.document.id))snapshot.jobs.push({tabId:tab.id!,pageKey:session.state.pageKey,documentId:review.document.id,attempts:0});
        await publish(tab.id!,session.state.pageKey);void pump();return {ok:true,state:structuredClone(session.state)};
      }
      case 'redflag/reset-device': {
        if(!trustedUi(sender))return {ok:false,error:'Trusted settings required.'};
        erasingDevice=true;dataEpoch++;try{
        resetting=true;
        const paused={...createDefaultPreferences(new Date().toISOString()),enabled:false};
        await chrome.storage.local.set({[PREFERENCES_STORAGE_KEY]:paused});
        for(const controller of controllers)controller.abort();
        snapshot={sessions:{},jobs:[]};commonRequests.clear();communityRequests.clear();communityAttempts.clear();downloads.clear();manualAccess.clear();
        await accessUpdates.catch(()=>{});await syncContentScripts();await writes.catch(()=>{});
        await navigator.locks.request('redflag-preferences-v1',()=>navigator.locks.request('redflag-history-v1',async()=>{const keys=Object.keys(await chrome.storage.local.get(null)).filter(key=>key!==PREFERENCES_STORAGE_KEY);await chrome.storage.local.remove(keys);}));
        await chrome.storage.session.clear();
        for(const tab of await chrome.tabs.query({})){if(tab.id!==undefined){await toolbar.update(tab.id);await chrome.tabs.sendMessage(tab.id,{type:'redflag/internal-stop'}).catch(()=>{});}}
        return {ok:true};
        }finally{erasingDevice=false;}
      }
      case 'redflag/chat': return chatAction(message,sender);
      case 'redflag/backend-status':
      case 'redflag/connect-backend': return connectionAction(message,sender);
      case 'redflag/analyze':
      case 'redflag/recheck-site': return analysisAction(message,sender);
      case 'redflag/scan-current': return scanCurrent(message,sender);
      case 'redflag/discover': {
        if (sender.tab?.id === undefined || sender.frameId !== 0 || !sender.url || !(await preferences()).enabled) throw new Error('Discovery unavailable');
        const epoch=navigationEpoch.get(sender.tab.id)??0;
        const currentUrl = (await chrome.tabs.get(sender.tab.id)).url;
        if (!currentUrl || new URL(currentUrl).origin !== new URL(sender.url).origin) throw new Error('Stale discovery');
        // MessageSender.url retains the original document URL across pushState.
        // Resolve the current path from the trusted browser tab, never the payload.
        if(sender.documentId) {
          const [frame]=await chrome.scripting.executeScript({target:{tabId:sender.tab.id,frameIds:[0]},func:()=>undefined});
          if(frame?.documentId !== sender.documentId) throw new Error('Stale browser document');
        }
        const input = validateDiscovery(message,currentUrl);
        const manual=manualAccess.get(sender.tab.id);
        if(!await persistentAccess(currentUrl) && !(manual?.pageUrl===input.pageUrl && manual.documentId===sender.documentId))throw new Error('Site access unavailable');
        if(epoch !== (navigationEpoch.get(sender.tab.id)??0)) throw new Error('Stale discovery');
        return {ok:true,state:await discover(sender.tab.id,sender.documentId,input.pageUrl,input.context,input.documents)};
      }
      case 'redflag/get-preferences': return {ok:true,preferences:await preferences()};
      case 'redflag/set-preferences': {
        if (!sender.url?.startsWith(chrome.runtime.getURL('')) || !validPreferences(message.preferences)) throw new Error('Untrusted preference write');
        await chrome.storage.local.set({[PREFERENCES_STORAGE_KEY]:message.preferences});return {ok:true,preferences:message.preferences};
      }
      case 'redflag/get-state': {
        const tabId = sender.url?.startsWith(chrome.runtime.getURL('')) ? (await chrome.tabs.query({active:true,currentWindow:true}))[0]?.id : sender.tab?.id;
        return {ok:true,state:tabId === undefined ? null : snapshot.sessions[tabId]?.state ?? null};
      }
      case 'redflag/internal-open-settings': {
        if(!sender.tab?.id||sender.frameId!==0)return {ok:false};
        try{await chrome.action.openPopup({windowId:sender.tab.windowId});return {ok:true};}catch{return {ok:false,error:'Open RedFlag from the toolbar.'};}
      }
      default: throw new Error('Unknown message');
    }
  })().then(reply,() => reply({ok:false,error:'Request unavailable or invalid.'}));
  return true;
});
chrome.tabs.onUpdated.addListener((tabId,change) => {
  if (!change.url && change.status !== 'loading') return;
  const old=snapshot.sessions[tabId];
  if(change.status !== 'loading' && change.url) {try {if(old?.state.pageUrl===safePageUrl(change.url)) return;}catch{}}
  navigationEpoch.set(tabId,(navigationEpoch.get(tabId)??0)+1);
  manualAccess.delete(tabId);
  delete snapshot.sessions[tabId];snapshot.jobs=snapshot.jobs.filter(j=>j.tabId!==tabId);
  void toolbar.update(tabId);
  void initialized.then(async () => {
    if (change.status !== 'loading' && change.url && snapshot.sessions[tabId]?.state.pageUrl === safePageUrl(change.url)) return;
    await persist();
  });
});
chrome.tabs.onRemoved.addListener(tabId => {toolbar.forget(tabId);navigationEpoch.delete(tabId);manualAccess.delete(tabId);void initialized.then(async () => {delete snapshot.sessions[tabId];snapshot.jobs = snapshot.jobs.filter(j => j.tabId !== tabId);await persist();});});
async function syncContentScripts() {
  const current = await chrome.scripting.getRegisteredContentScripts({ids:['redflag-discovery']});
  if (current.length) await chrome.scripting.unregisterContentScripts({ids:['redflag-discovery']});
  if (!(await preferences()).enabled) return;
  const origins = (await chrome.permissions.getAll()).origins?.filter(origin => /^https?:\/\//.test(origin) || origin.startsWith('*://')) ?? [];
  if (origins.length) await chrome.scripting.registerContentScripts([{id:'redflag-discovery',matches:origins,js:['content.js'],runAt:'document_idle',allFrames:false,persistAcrossSessions:true}]);
}
let accessUpdates=Promise.resolve();
async function updateAccess(scanOpenTabs:boolean) {
  await initialized;await syncContentScripts();
  const tabs=await chrome.tabs.query({});
  const permittedTabs:chrome.tabs.Tab[]=[];
  for(const tab of tabs) {
    if(tab.id===undefined)continue;
    const url=tab.url ?? snapshot.sessions[tab.id]?.state.pageUrl;
    if(!url || !/^https?:/.test(url))continue;
    if(await persistentAccess(url)){permittedTabs.push(tab);continue;}
    if(!scanOpenTabs) {
      manualAccess.delete(tab.id);navigationEpoch.set(tab.id,(navigationEpoch.get(tab.id) ?? 0)+1);
      delete snapshot.sessions[tab.id];snapshot.jobs=snapshot.jobs.filter(job=>job.tabId!==tab.id);
      await toolbar.update(tab.id);
      await chrome.tabs.sendMessage(tab.id,{type:'redflag/internal-stop'}).catch(()=>{});
    }
  }
  await persist();
  if(scanOpenTabs) {
    // Bound injection concurrency without requiring a reload or changing navigation.
    let index=0;await Promise.all(Array.from({length:Math.min(3,permittedTabs.length)},async()=>{
      while(index<permittedTabs.length){const tab=permittedTabs[index++];await scanTab(tab.id!).catch(()=>{});}
    }));
    for(const [id,session] of Object.entries(snapshot.sessions)) {
      if(Number(id)<0)continue;
      let changed=false;
      for(const review of [...session.state.documents]) {
        if(review.reason!=='permission-required' || !await permitted(review.document.url) || snapshot.jobs.some(job=>job.pageKey===session.state.pageKey && job.documentId===review.document.id))continue;
        session.state.documents[session.state.documents.indexOf(review)]=pendingState(session.state.pageKey,session.state.pageUrl,session.state.context,[review.document]).documents[0];
        snapshot.jobs.push({tabId:Number(id),pageKey:session.state.pageKey,documentId:review.document.id,attempts:0});changed=true;
      }
      if(changed)await publish(Number(id),session.state.pageKey);
    }
    await persist();void pump();
  }
}
chrome.permissions.onAdded.addListener(() => {accessUpdates=accessUpdates.catch(()=>{}).then(()=>updateAccess(true));});
chrome.permissions.onRemoved.addListener(() => {accessUpdates=accessUpdates.catch(()=>{}).then(()=>updateAccess(false));});
chrome.storage.onChanged.addListener((changes,area) => {
  if (area !== 'local' || !changes[PREFERENCES_STORAGE_KEY]) return;
  void initialized.then(async () => {
    const prefs = await preferences();
    if(prefs.enabled)resetting=false;
    if (!permitsAi(prefs)) for (const controller of controllers) controller.abort();
    if (!prefs.enabled) snapshot.jobs = [];
    else for (const [tab,session] of Object.entries(snapshot.sessions)) for (const review of session.state.documents) {
      if (review.status === 'unrated' && review.reason === 'ai-consent-required' && permitsAi(prefs)) {
        review.status = 'pending';review.reason = 'pending';
        if (!snapshot.jobs.some(j => j.pageKey === session.state.pageKey && j.documentId === review.document.id)) snapshot.jobs.push({tabId:Number(tab),pageKey:session.state.pageKey,documentId:review.document.id,attempts:0});
      }
    }
    await persist();
    for (const [tab,session] of Object.entries(snapshot.sessions)) await publish(Number(tab),session.state.pageKey);
    await updateAccess(prefs.enabled);void pump();
  });
});
chrome.alarms.onAlarm.addListener(alarm => {if (alarm.name === 'redflag-recovery') void pump();});
chrome.runtime.onInstalled.addListener(() => {void chrome.alarms.create('redflag-recovery',{periodInMinutes:0.5});accessUpdates=accessUpdates.catch(()=>{}).then(()=>updateAccess(true));});
chrome.runtime.onStartup.addListener(() => {void chrome.alarms.create('redflag-recovery',{periodInMinutes:0.5});accessUpdates=accessUpdates.catch(()=>{}).then(()=>updateAccess(true));void pump();});
void initialized.then(() => {void chrome.alarms.create('redflag-recovery',{periodInMinutes:0.5});void pump();});

chrome.tabs.onActivated.addListener(({tabId})=>{void initialized.then(async()=>{
  const tab=await chrome.tabs.get(tabId).catch(()=>undefined);
  const state=snapshot.sessions[tabId]?.state;
  let current=false;try{current=!!tab?.url && !!state && safePageUrl(tab.url)===state.pageUrl;}catch{}
  await toolbar.update(tabId,current?state:undefined);
});});
void initialized.then(async()=>{
  for(const tab of await chrome.tabs.query({}))if(tab.id!==undefined){
    const session=snapshot.sessions[tab.id],state=session?.state;
    let current=false;try{current=!!tab.url && !!state && safePageUrl(tab.url)===state.pageUrl;}catch{}
    if(!current){delete snapshot.sessions[tab.id];snapshot.jobs=snapshot.jobs.filter(job=>job.tabId!==tab.id);}
    // Common-policy fetch promises do not survive MV3 suspension. Recreate the
    // pending discovery work so an all-policy batch cannot remain pending forever.
    else if(state?.discoveryPending && (await preferences()).enabled)await discover(tab.id,session.browserDocumentId,state.pageUrl,state.context,state.documents.map(review=>review.document));
    await toolbar.update(tab.id,current?state:undefined);
  }
  await persist();
});
