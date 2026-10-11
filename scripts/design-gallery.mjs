// Assemble actual UI captures into a local, Figma-ready screenshot board.
// Usage: node scripts/design-gallery.mjs manifest.json [manifest.json ...]
import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {basename,resolve} from 'node:path';
const output=resolve('dist/simulator/design-board');await mkdir(output,{recursive:true});
const entries=[];
for(const path of process.argv.slice(2)){
 const value=JSON.parse(await readFile(path,'utf8'));
 const records=Array.isArray(value)?value:value.screenshots??value.screens??[];
 for(const record of records){
  const source=record.path??record.file??record.absolutePath;if(!source)continue;
  const name=String(entries.length+1).padStart(2,'0')+'-'+basename(source);
  await copyFile(source,output+'/'+name);
  entries.push({...record,path:name,name:record.name??record.state??basename(source),synthetic:record.synthetic!==false});
 }
}
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
await writeFile(output+'/manifest.json',JSON.stringify(entries,null,2));
const cards=entries.map(e=>`<figure><figcaption>${escape(e.name)}<small>${e.synthetic?'Actual UI · synthetic review data':'Actual UI capture'}</small></figcaption><a href="${escape(e.path)}" target="_blank"><img src="${escape(e.path)}" alt="${escape(e.name)}"></a></figure>`).join('');
await writeFile(output+'/index.html',`<!doctype html><html lang="en"><head><meta charset="utf-8"><title>RedFlag screen inventory</title><style>*{box-sizing:border-box}body{margin:0;background:#101214;color:#f4f5f7;font:14px/1.5 ui-monospace,monospace;padding:32px}h1{color:#ff334f}header{max-width:1000px;margin-bottom:32px}main{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:28px;align-items:start}figure{margin:0;background:#1b1e22;border:1px solid #424850;padding:12px;border-radius:12px}figcaption{font-weight:700;margin-bottom:12px}small{display:block;color:#b5bac3;font-weight:400}img{width:100%;height:auto;display:block}a{color:inherit}@media(max-width:900px){main{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:550px){main{grid-template-columns:1fr}}</style></head><body><header><h1>RedFlag · implemented screens</h1><p>Screen captures of the extension after the clarity and discovery fixes. Example grades are synthetic test data, not real website ratings. Click a capture for full size.</p><p>Unknown reviews use ?, supported grades use A–F. Monoglyphic is not installed; the current font is a temporary system monospace.</p></header><main>${cards}</main></body></html>`);
console.log(`${entries.length} captures assembled at ${output}`);
