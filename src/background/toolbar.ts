import {summarizeReview} from '../core/summary.ts';
import type {ReviewState} from '../core/contracts.ts';
const colors={A:'#2d6844',B:'#467443',C:'#a67721',D:'#ba681c',E:'#b83b36',F:'#9e272d',unknown:'#64646c',pending:'#8b6737'};
export function toolbarPresentation(state?:ReviewState | null) {
  const s=summarizeReview(state);
  const grade=s.worstDocumentGrade;
  const text=s.status === 'rated' ? s.grade : grade !== 'Unrated' ? `${grade}?` : s.highConcern ? '!' : s.pending ? '…' : '?';
  const scope=s.status === 'rated' ? 'All discovered policies graded (discovery may be incomplete)' : 'Incomplete review';
  return {text,color:grade !== 'Unrated' ? colors[grade] : s.pending ? colors.pending : colors.unknown,
    title:`RedFlag — ${scope}. ${s.graded}/${s.total} discovered policies graded; ${s.pending} pending. Worst supported document grade: ${grade}. Terms: ${s.termsGrade}; Privacy: ${s.privacyGrade}.${s.missingKinds.length ? ' Not discovered: '+s.missingKinds.join(',')+'.' : ''}${s.highConcern ? ' High-severity sourced concern.' : ''}`};
}
/** Badge overlays the installed RedFlag logo; never replace base icon identity. */
export class ToolbarController {
  private revisions=new Map<number,number>();
  private writes=new Map<number,Promise<void>>();
  update(tabId:number,state?:ReviewState | null):Promise<void> {
    const revision=(this.revisions.get(tabId) ?? 0)+1;this.revisions.set(tabId,revision);
    const presentation=toolbarPresentation(state);
    const next=(this.writes.get(tabId) ?? Promise.resolve()).catch(()=>{}).then(async()=>{
      if (this.revisions.get(tabId) !== revision) return;
      await chrome.action.setBadgeText({tabId,text:presentation.text});
      if (this.revisions.get(tabId) !== revision) return;
      await chrome.action.setBadgeBackgroundColor({tabId,color:presentation.color});
      if (this.revisions.get(tabId) !== revision) return;
      await chrome.action.setTitle({tabId,title:presentation.title});
    }).catch(()=>{});
    this.writes.set(tabId,next);
    return next;
  }
  forget(tabId:number) {this.revisions.delete(tabId);this.writes.delete(tabId);}
}
