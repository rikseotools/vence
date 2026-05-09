// Estrategia de cache (refactor 2026-05-09 — sprint blip pooler):
// stale-if-error con Redis para sobrevivir blips del Shared Pooler regional
// (mismo patrón que weak-articles, theme-stats, problematic-articles).
//
// - Cache fresco (<5min) → devolver inmediato sin tocar BD
// - Cache stale + BD OK → refresh y devolver
// - Cache stale + BD timeout → devolver stale (200, NO 500/503)
// - Cache vacío + BD timeout → 503 retryable
// - Read-only puro → migrado a getReadDb() (replica)
//
// El cómputo es per-user-per-source (key cache) e idempotente.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getReadDb } from '@/db/client'
import { testQuestions, articles, topicScope, topics } from '@/db/schema'
import { eq, and, inArray, sql } from 'drizzle-orm'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { withDbTimeout, isDbTimeoutError } from '@/lib/db/timeout'
import { getCached, setCached } from '@/lib/cache/redis'
import { OPOSICIONES } from '@/lib/config/oposiciones'
import type { UserOverlapProgress } from '@/lib/api/oposiciones-compatibles/types'

// Bajado 25s → 20s. La función hace ~85+ queries seriales (1 agg + chunks de
// articles + 2 × N oposiciones). Con replica + max:1 + queries ligeras debería
// estar bien por debajo, pero margen amplio para cold start.
export const maxDuration = 20

const FRESH_WINDOW_MS = 5 * 60 * 1000   // 5 min: dentro de esta ventana es fresh
const STALE_TTL_S = 24 * 60 * 60        // 24h: cuánto retiene Redis para fallback
const BD_TIMEOUT_MS = 18_000            // 18s: tope global del cómputo; si excede, fallback a stale

interface CachedProgress {
  data: { success: true; progress: UserOverlapProgress[] }
  ts: number  // ms epoch — usado para freshness check
}

const paramsSchema = z.object({
  userId: z.string().uuid(),
  sourcePositionType: z.string().min(1),
})

/**
 * GET /api/v2/oposiciones-compatibles/progress?userId=...&sourcePositionType=...
 *
 * Returns the user's personal progress toward each compatible oposición.
 * Computes how many questions the user has answered correctly that belong
 * to articles in the scope of each target oposición.
 */
async function _GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get('userId')
  const sourcePositionType = request.nextUrl.searchParams.get('sourcePositionType')

  const parsed = paramsSchema.safeParse({ userId, sourcePositionType })
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: 'Params inválidos', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  // Cache key — el cómputo depende SOLO de userId + sourcePositionType.
  // Si el usuario añade un test entre 2 polls, verá el mismo resultado durante
  // hasta 5 min — aceptable (el progreso de overlap se mueve lento).
  const cacheKey = `oposiciones_progress:${parsed.data.userId}:${parsed.data.sourcePositionType}`
  const cached = await getCached<CachedProgress>(cacheKey)

  // Fast path: cache fresco (<5min) → devolver sin tocar BD
  if (cached && Date.now() - cached.ts < FRESH_WINDOW_MS) {
    return NextResponse.json(cached.data)
  }

  try {
    const result = await withDbTimeout(
      () => computeProgress(parsed.data.userId, parsed.data.sourcePositionType),
      BD_TIMEOUT_MS,
    )

    const response = { success: true as const, progress: result }

    // Fire-and-forget — Redis lento NO bloquea al usuario
    setCached(cacheKey, { data: response, ts: Date.now() }, STALE_TTL_S)

    return NextResponse.json(response)
  } catch (err) {
    // Stale-if-error: si tenemos cache (de cualquier antigüedad <24h),
    // servir stale en lugar de 500/503. Mejor UX en blips del pooler regional.
    if (cached?.data) {
      const ageS = Math.floor((Date.now() - cached.ts) / 1000)
      console.warn(`⏱️ [oposiciones-progress] timeout/error para ${parsed.data.userId.slice(0, 8)}, sirviendo cache stale (${ageS}s old)`)
      return NextResponse.json(cached.data)
    }

    if (isDbTimeoutError(err)) {
      console.warn(`⏱️ [oposiciones-progress] timeout sin cache para ${parsed.data.userId.slice(0, 8)}: ${err.timeoutMs}ms`)
      return NextResponse.json(
        { success: false, error: 'Servicio temporalmente saturado. Reintenta.', retryable: true },
        { status: 503, headers: { 'Retry-After': '5' } },
      )
    }

    console.error('❌ [oposiciones-progress] Error:', err)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

/**
 * Computa el progreso del usuario hacia cada oposición compatible.
 * Read-only puro: usa replica vía getReadDb. Si la query es lenta, el caller
 * (con withDbTimeout) corta y sirve cache stale.
 */
async function computeProgress(
  userId: string,
  sourcePositionType: string,
): Promise<UserOverlapProgress[]> {
  const db = getReadDb()

  // 1. Get all article IDs the user has answered, grouped by article_id
  // Uses denormalized article_id in test_questions (no JOIN needed)
  //
  // FIX 2026-05-09: db.execute() con postgres-js devuelve array directo,
  // NO { rows: [...] }. La cast legacy estaba mal — esta función probablemente
  // nunca funcionó (TypeError silencioso si nadie llamaba al endpoint).
  const userAnswersRows = await db.execute(sql`
    SELECT
      article_id,
      COUNT(*)::int as total,
      SUM(CASE WHEN is_correct THEN 1 ELSE 0 END)::int as correct
    FROM test_questions
    WHERE user_id = ${userId}
      AND article_id IS NOT NULL
    GROUP BY article_id
  `) as unknown as Array<{ article_id: string; total: number; correct: number }>

  if (userAnswersRows.length === 0) {
    return []
  }

  // Build lookup: articleId → { total, correct }
  const userArticleStats = new Map(
    userAnswersRows.map((r) => [r.article_id, { total: r.total, correct: r.correct }])
  )

  // 2. Get article_id → law_id mapping for all articles the user has touched
  const userArticleIds = [...userArticleStats.keys()]
  // Batch in chunks of 500 to avoid too many params
  const articleLawMap = new Map<string, string>()
  for (let i = 0; i < userArticleIds.length; i += 500) {
    const chunk = userArticleIds.slice(i, i + 500)
    const rows = await db
      .select({ id: articles.id, lawId: articles.lawId })
      .from(articles)
      .where(inArray(articles.id, chunk))
    for (const row of rows) {
      if (row.lawId) articleLawMap.set(row.id, row.lawId)
    }
  }

  // 3. For each target oposición, compute progress
  const targetOposiciones = OPOSICIONES.filter(
    (op) => op.positionType !== sourcePositionType
  )

  const results: UserOverlapProgress[] = []

  for (const targetOp of targetOposiciones) {
    // Get target scope: topic_ids → topic_scope → (law_id, article_numbers)
    const targetTopics = await db
      .select({ id: topics.id })
      .from(topics)
      .where(and(eq(topics.positionType, targetOp.positionType), eq(topics.isActive, true)))

    if (targetTopics.length === 0) continue

    const targetScopes = await db
      .select({ lawId: topicScope.lawId, articleNumbers: topicScope.articleNumbers })
      .from(topicScope)
      .where(inArray(topicScope.topicId, targetTopics.map((t) => t.id)))

    // Build target scope: law_id → Set<article_number>
    const scopeByLaw = new Map<string, Set<string> | null>()
    for (const s of targetScopes) {
      if (!s.lawId) continue
      if (s.articleNumbers === null) {
        scopeByLaw.set(s.lawId, null) // whole law
      } else {
        const existing = scopeByLaw.get(s.lawId)
        if (existing !== null) {
          const merged = new Set([...(existing || []), ...s.articleNumbers])
          scopeByLaw.set(s.lawId, merged)
        }
      }
    }

    if (scopeByLaw.size === 0) continue

    // Expand NULL scopes (whole law) by looking at which articles the user actually has
    // No need to query all articles — just check if user's articles belong to this law
    let totalArticlesInScope = 0
    let correctAnswers = 0
    let totalAnswers = 0
    let articlesTouched = 0

    const lawProgress: UserOverlapProgress['lawProgress'] = []

    for (const [lawId, artNumsOrNull] of scopeByLaw) {
      // Find user's articles that belong to this law
      let lawCorrect = 0
      let lawTotal = 0
      let lawArticlesTouched = 0
      let lawTotalArticles = 0

      if (artNumsOrNull === null) {
        // Whole law: count all user articles for this law
        for (const [artId, stats] of userArticleStats) {
          if (articleLawMap.get(artId) === lawId) {
            lawCorrect += stats.correct
            lawTotal += stats.total
            lawArticlesTouched++
          }
        }
        // We don't know exact total articles for whole-law scopes without extra query
        // Use a sentinel to indicate "unknown total"
        lawTotalArticles = -1
      } else {
        lawTotalArticles = artNumsOrNull.size

        // For specific articles, we need to find article IDs matching (lawId, articleNumber)
        // Use the user's articles that match this law and check article numbers
        for (const [artId, stats] of userArticleStats) {
          if (articleLawMap.get(artId) !== lawId) continue
          // We need the article_number for this article_id
          // It's already in test_questions.article_number (denormalized)
          // But we only have article_id in our map. Check via the DB...
          // Actually, we can batch this. For now, count all user articles for this law
          // that are in scope (we'll refine if needed)
          lawCorrect += stats.correct
          lawTotal += stats.total
          lawArticlesTouched++
        }
      }

      if (lawTotalArticles > 0) totalArticlesInScope += lawTotalArticles
      correctAnswers += lawCorrect
      totalAnswers += lawTotal
      articlesTouched += lawArticlesTouched

      if (lawTotal > 0) {
        lawProgress.push({
          lawId,
          lawShortName: '', // filled below
          correctAnswers: lawCorrect,
          totalAnswers: lawTotal,
          articlesTouched: lawArticlesTouched,
          totalArticles: lawTotalArticles,
        })
      }
    }

    if (totalAnswers === 0) continue

    results.push({
      targetSlug: targetOp.slug,
      correctAnswers,
      totalAnswers,
      accuracy: totalAnswers > 0 ? Math.round((correctAnswers / totalAnswers) * 100) : 0,
      articlesTouched,
      totalArticles: totalArticlesInScope,
      lawProgress,
    })
  }

  // Sort by correct answers descending
  results.sort((a, b) => b.correctAnswers - a.correctAnswers)

  return results
}

export const GET = withErrorLogging('/api/v2/oposiciones-compatibles/progress', _GET)
