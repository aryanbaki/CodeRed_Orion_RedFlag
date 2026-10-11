import {publicDocumentUrl} from '../discovery/urls.ts';
import {GEMINI_BACKUP_MODELS,validFallbackModels} from '../core/model-routing.ts';
import type {AnalysisVersions} from './cache.ts';
import {boundedText} from './io.ts';
import {PROMPT_VERSION,RUBRIC_VERSION} from '../server/versions.ts';
export const BACKEND_KEY='redflag.backend.v1';
export interface Backend extends AnalysisVersions {baseUrl:string;accessToken:string}
export function parseBackend(value:unknown):Backend|undefined {
 if(!value||typeof value!=='object')return;
 const raw=value as Backend;
 if(![raw.baseUrl,raw.accessToken,raw.model,raw.promptVersion,raw.rubricVersion].every(v=>typeof v==='string'&&v.length>0&&v.length<=500))return;
 if(!/^[A-Za-z0-9_-]{32,128}$/.test(raw.accessToken))return;
 try{
  const url=new URL(raw.baseUrl),local=['localhost','127.0.0.1'].includes(url.hostname);
  if(url.protocol!=='https:'&&!(url.protocol==='http:'&&local))return;
  if(url.username||url.password||url.search||url.hash||url.pathname!=='/')return;
  if(!local)publicDocumentUrl(raw.baseUrl);
  const fallbackModels=raw.fallbackModels??(raw.model==='gemini-3.5-flash'?[...GEMINI_BACKUP_MODELS]:[]);
  if(!validFallbackModels(fallbackModels)||!/^gemini-[a-z0-9.-]+$/.test(raw.model))return;
  if(raw.promptVersion!==PROMPT_VERSION||raw.rubricVersion!==RUBRIC_VERSION)return;
  return {baseUrl:url.origin,accessToken:raw.accessToken,model:raw.model,fallbackModels,promptVersion:raw.promptVersion,rubricVersion:raw.rubricVersion};
 }catch{return;}
}
export async function checkBackend(config:Backend,fetcher:typeof fetch=fetch):Promise<void>{
 const signal=AbortSignal.timeout(5000);
 const response=await fetcher(new URL('/api/health',config.baseUrl),{method:'POST',headers:{Authorization:'Bearer '+config.accessToken,'Content-Type':'application/json'},body:'{}',credentials:'omit',redirect:'error',referrerPolicy:'no-referrer',signal});
 if(!response.ok)throw Error(response.status===401||response.status===403?'Connection rejected. Check the connection file.':'Start the RedFlag backend, then reconnect.');
 const data=JSON.parse(await boundedText(response,8000,signal));
 if(data.schemaVersion!==1||data.model!==config.model||data.promptVersion!==config.promptVersion||data.rubricVersion!==config.rubricVersion||JSON.stringify(data.fallbackModels)!==JSON.stringify(config.fallbackModels??[]))throw Error('Backend versions differ. Import a new connection file.');
}

/** Pair only with the local server; no provider credentials enter the extension. */
export async function connectLocalBackend(fetcher:typeof fetch=fetch):Promise<Backend>{
 const signal=AbortSignal.timeout(5000),baseUrl='http://127.0.0.1:8787';
 const response=await fetcher(baseUrl+'/api/connect',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}',credentials:'omit',redirect:'error',referrerPolicy:'no-referrer',signal});
 if(!response.ok)throw Error('Start the RedFlag backend, then retry.');
 const config=parseBackend(JSON.parse(await boundedText(response,8000,signal)));
 if(!config||config.baseUrl!==baseUrl)throw Error('Local connection unavailable.');
 await checkBackend(config,fetcher);return config;
}
