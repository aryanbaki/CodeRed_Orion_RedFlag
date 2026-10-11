import {extractLegalText} from '../background/extraction.ts';
chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (sender.id !== chrome.runtime.id || sender.tab || message?.type !== 'redflag/internal-extract') return;
  if (typeof message.body !== 'string' || message.body.length > 256000 || !['html','text'].includes(message.format)) { reply({text:'',coverage:'partial',reason:'incomplete'}); return; }
  reply(extractLegalText(message.body,message.format,new DOMParser()));
});
