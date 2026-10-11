/** Canonical public document identity. Queries are never forwarded: legal links
 * carrying account/session data require a public, query-free alternative. */
export function publicDocumentUrl(raw: string, base?: string): string {
  const url = new URL(raw, base);
  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.search ||
      (url.port && !['80', '443'].includes(url.port)) || !host.includes('.') ||
      /^[\d.]+$/.test(host) || host.includes(':') ||
      /(^|\.)(localhost|local|internal|lan|home|test|invalid|example)$/.test(host) ||
      /(^|\.)(localtest\.me|lvh\.me|nip\.io|sslip\.io)$/.test(host)) {
    throw new Error('unsafe-url');
  }
  url.hostname = host;
  url.hash = '';
  return url.href;
}
export function exactDomain(host: string, declared: string): boolean {
  try {
    // Exact declared host matching deliberately avoids public-suffix/tenant inference.
    return new URL('https://' + host).hostname === new URL('https://' + declared).hostname &&
      !/[/:?#@]/.test(host + declared) && declared.includes('.');
  } catch { return false; }
}
