import {validateGeminiConfig, type GeminiConfig} from '../providers/gemini.ts';
export interface ServerConfig extends GeminiConfig { token: string; allowedOrigin: string; port: number }
export function readConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const config = {apiKey:env.GEMINI_API_KEY ?? '',model:env.GEMINI_MODEL ?? '',token:env.REDFLAG_DEMO_TOKEN ?? '',allowedOrigin:env.REDFLAG_ALLOWED_ORIGIN ?? '',port:Number(env.PORT ?? '8787'),timeoutMs:30000,retries:1};
  validateGeminiConfig(config);
  if (!/^[A-Za-z0-9_-]{32,128}$/.test(config.token) || !/^chrome-extension:\/\/[a-p]{32}$/.test(config.allowedOrigin) || !Number.isInteger(config.port) || config.port < 1 || config.port > 65535) throw new Error('Server demo access configuration is missing or invalid.');
  return config;
}
