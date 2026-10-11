import {readFile,writeFile,mkdir,readdir,stat,rm,rename} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {homedir} from 'node:os';
import {spawnSync} from 'node:child_process';
const output=join(homedir(),'Downloads'),root=resolve('dist/extension');
await mkdir(output,{recursive:true});
const manifest=JSON.parse(await readFile(join(root,'manifest.json'),'utf8'));
if(!/^\d+\.\d+\.\d+$/.test(manifest.version)||!manifest.key)throw Error('Unexpected extension manifest');
const version=manifest.version;
await writeFile(join(root,'INSTALL.txt'),`RedFlag ${version}\n\nUnzip this archive into a permanent folder. Open chrome://extensions, enable Developer mode, and choose Load unpacked. Select the folder containing manifest.json. Disable older RedFlag copies to avoid duplicate icons.\n\nOpen RedFlag on a website. It connects automatically to your running local backend on port 8787. Choose Enable checks once to allow public-policy analysis. Advanced connection-file import remains available for another backend. Policy cards remain visible; analysis starts automatically after consent. Analyze all refreshes every discovered policy. Chat uses the retrieved policies and shows exact source quotes.\n\nProvider API keys remain on the backend. The connection file contains a private local backend access token and is deliberately excluded from this ZIP. The backend must be running for Gemini analysis and chat.\n`);
const files=await readdir(root);if(!files.includes('manifest.json'))throw Error('Missing manifest');
async function verify(directory){for(const name of await readdir(directory)){const path=join(directory,name);if((await stat(path)).isDirectory())await verify(path);else if(/\.(js|json|html|css|txt)$/i.test(name)){const text=await readFile(path,'utf8');if(/AIza[A-Za-z0-9_-]{30,}|-----BEGIN .*PRIVATE KEY-----/.test(text))throw Error('Private credential in package');}}}
await verify(root);
// Fresh archives; include extension files at ZIP root.
const archive=join(output,`RedFlag-Extension-${version}.zip`),temp=join(output,`RedFlag-Extension-${version}.new.zip`);
await rm(temp,{force:true});
const zipped=spawnSync('/usr/bin/zip',['-qr',temp,'.'],{cwd:root});if(zipped.status!==0)throw Error('ZIP creation failed');
await rename(temp,archive);
console.log('Updated extension ZIP: '+archive);
