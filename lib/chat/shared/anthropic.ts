// lib/chat/shared/anthropic.ts
// Cliente Anthropic singleton para el chat (psicotécnicos con razonamiento complejo)

import Anthropic from '@anthropic-ai/sdk'
import { getDb } from '@/db/client'
import { aiApiConfig } from '@/db/schema'
import { eq, and } from 'drizzle-orm'

let anthropicClient: Anthropic | null = null
let cachedApiKey: string | null = null
let cacheTimestamp = 0
const CACHE_TTL = 1000 * 60 * 30 // 30 minutos

async function fetchApiKey(): Promise<string> {
  const now = Date.now()

  if (cachedApiKey && (now - cacheTimestamp) < CACHE_TTL) {
    return cachedApiKey
  }

  const result = await getDb()
    .select({ apiKeyEncrypted: aiApiConfig.apiKeyEncrypted })
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
  cacheTimestamp = now

  return cachedApiKey
}

export async function getAnthropic(): Promise<Anthropic> {
  const apiKey = await fetchApiKey()

  if (!anthropicClient || cachedApiKey !== apiKey) {
    anthropicClient = new Anthropic({ apiKey })
  }

  return anthropicClient
}

export const ANTHROPIC_MODEL = 'claude-sonnet-4-20250514'
