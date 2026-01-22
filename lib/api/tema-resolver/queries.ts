// lib/api/tema-resolver/queries.ts - Queries Drizzle para resolución de tema
// OPTIMIZADO para escalar a 100k+ usuarios
import { getDb } from '@/db/client'
import { topics, topicScope, questions, articles, laws } from '@/db/schema'
import { eq, and, sql, inArray } from 'drizzle-orm'
import type {
  ResolveTemaByArticleRequest,
  ResolveTemaResponse,
  ResolveTemasBatchRequest,
  ResolveTemasBatchResponse,
  PositionType,
  OposicionId,
} from './schemas'
import { OPOSICION_TO_POSITION_TYPE } from './schemas'

// ============================================
// CACHE LRU CON LÍMITE DE TAMAÑO
// ============================================

const CACHE_MAX_SIZE = 10000 // Máximo 10k entradas
const CACHE_TTL = 5 * 60 * 1000 // 5 minutos

type CacheEntry = { data: ResolveTemaResponse; timestamp: number }

class LRUCache {
  private cache = new Map<string, CacheEntry>()
  private maxSize: number

  constructor(maxSize: number) {
    this.maxSize = maxSize
  }

  get(key: string): CacheEntry | undefined {
    const entry = this.cache.get(key)
    if (entry) {
      // Move to end (most recently used)
      this.cache.delete(key)
      this.cache.set(key, entry)
    }
    return entry
  }

  set(key: string, value: CacheEntry): void {
    // Delete if exists (to update order)
    if (this.cache.has(key)) {
      this.cache.delete(key)
    }
    // Evict oldest if at capacity
    while (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value
      if (firstKey) this.cache.delete(firstKey)
    }
    this.cache.set(key, value)
  }

  delete(key: string): void {
    this.cache.delete(key)
  }

  clear(): void {
    this.cache.clear()
  }

  get size(): number {
    return this.cache.size
  }

  keys(): string[] {
    return Array.from(this.cache.keys())
  }
}

const temaCache = new LRUCache(CACHE_MAX_SIZE)

/**
 * Genera una clave de cache única para la consulta
 */
function getCacheKey(
  questionId?: string | null,
  articleId?: string | null,
  articleNumber?: string | null,
  lawId?: string | null,
  positionType?: string
): string {
  return `tema:${questionId || ''}:${articleId || ''}:${articleNumber || ''}:${lawId || ''}:${positionType || ''}`
}

/**
 * Resuelve el tema_number para una pregunta/artículo basándose en topic_scope
 *
 * Flujo de resolución:
 * 1. Si hay questionId → obtener primary_article_id de la pregunta
 * 2. Si hay articleId → obtener law_id y article_number
 * 3. Si hay articleNumber + lawId → usar directamente
 * 4. Buscar en topic_scope el tema que incluye esa ley y artículo
 * 5. Filtrar por position_type (oposición del usuario)
 */
export async function resolveTemaByArticle(
  params: ResolveTemaByArticleRequest
): Promise<ResolveTemaResponse> {
  try {
    const positionType = OPOSICION_TO_POSITION_TYPE[params.oposicionId || 'auxiliar_administrativo_estado']

    // Verificar cache
    const cacheKey = getCacheKey(
      params.questionId,
      params.articleId,
      params.articleNumber,
      params.lawId,
      positionType
    )

    const cached = temaCache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return { ...cached.data, cached: true } as ResolveTemaResponse
    }

    const db = getDb()

    let lawId: string | null = params.lawId || null
    let articleNumber: string | null = params.articleNumber || null
    let articleId: string | null = params.articleId || null

    // PASO 1: Si tenemos questionId, obtener el artículo de la pregunta
    if (params.questionId) {
      const questionResult = await db
        .select({
          primaryArticleId: questions.primaryArticleId,
        })
        .from(questions)
        .where(eq(questions.id, params.questionId))
        .limit(1)

      if (!questionResult.length || !questionResult[0].primaryArticleId) {
        const response: ResolveTemaResponse = {
          success: false,
          temaNumber: null,
          reason: 'question_not_found',
          error: `Pregunta ${params.questionId} no encontrada o sin artículo vinculado`,
        }
        return response
      }

      articleId = questionResult[0].primaryArticleId
    }

    // PASO 2: Si tenemos articleId, obtener law_id y article_number
    if (articleId) {
      const articleResult = await db
        .select({
          lawId: articles.lawId,
          articleNumber: articles.articleNumber,
        })
        .from(articles)
        .where(eq(articles.id, articleId))
        .limit(1)

      if (!articleResult.length) {
        const response: ResolveTemaResponse = {
          success: false,
          temaNumber: null,
          reason: 'article_not_found',
          error: `Artículo ${articleId} no encontrado`,
        }
        return response
      }

      lawId = articleResult[0].lawId
      articleNumber = articleResult[0].articleNumber
    }

    // PASO 3: Si tenemos lawShortName pero no lawId, buscar la ley
    if (!lawId && params.lawShortName) {
      const lawResult = await db
        .select({ id: laws.id })
        .from(laws)
        .where(eq(laws.shortName, params.lawShortName))
        .limit(1)

      if (lawResult.length) {
        lawId = lawResult[0].id
      }
    }

    // Validar que tenemos los datos necesarios
    if (!lawId) {
      const response: ResolveTemaResponse = {
        success: false,
        temaNumber: null,
        reason: 'law_not_found',
        error: 'No se pudo determinar la ley del artículo',
      }
      return response
    }

    // PASO 4: Buscar en topic_scope el tema que incluye esta ley y artículo
    // Primero intentar con artículo específico
    if (articleNumber) {
      const scopeResult = await db
        .select({
          topicId: topicScope.topicId,
          topicNumber: topics.topicNumber,
          topicTitle: topics.title,
          positionType: topics.positionType,
        })
        .from(topicScope)
        .innerJoin(topics, eq(topicScope.topicId, topics.id))
        .where(and(
          eq(topicScope.lawId, lawId),
          eq(topics.positionType, positionType),
          eq(topics.isActive, true),
          // Buscar donde article_numbers contiene el artículo específico
          sql`${topicScope.articleNumbers} @> ARRAY[${articleNumber}]::text[]`
        ))
        .limit(1)

      if (scopeResult.length) {
        const response: ResolveTemaResponse = {
          success: true,
          temaNumber: scopeResult[0].topicNumber,
          topicId: scopeResult[0].topicId,
          topicTitle: scopeResult[0].topicTitle || undefined,
          positionType: scopeResult[0].positionType as PositionType,
          resolvedVia: params.questionId ? 'question' : (params.articleId ? 'article' : 'article_number'),
        }

        // Guardar en cache
        temaCache.set(cacheKey, { data: response, timestamp: Date.now() })

        return response
      }
    }

    // PASO 5: Si no encontramos con artículo específico, buscar leyes completas (article_numbers IS NULL)
    const fullLawScopeResult = await db
      .select({
        topicId: topicScope.topicId,
        topicNumber: topics.topicNumber,
        topicTitle: topics.title,
        positionType: topics.positionType,
      })
      .from(topicScope)
      .innerJoin(topics, eq(topicScope.topicId, topics.id))
      .where(and(
        eq(topicScope.lawId, lawId),
        eq(topics.positionType, positionType),
        eq(topics.isActive, true),
        sql`${topicScope.articleNumbers} IS NULL`
      ))
      .limit(1)

    if (fullLawScopeResult.length) {
      const response: ResolveTemaResponse = {
        success: true,
        temaNumber: fullLawScopeResult[0].topicNumber,
        topicId: fullLawScopeResult[0].topicId,
        topicTitle: fullLawScopeResult[0].topicTitle || undefined,
        positionType: fullLawScopeResult[0].positionType as PositionType,
        resolvedVia: 'full_law',
      }

      // Guardar en cache
      temaCache.set(cacheKey, { data: response, timestamp: Date.now() })

      return response
    }

    // No se encontró tema para esta combinación
    const response: ResolveTemaResponse = {
      success: false,
      temaNumber: null,
      reason: 'no_topic_scope_match',
      error: `No se encontró tema para ley ${lawId}, artículo ${articleNumber || 'N/A'}, oposición ${positionType}`,
    }
    return response

  } catch (error) {
    console.error('❌ [TemaResolver] Error resolviendo tema:', error)
    return {
      success: false,
      temaNumber: null,
      reason: 'no_topic_scope_match',
      error: error instanceof Error ? error.message : 'Error desconocido',
    }
  }
}

/**
 * Resuelve temas para múltiples preguntas en batch (OPTIMIZADO)
 *
 * Usa UN SOLO query SQL con JOINs para resolver todas las preguntas
 * en lugar de N queries individuales. Escala a 100k+ usuarios.
 */
export async function resolveTemasBatch(
  params: ResolveTemasBatchRequest
): Promise<ResolveTemasBatchResponse> {
  const positionType = OPOSICION_TO_POSITION_TYPE[params.oposicionId || 'auxiliar_administrativo_estado']

  // Separar preguntas por tipo de input
  const questionIds: string[] = []
  const articleIds: string[] = []
  const questionIdToIndex = new Map<string, number>()
  const articleIdToIndex = new Map<string, number>()

  params.questions.forEach((q, index) => {
    if (q.questionId) {
      questionIds.push(q.questionId)
      questionIdToIndex.set(q.questionId, index)
    } else if (q.articleId) {
      articleIds.push(q.articleId)
      articleIdToIndex.set(q.articleId, index)
    }
  })

  const results: ResolveTemasBatchResponse['results'] = params.questions.map((_, index) => ({
    index,
    temaNumber: null,
    topicId: null,
  }))

  let resolved = 0
  let notFound = params.questions.length

  try {
    const db = getDb()

    // QUERY 1: Resolver por questionIds (un solo query para todas las preguntas)
    if (questionIds.length > 0) {
      // Convertir array a formato PostgreSQL ARRAY literal
      const questionIdsArray = sql.raw(`ARRAY['${questionIds.join("','")}']::uuid[]`)

      // Query optimizado con JOINs - resuelve todas las preguntas en UN query
      const questionResults = await db.execute<{question_id: string; topic_id: string; topic_number: number}>(sql`
        WITH question_articles AS (
          SELECT q.id as question_id, a.id as article_id, a.law_id, a.article_number
          FROM ${questions} q
          JOIN ${articles} a ON q.primary_article_id = a.id
          WHERE q.id = ANY(${questionIdsArray})
        )
        SELECT DISTINCT ON (qa.question_id)
          qa.question_id,
          t.id as topic_id,
          t.topic_number
        FROM question_articles qa
        JOIN ${topicScope} ts ON ts.law_id = qa.law_id
        JOIN ${topics} t ON ts.topic_id = t.id
          AND t.position_type = ${positionType}
          AND t.is_active = true
        WHERE ts.article_numbers @> ARRAY[qa.article_number]::text[]
           OR ts.article_numbers IS NULL
        ORDER BY qa.question_id,
          CASE WHEN ts.article_numbers IS NOT NULL THEN 0 ELSE 1 END
      `)

      // Procesar resultados (drizzle execute retorna array directamente)
      for (const row of questionResults) {
        const index = questionIdToIndex.get(row.question_id)
        if (index !== undefined) {
          results[index] = {
            index,
            temaNumber: row.topic_number,
            topicId: row.topic_id,
          }
          resolved++
          notFound--

          // Guardar en cache
          const cacheKey = getCacheKey(row.question_id, null, null, null, positionType)
          temaCache.set(cacheKey, {
            data: {
              success: true,
              temaNumber: row.topic_number,
              topicId: row.topic_id,
              positionType: positionType as PositionType,
              resolvedVia: 'question',
            },
            timestamp: Date.now(),
          })
        }
      }
    }

    // QUERY 2: Resolver por articleIds (un solo query para todos los artículos)
    if (articleIds.length > 0) {
      // Convertir array a formato PostgreSQL ARRAY literal
      const articleIdsArray = sql.raw(`ARRAY['${articleIds.join("','")}']::uuid[]`)

      const articleResults = await db.execute<{article_id: string; topic_id: string; topic_number: number}>(sql`
        WITH article_data AS (
          SELECT a.id as article_id, a.law_id, a.article_number
          FROM ${articles} a
          WHERE a.id = ANY(${articleIdsArray})
        )
        SELECT DISTINCT ON (ad.article_id)
          ad.article_id,
          t.id as topic_id,
          t.topic_number
        FROM article_data ad
        JOIN ${topicScope} ts ON ts.law_id = ad.law_id
        JOIN ${topics} t ON ts.topic_id = t.id
          AND t.position_type = ${positionType}
          AND t.is_active = true
        WHERE ts.article_numbers @> ARRAY[ad.article_number]::text[]
           OR ts.article_numbers IS NULL
        ORDER BY ad.article_id,
          CASE WHEN ts.article_numbers IS NOT NULL THEN 0 ELSE 1 END
      `)

      // Procesar resultados (drizzle execute retorna array directamente)
      for (const row of articleResults) {
        const index = articleIdToIndex.get(row.article_id)
        if (index !== undefined) {
          results[index] = {
            index,
            temaNumber: row.topic_number,
            topicId: row.topic_id,
          }
          resolved++
          notFound--

          // Guardar en cache
          const cacheKey = getCacheKey(null, row.article_id, null, null, positionType)
          temaCache.set(cacheKey, {
            data: {
              success: true,
              temaNumber: row.topic_number,
              topicId: row.topic_id,
              positionType: positionType as PositionType,
              resolvedVia: 'article',
            },
            timestamp: Date.now(),
          })
        }
      }
    }

  } catch (error) {
    console.error('❌ [TemaResolver Batch] Error:', error)
  }

  return {
    success: resolved > 0,
    results,
    resolved,
    notFound,
  }
}

/**
 * Resuelve temas para múltiples questionIds en UN SOLO query
 * Versión ultra-optimizada para usar desde initExamQuestions
 * Retorna Map<questionId, temaNumber>
 */
export async function resolveTemasBatchByQuestionIds(
  questionIds: string[],
  oposicionId: OposicionId = 'auxiliar_administrativo_estado'
): Promise<Map<string, number>> {
  if (questionIds.length === 0) return new Map()

  const positionType = OPOSICION_TO_POSITION_TYPE[oposicionId]
  const result = new Map<string, number>()

  try {
    const db = getDb()

    // Convertir array a formato PostgreSQL ARRAY literal
    const questionIdsArray = sql.raw(`ARRAY['${questionIds.join("','")}']::uuid[]`)

    // UN SOLO query para resolver TODAS las preguntas
    const queryResult = await db.execute<{question_id: string; topic_number: number}>(sql`
      WITH question_articles AS (
        SELECT q.id as question_id, a.law_id, a.article_number
        FROM ${questions} q
        JOIN ${articles} a ON q.primary_article_id = a.id
        WHERE q.id = ANY(${questionIdsArray})
          AND q.primary_article_id IS NOT NULL
      )
      SELECT DISTINCT ON (qa.question_id)
        qa.question_id,
        t.topic_number
      FROM question_articles qa
      JOIN ${topicScope} ts ON ts.law_id = qa.law_id
      JOIN ${topics} t ON ts.topic_id = t.id
        AND t.position_type = ${positionType}
        AND t.is_active = true
      WHERE ts.article_numbers @> ARRAY[qa.article_number]::text[]
         OR ts.article_numbers IS NULL
      ORDER BY qa.question_id,
        CASE WHEN ts.article_numbers IS NOT NULL THEN 0 ELSE 1 END
    `)

    for (const row of queryResult) {
      result.set(row.question_id, row.topic_number)
    }

    console.log(`✅ [TemaResolver Batch] Resueltos ${result.size}/${questionIds.length} temas en 1 query`)

  } catch (error) {
    console.error('❌ [TemaResolver Batch] Error:', error)
  }

  return result
}

/**
 * Resuelve tema de forma simplificada para uso desde JavaScript (testAnswers.js)
 * Retorna solo el número de tema o null
 */
export async function resolveTemaNumber(
  questionId?: string | null,
  articleId?: string | null,
  articleNumber?: string | null,
  lawId?: string | null,
  lawShortName?: string | null,
  oposicionId: OposicionId = 'auxiliar_administrativo_estado'
): Promise<number | null> {
  const result = await resolveTemaByArticle({
    questionId,
    articleId,
    articleNumber,
    lawId,
    lawShortName,
    oposicionId,
  })

  return result.success ? result.temaNumber : null
}

/**
 * Invalida el cache para una clave específica o todo el cache
 */
export function invalidateTemaCache(cacheKey?: string): void {
  if (cacheKey) {
    temaCache.delete(cacheKey)
  } else {
    temaCache.clear()
  }
}

/**
 * Obtiene estadísticas del cache
 */
export function getTemaCacheStats(): { size: number; keys: string[] } {
  return {
    size: temaCache.size,
    keys: Array.from(temaCache.keys()),
  }
}
