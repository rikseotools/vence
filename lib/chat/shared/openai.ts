// lib/chat/shared/openai.ts
// Cliente OpenAI singleton para el chat

import OpenAI from 'openai'
import { getDb } from '@/db/client'
import { aiApiConfig } from '@/db/schema'
import { eq, and } from 'drizzle-orm'

// Singleton
let openaiClient: OpenAI | null = null
let cachedApiKey: string | null = null
let cacheTimestamp = 0
const CACHE_TTL = 1000 * 60 * 30 // 30 minutos

/**
 * Obtener API key de OpenAI desde la base de datos
 */
async function fetchApiKey(): Promise<string> {
  const now = Date.now()

  // Usar cache si es válido
  if (cachedApiKey && (now - cacheTimestamp) < CACHE_TTL) {
    return cachedApiKey
  }

  const result = await getDb()
    .select({ apiKeyEncrypted: aiApiConfig.apiKeyEncrypted })
    .from(aiApiConfig)
    .where(and(
      eq(aiApiConfig.provider, 'openai'),
      eq(aiApiConfig.isActive, true)
    ))
    .limit(1)

  if (!result[0]?.apiKeyEncrypted) {
    throw new Error('OpenAI API key not configured')
  }

  // Decodificar API key
  cachedApiKey = Buffer.from(result[0].apiKeyEncrypted, 'base64').toString('utf-8')
  cacheTimestamp = now

  return cachedApiKey
}

/**
 * Obtener cliente OpenAI configurado
 */
export async function getOpenAI(): Promise<OpenAI> {
  const apiKey = await fetchApiKey()

  // Crear nuevo cliente si la key cambió o no existe
  if (!openaiClient || cachedApiKey !== apiKey) {
    openaiClient = new OpenAI({ apiKey })
  }

  return openaiClient
}

/**
 * Modelo de embeddings por defecto
 */
export const EMBEDDING_MODEL = 'text-embedding-3-small'
export const EMBEDDING_DIMENSIONS = 1536

/**
 * Modelo de chat por defecto
 */
export const CHAT_MODEL = 'gpt-4o-mini'
export const CHAT_MODEL_PREMIUM = 'gpt-4o'
