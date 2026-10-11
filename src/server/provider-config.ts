// Server-only provider selection. Additional adapters can use the same validated document boundary.
import {GEMINI_BACKUP_MODELS} from '../core/model-routing.ts';
import {validateGeminiConfig, type GeminiConfig} from '../providers/gemini.ts';
export type ProviderName = 'gemini' | 'openai' | 'anthropic' | 'custom';
export type GeminiProfile = 'default' | 'free' | 'paid';
export interface ActiveProviderConfig extends GeminiConfig {provider:'gemini'; profile:GeminiProfile}
export function readProviderConfig(env: NodeJS.ProcessEnv = process.env): ActiveProviderConfig {
  const provider = env.AI_PROVIDER ?? 'gemini';
  if (provider !== 'gemini') throw new Error('Selected provider adapter is not implemented. Gemini is currently supported.');
  const profile = env.GEMINI_PROFILE ?? 'default';
  if (!['default','free','paid'].includes(profile)) throw new Error('Invalid Gemini profile.');
  const prefix = profile === 'free' ? 'GEMINI_FREE' : profile === 'paid' ? 'GEMINI_PAID' : 'GEMINI';
  // Never fall back from a missing free key to a paid/default key.
  const apiKey = env[`${prefix}_API_KEY`] ?? '';
  const model = env[`${prefix}_MODEL`] || env.GEMINI_MODEL || '';
  const fallbackModels=env.GEMINI_FALLBACK_MODELS===undefined?(model==='gemini-3.5-flash'?[...GEMINI_BACKUP_MODELS]:[]):env.GEMINI_FALLBACK_MODELS.split(',').map(v=>v.trim()).filter(Boolean);
  const result = {fallbackModels,provider:'gemini' as const,profile:profile as GeminiProfile,apiKey,model,timeoutMs:30000,retries:1};
  validateGeminiConfig(result);
  return result;
}
