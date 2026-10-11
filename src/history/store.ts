import type {ReviewState} from '../core/contracts.ts';
import {HISTORY_STORAGE_KEY, decodeHistory, pruneHistory, snapshotReview, checkedOrigin, type CheckedSite, type HistoryData} from './model.ts';
export type {CheckedSite} from './model.ts';
export interface HistoryStorage {get:(key:string)=>Promise<Record<string,unknown>>;set:(items:Record<string,unknown>)=>Promise<void>}
export class HistoryError extends Error {}
/** All trusted extension contexts share this Web Lock, including the MV3 worker.
 * A browser restart releases abandoned locks; storage commits remain atomic. */
export function createHistoryApi(storage:HistoryStorage,lock:<T>(task:()=>Promise<T>)=>Promise<T>,now=()=>Date.now()) {
  async function read():Promise<HistoryData> {
    let stored:Record<string,unknown>;
    try {stored=await storage.get(HISTORY_STORAGE_KEY);}catch{throw new HistoryError('Local history could not be read. Try again.');}
    const {data,unsupported}=decodeHistory(stored[HISTORY_STORAGE_KEY],now());
    if(unsupported) throw new HistoryError('This history format is unsupported. Clear history to reset it; current settings will be kept.');
    return data;
  }
  async function write(data:HistoryData) {try {await storage.set({[HISTORY_STORAGE_KEY]:pruneHistory(data,now())});}catch{throw new HistoryError('Local history could not be saved. Existing saved reviews are unchanged.');}}
  return {
    list:():Promise<CheckedSite[]> => lock(async()=>{
      const data=await read();
      const raw=(await storage.get(HISTORY_STORAGE_KEY))[HISTORY_STORAGE_KEY];
      if(raw!==undefined && JSON.stringify(raw)!==JSON.stringify(data)) await write(data);
      return structuredClone(data.sites);
    }),
    get:async(origin:string):Promise<CheckedSite | undefined> => structuredClone((await read()).sites.find(s=>s.origin===checkedOrigin(origin))),
    recordReview:(state:ReviewState,options:{requireExisting?:boolean}={}):Promise<void> => lock(async()=>{
      const site=snapshotReview(state),data=await read();
      if(data.deleted.some(d=>d.origin===site.origin && d.generation===site.generation)) return;
      const previous=data.sites.find(s=>s.origin===site.origin);
      if(options.requireExisting && !previous) return;
      if(previous && previous.lastCheckedAt>site.lastCheckedAt) return;
      if(previous) site.firstCheckedAt=previous.firstCheckedAt;
      site.visitCount=(previous?.visitCount??(previous?1:0))+(previous?.generation===site.generation?0:1);
      data.sites=data.sites.filter(s=>s.origin!==site.origin);data.sites.push(site);
      // Keep tombstones for other generations so late updates cannot resurrect deleted history.
      await write(data);
    }),
    remove:(origin:string):Promise<void> => lock(async()=>{
      const data=await read(),target=checkedOrigin(origin),site=data.sites.find(s=>s.origin===target);
      if(site) data.deleted.push({origin:target,generation:site.generation,at:new Date(now()).toISOString()});
      data.sites=data.sites.filter(s=>s.origin!==target);await write(data);
    }),
    clear:():Promise<void> => lock(async()=>{
      // Unknown versions can be explicitly reset, never silently overwritten.
      const raw=await storage.get(HISTORY_STORAGE_KEY).catch(()=>{throw new HistoryError('Local history could not be read. Try again.');});
      const {data}=decodeHistory(raw[HISTORY_STORAGE_KEY],now());
      const deleted=[...data.deleted,...data.sites.map(s=>({origin:s.origin,generation:s.generation,at:new Date(now()).toISOString()}))];
      await write({schemaVersion:1,sites:[],deleted});
    })
  };
}
let api:ReturnType<typeof createHistoryApi> | undefined;
export function historyApi() {
  api??=createHistoryApi(chrome.storage.local,async task=>await navigator.locks.request('redflag-history-v1',async()=>await task()));
  return api;
}
// Stable worker/popup integration surface; no review capture or analysis lives here.
export const recordReview=(state:ReviewState,options?:{requireExisting?:boolean})=>historyApi().recordReview(state,options);
export const listHistory=()=>historyApi().list();
export const getHistory=(origin:string)=>historyApi().get(origin);
export const deleteHistory=(origin:string)=>historyApi().remove(origin);
export const clearHistory=()=>historyApi().clear();
export function subscribeHistory(callback:()=>void):()=>void {
  const listener=(changes:Record<string,chrome.storage.StorageChange>,area:string)=>{if(area==='local' && changes[HISTORY_STORAGE_KEY]) callback();};
  chrome.storage.onChanged.addListener(listener);return ()=>chrome.storage.onChanged.removeListener(listener);
}
