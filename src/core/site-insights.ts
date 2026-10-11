import type {EvidenceFinding,ReviewState,DocumentKind} from './contracts.ts';
import {supportedAssessment} from './summary.ts';
export const policyLabels:Partial<Record<DocumentKind,string>>={privacy:'Privacy policy',cookies:'Cookie policy',terms:'Terms of service',additional:'Additional terms'};
export function siteInsights(state:ReviewState|null){
 const documents=state?.documents??[],weights={high:3,medium:2,low:1};
 const evidence=(protective:boolean)=>{
  const seen=new Set<string>();
  return documents.flatMap(d=>{
   if(d.status==='pending')return [];
   const a=supportedAssessment(d);if(!a)return [];
   if(d.freshness.cacheExpiresAt&&Date.parse(d.freshness.cacheExpiresAt)<=Date.now())return [];
   return (protective?a.protections??[]:a.findings).filter(f=>{
    if(f.sourceUrl!==d.document.url||typeof f.quote!=='string'||f.quote.trim().length<12)return false;
    const key=JSON.stringify([f.sourceUrl,f.category,f.quote]);if(seen.has(key))return false;seen.add(key);return true;
   }).map(f=>({...f,policyLabel:policyLabels[d.document.kind]??'Policy'}));
  }).sort((a,b)=>weights[b.severity]-weights[a.severity]);
 };
 const summaries=documents.filter(d=>d.status!=='pending').flatMap(d=>{const a=supportedAssessment(d);return a?[{label:policyLabels[d.document.kind]??'Policy',text:a.summary,model:a.model,partial:a.coverage!=='complete'}]:[];});
 const gaps=(['privacy','cookies','terms'] as const).filter(kind=>!documents.some(d=>d.document.kind===kind)).map(kind=>`${policyLabels[kind]} not found.`);
 for(const d of documents)if(d.status==='unrated'&&!supportedAssessment(d))gaps.push(`${policyLabels[d.document.kind]??'Policy'}: ${d.failure?.message??'Analysis unavailable.'}`);
 return {findings:evidence(false),protections:evidence(true),summaries,gaps,pending:documents.some(d=>d.status==='pending')||Boolean(state?.discoveryPending)};
}
