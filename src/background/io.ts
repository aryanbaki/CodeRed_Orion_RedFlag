export async function abortable<T>(operation:Promise<T>,signal:AbortSignal):Promise<T> {
  if (signal.aborted) throw signal.reason;
  let abort:() => void = () => {};
  const interrupted = new Promise<never>((_,reject) => {abort = () => reject(signal.reason);signal.addEventListener('abort',abort,{once:true});});
  try {return await Promise.race([operation,interrupted]);}
  finally {signal.removeEventListener('abort',abort);}
}
export async function boundedText(response:Response,maxBytes:number,signal:AbortSignal):Promise<string> {
  if (Number(response.headers.get('content-length')) > maxBytes) throw new Error('oversized');
  if (!response.body) throw new Error('incomplete');
  const reader=response.body.getReader(),decoder=new TextDecoder('utf-8',{fatal:true});
  let count=0,body='';
  try {
    for (;;) {
      const {done,value}=await abortable(reader.read(),signal);
      if (done) break;
      count += value.byteLength;
      if (count > maxBytes) throw new Error('oversized');
      body += decoder.decode(value,{stream:true});
    }
    return body + decoder.decode();
  } finally {void reader.cancel().catch(() => {});}
}
