import {readConfig} from './config.ts';
import {createAnalysisServer} from './http.ts';
import {writeFileSync,readFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {join,dirname,resolve} from 'node:path';
import {homedir} from 'node:os';
import {PROMPT_VERSION,RUBRIC_VERSION} from './versions.ts';
try {
 const manifest=JSON.parse(readFileSync(resolve('src/extension/manifest.json'),'utf8'));
 const id=createHash('sha256').update(Buffer.from(manifest.key,'base64')).digest('hex').slice(0,32).replace(/[0-9a-f]/g,c=>String.fromCharCode(97+parseInt(c,16)));
 const config=readConfig({...process.env,REDFLAG_ALLOWED_ORIGIN:'chrome-extension://'+id});
 const server=createAnalysisServer(config,undefined,undefined,{allowLocalConnect:true});
 server.on('error',()=>{console.error('RedFlag server failed to listen.');process.exitCode=1;});
 server.listen(config.port,'127.0.0.1',()=>{
  const file=process.env.REDFLAG_CONNECTION_FILE??join(homedir(),'Downloads','RedFlag-Local-Connection.json');
  try{mkdirSync(dirname(file),{recursive:true});writeFileSync(file,JSON.stringify({baseUrl:'http://127.0.0.1:'+config.port,accessToken:config.token,model:config.model,fallbackModels:config.fallbackModels??[],promptVersion:PROMPT_VERSION,rubricVersion:RUBRIC_VERSION},null,2)+'\n',{mode:0o600});}
  catch{console.error('Connection file could not be saved. Check local file permissions.');}
  console.info(`RedFlag backend ready on 127.0.0.1:${config.port}. Open the extension to connect automatically.`);
 });
} catch {console.error('RedFlag server configuration is missing or invalid. See docs/gemini-backend.md.');process.exitCode=1;}
