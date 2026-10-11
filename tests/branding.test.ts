import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ToolbarController,toolbarPresentation} from '../src/background/toolbar.ts';
import {gradeColors} from '../src/ui/branding.ts';
import {pendingState} from '../src/background/validation.ts';
import type {ReviewState} from '../src/core/contracts.ts';
function rated(grade:keyof typeof gradeColors):ReviewState {
 const state=pendingState('page','https://fixture.example/signup','signup',[]);
 state.documents=(['terms','privacy'] as const).map(kind=>{
  const url=`https://fixture.example/${kind}`;
  return {document:{id:kind,url,kind,label:kind,discoveredAt:new Date().toISOString()},grade,status:'ready',coverage:'complete',freshness:{},community:[],cached:false,
   assessment:{documentId:kind,documentUrl:url,kind,grade,coverage:'complete',provider:'gemini',rubricVersion:'redflag.rubric.v3',promptVersion:'fixture',contentHash:'a'.repeat(64),analyzedAt:new Date().toISOString(),summary:'Synthetic test',findings:[]}};
 });
 return state;
}
test('each supported grade selects its own flag and matching badge color',()=>{
 for(const grade of Object.keys(gradeColors) as (keyof typeof gradeColors)[]){
  const p=toolbarPresentation(rated(grade));assert.equal(p.text,grade);assert.equal(p.color,gradeColors[grade]);assert.equal(p.icon,`icons/redflag-${grade}`);
 }
 const p=toolbarPresentation();assert.equal(p.text,'');assert.equal(p.icon,'icons/redflag');assert.ok(!p.title.includes('?'));
});
test('toolbar updates are tab-scoped and newer idle updates clear an old grade',async()=>{
 const original=globalThis.chrome;
 const icons=new Map<number,unknown>(),badges=new Map<number,string>(),textColors=new Map<number,string>();
 globalThis.chrome={action:{setIcon:async({tabId,path}:any)=>{icons.set(tabId,path);},setBadgeText:async({tabId,text}:any)=>{badges.set(tabId,text);},setBadgeBackgroundColor:async()=>{},setBadgeTextColor:async({tabId,color}:any)=>{textColors.set(tabId,color);},setTitle:async()=>{}}} as unknown as typeof chrome;
 try {
  const controller=new ToolbarController();
  await Promise.all([controller.update(1,rated('S')),controller.update(2,rated('E'))]);
  assert.deepEqual(icons.get(1),{16:'icons/redflag-S-16.png',32:'icons/redflag-S-32.png',48:'icons/redflag-S-48.png',128:'icons/redflag-S-128.png'});
  assert.equal(badges.get(2),'E');assert.equal(textColors.get(2),'#ffffff');
  await Promise.all([controller.update(1,rated('B')),controller.update(1)]);
  assert.equal(badges.get(1),'');assert.equal((icons.get(1) as Record<number,string>)[16],'icons/redflag-16.png');assert.equal(badges.get(2),'E');
 } finally {globalThis.chrome=original;}
});
