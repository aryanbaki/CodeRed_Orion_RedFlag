import {publicDocumentUrl} from './urls.ts';
export type LegalKind = 'terms' | 'privacy' | 'additional';
export interface DiscoveredLink {url: string; kind: LegalKind; label: string; element?: HTMLAnchorElement}
const legal = /\b(terms\s*(?:of\s*(?:service|use)|(?:and|&)\s*conditions)|privacy\s*polic(?:y|ies)|additional\s*terms)\b/i;
const agreement = /\b(sign\s*up|register|create\s*(?:an?\s*)?account|checkout|onboarding|consent|agree|accept|by\s*(?:continuing|proceeding)|get\s*started)\b/i;
function staticText(element: Element): string {
  const copy = element.cloneNode(true) as Element;
  copy.querySelectorAll('input,textarea,select,script,style,[contenteditable], [data-redflag-ui]').forEach(e => e.remove());
  return (copy.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 4000);
}
function inContext(link: Element): boolean {
  let parent: Element | null = link.parentElement;
  for (let depth = 0; parent && depth < 6; depth++, parent = parent.parentElement) {
    if (parent.matches('[data-redflag-ui]')) return false;
    if (parent.matches('form,dialog,[role="dialog"],[role="group"],section,main,body,label,p,div')) {
      // Bound context cloning to avoid repeatedly copying the full document.
      if (parent.querySelectorAll('*').length <= 250 && agreement.test(staticText(parent))) return true;
    }
  }
  return false;
}
/** No values, form state, surrounding page text, or account identifiers leave this function. */
export function discoverLegalLinks(root: ParentNode, base: string, deduplicate = true): DiscoveredLink[] {
  const candidates = Array.from(root.querySelectorAll('a[href]'));
  if (root instanceof Element && root.matches('a[href]')) candidates.unshift(root as HTMLAnchorElement);
  const results = new Map<string, DiscoveredLink>();
  for (const link of candidates.slice(0, 500)) {
    if (link.closest('[data-redflag-ui], [hidden], [aria-hidden="true"]')) continue;
    const names = [staticText(link), link.getAttribute('aria-label') ?? '', link.getAttribute('title') ?? ''];
    const labelled = link.getAttribute('aria-labelledby')?.split(/\s+/).map(id => link.ownerDocument.getElementById(id)).filter(Boolean) as Element[] | undefined;
    if (labelled) names.push(...labelled.map(staticText));
    const match = names.join(' ').match(legal);
    if (!match || !inContext(link)) continue;
    try {
      const url = publicDocumentUrl(link.getAttribute('href')!, base);
      const label = match[0];
      const kind = /privacy/i.test(label) ? 'privacy' : /additional/i.test(label) ? 'additional' : 'terms';
      // A shared URL with distinct scopes is still two agreements.
      results.set(deduplicate ? kind + ':' + url : String(results.size), {url, kind, label, element:link as HTMLAnchorElement});
    } catch { /* Invalid/unsafe links never become fetch requests. */ }
  }
  return [...results.values()];
}
export function observeLegalLinks(document: Document, emit: (links: DiscoveredLink[]) => void): () => void {
  const roots = new Set<ParentNode>();
  const tracked = new Map<Element,DiscoveredLink>();
  let signature = '';
  let timer: ReturnType<typeof setTimeout> | undefined;
  const flush = () => {
    timer = undefined;
    for (const [element] of tracked) if (!element.isConnected || [...roots].some(root => root instanceof Node && root.contains(element))) tracked.delete(element);
    for (const root of roots) for (const link of discoverLegalLinks(root, document.baseURI,false)) if (link.element) tracked.set(link.element,link);
    roots.clear();
    const links = new Map<string,DiscoveredLink>();
    for (const link of tracked.values()) links.set(link.kind + ':' + link.url,link);
    const next = JSON.stringify([...links.keys()].sort());
    if (next !== signature) { signature = next; emit([...links.values()]); }
  };
  const observer = new MutationObserver(records => {
    for (const record of records) {
      if (record.target instanceof Element && record.target.closest('[data-redflag-ui]')) continue;
      if (record.type === 'attributes' || record.type === 'characterData') {
        const target = record.target instanceof Element ? record.target : record.target.parentElement;
        if (target) roots.add(target.closest('form,dialog,[role="dialog"],section') ?? target.parentElement ?? target);
      } else {
        for (const node of record.addedNodes) if (node instanceof Element && !node.matches('[data-redflag-ui]')) roots.add(node);
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
