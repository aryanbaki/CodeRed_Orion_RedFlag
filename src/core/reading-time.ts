import type {DocumentReview,ReviewState} from './contracts.ts';
import {supportedAssessment} from './summary.ts';
// Adult English non-fiction mean: https://biblio.ugent.be/publication/8647789
export const READING_WORDS_PER_MINUTE=238;
export function currentAnalysis(review:DocumentReview,now=Date.now()){
 const a=supportedAssessment(review),expires=review.freshness.cacheExpiresAt;
 if(!a||review.status==='pending'||!['ready','unrated'].includes(review.status))return;
 if(a.reason&&!['insufficient-evidence','incomplete'].includes(a.reason))return;
 if(expires&&(!Number.isFinite(Date.parse(expires))||Date.parse(expires)<=now))return;
 return a;
}
/** Per-site estimate, never a cumulative counter across rechecks. */
export function readingTimeSaved(state:ReviewState|null,now=Date.now()){
 const seen=new Set<string>();let words=0;
 for(const d of state?.documents??[]){
  if(!currentAnalysis(d,now)||!Number.isSafeInteger(d.wordCount)||d.wordCount!<=0)continue;
  const key=d.document.url;if(seen.has(key))continue;seen.add(key);words+=d.wordCount!;
 }
 const minutes=words/READING_WORDS_PER_MINUTE,rounded=Math.max(1,Math.round(minutes));
 return {words,minutes,label:!words?'':minutes<1?'Saved you <1 minute':`Saved you ~${rounded} ${rounded===1?'minute':'minutes'}`};
}
