export interface Extraction {text: string; coverage: 'complete' | 'partial'; reason?: string}
/** Runs only on the freshly downloaded, credential-free legal document in a
 * detached inert DOM, never on the signup/account page. */
export function extractLegalText(body: string, type: 'html' | 'text', parser: DOMParser): Extraction {
  if (type === 'text') return limit(body.trim(), 'complete');
  const document = parser.parseFromString(body, 'text/html');
  if (document.querySelector('input[type="password"]') || /\b(sign in|log in)\b/i.test(document.title)) {
    return {text:'',coverage:'partial',reason:'authentication-required'};
  }
  // Prevent UI fields, templates, scripts and account content from becoming evidence.
  document.querySelectorAll('script,style,noscript,template,iframe,form,input,textarea,select,button,[contenteditable],nav,header,footer,[hidden],[aria-hidden="true"]').forEach(node => node.remove());
  const main = document.querySelector('main,article,[role="main"]');
  const root = main ?? document.body;
  const blocks = root.querySelectorAll('p,li,h1,h2,h3,h4,h5,h6,td,pre,blockquote');
  const text = blocks.length ? [...blocks].filter(node => !node.querySelector('p,li,td,pre,blockquote')).map(node => (node.textContent ?? '').replace(/\s+/g,' ').trim()).filter(Boolean).join('\n') : (root.textContent ?? '').replace(/\s+/g,' ').trim();
  // An HTML heuristic cannot prove all clauses are present. AI must not assign
  // a complete grade unless a trusted extraction adapter establishes coverage.
  return limit(text, 'partial');
}
function limit(text: string, coverage: Extraction['coverage']): Extraction {
  if (!text || text.length < 80) return {text:'',coverage:'partial',reason:'incomplete'};
  if (text.length > 60000) return {text:'',coverage:'partial',reason:'oversized'};
  return {text,coverage};
}
