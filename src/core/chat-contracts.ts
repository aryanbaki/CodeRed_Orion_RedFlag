import type {AnalysisDocument} from './contracts.ts';
export interface ChatTurn {role:'user'|'assistant';text:string}
export interface ChatCommand {type:'redflag/chat';schemaVersion:1;pageKey:string;question:string;history:ChatTurn[]}
export interface ChatRequest {schemaVersion:1;pageKey:string;question:string;history:ChatTurn[];documents:AnalysisDocument[]}
export interface ChatCitation {documentId:string;sourceUrl:string;quote:string}
export interface ChatAnswer {schemaVersion:1;pageKey:string;answer:string;citations:ChatCitation[];model:string}
export type ChatResponse = ({ok:true}&ChatAnswer)|{ok:false;schemaVersion:1;pageKey:string;code:string;error:string};
export function validChatInput(value:unknown):value is ChatCommand {
 if(!value||typeof value!=='object')return false;
 const v=value as ChatCommand;
 return v.schemaVersion===1&&typeof v.pageKey==='string'&&v.pageKey.length>0&&v.pageKey.length<=300&&typeof v.question==='string'&&v.question.trim().length>0&&v.question.length<=2000&&Array.isArray(v.history)&&v.history.length<=10&&v.history.every(t=>t&&['user','assistant'].includes(t.role)&&typeof t.text==='string'&&t.text.length>0&&t.text.length<=4000);
}
