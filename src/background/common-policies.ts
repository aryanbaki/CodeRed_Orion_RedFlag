import type {DiscoveredDocument,DocumentKind} from '../core/contracts.ts';
import type {Download} from './retrieval.ts';
const candidates:[DocumentKind,string,string[]][]=[
 ['terms','Terms of service',['/terms','/terms-of-service','/terms-and-conditions']],
 ['privacy','Privacy policy',['/privacy','/privacy-policy']],
 ['cookies','Cookie policy',['/cookie-policy','/cookies']],
];
/** Verify a legal heading before accepting a common URL; a successful homepage is not a policy. */
export async function findCommonPolicies(origin:string,known:DiscoveredDocument[],download:(url:string)=>Promise<Download>):Promise<DiscoveredDocument[]>{
 const found:DiscoveredDocument[]=[];
 await Promise.all(candidates.filter(([kind])=>!known.some(d=>d.kind===kind)).map(async([kind,label,paths])=>{
  const pattern=kind==='terms'?/\bterms(?:\s+of\s+(?:service|use)|\s+(?:and|&)\s+conditions)?\b/i:kind==='privacy'?/\bprivacy\s+policy\b/i:/\bcookie\s+policy\b/i;
  for(const path of paths){
   try{
    const result=await download(new URL(path,origin).href);
    const headings=result.type==='html'?[...result.body.matchAll(/<(?:title|h1)\b[^>]*>([\s\S]*?)<\/(?:title|h1)>/gi)].map(m=>m[1].replace(/<[^>]+>/g,' ').replace(/&amp;/g,'&')).join(' '):result.body.slice(0,160);
    if(!pattern.test(headings))continue;
    found.push({id:'common-'+kind,url:result.url,kind,label,discoveredAt:new Date().toISOString()});break;
   }catch{/* Missing or inaccessible candidates are never represented as reviewed documents. */}
  }
 }));
 return found;
}
