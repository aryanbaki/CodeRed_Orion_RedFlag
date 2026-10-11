/** Provider output is always text, never HTML. */
export function element<K extends keyof HTMLElementTagNameMap>(tag: K, text?: string, className?: string, doc: Document = document): HTMLElementTagNameMap[K] {
  const node = doc.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}
export function safeLink(label: string, url: string | null | undefined, doc: Document = document): HTMLElement {
  try {
    const parsed = new URL(url ?? '');
    if (!['https:', 'http:'].includes(parsed.protocol) || parsed.username || parsed.password) throw new Error();
    const link = element('a', label, undefined, doc);
    link.href = parsed.href; link.target = '_blank'; link.rel = 'noopener noreferrer';
    return link;
  } catch {return element('span', `${label} (link unavailable)`, undefined, doc);}
}
export function dateLabel(value: string | null | undefined): string {
  if (!value || Number.isNaN(Date.parse(value))) return 'Unknown';
  return new Date(value).toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, ' UTC');
}
