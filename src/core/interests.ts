import type {EvidenceFinding,RiskCategory} from './contracts.ts';
export const CUSTOM_INTERESTS_KEY='redflag.custom-interests.v1';
export const interestChoices:{category:RiskCategory;label:string;detail:string}[]=[
 {category:'tracking',label:'Less tracking',detail:'Activity across sites'},
 {category:'sharing',label:'Keep data private',detail:'Selling or sharing information'},
 {category:'arbitration',label:'Keep my legal options',detail:'Arbitration and class-action limits'},
 {category:'content-rights',label:'Protect my creations',detail:'Rights to content I upload'},
 {category:'renewal',label:'Avoid surprise costs',detail:'Renewals and recurring charges'},
 {category:'cancellation',label:'Leave on my terms',detail:'Cancellation and account closure'},
 {category:'retention',label:'Control what stays',detail:'Retention and deletion'},
];
export function normalizeCustomInterests(value:unknown):string[]{return Array.isArray(value)?[...new Set(value.filter((v):v is string=>typeof v==='string').map(v=>v.trim().replace(/\s+/g,' ').slice(0,80)).filter(Boolean))].slice(0,5):[];}
/** Custom interests only reorder matching supported findings; they never invent evidence. */
export function prioritizeFindings<T extends EvidenceFinding>(findings:T[],priorities:RiskCategory[],custom:string[]):T[]{
 const matches=(f:T)=>priorities.includes(f.category)||custom.some(v=>v.toLowerCase().split(/[^a-z0-9]+/).filter(w=>w.length>=4).some(w=>(f.title+' '+f.explanation+' '+f.quote).toLowerCase().includes(w)));
 const severity={high:3,medium:2,low:1};return [...findings].sort((a,b)=>Number(matches(b))-Number(matches(a))||severity[b.severity]-severity[a.severity]);
}
