import {createHash} from 'node:crypto';
import {isIP} from 'node:net';
import {CONTRACT_VERSION, type AnalyzeRequest} from '../core/contracts.ts';
export class InputError extends Error {}
export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new InputError('Invalid object.');
  return value as Record<string, unknown>;
}
export function keys(value: Record<string, unknown>, allowed: string[]): void {
  if (Object.keys(value).some(k => !allowed.includes(k))) throw new InputError('Unexpected field.');
}
export function string(value: unknown, max: number, min = 1): string {
  if (typeof value !== 'string' || value.trim().length < min || value.length > max) throw new InputError('Invalid string.');
  return value;
}
export function timestamp(value: unknown): string {
  const s = string(value, 40);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(s) || !Number.isFinite(Date.parse(s)) || new Date(s).toISOString() !== s.replace(/Z$/, s.includes('.') ? 'Z' : '.000Z') || Date.parse(s) > Date.now() + 60000) throw new InputError('Invalid timestamp.');
  return s;
}
export function publicUrl(value: unknown): string {
  const s = string(value, 2048);
  let url: URL;
  try {url = new URL(s);} catch {throw new InputError('Invalid public URL.');}
  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  // Never fetch this URL. Restrict metadata to public DNS names, excluding all IP literals.
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.search || url.hash ||
      (url.port && url.port !== '80' && url.port !== '443') || isIP(host) || host.startsWith('[') ||
      !host.includes('.') || /(?:^|\.)(localhost|local|internal|test|invalid|example|onion)$/.test(host) ||
      !/^[a-z0-9.-]+$/.test(host) || host.split('.').some(p => !p || p.startsWith('-') || p.endsWith('-')) || /^\d+$/.test(host.split('.').at(-1)!)) throw new InputError('Invalid public URL.');
  return s;
}
export function validateRequest(value: unknown): AnalyzeRequest {
  const r = object(value); keys(r, ['schemaVersion', 'document']);
  if (r.schemaVersion !== CONTRACT_VERSION) throw new InputError('Unsupported contract.');
  const d = object(r.document); keys(d, ['id', 'kind', 'url', 'text', 'contentHash', 'retrievedAt', 'coverage', 'documentUpdatedAt']);
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(string(d.id, 128)) || typeof d.kind !== 'string' || !['terms', 'privacy', 'additional', 'unknown'].includes(d.kind) ||
      typeof d.coverage !== 'string' || !['complete', 'partial', 'unknown'].includes(d.coverage)) throw new InputError('Unsupported legal document.');
  publicUrl(d.url); timestamp(d.retrievedAt);
  const text = string(d.text, 60000, 12);
  if (typeof d.contentHash !== 'string' || !/^[a-f0-9]{64}$/.test(d.contentHash) || createHash('sha256').update(text, 'utf8').digest('hex') !== d.contentHash) throw new InputError('Document hash mismatch.');
  if (d.documentUpdatedAt !== undefined) timestamp(d.documentUpdatedAt);
  return r as unknown as AnalyzeRequest;
}
