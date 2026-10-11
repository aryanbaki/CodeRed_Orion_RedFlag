import {createServer} from 'node:http';import {readFile} from 'node:fs/promises';import {resolve,extname} from 'node:path';
const previewPort=Number(process.env.REDFLAG_PREVIEW_PORT??8790);
const root=resolve('dist/simulator');const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.ttf':'font/ttf'};
const previewServer=createServer(async(req,res)=>{try{const url=new URL(req.url,'http://localhost');const path=resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));if(!path.startsWith(root+'/'))throw Error();const data=await readFile(path);res.writeHead(200,{'Content-Type':types[extname(path)]??'application/octet-stream','Cache-Control':'no-store'});res.end(data);}catch{res.writeHead(404);res.end('Not found');}});
previewServer.listen(previewPort,'127.0.0.1',()=>console.log(`RedFlag simulator: http://127.0.0.1:${previewServer.address().port}/`));
