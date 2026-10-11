export const categories = ['sharing', 'retention', 'tracking'] as const;
export type Category = typeof categories[number];
export interface PolicyDocument {
  url: string;
  text: string;
  capturedAt: string;
}
export interface Finding {
  category: Category;
  explanation: string;
  quote: string;
  source: 'demo' | 'gemini';
  sourceUrl: string;
}
export function validateDocument(value: PolicyDocument): void {
  const url = new URL(value.url);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password)
    throw new Error('Open a public HTTP or HTTPS policy page.');
  if (!value.text.trim()) throw new Error('No policy text found. Select the policy text and try again.');
  if (value.text.length > 60000) throw new Error('Text exceeds 60,000 characters. Select a smaller passage; it will be a partial review.');
}
export function validateFindings(raw: unknown, document: PolicyDocument): Finding[] {
  validateDocument(document);
  if (!Array.isArray(raw) || raw.length > 30) throw new Error('Invalid findings response.');
  return raw.map((value: unknown) => {
    if (!value || typeof value !== 'object') throw new Error('Invalid finding.');
    const f = value as Record<string, unknown>;
    if (!categories.includes(f.category as Category) || typeof f.explanation !== 'string' || !f.explanation.trim() || f.explanation.length > 2000 || typeof f.quote !== 'string' || f.quote.trim().length < 12 || !document.text.includes(f.quote))
      throw new Error('A finding is missing valid source evidence.');
    return {category: f.category as Category, explanation: f.explanation, quote: f.quote, source: 'gemini', sourceUrl: document.url};
  });
}
export function prioritize(findings: Finding[], selected: Category[]): Finding[] {
  return [...findings].sort((a,b) => Number(selected.includes(b.category)) - Number(selected.includes(a.category)));
}
export function matchesDomain(hostname: string, domain: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, '');
  const target = domain.toLowerCase().replace(/\.$/, '');
  return Boolean(target) && (host === target || host.endsWith('.' + target));
}
