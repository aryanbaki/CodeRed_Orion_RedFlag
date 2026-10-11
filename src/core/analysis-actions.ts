import type {ReviewState} from './contracts.ts';
export type AnalysisMode = 'one' | 'all' | 'recheck';
/** Only trusted extension UI may send commands. URL/text never comes from a caller. */
export type AnalysisCommand =
  | {type:'redflag/analyze';mode:AnalysisMode;pageKey:string;documentId?:string;tabId?:number}
  | {type:'redflag/recheck-site';siteOrigin:string};
export type ActionRejection = 'untrusted' | 'invalid-command' | 'stale-page' | 'no-review' | 'document-not-found' | 'disabled' | 'history-unavailable';
export type AnalysisActionResponse =
  | {ok:true;state:ReviewState;queuedDocumentIds:string[];joinedDocumentIds:string[]}
  | {ok:false;code:ActionRejection;error:string};
/** Acknowledgment is admission, not an analysis success. Listen for redflag/state. */
export async function requestAnalysis(command:AnalysisCommand):Promise<AnalysisActionResponse> {
  return chrome.runtime.sendMessage(command);
}
