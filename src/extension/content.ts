import {discoverLegalLinks,observeLegalLinks,type DiscoveredLink} from '../discovery/dom.ts';
import {safePageUrl,validPreferences} from '../background/validation.ts';
import {createDefaultPreferences,type DiscoveredDocument,type ExtensionResponse,type ReviewState,type RedFlagPreferences,type OverviewController} from '../core/contracts.ts';
// A single observer/listener set survives repeated granted-origin/activeTab injection.
const scope=globalThis as typeof globalThis & {__redflagDiscovery?:{start:()=>void}};
if(scope.__redflagDiscovery) scope.__redflagDiscovery.start();
else install();
function install() {
 let controller:OverviewController | undefined;
 let dismissed=false,enabled=true;
 let state:ReviewState | undefined;
 let prefs:RedFlagPreferences=createDefaultPreferences(new Date().toISOString());
 let pageUrl=safePageUrl(location.href);
 const documents=new Map<string,DiscoveredDocument>();
 let pending:Promise<ReviewState | undefined>=Promise.resolve(undefined);
 let stop:(()=>void) | undefined;
 const request=async(message:unknown):Promise<ExtensionResponse>=>chrome.runtime.sendMessage(message);
 function render() {
  // Discovery remains automatic, but review UI lives in the extension popup.
  // Never mount an in-page overlay over the site itself.
  controller?.destroy();
  controller=undefined;
 }
 function context(links:DiscoveredLink[]):ReviewState['context'] {
  if(!links.some(link=>link.consent)) return 'browsing';
  const path=location.pathname.toLowerCase();
  if(/checkout|purchase|payment/.test(path)) return 'checkout';
  if(/signup|sign-up|register/.test(path)) return 'signup';
  if(/onboard|welcome/.test(path)) return 'onboarding';
  return 'consent';
 }
 async function discovered(links:DiscoveredLink[],force=false) {
  if(!enabled) return;
  const current=safePageUrl(location.href),nextContext=context(links);
  if(current!==pageUrl) {documents.clear();state=undefined;controller?.destroy();controller=undefined;dismissed=false;pageUrl=current;}
  let changed=state?.context!==nextContext;
  const present=new Set(links.map(link=>link.kind+':'+link.url));
  for(const key of documents.keys()) if(!present.has(key)) {documents.delete(key);changed=true;}
  for(const link of links) {
   const key=link.kind+':'+link.url;
   if(!documents.has(key) && documents.size<24) {documents.set(key,{url:link.url,kind:link.kind,label:link.label,id:crypto.randomUUID(),discoveredAt:new Date().toISOString()});changed=true;}
  }
  if(!changed && !force && state) return state;
  try {
   const response=await request({type:'redflag/discover',pageUrl,context:nextContext,documents:[...documents.values()]});
   if(enabled && response.ok && response.state && response.state.pageUrl===safePageUrl(location.href)) {state=response.state;render();return state;}
  } catch {/* Revocation/reload never interrupts browsing. */}
 }
 function scan(force=false) {pending=pending.catch(()=>undefined).then(()=>discovered(discoverLegalLinks(document,document.baseURI),force));return pending;}
 function start() {
  enabled=true;
  if(!stop) stop=observeLegalLinks(document,links=>{pending=pending.catch(()=>undefined).then(()=>discovered(links));});
 }
 function suspend() {enabled=false;stop?.();stop=undefined;state=undefined;documents.clear();controller?.destroy();controller=undefined;}
 scope.__redflagDiscovery={start};
 chrome.runtime.onMessage.addListener((message,sender,reply)=>{
  if(sender.id!==chrome.runtime.id) return;
  if(message?.type==='redflag/internal-scan') {start();void scan(true).then(state=>reply({ok:!!state,state}),()=>reply({ok:false}));return true;}
  if(message?.type==='redflag/internal-stop') {suspend();reply({ok:true});return;}
  if(message?.type!=='redflag/state' || !enabled || !state || message.state?.pageKey!==state.pageKey || message.state.pageUrl!==safePageUrl(location.href)) return;
  state=message.state;render();
  void request({type:'redflag/get-preferences'}).then(response=>{if(response.ok && response.preferences){prefs=response.preferences;render();}}).catch(()=>{});
 });
 chrome.storage.onChanged.addListener((changes,area)=>{
  if(area!=='local' || !changes['redflag.preferences.v1']) return;
  const value=changes['redflag.preferences.v1'].newValue;
  if(validPreferences(value)) {prefs=value;render();}
 });
 void request({type:'redflag/get-preferences'}).then(response=>{if(response.ok && response.preferences){prefs=response.preferences;render();}}).catch(()=>{});
 function routeChanged() {if(enabled && safePageUrl(location.href)!==pageUrl){stop?.();stop=undefined;documents.clear();state=undefined;controller?.destroy();controller=undefined;dismissed=false;pageUrl=safePageUrl(location.href);start();}}
 addEventListener('popstate',routeChanged);
 (window as Window & {navigation?:EventTarget}).navigation?.addEventListener('navigatesuccess',routeChanged);
 addEventListener('pagehide',()=>{stop?.();stop=undefined;controller?.destroy();controller=undefined;});
 addEventListener('pageshow',event=>{if(event.persisted && enabled){documents.clear();state=undefined;dismissed=false;start();}});
 start();
}
