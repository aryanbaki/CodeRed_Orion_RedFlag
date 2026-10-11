import {applyTheme} from '../ui/theme.ts';
import {element} from '../ui/dom.ts';
import {listHistory,deleteHistory,clearHistory,subscribeHistory} from '../history/store.ts';
import {loadPreferences} from '../ui/preferences.ts';
import {CUSTOM_INTERESTS_KEY,normalizeCustomInterests} from '../core/interests.ts';
applyTheme();
const get=(id:string)=>document.getElementById(id)!,say=(s:string)=>get('status').textContent=s;
async function refresh(){try{const sites=await listHistory();get('records').replaceChildren();if(!sites.length)get('records').append(element('p','No saved reviews.'));for(const site of sites){const row=element('div',undefined,'record'),remove=element('button','Remove','secondary');remove.setAttribute('aria-label','Remove '+new URL(site.origin).hostname);remove.addEventListener('click',()=>void (async()=>{remove.disabled=true;try{await deleteHistory(site.origin);say('Review removed.');await refresh();}catch{say('Could not remove this review. Try again.');remove.disabled=false;}})());row.append(element('span',new URL(site.origin).hostname),remove);get('records').append(row);}}catch{say('Saved records could not be loaded. Try reopening this page.');}}
get('export').addEventListener('click',()=>void (async()=>{
 try{const preferences=await loadPreferences(),sites=await listHistory(),customInterests=normalizeCustomInterests((await chrome.storage.local.get(CUSTOM_INTERESTS_KEY))[CUSTOM_INTERESTS_KEY]);
 const blob=new Blob([JSON.stringify({schemaVersion:1,exportedAt:new Date().toISOString(),preferences,customInterests,sites},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='RedFlag-records-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);say('Records downloaded.');
 }catch{say('Could not export your records. Try again.');}
})());
get('clear-reviews').addEventListener('click',()=>void (async()=>{try{await clearHistory();say('Saved reviews removed. Preferences kept.');await refresh();}catch{say('Could not remove saved reviews. Try again.');}})());
get('reset').addEventListener('click',()=>{get('confirmation').hidden=false;get('cancel-reset').focus();});get('cancel-reset').addEventListener('click',()=>get('confirmation').hidden=true);
get('confirm-reset').addEventListener('click',()=>void (async()=>{const button=get('confirm-reset') as HTMLButtonElement;button.disabled=true;try{const result=await chrome.runtime.sendMessage({type:'redflag/reset-device'});if(!result?.ok)throw Error();get('confirmation').hidden=true;say('Device reset. Checks are paused. Open RedFlag to set up again.');await refresh();}catch{say('Reset could not finish. Checks may be paused; try again.');}finally{button.disabled=false;}})());subscribeHistory(()=>void refresh());void refresh();
