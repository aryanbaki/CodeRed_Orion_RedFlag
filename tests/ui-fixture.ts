import {renderSiteAccess} from '../src/ui/access.ts';
import {element} from '../src/ui/dom.ts';
import {mountOverview} from '../src/ui/overview.ts';
import {createDefaultPreferences, type DocumentReview, type ReviewState} from '../src/core/contracts.ts';
const preferences = createDefaultPreferences('2026-10-11T00:00:00Z'); preferences.priorities=['renewal'];
const terms: DocumentReview = {
  document:{id:'terms',url:'https://example.com/terms',kind:'terms',label:'Fixture Terms',discoveredAt:'2026-10-11T00:00:00Z'},
  status:'ready',grade:'D',coverage:'complete',cached:true,freshness:{retrievedAt:'2026-10-11T00:00:00Z',cacheExpiresAt:'2020-01-01T00:00:00Z'},community:[],
  assessment:{documentId:'terms',documentUrl:'https://example.com/terms',kind:'terms',grade:'D',coverage:'complete',summary:'Synthetic Terms assessment.',provider:'gemini',analyzedAt:'2026-10-11T00:00:00Z',model:'fixture-model',promptVersion:'fixture-v1',rubricVersion:'fixture-v1',contentHash:'fixture',findings:[
    {id:'arbitration',category:'arbitration',severity:'high',title:'Arbitration required',explanation:'Disputes use arbitration.',quote:'All disputes must be resolved through binding arbitration.',sourceUrl:'https://example.com/terms'},
    {id:'renewal',category:'renewal',severity:'medium',title:'Automatic renewal',explanation:'Your subscription renews automatically.',quote:'Your subscription renews automatically every month.',sourceUrl:'https://example.com/terms'},
  ]},
};
const privacy: DocumentReview = {
  document:{id:'privacy',url:'https://example.com/privacy',kind:'privacy',label:'Fixture Privacy',discoveredAt:'2026-10-11T00:00:00Z'},status:'pending',grade:'Unrated',reason:'pending',coverage:'unknown',cached:false,freshness:{},
  community:[{provider:'tosdr',serviceId:'fixture',serviceName:'Synthetic service',sourceUrl:'https://example.com/community',rating:'A',scope:'service',reviewStatus:'unknown',fetchedAt:'2026-10-11T00:00:00Z',freshness:'stale',attribution:'Synthetic ToS;DR fixture'}],
};
const additional: DocumentReview = {...privacy,document:{...privacy.document,id:'additional',kind:'additional',label:'Fixture Additional Terms',url:'https://example.com/additional'},status:'unrated',reason:'authentication-required',community:[]};
const state: ReviewState = {schemaVersion:1,pageKey:'fixture-signup',pageUrl:'https://example.com/signup',context:'signup',documents:[terms,privacy,additional],updatedAt:'2026-10-11T00:00:00Z'};
let dismissed=0; let settings=0;
const controller=mountOverview(state,preferences,{onDismiss:()=>{dismissed++;},onOpenSettings:()=>{settings++;}});
const grants = new Set<string>(); const permissionCalls: string[][] = [];
Object.assign(window,{
  fixtureAccess:async()=>{
    Object.defineProperty(window,'chrome',{value:{tabs:{query:async()=>[{url:'https://signup.example/register?secret=excluded'}]},permissions:{
      contains:async({origins}:{origins:string[]})=>origins.every(v=>grants.has(v)),
      request:async({origins}:{origins:string[]})=>{permissionCalls.push(origins);origins.forEach(v=>grants.add(v));return true;},
      remove:async({origins}:{origins:string[]})=>{origins.forEach(v=>grants.delete(v));return true;},
      getAll:async()=>({origins:[...grants]}),
    }},configurable:true});
    const section=element('section');section.setAttribute('aria-label','Site access fixture');
    const access=element('div');const status=element('p');status.setAttribute('role','status');section.append(status,access);document.body.prepend(section);
    await renderSiteAccess(access,status,state);
  },fixturePermissionCalls:()=>permissionCalls,

  fixtureUpdate:()=>controller.update({...state,documents:[terms,{...privacy,status:'unrated',coverage:'partial',reason:'inaccessible'},additional]},preferences),
  fixtureReady:()=>controller.update({...state,documents:[terms,{...privacy,status:'ready',grade:'B',coverage:'complete',assessment:{...terms.assessment!,documentId:'privacy',documentUrl:privacy.document.url,kind:'privacy',grade:'B',summary:'Synthetic independent Privacy assessment.',findings:[]}},additional]},preferences),
  fixtureAllReady:()=>{const readyTerms={...terms,cached:false,freshness:{},assessment:{...terms.assessment!,rubricVersion:'redflag.rubric.v3',contentHash:'a'.repeat(64)}};controller.update({...state,documents:[readyTerms,{...privacy,status:'ready',grade:'B',coverage:'complete',community:[],assessment:{...readyTerms.assessment!,documentId:'privacy',documentUrl:privacy.document.url,kind:'privacy',grade:'B',findings:[]}}]},preferences);},
  fixtureMissing:()=>controller.update({...state,documents:[terms]},preferences),
  fixtureInvalidGrade:()=>controller.update({...state,documents:[{...terms,coverage:'partial'},privacy]},preferences),
  fixtureUnsafe:()=>controller.update({...state,documents:[{...terms,document:{...terms.document,url:'javascript:alert(1)',label:'<img src=x onerror=alert(1)>'},assessment:undefined},privacy]},preferences),
  fixtureRestore:()=>controller.update(state,preferences),
  fixtureOldGeneration:()=>controller.update({...state,pageKey:'old-generation',documents:[]},preferences),
  fixtureDisable:()=>controller.update(state,{...preferences,enabled:false}),fixtureEnable:()=>controller.update(state,preferences),
  fixtureDestroy:()=>controller.destroy(),fixtureCounts:()=>({dismissed,settings}),
});
