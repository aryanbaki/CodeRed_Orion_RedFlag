import {build} from 'esbuild';
import {mkdir,copyFile,cp,rm} from 'node:fs/promises';
await mkdir('dist/extension',{recursive:true});
await build({entryPoints:['src/extension/popup.ts'],bundle:true,format:'esm',platform:'browser',target:'chrome120',outfile:'dist/extension/popup.js'});
for(const name of ['manifest.json','popup.html','popup.css']) await copyFile('src/extension/'+name,'dist/extension/'+name);
await cp('src/extension/icons','dist/extension/icons',{recursive:true});
await rm('dist/extension/fonts',{recursive:true,force:true});
await cp('src/extension/fonts','dist/extension/fonts',{recursive:true});
console.log('Extension built in dist/extension');

await build({entryPoints:['src/extension/background.ts'],bundle:true,format:'esm',platform:'browser',target:'chrome120',outfile:'dist/extension/background.js'});
await build({entryPoints:['src/extension/offscreen.ts'],bundle:true,format:'iife',platform:'browser',target:'chrome120',outfile:'dist/extension/offscreen.js'});
await copyFile('src/extension/offscreen.html','dist/extension/offscreen.html');
await build({entryPoints:['src/extension/content.ts'],bundle:true,format:'iife',platform:'browser',target:'chrome120',outfile:'dist/extension/content.js'});

await build({entryPoints:['src/extension/dashboard.ts'],bundle:true,format:'esm',platform:'browser',target:'chrome120',outfile:'dist/extension/dashboard.js'});
for (const name of ['dashboard.html','dashboard.css']) await copyFile('src/extension/'+name,'dist/extension/'+name);

await copyFile('docs/tosdr-data.md','dist/extension/tosdr-data.txt');

await build({entryPoints:['src/extension/data.ts'],bundle:true,format:'esm',platform:'browser',target:'chrome120',outfile:'dist/extension/data.js'});
for(const name of ['data.html','data.css'])await copyFile('src/extension/'+name,'dist/extension/'+name);
