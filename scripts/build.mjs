import {build} from 'esbuild';
import {mkdir,copyFile} from 'node:fs/promises';
await mkdir('dist/extension',{recursive:true});
await build({entryPoints:['src/extension/popup.ts'],bundle:true,format:'esm',platform:'browser',target:'chrome120',outfile:'dist/extension/popup.js'});
for(const name of ['manifest.json','popup.html','popup.css']) await copyFile('src/extension/'+name,'dist/extension/'+name);
console.log('Extension built in dist/extension');
