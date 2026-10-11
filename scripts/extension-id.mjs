import {createHash} from 'node:crypto';
import {readFileSync,existsSync} from 'node:fs';
import {resolve,join} from 'node:path';
export function extensionId(directory){
 const manifest=existsSync(join(directory,'manifest.json'))?JSON.parse(readFileSync(join(directory,'manifest.json'),'utf8')):{};
 return createHash('sha256').update(manifest.key?Buffer.from(manifest.key,'base64'):resolve(directory)).digest('hex').slice(0,32).replace(/[0-9a-f]/g,c=>String.fromCharCode(97+parseInt(c,16)));
}
