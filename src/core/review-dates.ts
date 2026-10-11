import type {ReviewState} from './contracts.ts';
import {currentAnalysis} from './reading-time.ts';
export function reviewDates(state:ReviewState|null){
 const valid=(value:string|undefined)=>value&&Number.isFinite(Date.parse(value))&&Date.parse(value)<=Date.now()+60000?value:undefined;
 const reviewed=state?.documents.flatMap(d=>{const a=currentAnalysis(d);return a&&valid(a.analyzedAt)?[a.analyzedAt]:[];}).sort((a,b)=>Date.parse(b)-Date.parse(a))[0];
 const updated=state?.documents.flatMap(d=>{const date=valid(d.freshness.documentUpdatedAt);return date?[date]:[];}).sort((a,b)=>Date.parse(b)-Date.parse(a))[0];
 const label=(value:string)=>new Intl.DateTimeFormat('en',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'}).format(new Date(value));
 return {reviewed,updated,label:reviewed?`Reviewed ${label(reviewed)}${updated?` · Policy updated ${label(updated)}`:''}`:''};
}
