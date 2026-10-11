import {build} from 'esbuild';
import {mkdir,copyFile} from 'node:fs/promises';
await mkdir('dist/extension',{recursive:true});
await build({entryPoints:['src/extension/popup.ts'],bundle:true,format:'esm',platform:'browser',target:'chrome120',outfile:'dist/extension/popup.js'});
for(const name of ['manifest.json','popup.html','popup.css']) await copyFile('src/extension/'+name,'dist/extension/'+name);
console.log('Extension built in dist/extension');

await build({entryPoints:['src/extension/background.ts'],bundle:true,format:'esm',platform:'browser',target:'chrome120',outfile:'dist/extension/background.js'});
await build({entryPoints:['src/extension/offscreen.ts'],bundle:true,format:'iife',platform:'browser',target:'chrome120',outfile:'dist/extension/offscreen.js'});
await copyFile('src/extension/offscreen.html','dist/extension/offscreen.html');
await build({entryPoints:['src/extension/content.ts'],bundle:true,format:'iife',platform:'browser',target:'chrome120',outfile:'dist/extension/content.js'});
