import {merriweatherFaces} from './font-data.ts';
export const APP_FONT_STACK = '"Merriweather", Georgia, serif';
const loads=new WeakMap<Document,Promise<void>>();
/** Register local regular, bold, black and italic faces once per document. */
export function ensureAppFont(doc:Document=document):Promise<void> {
 const existing=loads.get(doc);if(existing)return existing;
 const loaded=Promise.all(merriweatherFaces.map(({base64,weight,style})=>{
  const bytes=Uint8Array.from(atob(base64),character=>character.charCodeAt(0));
  const face=new FontFace('Merriweather',bytes,{style,weight,display:'swap'});
  doc.fonts.add(face);return face.load();
 })).then(()=>{});
 loads.set(doc,loaded);return loaded;
}
