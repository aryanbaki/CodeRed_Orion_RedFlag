import {legalLabel} from './legal-label.ts';
import {publicDocumentUrl} from './urls.ts';
export type LegalKind = 'terms' | 'privacy' | 'cookies' | 'additional';
export interface DiscoveredLink {url: string; kind: LegalKind; label: string; element?: HTMLAnchorElement; consent?:boolean}
const shortLegal = /^(terms|privacy|cookies)$/i;
const agreement = /\b(sign\s*up|register|create\s*(?:an?\s*)?account|checkout|onboarding|consent|agree|accept|by\s*(?:continuing|proceeding)|get\s*started)\b/i;
const explicitAgreement = /\b((?:i|you|we)\s+(?:agree|accept)|by\s*(?:continuing|proceeding|signing\s*up)|agree\s+to|accept\s+(?:the|these|our)\s+(?:terms|privacy)|consent\s+to)\b/i;
function staticText(element: Element): string {
  const copy = element.cloneNode(true) as Element;
  copy.querySelectorAll('input,textarea,select,script,style,[contenteditable], [data-redflag-ui]').forEach(e => e.remove());
  return (copy.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 4000);
}
function inContext(link: Element): boolean {
  let parent: Element | null = link.parentElement;
  for (let depth = 0; parent && depth < 6; depth++, parent = parent.parentElement) {
    if (parent.matches('[data-redflag-ui]')) return false;
    if (parent.matches('form,dialog,[role="dialog"],[role="group"],section,label,p,div')) {
      // Bound context cloning to avoid repeatedly copying the full document.
      const contextual=parent.matches('form,dialog,[role="dialog"]') ? agreement : explicitAgreement;
      if (parent.querySelectorAll('*').length <= 250 && contextual.test(staticText(parent))) return true;
    }
  }
  return false;
}
/** No values, form state, surrounding page text, or account identifiers leave this function. */
export function discoverLegalLinks(root: ParentNode, base: string, deduplicate = true): DiscoveredLink[] {
  const all = Array.from(root.querySelectorAll('a[href]'));
  // Include the footer even on repositories with hundreds of unrelated links.
  const candidates = [...new Set([...root.querySelectorAll('footer a[href],[role="contentinfo"] a[href]')].slice(0,200).concat(
    [...root.querySelectorAll('nav a[href]')].slice(-100),all.slice(0,100),all.slice(-100)))];
  if (root instanceof Element && root.matches('a[href]')) candidates.unshift(root as HTMLAnchorElement);
  const results = new Map<string, DiscoveredLink>();
  for (const link of candidates.slice(0, 500)) {
    if (link.closest('[data-redflag-ui], [hidden], [aria-hidden="true"]')) continue;
    const names = [staticText(link), link.getAttribute('aria-label') ?? '', link.getAttribute('title') ?? ''];
    const labelled = link.getAttribute('aria-labelledby')?.split(/\s+/).map(id => link.ownerDocument.getElementById(id)).filter(Boolean) as Element[] | undefined;
    if (labelled) names.push(...labelled.map(staticText));
    const explicit=legalLabel(names.join(' '));
    const match = explicit ? [explicit.label] : names.map(name=>name.trim().match(shortLegal)).find(Boolean);
    if (!match) continue;
    try {
      const url = publicDocumentUrl(link.getAttribute('href')!, base);
      const label = match[0];
      if(shortLegal.test(label) && (/\/(?:blog|articles?|settings|issues|pull|discussions)(?:\/|$)/i.test(new URL(url).pathname) ||
        !/\/(?:site-policy|policies|legal|cookies?(?:-policy)?|privacy(?:-policy)?|terms(?:-of-(?:service|use))?)(?:\/|$)/i.test(new URL(url).pathname))) continue;
      const kinds = explicit?.kinds ?? [/cookie/i.test(label) ? 'cookies' : /privacy/i.test(label) ? 'privacy' : /additional/i.test(label) ? 'additional' : 'terms'];
      for(const kind of kinds) {
      // A shared URL with distinct scopes is still two agreements.
      const key=deduplicate ? kind + ':' + url : String(results.size);
      const consent=inContext(link) || results.get(key)?.consent === true;
      results.set(key, {url, kind:kind as LegalKind, label, element:link as HTMLAnchorElement,consent});
      }
    } catch { /* Invalid/unsafe links never become fetch requests. */ }
  }
  return [...results.values()];
}
export function observeLegalLinks(document: Document, emit: (links: DiscoveredLink[]) => void): () => void {
  const roots = new Set<ParentNode>();
  const tracked = new Map<Element,DiscoveredLink[]>();
  let signature: string | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const flush = () => {
    timer = undefined;
    for (const [element] of tracked) if (!element.isConnected || [...roots].some(root => root instanceof Node && root.contains(element))) tracked.delete(element);
    for (const root of roots) for (const link of discoverLegalLinks(root, document.baseURI,false)) if (link.element) {
      const scopes=tracked.get(link.element)??[];
      if(!scopes.some(existing=>existing.kind===link.kind&&existing.url===link.url))scopes.push(link);
      tracked.set(link.element,scopes);
    }
    roots.clear();
    const links = new Map<string,DiscoveredLink>();
    for (const link of [...tracked.values()].flat()) {
      const key=link.kind + ':' + link.url;
      links.set(key,{...link,consent:link.consent || links.get(key)?.consent === true});
    }
    const next = JSON.stringify([...links].map(([key,link])=>[key,!!link.consent]).sort());
    if (next !== signature) { signature = next; emit([...links.values()]); }
  };
  const observer = new MutationObserver(records => {
    for (const record of records) {
      if (record.target instanceof Element && record.target.closest('[data-redflag-ui]')) continue;
      if (record.type === 'attributes' || record.type === 'characterData') {
        const target = record.target instanceof Element ? record.target : record.target.parentElement;
        if (target) roots.add(target.closest('form,dialog,[role="dialog"],section') ?? target.parentElement ?? target);
      } else {
        for (const node of record.addedNodes) if (node instanceof Element && !node.matches('[data-redflag-ui]')) roots.add(node.closest('form,dialog,[role="dialog"],section') ?? node);
        if ([...record.addedNodes].some(node=>node instanceof Text) && record.target instanceof Element) roots.add(record.target.closest('form,dialog,[role="dialog"],section') ?? record.target);
        if ([...record.removedNodes].some(node => !(node instanceof Element && node.matches('[data-redflag-ui]'))) && record.target instanceof Element) roots.add(record.target);
      }
    }
    // Collapse a mutation storm into a bounded batch, never rescan the whole page.
    if (roots.size > 40) { const batch = [...roots].slice(-40); roots.clear(); batch.forEach(root => roots.add(root)); }
    if (roots.size && !timer) timer = setTimeout(flush, 150);
  });
  roots.add(document);
  flush();
  observer.observe(document.documentElement, {subtree:true, childList:true, characterData:true, attributes:true, attributeFilter:['href','aria-label','aria-labelledby','title','hidden','aria-hidden']});
  return () => { observer.disconnect(); if (timer) clearTimeout(timer); roots.clear(); };
}
