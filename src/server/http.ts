import type {ChatRequest,ChatAnswer} from '../core/chat-contracts.ts';
import {answerPolicyQuestion,validateChatRequest} from './chat.ts';
import {ProviderError} from '../providers/gemini.ts';
import {PROMPT_VERSION,RUBRIC_VERSION} from './versions.ts';
import {createServer, type IncomingMessage, type ServerResponse} from 'node:http';
import {timingSafeEqual} from 'node:crypto';
import {analyzeDocument} from '../providers/gemini.ts';
import {CONTRACT_VERSION, type UnratedReason, type DocumentAssessment, type AnalyzeRequest} from '../core/contracts.ts';
import {validateRequest, InputError} from './validation.ts';
import type {ServerConfig} from './config.ts';
const MAX_BODY_BYTES = 2_000_000;
type Analyzer = (request: AnalyzeRequest) => Promise<DocumentAssessment>;
export function createAnalysisServer(config: ServerConfig, analyzer: Analyzer = r => analyzeDocument(r.document,config), chatter:(r:ChatRequest)=>Promise<ChatAnswer>=r=>answerPolicyQuestion(r,config)) {
  let active = 0, minuteStart = Date.now(), minuteCount = 0, dayStart = Date.now(), dayCount = 0;
  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const send = (status:number, value:unknown) => {
      if (!res.destroyed && !res.headersSent) {res.writeHead(status, {'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}); res.end(JSON.stringify(value));}
    };
    const origin = req.headers.origin;
    if (origin !== config.allowedOrigin) {send(403,failure('unsafe-url','Origin denied.',false)); return;}
    res.setHeader('Access-Control-Allow-Origin', config.allowedOrigin); res.setHeader('Vary','Origin');
    if (!['/api/analyze','/api/chat','/api/health'].includes(req.url??'')) {send(404,failure('unsupported','Endpoint not found.',false)); return;}
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {'Access-Control-Allow-Methods':'POST, GET','Access-Control-Allow-Headers':'Authorization, Content-Type','Access-Control-Max-Age':'600'}); res.end(); return;
    }
    const supplied = Buffer.from(req.headers.authorization ?? ''); const expected = Buffer.from(`Bearer ${config.token}`);
    if (supplied.length !== expected.length || !timingSafeEqual(supplied,expected)) {send(401,failure('authentication-required','Demo access authorization required.',false)); return;}
    if(req.url==='/api/health'&&['GET','POST'].includes(req.method??'')){send(200,{schemaVersion:1,model:config.model,fallbackModels:config.fallbackModels??[],promptVersion:PROMPT_VERSION,rubricVersion:RUBRIC_VERSION});return;}
    if(req.method!=='POST'||req.url==='/api/health'){send(405,failure('unsupported','POST required.',false));return;}
    const limit=req.url==='/api/chat'?4_000_000:MAX_BODY_BYTES;
    const now = Date.now();
    if (now - minuteStart >= 60000) {minuteStart=now; minuteCount=0;}
    if (now - dayStart >= 86400000) {dayStart=now; dayCount=0;}
    if (active >= 2 || minuteCount >= 10 || dayCount >= 100) {res.setHeader('Retry-After','60'); send(429,failure('quota','Demo limit reached.',true)); return;}
    if (req.headers['content-type']?.split(';')[0].trim() !== 'application/json' || req.headers['content-encoding']) {send(415,failure('unsupported','JSON required.',false)); return;}
    if (Number(req.headers['content-length'] ?? 0) > limit) {send(413,failure('too-large','Input too large.',false)); req.resume(); return;}
    active++; minuteCount++; dayCount++;
    let bodyTimer: ReturnType<typeof setTimeout> | undefined;
    try {
      const chunks: Buffer[] = []; let bytes = 0;
      const read = async () => {
        for await (const chunk of req) {
          const data = Buffer.from(chunk); bytes += data.length;
          if (bytes > limit) {send(413,failure('too-large','Input too large.',false)); req.destroy(); return null;}
          chunks.push(data);
        }
        return Buffer.concat(chunks).toString('utf8');
      };
      const body = await Promise.race([read(), new Promise<null>(resolve => {bodyTimer=setTimeout(() => {send(408,failure('timeout','Input timed out.',true)); req.destroy(); resolve(null);},5000);})]);
      clearTimeout(bodyTimer);
      if (body === null) return;
      if(req.url==='/api/chat'){const answer=await chatter(validateChatRequest(JSON.parse(body)));send(200,answer);return;}
      const request = validateRequest(JSON.parse(body));
      const result = await analyzer(request);
      // Valid document requests return a result, including provider failures as Unrated.
      send(200,{schemaVersion:CONTRACT_VERSION, assessment:result});
    } catch(error) {if(error instanceof ProviderError){const code=error.code==='provider-quota'?'quota':error.code==='provider-timeout'?'timeout':error.code==='provider-authentication'?'authentication-required':error.code==='invalid-provider-output'?'invalid-response':'network-error';send(code==='quota'?429:code==='timeout'?504:502,failure(code,'Gemini could not answer. Try again.',code!=='invalid-response'));return;}send(error instanceof InputError || error instanceof SyntaxError ? 400 : 500,failure(error instanceof InputError || error instanceof SyntaxError ? 'invalid-response' : 'network-error', error instanceof InputError || error instanceof SyntaxError ? 'Invalid analysis request.' : 'Analysis unavailable.', false));}
    finally {clearTimeout(bodyTimer); active--;}
  });
  server.headersTimeout=5000; server.requestTimeout=10000; server.keepAliveTimeout=1000;
  server.maxConnections=20;
  return server;
}

function failure(code: UnratedReason, message:string, retryable:boolean) {return {schemaVersion:CONTRACT_VERSION, error:{code,message,retryable}};}
