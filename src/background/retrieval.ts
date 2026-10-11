import {abortable, boundedText} from './io.ts';
import {publicDocumentUrl} from '../discovery/urls.ts';
export type RetrievalFailure = 'unsafe-url' | 'permission-denied' | 'authentication-required' | 'redirect-unverified' | 'inaccessible' | 'unsupported-content' | 'oversized' | 'incomplete' | 'timeout' | 'network-error';
export class RetrievalError extends Error {
  reason: RetrievalFailure;
  constructor(reason: RetrievalFailure) { super(reason); this.reason = reason; }
}
export interface Download {url: string; body: string; type: 'html' | 'text'; retrievedAt: string}
export async function retrievePublicDocument(raw: string, permitted: (url: string) => Promise<boolean>, fetcher: typeof fetch = fetch, timeoutMs = 12000): Promise<Download> {
  let url: string;
  try { url = publicDocumentUrl(raw); } catch { throw new RetrievalError('unsafe-url'); }
  if (!await permitted(url)) throw new RetrievalError('permission-denied');
  try {
    const signal = AbortSignal.timeout(timeoutMs);
    const response = await abortable(fetcher(url, {credentials:'omit', redirect:'manual', referrerPolicy:'no-referrer', cache:'no-store', signal}),signal);
    // Fetch exposes opaque redirects to browser extensions. Never follow an
    // uninspectable hop: it could target login, a private network, or a new origin.
    if (response.type === 'opaqueredirect' || (response.status >= 300 && response.status < 400)) throw new RetrievalError('redirect-unverified');
    if ([401,403].includes(response.status)) throw new RetrievalError('authentication-required');
    if (response.status === 206) throw new RetrievalError('incomplete');
    if (!response.ok) throw new RetrievalError('inaccessible');
    if (response.url && response.url !== url) throw new RetrievalError('redirect-unverified');
    const mime = response.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
    if (!['text/html','text/plain'].includes(mime ?? '')) throw new RetrievalError('unsupported-content');
    const body = await boundedText(response,256000,signal);
    if (!body.trim()) throw new RetrievalError('incomplete');
    return {url, body, type:mime === 'text/html' ? 'html' : 'text', retrievedAt:new Date().toISOString()};
  } catch (error) {
    if (error instanceof RetrievalError) throw error;
    if (error instanceof Error && ['oversized','incomplete'].includes(error.message)) throw new RetrievalError(error.message as RetrievalFailure);
    throw new RetrievalError(error instanceof Error && ['TimeoutError','AbortError'].includes(error.name) ? 'timeout' : 'network-error');
  }
}
