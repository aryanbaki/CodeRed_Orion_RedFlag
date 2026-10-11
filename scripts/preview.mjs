// Build a key-free simulator from the actual extension UI. Never include background/manifest/config.
import {mkdir,cp,readFile,writeFile} from 'node:fs/promises';
const output='dist/simulator';await mkdir(output,{recursive:true});
for(const file of ['popup.html','popup.css','popup.js','dashboard.html','dashboard.css','dashboard.js','icons','fonts'])await cp('dist/extension/'+file,output+'/'+file,{recursive:true});
for(const file of ['popup.html','dashboard.html']){let html=await readFile(output+'/'+file,'utf8');html=html.replace('<head>','<head><script src="simulator-api.js"></script>');await writeFile(output+'/'+file,html);}
await cp('scripts/preview-api.js',output+'/simulator-api.js');const shell=(await readFile('scripts/preview.html','utf8')).replace('<option value="partial">','<option value="empty">Ordinary site · no policies</option><option value="partial" selected>');await writeFile(output+'/index.html',shell);
console.log('Simulator generated: dist/simulator/index.html. Serve with node scripts/preview-server.mjs');
