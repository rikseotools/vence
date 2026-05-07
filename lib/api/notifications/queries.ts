// lib/api/notifications/queries.ts
// Reemplazo tipado de la RPC get_user_problematic_articles_weekly (ver
// database/migrations/2026-04-14-baseline-problematic-articles-rpc.sql).
//
// Diferencia clave respecto al baseline: aplica scope por target_oposicion
// via getAllowedLawIds → impide que un Aux Estado reciba artículos de leyes
// CCAA-específicas (dispute 4e247ddc, Mar Vazquez).

import { getDb } from '@/db/client'
import { articles, laws, testQuestions, tests } from '@/db/schema'
import { and, eq, gte, inArray, isNotNull, sql } from 'drizzle-orm'
import { unstable_cache } from 'next/cache'
import { getAllowedLawIds } from '@/lib/api/oposicion-scope/queries'

export type ProblematicArticle = {
  article_id: string
  article_number: string
  law_name: string
  total_attempts: number
  correct_attempts: number
  accuracy_percentage: number
  last_attempt_date: string | null
  recommendation: string
}

export type GetUserProblematicArticlesWeeklyParams = {
  userId: string
  /** Límite de artículos devueltos. Baseline RPC: 5. */
  limit?: number
  /** Umbral de accuracy. Baseline RPC: <60%. */
  accuracyMaxPct?: number
  /** Ventana en días. Baseline RPC: 7. */
  windowDays?: number
}

function derivRecommendation(accuracy: number): string {
  if (accuracy === 0) return '📚 Repasar teoría urgente'
  if (accuracy < 30) return '⚠️ Necesita más práctica'
  if (accuracy < 50) return '📖 Repasar conceptos'
  return '👍 Casi dominado'
}

export async function getUserProblematicArticlesWeekly(
  params: GetUserProblematicArticlesWeeklyParams
): Promise<ProblematicArticle[]> {
  const db = getDb()
  const limit = params.limit ?? 5
  const accuracyMax = params.accuracyMaxPct ?? 60
  const windowDays = params.windowDays ?? 7

  // Scope: derivar positionType de target_oposicion y listar law_ids válidos.
  const scope = await getAllowedLawIds({ userId: params.userId })

  if (scope.lawIds.length === 0) {
    return []
  }

  const sinceExpr = sql`CURRENT_DATE - make_interval(days => ${windowDays})`

  const rows = await db
    .select({
      articleId: testQuestions.articleId,
      articleNumber: articles.articleNumber,
      lawName: laws.shortName,
      totalAttempts: sql<number>`COUNT(*)::int`,
      correctAttempts: sql<number>`SUM(CASE WHEN ${testQuestions.isCorrect} THEN 1 ELSE 0 END)::int`,
      accuracyPct: sql<string>`ROUND((SUM(CASE WHEN ${testQuestions.isCorrect} THEN 1 ELSE 0 END)::numeric / COUNT(*)) * 100, 1)`,
      lastAttemptDate: sql<string | null>`MAX(${testQuestions.createdAt})`,
    })
    .from(testQuestions)
    .innerJoin(tests, eq(testQuestions.testId, tests.id))
    .innerJoin(articles, eq(testQuestions.articleId, articles.id))
    .innerJoin(laws, eq(articles.lawId, laws.id))
    .where(
      and(
        eq(testQuestions.userId, params.userId),
        eq(tests.isCompleted, true),
        gte(testQuestions.createdAt, sinceExpr),
        isNotNull(testQuestions.articleId),
        inArray(laws.id, scope.lawIds)
      )
    )
    .groupBy(testQuestions.articleId, articles.articleNumber, laws.shortName)
    .having(
      sql`COUNT(*) >= 1 AND ROUND((SUM(CASE WHEN ${testQuestions.isCorrect} THEN 1 ELSE 0 END)::numeric / COUNT(*)) * 100, 1) < ${accuracyMax}`
    )
    .orderBy(
      sql`ROUND((SUM(CASE WHEN ${testQuestions.isCorrect} THEN 1 ELSE 0 END)::numeric / COUNT(*)) * 100, 1) ASC`,
      sql`COUNT(*) DESC`
    )
    .limit(limit)

  return rows
    .filter((r): r is typeof r & { articleId: string; articleNumber: string; lawName: string } =>
      !!r.articleId && !!r.articleNumber && !!r.lawName
    )
    .map((r) => {
      const accuracy = Number(r.accuracyPct)
      return {
        article_id: r.articleId,
        article_number: r.articleNumber,
        law_name: r.lawName,
        total_attempts: Number(r.totalAttempts),
        correct_attempts: Number(r.correctAttempts),
        accuracy_percentage: accuracy,
        last_attempt_date: r.lastAttemptDate,
        recommendation: derivRecommendation(accuracy),
      }
    })
}

// ============================================
// CACHED WRAPPER (2026-05-07 — tag 'problematic-articles')
// ============================================
// El endpoint /api/notifications/problematic-articles tenía 21 errores 503
// críticos en 36h post-fix (covering index commit 068c5e5b) bajo blips del
// pooler Supabase. El covering index reduce query a 47ms warm pero bajo
// pool blip puede acumular > 10s timeout y disparar quick-fail.
//
// Solución: cachear server-side per-userId. Cuando el pooler parpadee,
// el cache responde sin tocar BD → 0 errores user-facing.
//
// Cache key: incluye userId vía args de la función (unstable_cache keys
// automáticamente por args). NO hay cross-oposición leakage porque:
// - userId viene del Bearer token (auth.user.id), no de body untrusted
// - cada cache key es {userId}, datos de un user nunca se sirven a otro
//
// TTL 5 min: balance entre frescura (data es "weekly performance" que no
// cambia en 5 min de relevancia) y reducción de carga BD. Sin invalidación
// explícita — la API es read-mostly y 5 min de staleness es aceptable
// para una vista de "problematic articles last 7 days" (single answer
// no cambia significativamente la lista de 5 problemáticos).
//
// Para invalidación manual (ej. tras script masivo): tag 'problematic-articles'
// en /api/admin/revalidate.
//
// Feature flag: CACHE_PROBLEMATIC_ARTICLES=false → bypass.

const TTL_PROBLEMATIC_ARTICLES = 300 // 5 min

const _cachedGetUserProblematicArticlesWeekly = unstable_cache(
  getUserProblematicArticlesWeekly,
  ['problematic-articles-v1'],
  { revalidate: TTL_PROBLEMATIC_ARTICLES, tags: ['problematic-articles'] },
)

export async function getUserProblematicArticlesWeeklyCached(
  params: GetUserProblematicArticlesWeeklyParams,
): Promise<ProblematicArticle[]> {
  if (process.env.CACHE_PROBLEMATIC_ARTICLES === 'false') {
    return getUserProblematicArticlesWeekly(params)
  }
  return _cachedGetUserProblematicArticlesWeekly(params)
}
