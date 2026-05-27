// lib/api/admin-ai-config/getAiApiKey.ts
// Fuente única para obtener la API key de un provider de IA.
//
// Orden de fallback:
//   1. ai_api_config.api_key_encrypted (base64 decoded) — fuente principal.
//      Mantenida desde /admin/ai-config UI. Se actualiza sin redeploy.
//   2. process.env.{OPENAI|ANTHROPIC|GOOGLE_AI}_API_KEY — fallback para dev
//      local o si la BD está caída.
//
// Devuelve null si ningún source tiene la key — el caller decide cómo
// responder (típicamente 503 + log).
//
// Reemplaza el patrón duplicado en topic-review/verify, verify-articles/
// ai-verify, verify-articles/ai-helpers y admin/ai-config/test. Cabo de
// agnosticismo: el código de aplicación NO conoce env vars de provider,
// solo conoce este helper.

import { getConfigByProvider } from './queries'

export type AiProvider = 'openai' | 'anthropic' | 'google'

const ENV_VAR_BY_PROVIDER: Record<AiProvider, string> = {
  openai: 'OPENAI_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
  google: 'GOOGLE_AI_API_KEY',
}

export async function getAiApiKey(provider: AiProvider): Promise<string | null> {
  // 1. BD primero
  try {
    const config = await getConfigByProvider(provider)
    if (config?.apiKeyEncrypted) {
      return Buffer.from(config.apiKeyEncrypted, 'base64').toString('utf-8')
    }
  } catch (err) {
    console.warn(`⚠️ [getAiApiKey] Error leyendo ai_api_config para ${provider}:`, err)
    // No throw — pasamos al fallback env
  }

  // 2. Fallback env
  const envVarName = ENV_VAR_BY_PROVIDER[provider]
  return process.env[envVarName] ?? null
}
