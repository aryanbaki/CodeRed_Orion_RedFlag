// Read-only probes; no provider credentials and no policy bodies saved.
const endpoints = ['https://api.tosdr.org/appdb/version/v2','https://api.tosdr.org/service/v2/?id=182','https://api.tosdr.org/search/v5?query=facebook.com','https://api.tosdr.org/search/v5?query=policy-review-example.invalid','https://api.tosdr.org/search/v5?query=facebook.com.attacker.test','https://privacyspy.org/api/v2/index.json','https://privacyspy.org/api/v2/rubric.json'];
for (const url of endpoints) {
  try {
    const response=await fetch(url,{signal:AbortSignal.timeout(15000)});
    const data=await response.text();
    console.log(JSON.stringify({url,status:response.status,bytes:Buffer.byteLength(data),contentType:response.headers.get('content-type'),checkedAt:new Date().toISOString()}));
  } catch {console.log(JSON.stringify({url,error:'Network request failed'}));}
}
