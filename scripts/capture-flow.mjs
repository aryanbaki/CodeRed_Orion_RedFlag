import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {join} from 'node:path';
const version=JSON.parse(await readFile('src/extension/manifest.json','utf8')).version;
const files=['01-connect','02-searching','06-unknown','03-red-flags','04-summary','05-chat'],labels=['1 · Connect once','2 · Automatic discovery','3 · Unknown grades','4 · Red flags','5 · Summary','6 · Policy chat'],captures=[];
for(const [i,name] of files.entries()){const bytes=await readFile('dist/site-review-v2/'+name+'.png');captures.push({bytes,width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20),label:labels[i],name});}
const height=Math.max(...captures.map(c=>c.height))+190,width=files.length*464+64;
const content=captures.map((c,i)=>`<g id="${c.name}" transform="translate(${40+i*464},125)"><text fill="#edf2fa" font-size="20" font-family="Arial" font-weight="700">${c.label}</text><image x="0" y="25" width="${c.width}" height="${c.height}" href="data:image/png;base64,${c.bytes.toString('base64')}"/></g>`).join('');
const svg=`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="${width}" height="${height}" rx="24" fill="#0b101b"/><text x="40" y="48" fill="#edf2fa" font-family="Arial" font-size="28" font-weight="700">RedFlag ${version} · Current implementation</text><text x="40" y="82" fill="#a6b3c9" font-family="Arial" font-size="17">Always visible grades · Individual / Analyze all · Summary · Cited chat · Sample data, not live site ratings</text>${content}</svg>`;
const output=join('docs','design','release-'+version);await mkdir(output,{recursive:true});await writeFile(join(output,'Ordered-layout.svg'),svg);for(const c of captures)await copyFile('dist/site-review-v2/'+c.name+'.png',join(output,c.name+'.png'));
console.log('Ordered current screenshots saved in '+output);
