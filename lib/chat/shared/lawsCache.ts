// lib/chat/shared/lawsCache.ts
// Cache compartido de leyes desde BD para chat (Stats + Search).
//
// Permite resolver menciones de leyes en mensajes del usuario sin hardcodear
// abreviaturas: cualquier ley nueva en BD se detecta automáticamente vía
// keyword matching del campo `name`.
//
// Antes este código vivía en StatsService.ts (slot global 'stats-laws-cache-v1').
// Movido aquí para que SearchDomain también lo aproveche y se evite duplicación.

// Self-hosted PgBouncer (max:8, sano), no Supavisor max:1 → 504. Ver ARCHITECTURE_ROADMAP L17.
import { getPoolerDb } from '@/db/client'
import { laws } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { createGlobalCache } from '@/lib/cache/globalCache'
import { mapSlugToShortName as mapLawSlugToShortName } from '@/lib/lawSlugSync'
import { logger } from './logger'

// ============================================
// STOP WORDS
// ============================================

// Tokens que no aportan señal al matching: artículos, preposiciones, palabras
// estructurales de títulos legales ("Ley", "Real", "Decreto"...) y meses.
const STOP_WORDS = new Set([
  'de', 'del', 'la', 'el', 'las', 'los', 'por', 'que', 'se', 'en', 'al', 'con',
  'para', 'y', 'o', 'a', 'un', 'una', 'su', 'sus', 'lo', 'le', 'les',
  'sobre', 'como', 'cual', 'cuales', 'este', 'esta', 'estos', 'estas',
  'ley', 'real', 'decreto', 'orden', 'organica', 'legislativo',
  'texto', 'refundido', 'aprueba', 'regula', 'reguladora', 'establece',
  'modifica', 'determina', 'dispone', 'materia', 'medidas', 'normas',
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
])

/**
 * Extrae keywords significativos del nombre descriptivo de una ley.
 * Filtra stop words, números puros y tokens cortos.
 */
export function extractKeywords(name: string): string[] {
  return name
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // quitar acentos
    .replace(/[()""".,;:\/\-]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length >= 3)
    .filter(t => !/^\d+$/.test(t))
    .filter(t => !STOP_WORDS.has(t))
}

// ============================================
// CACHE GLOBAL
// ============================================

export interface LawsCacheData {
  slugMap: Map<string, string>           // slug → short_name
  shortNameMap: Map<string, string>      // short_name.toLowerCase() → short_name canónico
  nameKeywords: Array<{ shortName: string; keywords: string[] }>
}

// Cache compartido cross-bundle. Forever — invalidar requiere restart del task.
// Slot renombrado de 'stats-laws-cache-v1' a 'chat-laws-cache-v1' al unificarse
// Stats + Search en este módulo (cold-load tras deploy, igual que un restart).
const _lawsCache = createGlobalCache<LawsCacheData>(
  'chat-laws-cache-v1',
  Number.MAX_SAFE_INTEGER,
)

/**
 * Carga slug → short_name + keywords desde la tabla `laws` en BD.
 * Lazy: se llama desde Stats/Search antes del primer uso. Solo carga una vez.
 *
 * Nota: createGlobalCache.getOrLoad NO dedupea llamadas concurrentes — si 2
 * requests llegan a la vez antes de la primera carga, ambos lanzan la query.
 * Aceptable: ocurre solo al arrancar el task, query rápida (~700 leyes),
 * cache vive forever después.
 */
export async function loadLawsCache(): Promise<void> {
  await _lawsCache.getOrLoad(async () => {
    let data: Array<{ slug: string | null; short_name: string; name: string }>
    try {
      const db = getPoolerDb()
      data = await db
        .select({ slug: laws.slug, short_name: laws.shortName, name: laws.name })
        .from(laws)
        .where(eq(laws.isActive, true))
    } catch (error) {
      logger.warn('Could not load laws cache from DB', { domain: 'shared', error: (error as Error)?.message })
      return { slugMap: new Map(), shortNameMap: new Map(), nameKeywords: [] }
    }

    const slugMap = new Map<string, string>()
    const shortNameMap = new Map<string, string>()
    const nameKeywords: Array<{ shortName: string; keywords: string[] }> = []

    for (const law of data) {
      if (law.slug) {
        slugMap.set(law.slug, law.short_name)
      }
      shortNameMap.set(law.short_name.toLowerCase(), law.short_name)
      if (law.name && law.name !== law.short_name) {
        const keywords = extractKeywords(law.name)
        if (keywords.length > 0) {
          nameKeywords.push({ shortName: law.short_name, keywords })
        }
      }
    }

    logger.info(
      `Laws cache loaded from DB: ${slugMap.size} slugs, ${shortNameMap.size} short_names, ${nameKeywords.length} name keyword sets`,
      { domain: 'shared' }
    )
    return { slugMap, shortNameMap, nameKeywords }
  })
}

/**
 * Vista síncrona del cache (sin disparar carga). Útil para los matchers.
 */
export function peekLawsCache(): LawsCacheData | null {
  return _lawsCache.peek()
}

// ============================================
// RESOLUTORES SÍNCRONOS (requieren cache cargada)
// ============================================

/**
 * Resuelve un slug/alias a short_name canónico.
 * 1. Cache BD (slug → short_name)
 * 2. Cache BD (short_name directo, case-insensitive)
 * 3. lawMappingUtils hardcodeado (fallback)
 */
export function resolveSlug(slug: string): string | null {
  const cached = _lawsCache.peek()
  if (cached) {
    const fromSlug = cached.slugMap.get(slug)
    if (fromSlug) return fromSlug
    const fromSn = cached.shortNameMap.get(slug.toLowerCase())
    if (fromSn) return fromSn
  }
  return mapLawSlugToShortName(slug)
}

/**
 * Devuelve la ÚNICA mejor ley por keyword matching del campo `name` (BD).
 * Para cada ley, calcula matched / total_keywords. Devuelve la de mayor score
 * si supera el umbral mínimo (>= 0.25).
 *
 * Usado por StatsService.extractLawFromMessage (espera 1 resultado).
 */
export function matchLawByNameKeywords(message: string): string | null {
  const cached = _lawsCache.peek()
  if (!cached || cached.nameKeywords.length === 0) return null

  const msgTokens = _tokenize(message)

  let bestMatch: string | null = null
  let bestScore = 0
  let bestMatchedCount = 0

  for (const { shortName, keywords } of cached.nameKeywords) {
    if (keywords.length === 0) continue
    const matched = keywords.filter(kw => msgTokens.has(kw)).length
    if (matched === 0) continue
    const score = matched / keywords.length
    if (score > bestScore || (score === bestScore && matched > bestMatchedCount)) {
      bestScore = score
      bestMatch = shortName
      bestMatchedCount = matched
    }
  }

  return bestScore >= 0.25 ? bestMatch : null
}

/**
 * Devuelve hasta `topN` leyes candidatas por keyword matching del campo `name`.
 * Umbrales por defecto más estrictos que matchLawByNameKeywords para reducir
 * falsos positivos en SearchDomain (que después busca FTS en cada ley):
 *   - matched >= 2     (descarta matches de 1 sola palabra como "Ley X del Gobierno")
 *   - score >= 0.4
 * Resultados ordenados por matched desc, score desc.
 */
export function matchAllLawsByNameKeywords(
  message: string,
  opts: { topN?: number; minMatched?: number; minScore?: number } = {}
): string[] {
  const { topN = 3, minMatched = 2, minScore = 0.4 } = opts

  const cached = _lawsCache.peek()
  if (!cached || cached.nameKeywords.length === 0) return []

  const msgTokens = _tokenize(message)

  const results: Array<{ shortName: string; matched: number; score: number }> = []
  for (const { shortName, keywords } of cached.nameKeywords) {
    if (keywords.length === 0) continue
    const matched = keywords.filter(kw => msgTokens.has(kw)).length
    if (matched < minMatched) continue
    const score = matched / keywords.length
    if (score < minScore) continue
    results.push({ shortName, matched, score })
  }

  results.sort((a, b) => b.matched - a.matched || b.score - a.score)
  return results.slice(0, topN).map(r => r.shortName)
}

// ============================================
// HELPER INTERNO
// ============================================

function _tokenize(message: string): Set<string> {
  const msgNorm = message
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[¿?¡!()""".,;:\/\-]/g, ' ')
  return new Set(msgNorm.split(/\s+/).filter(t => t.length >= 3))
}
