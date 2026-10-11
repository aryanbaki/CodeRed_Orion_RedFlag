import {abortable, boundedText} from '../background/io.ts';
import {CONTRACT_VERSION, PREFERENCES_STORAGE_KEY, createDefaultPreferences, type ReviewState, type RedFlagPreferences, type DiscoveredDocument, type ConsentContext, type AnalysisDocument} from '../core/contracts.ts';
import {pendingState, safePageUrl, validateDiscovery, validPreferences, permitsAi} from '../background/validation.ts';
import {retrievePublicDocument, type Download} from '../background/retrieval.ts';
import {processDocument} from '../background/processor.ts';
import {CACHE_KEY, type CacheEntry, type AnalysisVersions} from '../background/cache.ts';
import {COMMUNITY_CATALOG_KEY, parseCommunityCatalog} from '../background/community.ts';
import type {Extraction} from '../background/extraction.ts';
import {publicDocumentUrl} from '../discovery/urls.ts';
const SESSION_KEY = 'redflag.jobs.v1';
const BACKEND_KEY = 'redflag.backend.v1';
interface Job {tabId:number;pageKey:string;documentId:string;attempts:number}
interface Session {browserDocumentId?:string;state:ReviewState}
interface Snapshot {sessions:Record<string,Session>;jobs:Job[]}
interface Backend extends AnalysisVersions {baseUrl:string;accessToken:string}
let snapshot:Snapshot = {sessions:{},jobs:[]};
let running = 0;
const inFlight = new Set<string>();
let creatingOffscreen:Promise<void> | undefined;
let writes = Promise.resolve();
async function preferences():Promise<RedFlagPreferences> {
  const raw = (await chrome.storage.local.get(PREFERENCES_STORAGE_KEY))[PREFERENCES_STORAGE_KEY];
  return validPreferences(raw) ? raw : createDefaultPreferences(new Date().toISOString());
}
async function backend():Promise<Backend | undefined> {
  const raw = (await chrome.storage.local.get(BACKEND_KEY))[BACKEND_KEY] as Backend | undefined;
  if (!raw || ![raw.model,raw.promptVersion,raw.rubricVersion,raw.accessToken,raw.baseUrl].every(v => typeof v === 'string' && v.length > 0 && v.length <= 500)) return;
  try {
    const url = new URL(raw.baseUrl);
    // Production transport must use a public HTTPS destination. localhost demo
    // is an explicitly configured exception for backend transport, never retrieval.
    if (url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') publicDocumentUrl(raw.baseUrl);
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost','127.0.0.1'].includes(url.hostname))) return;
    if (url.username || url.password || url.search || url.hash) return;
    return raw;
  } catch { return; }
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
async function extract(download:Download):Promise<Extraction> {
  creatingOffscreen ??= (async () => {
    if (!await chrome.offscreen.hasDocument()) await chrome.offscreen.createDocument({url:'offscreen.html',reasons:[chrome.offscreen.Reason.DOM_PARSER],justification:'Extract public legal documents in a detached DOM without opening policy tabs.'});
  })().finally(() => {creatingOffscreen = undefined;});
  await creatingOffscreen;
  const result = await abortable(chrome.runtime.sendMessage({type:'redflag/internal-extract',body:download.body,format:download.type}),AbortSignal.timeout(5000)) as Extraction;
  if (!result || typeof result.text !== 'string' || result.text.length > 60000 || !['complete','partial'].includes(result.coverage)) throw new Error('invalid-response');
  return result;
}
async function permitted(url:string) {return chrome.permissions.contains({origins:[new URL(url).origin + '/*']});}
const controllers = new Set<AbortController>();
const downloads = new Map<string,Promise<Download>>();
async function download(url:string):Promise<Download> {
  let request = downloads.get(url);
  if (!request) {request = retrievePublicDocument(url,permitted);downloads.set(url,request);}
  try {return await request;} finally {if (downloads.get(url) === request) downloads.delete(url);}
}
async function analyze(document:AnalysisDocument) {
  const config = await backend();
  if (!config || !await permitted(config.baseUrl)) throw new Error('inaccessible');
  if (!permitsAi(await preferences())) throw new Error('ai-consent-required');
  const controller = new AbortController(); controllers.add(controller);
  const timeout = setTimeout(() => controller.abort(),30000);
  try {
    const response = await abortable(fetch(new URL('/api/analyze',config.baseUrl),{
      method:'POST',credentials:'omit',redirect:'error',referrerPolicy:'no-referrer',signal:controller.signal,
      headers:{'Content-Type':'application/json','Authorization':'Bearer ' + config.accessToken},
      body:JSON.stringify({schemaVersion:CONTRACT_VERSION,document})
    }),controller.signal);
    if (!response.ok) throw new Error(response.status === 429 ? 'quota' : response.status === 401 || response.status === 403 ? 'authentication-required' : 'inaccessible');
    const body = await boundedText(response,120000,controller.signal);
    if (body.length > 120000) throw new Error('invalid-response');
    if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('invalid-response');
    let data;
    try {data = JSON.parse(body);} catch {throw new Error('invalid-response');}
    if (data.schemaVersion !== CONTRACT_VERSION || !data.assessment) throw new Error('invalid-response');
    if (!permitsAi(await preferences())) throw new Error('ai-consent-required');
    return data.assessment;
  } catch (error) {
    if (controller.signal.aborted) throw new Error(permitsAi(await preferences()) ? 'timeout' : 'ai-consent-required');
    throw error;
  } finally {clearTimeout(timeout);controllers.delete(controller);}
}
async function publish(tabId:number,pageKey:string) {
  const session = snapshot.sessions[tabId];
  if (!session || session.state.pageKey !== pageKey) return;
  session.state.updatedAt = new Date().toISOString();
  await persist();
  const options:chrome.tabs.MessageSendOptions = session.browserDocumentId ? {documentId:session.browserDocumentId} : {frameId:0};
  await chrome.tabs.sendMessage(tabId,{type:'redflag/state',state:session.state},options).catch(() => {});
  await chrome.runtime.sendMessage({type:'redflag/state',state:session.state}).catch(() => {});
}
function jobKey(job:Job) {return job.pageKey + ':' + job.documentId;}
async function pump() {
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
      snapshot.jobs = snapshot.jobs.filter(j => j !== job);await publish(job.tabId,job.pageKey);continue;
    }
    job.attempts++;running++;inFlight.add(key);
    await persist(); // Persist retry budget before any network work.
    void processDocument(review,new URL(session.state.pageUrl).hostname,{
      preferences:async () => { const prefs = await preferences(); return snapshot.sessions[job.tabId]?.state.pageKey === job.pageKey && snapshot.sessions[job.tabId]?.state.documents.some(d => d.document.id === job.documentId) ? prefs : {...prefs,enabled:false}; },download,extract,
      versions:backend,analyze,
      catalog:async () => parseCommunityCatalog((await chrome.storage.local.get(COMMUNITY_CATALOG_KEY))[COMMUNITY_CATALOG_KEY]),
      cacheGet:async key => ((await chrome.storage.local.get(CACHE_KEY))[CACHE_KEY] as Record<string,CacheEntry> | undefined)?.[key],
      cachePut:async (cacheKey,entry) => {
        // Cache mutations share the serialization queue with session writes.
        writes = writes.catch(() => {}).then(async () => {
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
      snapshot.jobs = snapshot.jobs.filter(j => j !== job);inFlight.delete(key);running--;await persist();void pump();
    });
  }
}
async function discover(tabId:number,browserDocumentId:string | undefined,pageUrl:string,context:ConsentContext,documents:DiscoveredDocument[]) {
  const old = snapshot.sessions[tabId];
  if (!old || old.browserDocumentId !== browserDocumentId || old.state.pageUrl !== pageUrl) {
    snapshot.jobs = snapshot.jobs.filter(j => j.tabId !== tabId);
    snapshot.sessions[tabId] = {browserDocumentId,state:pendingState(crypto.randomUUID(),pageUrl,context,[])};
  }
  const session = snapshot.sessions[tabId];
  session.state.documents = session.state.documents.filter(review => documents.some(d => d.url === review.document.url && d.kind === review.document.kind));
  snapshot.jobs = snapshot.jobs.filter(job => job.pageKey !== session.state.pageKey || session.state.documents.some(d => d.document.id === job.documentId));
  for (const document of documents) {
    if (session.state.documents.some(d => d.document.url === document.url && d.document.kind === document.kind)) continue;
    if (session.state.documents.length >= 24) break;
    session.state.documents.push(...pendingState(session.state.pageKey,pageUrl,context,[document]).documents);
    snapshot.jobs.push({tabId,pageKey:session.state.pageKey,documentId:document.id,attempts:0});
  }
  await persist();
  // Return the initial state first; later updates are routed by browser document id.
  setTimeout(() => {void pump();},0);
  return session.state;
}
chrome.runtime.onMessage.addListener((message,sender,reply) => {
  if (sender.id !== chrome.runtime.id || !message || typeof message !== 'object') return;
  if (message.type === 'redflag/internal-extract' || message.type === 'redflag/state') return;
  void (async () => {
    await initialized;
    switch (message.type) {
      case 'redflag/discover': {
        if (sender.tab?.id === undefined || sender.frameId !== 0 || !sender.url || !(await preferences()).enabled) throw new Error('Discovery unavailable');
        const currentUrl = (await chrome.tabs.get(sender.tab.id)).url;
        if (!currentUrl || new URL(currentUrl).origin !== new URL(sender.url).origin) throw new Error('Stale discovery');
        // MessageSender.url retains the original document URL across pushState.
        // Resolve the current path from the trusted browser tab, never the payload.
        const input = validateDiscovery(message,currentUrl);
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
        await chrome.tabs.create({url:chrome.runtime.getURL('popup.html')});return {ok:true};
      }
      default: throw new Error('Unknown message');
    }
  })().then(reply,() => reply({ok:false,error:'Request unavailable or invalid.'}));
  return true;
});
chrome.tabs.onUpdated.addListener((tabId,change) => {
  if (!change.url && change.status !== 'loading') return;
  void initialized.then(async () => {
    if (change.status !== 'loading' && change.url && snapshot.sessions[tabId]?.state.pageUrl === safePageUrl(change.url)) return;
    delete snapshot.sessions[tabId];snapshot.jobs = snapshot.jobs.filter(j => j.tabId !== tabId);await persist();
  });
});
chrome.tabs.onRemoved.addListener(tabId => {void initialized.then(async () => {delete snapshot.sessions[tabId];snapshot.jobs = snapshot.jobs.filter(j => j.tabId !== tabId);await persist();});});
async function syncContentScripts() {
  const current = await chrome.scripting.getRegisteredContentScripts({ids:['redflag-discovery']});
  if (current.length) await chrome.scripting.unregisterContentScripts({ids:['redflag-discovery']});
  if (!(await preferences()).enabled) return;
  const origins = (await chrome.permissions.getAll()).origins?.filter(origin => /^https?:\/\//.test(origin) || origin.startsWith('*://')) ?? [];
  if (origins.length) await chrome.scripting.registerContentScripts([{id:'redflag-discovery',matches:origins,js:['content.js'],runAt:'document_idle',allFrames:false,persistAcrossSessions:true}]);
}
chrome.permissions.onAdded.addListener(() => {void syncContentScripts();});
chrome.permissions.onRemoved.addListener(() => {void syncContentScripts();});
chrome.storage.onChanged.addListener((changes,area) => {
  if (area !== 'local' || !changes[PREFERENCES_STORAGE_KEY]) return;
  void initialized.then(async () => {
    const prefs = await preferences();
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
    await syncContentScripts();void pump();
  });
});
chrome.alarms.onAlarm.addListener(alarm => {if (alarm.name === 'redflag-recovery') void pump();});
chrome.runtime.onInstalled.addListener(() => {void chrome.alarms.create('redflag-recovery',{periodInMinutes:0.5});void syncContentScripts();});
chrome.runtime.onStartup.addListener(() => {void chrome.alarms.create('redflag-recovery',{periodInMinutes:0.5});void syncContentScripts();void pump();});
void initialized.then(() => {void chrome.alarms.create('redflag-recovery',{periodInMinutes:0.5});void pump();});
