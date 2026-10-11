import {avionBase64} from './font-data.ts';
export const APP_FONT_STACK = '"Avion", Arial, sans-serif';
const loads=new WeakMap<Document,Promise<void>>();
/** Register once per document, including the document that owns an injected shadow root. */
export function ensureAppFont(doc:Document=document):Promise<void> {
 const existing=loads.get(doc);if(existing)return existing;
 const bytes=Uint8Array.from(atob(avionBase64),character=>character.charCodeAt(0));
 const face=new FontFace('Avion',bytes,{style:'normal',weight:'400',display:'swap'});
 doc.fonts.add(face);
 const loaded=face.load().then(()=>{});
 loads.set(doc,loaded);return loaded;
}
