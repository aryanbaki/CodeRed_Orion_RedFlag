import type {AnalysisDocument} from '../core/contracts.ts';
import type {Backend} from './backend.ts';
import type {ChatAnswer,ChatCommand} from '../core/chat-contracts.ts';
import {boundedText} from './io.ts';
/** Revalidate every citation against this request's current retrieved text. */
export function validateChatAnswer(value:unknown,command:ChatCommand,documents:AnalysisDocument[],config:Backend):ChatAnswer {
 const r=value as ChatAnswer;
 if(!r||r.schemaVersion!==1||r.pageKey!==command.pageKey||typeof r.answer!=='string'||!r.answer.trim()||r.answer.length>6000||![config.model,...config.fallbackModels??[]].includes(r.model)||!Array.isArray(r.citations)||r.citations.length>12)throw Error('Gemini returned an invalid answer. Try again.');
 for(const c of r.citations){
  const doc=documents.find(d=>d.id===c?.documentId);
  if(!doc||c.sourceUrl!==doc.url||typeof c.quote!=='string'||c.quote.length<12||c.quote.length>4000||!doc.text.includes(c.quote))throw Error('Gemini returned unsupported evidence. Try again.');
 }
 if(!r.citations.length&&r.answer!=='The supplied policies do not state enough to answer that fully.'&&r.answer!=='Only the available policy text was checked.\n\nThe supplied policies do not state enough to answer that fully.')throw Error('Gemini returned an unsupported answer.');
 return {schemaVersion:1,pageKey:r.pageKey,answer:r.answer,citations:r.citations.map(c=>({documentId:c.documentId,sourceUrl:c.sourceUrl,quote:c.quote})),model:r.model};
}
export async function requestPolicyChat(command:ChatCommand,documents:AnalysisDocument[],config:Backend,signal:AbortSignal,fetcher:typeof fetch=fetch):Promise<ChatAnswer>{
 const body=JSON.stringify({schemaVersion:1,pageKey:command.pageKey,question:command.question,history:command.history,documents});
 if(new TextEncoder().encode(body).length>4_000_000)throw Error('These policies exceed the chat limit. Ask about an individual policy.');
 const response=await fetcher(new URL('/api/chat',config.baseUrl),{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+config.accessToken},body,credentials:'omit',redirect:'error',referrerPolicy:'no-referrer',signal});
 if(!response.ok)throw Error(response.status===429?'Gemini limit reached. Try again in a minute.':response.status===401||response.status===403?'Reconnect Gemini in setup.':response.status===504?'Gemini timed out. Try again.':'Gemini could not answer. Try again.');
 return validateChatAnswer(JSON.parse(await boundedText(response,120000,signal)),command,documents,config);
}
