import type { Finding, PolicyDocument } from '../core/evidence.ts';
export const demoDocument: PolicyDocument = {
  url: 'https://example.com/privacy', capturedAt: '2026-10-11T00:00:00Z',
  text: 'This is a fictional policy for testing. We share account information with advertising partners. We retain account records for five years after closure. We use advertising cookies to track activity across websites.'
};
export function demoFindings(): Finding[] {
  return [
    {category:'sharing', quote:'We share account information with advertising partners.', explanation:'In this fictional example, account information goes to advertising partners.'},
    {category:'retention', quote:'We retain account records for five years after closure.', explanation:'In this fictional example, closing the account does not immediately delete its records.'},
    {category:'tracking', quote:'We use advertising cookies to track activity across websites.', explanation:'In this fictional example, advertising cookies follow activity across websites.'}
  ].map(f => ({...f, category: f.category as Finding['category'], source:'demo', sourceUrl:demoDocument.url}));
}
