import {MAX_POLICY_CHARACTERS} from '../core/policy-text.ts';
export interface Extraction {text: string; coverage: 'complete' | 'partial'; reason?: string}
/** Runs only on the freshly downloaded, credential-free legal document in a
 * detached inert DOM, never on the signup/account page. */
export function extractLegalText(body: string, type: 'html' | 'text', parser: DOMParser): Extraction {
  if (type === 'text') return limit(body.trim(), 'complete');
  const document = parser.parseFromString(body, 'text/html');
  if (document.querySelector('input[type="password"]') || /\b(sign in|log in)\b/i.test(document.title)) {
    return {text:'',coverage:'partial',reason:'authentication-required'};
  }
  const legalRoot=document.querySelector('main,article,[role="main"]');
  const legalHeading=legalRoot?.querySelector('h1,h2')?.textContent ?? document.title;
  const staticPolicy=Boolean(legalRoot && /\b(privacy\s+polic(?:y|ies)|cookie\s+polic(?:y|ies)|terms(?:\s+of\s+(?:service|use)|\s+(?:and|&)\s+conditions)?)\b/i.test(legalHeading) &&
    !legalRoot.querySelector('[hidden],[aria-hidden="true"],[aria-busy="true"],[style*="display:none"],[style*="display: none"],iframe,input,textarea,[contenteditable]'));
  // Prevent UI fields, templates, scripts and account content from becoming evidence.
  document.querySelectorAll('script,style,noscript,template,iframe,form,input,textarea,select,button,[contenteditable],nav,footer,[hidden],[aria-hidden="true"]').forEach(node => node.remove());
  const main = document.querySelector('main,article,[role="main"]');
  const root = main ?? document.body;
  // Walk each text node once, including direct text around nested lists/tables.
  // Block-only selectors previously lost introductions and trailing clauses.
  const walker = document.createTreeWalker(root, 4 /* SHOW_TEXT */);
  const parts: string[] = [];
  while (walker.nextNode()) {
    const text = (walker.currentNode.textContent ?? '').replace(/\s+/g, ' ').trim();
    if (text) parts.push(text);
  }
  const text = parts.join('\n');
  // Complete means the identified static legal container was extracted in full.
  // Unknown structure, hidden sections, small/dynamic shells retain partial coverage.
  return limit(text, staticPolicy && text.length>=500 ? 'complete' : 'partial');
}
function limit(text: string, coverage: Extraction['coverage']): Extraction {
  if (!text || text.length < 80) return {text:'',coverage:'partial',reason:'incomplete'};
  if (text.length > MAX_POLICY_CHARACTERS) return {text:'',coverage:'partial',reason:'oversized'};
  return {text,coverage};
}
