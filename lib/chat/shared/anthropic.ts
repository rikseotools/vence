// lib/chat/shared/anthropic.ts
// Cliente Anthropic singleton para el chat (psicotécnicos con razonamiento complejo)

import Anthropic from '@anthropic-ai/sdk'
import { getDb } from '@/db/client'
import { aiApiConfig } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { instrumentAnthropic } from '@/lib/observability/llm'

let anthropicClient: Anthropic | null = null
let cachedApiKey: string | null = null
let cachedModel: string | null = null
let cacheTimestamp = 0
const CACHE_TTL = 1000 * 60 * 30 // 30 minutos

// Fallback de código si la BD no trae default_model. La FUENTE DE VERDAD es
// `ai_api_config.default_model` → cambiar el modelo del chat = UN UPDATE en BD, SIN
// deploy. Este fallback DEBE ser un modelo VÁLIDO: el bug del 09/07 (premium roto 2
// días, 7 usuarios) fue un pinned retirado por Anthropic (claude-sonnet-4-20250514 →
// 404) hardcodeado en código, que solo se podía cambiar redeployando.
export const ANTHROPIC_MODEL = 'claude-sonnet-4-5-20250929'

async function fetchConfig(): Promise<{ apiKey: string; model: string }> {
  const now = Date.now()

  if (cachedApiKey && (now - cacheTimestamp) < CACHE_TTL) {
    return { apiKey: cachedApiKey, model: cachedModel ?? ANTHROPIC_MODEL }
  }

  const result = await getDb()
    .select({
      apiKeyEncrypted: aiApiConfig.apiKeyEncrypted,
      defaultModel: aiApiConfig.defaultModel,
    })
    .from(aiApiConfig)
    .where(and(
      eq(aiApiConfig.provider, 'anthropic'),
      eq(aiApiConfig.isActive, true)
    ))
    .limit(1)

  if (!result[0]?.apiKeyEncrypted) {
    throw new Error('Anthropic API key not configured')
  }

  cachedApiKey = Buffer.from(result[0].apiKeyEncrypted, 'base64').toString('utf-8')
  cachedModel = result[0].defaultModel?.trim() || ANTHROPIC_MODEL
  cacheTimestamp = now

  return { apiKey: cachedApiKey, model: cachedModel }
}

export async function getAnthropic(): Promise<Anthropic> {
  const { apiKey } = await fetchConfig()

  if (!anthropicClient || cachedApiKey !== apiKey) {
    // Instrumentado UNA vez en creación → toda messages.create se observa (tokens/coste/latencia).
    anthropicClient = instrumentAnthropic(new Anthropic({ apiKey }))
  }

  return anthropicClient
}

/**
 * Modelo Anthropic del chat, desde `ai_api_config.default_model` (cache 30 min,
 * fallback al constante `ANTHROPIC_MODEL`). Async porque puede cambiarse en BD sin
 * deploy. Todo call-site del chat que llame a Anthropic debe usar ESTO, no el
 * constante, para heredar esa capacidad.
 */
export async function getAnthropicModel(): Promise<string> {
  const { model } = await fetchConfig()
  return model
}
