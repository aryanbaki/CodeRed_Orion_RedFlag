import {gradeColors,isFlagGrade} from '../ui/branding.ts';
import {summarizeReview} from '../core/summary.ts';
import type {ReviewState} from '../core/contracts.ts';
const colors={...gradeColors,unknown:gradeColors.D};
export function toolbarPresentation(state?:ReviewState | null) {
  const s=summarizeReview(state);
  const grade=s.grade;
  const text=isFlagGrade(grade)?grade:'';
  const icon=`icons/redflag${isFlagGrade(grade)?`-${grade}`:''}`;
  const source=s.source==='tosdr'?'ToS;DR community rating':s.source==='gemini'?'Gemini analysis':s.pending?'Analyzing policies':'Not enough information';
  return {text,color:isFlagGrade(grade)?colors[grade]:colors.unknown,icon,title:`RedFlag — ${grade==='Unrated'?'Unrated':`Overall ${grade}`} · ${state?.discoveryPending?'Looking for policies':source}`};
}
/** Per-tab flag color follows the supported overall grade; idle uses a plain red flag. */
export class ToolbarController {
  private revisions=new Map<number,number>();
  private writes=new Map<number,Promise<void>>();
  update(tabId:number,state?:ReviewState | null):Promise<void> {
    const revision=(this.revisions.get(tabId) ?? 0)+1;this.revisions.set(tabId,revision);
    const presentation=toolbarPresentation(state);
    const next=(this.writes.get(tabId) ?? Promise.resolve()).catch(()=>{}).then(async()=>{
      if (this.revisions.get(tabId) !== revision) return;
      await chrome.action.setIcon({tabId,path:{16:`${presentation.icon}-16.png`,32:`${presentation.icon}-32.png`,48:`${presentation.icon}-48.png`,128:`${presentation.icon}-128.png`}});
      if (this.revisions.get(tabId) !== revision) return;
      await chrome.action.setBadgeText({tabId,text:presentation.text});
      if (this.revisions.get(tabId) !== revision) return;
      await chrome.action.setBadgeBackgroundColor({tabId,color:presentation.color});
      if (this.revisions.get(tabId) !== revision) return;
      await chrome.action.setBadgeTextColor({tabId,color:'#ffffff'});
      if (this.revisions.get(tabId) !== revision) return;
      await chrome.action.setTitle({tabId,title:presentation.title});
    }).catch(()=>{});
    this.writes.set(tabId,next);
    return next;
  }
  forget(tabId:number) {this.revisions.delete(tabId);this.writes.delete(tabId);}
}
