import {MAX_POLICY_DOWNLOAD_BYTES} from '../core/policy-text.ts';
import {extractLegalText} from '../background/extraction.ts';
chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (sender.id !== chrome.runtime.id || sender.tab || message?.type !== 'redflag/internal-extract') return;
  if (typeof message.body !== 'string' || message.body.length > MAX_POLICY_DOWNLOAD_BYTES || !['html','text'].includes(message.format)) { reply({text:'',coverage:'partial',reason:'incomplete'}); return; }
  reply(extractLegalText(message.body,message.format,new DOMParser()));
});
