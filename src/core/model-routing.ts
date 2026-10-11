/** User-approved backups. These select models, never a different credential/profile. */
export const GEMINI_BACKUP_MODELS=['gemini-3.1-flash-lite','gemini-2.5-flash-lite'] as const;
export function validFallbackModels(value:unknown):value is string[] {
 return Array.isArray(value)&&value.length<=2&&value.every(v=>typeof v==='string'&&/^[a-zA-Z0-9._-]{1,100}$/.test(v))&&new Set(value).size===value.length;
}
