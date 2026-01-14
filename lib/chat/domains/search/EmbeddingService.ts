// lib/chat/domains/search/EmbeddingService.ts
// Servicio para generar embeddings con OpenAI

import { getOpenAI, EMBEDDING_MODEL, EMBEDDING_DIMENSIONS } from '../../shared/openai'
import { logger } from '../../shared/logger'
import { OpenAIError } from '../../shared/errors'
import type { EmbeddingResult } from '../../core/types'

// Cache de embeddings para evitar llamadas repetidas
const embeddingCache = new Map<string, { embedding: number[]; timestamp: number }>()
const CACHE_TTL = 1000 * 60 * 60 // 1 hora

/**
 * Genera un embedding para un texto
 */
export async function generateEmbedding(text: string): Promise<EmbeddingResult> {
  // Normalizar y limpiar el texto
  const normalizedText = normalizeText(text)

  // Verificar cache
  const cached = embeddingCache.get(normalizedText)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    logger.debug('Embedding from cache', { domain: 'search' })
    return {
      embedding: cached.embedding,
      model: EMBEDDING_MODEL,
      tokens: 0,
    }
  }

  try {
    const openai = await getOpenAI()

    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: normalizedText.substring(0, 8000), // Límite seguro
    })

    const embedding = response.data[0].embedding
    const tokens = response.usage?.total_tokens || 0

    // Guardar en cache
    embeddingCache.set(normalizedText, {
      embedding,
      timestamp: Date.now(),
    })

    logger.debug('Embedding generated', {
      domain: 'search',
      tokens,
      textLength: normalizedText.length,
    })

    return {
      embedding,
      model: EMBEDDING_MODEL,
      tokens,
    }
  } catch (error) {
    logger.error('Error generating embedding', error, { domain: 'search' })
    throw new OpenAIError(
      'Error generando embedding',
      error instanceof Error ? error : undefined
    )
  }
}

/**
 * Genera embeddings para múltiples textos en batch
 */
export async function generateEmbeddingsBatch(texts: string[]): Promise<EmbeddingResult[]> {
  if (texts.length === 0) return []

  // Normalizar textos
  const normalizedTexts = texts.map(normalizeText)

  // Separar los que están en cache de los que no
  const results: (EmbeddingResult | null)[] = normalizedTexts.map(text => {
    const cached = embeddingCache.get(text)
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return {
        embedding: cached.embedding,
        model: EMBEDDING_MODEL,
        tokens: 0,
      }
    }
    return null
  })

  // Obtener los índices y textos que necesitan embedding
  const uncachedIndices: number[] = []
  const uncachedTexts: string[] = []
  results.forEach((result, i) => {
    if (!result) {
      uncachedIndices.push(i)
      uncachedTexts.push(normalizedTexts[i].substring(0, 8000))
    }
  })

  // Si todos están en cache, retornar
  if (uncachedTexts.length === 0) {
    return results as EmbeddingResult[]
  }

  try {
    const openai = await getOpenAI()

    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: uncachedTexts,
    })

    // Asignar resultados y actualizar cache
    response.data.forEach((item, i) => {
      const originalIndex = uncachedIndices[i]
      const text = normalizedTexts[originalIndex]

      embeddingCache.set(text, {
        embedding: item.embedding,
        timestamp: Date.now(),
      })

      results[originalIndex] = {
        embedding: item.embedding,
        model: EMBEDDING_MODEL,
        tokens: Math.floor((response.usage?.total_tokens || 0) / uncachedTexts.length),
      }
    })

    logger.debug('Batch embeddings generated', {
      domain: 'search',
      total: texts.length,
      cached: texts.length - uncachedTexts.length,
      generated: uncachedTexts.length,
    })

    return results as EmbeddingResult[]
  } catch (error) {
    logger.error('Error generating batch embeddings', error, { domain: 'search' })
    throw new OpenAIError(
      'Error generando embeddings en batch',
      error instanceof Error ? error : undefined
    )
  }
}

/**
 * Normaliza texto para embedding
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Quitar acentos para cache key
}

/**
 * Limpia el cache de embeddings
 */
export function clearEmbeddingCache(): void {
  embeddingCache.clear()
  logger.debug('Embedding cache cleared', { domain: 'search' })
}

/**
 * Obtiene estadísticas del cache
 */
export function getEmbeddingCacheStats(): { size: number; oldestAge: number } {
  let oldestTimestamp = Date.now()
  embeddingCache.forEach(({ timestamp }) => {
    if (timestamp < oldestTimestamp) {
      oldestTimestamp = timestamp
    }
  })

  return {
    size: embeddingCache.size,
    oldestAge: Date.now() - oldestTimestamp,
  }
}

// Re-exportar constantes útiles
export { EMBEDDING_MODEL, EMBEDDING_DIMENSIONS }
