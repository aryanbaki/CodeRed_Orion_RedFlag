import type {ReviewState} from './contracts.ts';
/** Trusted UI only. Uses existing permission/activeTab; never requests permission or AI consent. */
export interface ScanCurrentCommand {type:'redflag/scan-current';tabId?:number}
export type ScanCurrentResponse =
  | {ok:true;state:ReviewState | null}
  | {ok:false;code:'untrusted'|'disabled'|'unsupported-page'|'permission-required'|'stale-page';error:string};
/** Call on toolbar opening or when a current-site recheck has no discovered documents. */
export async function requestCurrentScan(tabId?:number):Promise<ScanCurrentResponse> {
  return chrome.runtime.sendMessage({type:'redflag/scan-current',...(tabId === undefined ? {} : {tabId})});
}
