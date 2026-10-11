import {observeLegalLinks, type DiscoveredLink} from '../discovery/dom.ts';
import {safePageUrl, validPreferences} from '../background/validation.ts';
import {createDefaultPreferences, type DiscoveredDocument, type ExtensionResponse, type ReviewState, type RedFlagPreferences, type OverviewController} from '../core/contracts.ts';
// Proactive overview mounts automatically on supported legal-link discovery.
import {mountOverview} from '../ui/overview.ts';
let controller:OverviewController | undefined;
let dismissed = false;
let state:ReviewState | undefined;
let prefs:RedFlagPreferences = createDefaultPreferences(new Date().toISOString());
let pageUrl = safePageUrl(location.href);
const documents = new Map<string,DiscoveredDocument>();
const request = async (message:unknown):Promise<ExtensionResponse> => chrome.runtime.sendMessage(message);
function render() {
  if (!state || !state.documents.length || !prefs.enabled || dismissed) { controller?.destroy(); controller = undefined; return; }
  if (controller) controller.update(state,prefs);
  else controller = mountOverview(state,prefs,{
    onDismiss:() => { dismissed = true; controller?.destroy(); controller = undefined; },
    onOpenSettings:() => { void chrome.runtime.sendMessage({type:'redflag/internal-open-settings'}).catch(() => {}); }
  });
}
function context(): ReviewState['context'] {
  const path = location.pathname.toLowerCase();
  if (/checkout|purchase|payment/.test(path)) return 'checkout';
  if (/signup|sign-up|register/.test(path)) return 'signup';
  if (/onboard|welcome/.test(path)) return 'onboarding';
  return 'consent';
}
async function discovered(links:DiscoveredLink[]) {
  const current = safePageUrl(location.href);
  if (current !== pageUrl) { documents.clear(); state = undefined; controller?.destroy(); controller = undefined; dismissed = false; pageUrl = current; }
  let changed = false;
  const present = new Set(links.map(link => link.kind + ':' + link.url));
  for (const key of documents.keys()) if (!present.has(key)) {documents.delete(key); changed = true;}
  for (const link of links) {
    const key = link.kind + ':' + link.url;
    if (!documents.has(key) && documents.size < 24) {
      documents.set(key,{url:link.url,kind:link.kind,label:link.label,id:crypto.randomUUID(),discoveredAt:new Date().toISOString()}); changed = true;
    }
  }
  if (!changed) return;
  try {
    const response = await request({type:'redflag/discover',pageUrl,context:context(),documents:[...documents.values()]});
    if (response.ok && response.state && response.state.pageUrl === safePageUrl(location.href)) {
      state = response.state; render();
    }
  } catch { /* Extension reloaded or access revoked: browsing remains responsive. */ }
}
chrome.runtime.onMessage.addListener((message,sender) => {
  if (sender.id !== chrome.runtime.id || message?.type !== 'redflag/state' || !state || message.state?.pageKey !== state.pageKey || message.state.pageUrl !== safePageUrl(location.href)) return;
  state = message.state; render();
  void request({type:'redflag/get-preferences'}).then(response => {if (response.ok && response.preferences) {prefs = response.preferences;render();}}).catch(() => {});
});
chrome.storage.onChanged.addListener((changes,area) => {
  if (area !== 'local' || !changes['redflag.preferences.v1']) return;
  const value = changes['redflag.preferences.v1'].newValue;
  if (validPreferences(value)) { prefs = value; render(); }
});
void request({type:'redflag/get-preferences'}).then(response => { if (response.ok && response.preferences) {prefs = response.preferences; render();} }).catch(() => {});
let stop = observeLegalLinks(document, links => {void discovered(links);});
function routeChanged() {
  if (safePageUrl(location.href) === pageUrl) return;
  stop();documents.clear();state = undefined;controller?.destroy();controller = undefined;dismissed = false;pageUrl = safePageUrl(location.href);
  stop = observeLegalLinks(document, links => {void discovered(links);});
}
addEventListener('popstate',routeChanged);
(window as Window & {navigation?:EventTarget}).navigation?.addEventListener('navigatesuccess',routeChanged);
addEventListener('pagehide',() => {stop();controller?.destroy();controller = undefined;});
addEventListener('pageshow',event => {if (event.persisted) {documents.clear();state = undefined;dismissed = false;stop = observeLegalLinks(document,links => {void discovered(links);});}});
