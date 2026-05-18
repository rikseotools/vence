// lib/api/notifications/queries.ts
// Reemplazo tipado de la RPC get_user_problematic_articles_weekly (ver
// database/migrations/2026-04-14-baseline-problematic-articles-rpc.sql).
//
// Diferencia clave respecto al baseline: aplica scope por target_oposicion
// via getAllowedLawIds → impide que un Aux Estado reciba artículos de leyes
// CCAA-específicas (dispute 4e247ddc, Mar Vazquez).

// CANARY self-hosted pooler (Fase 3, 2026-05-10):
// /api/notifications/problematic-articles migrado en oleada 2.
// Read-only con cache + stale-if-error.
import { getReadDb, getPoolerDb } from '@/db/client'

function getProblematicArticlesDb() {
  return process.env.USE_SELF_HOSTED_POOLER === 'true' ? getPoolerDb() : getReadDb()
}
import { testQuestions, tests, articles } from '@/db/schema'
import { and, eq, gte, inArray, isNotNull, sql } from 'drizzle-orm'
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
  // Canary pooler propio si flag ON, replica fallback. Read-only analytics,
  // stale ≤1s aceptable para "weekly performance".
  const db = getProblematicArticlesDb()
  const limit = params.limit ?? 5
  const accuracyMax = params.accuracyMaxPct ?? 60
  const windowDays = params.windowDays ?? 7

  // Scope: derivar positionType de target_oposicion y listar law_ids válidos.
  const scope = await getAllowedLawIds({ userId: params.userId })

  if (scope.lawIds.length === 0) {
    return []
  }

  const sinceExpr = sql`CURRENT_DATE - make_interval(days => ${windowDays})`

  // Pre-resolver article_ids del scope una vez. Filtramos en la query
  // principal por `tq.article_id IN (...)` en lugar de JOIN con articles/laws.
  // Esto preserva la semántica original (ley vigente, no `tq.law_name`
  // histórico que puede tener drift) y permite que el planner use índice
  // por article_id sin romperse al ordenar/agrupar.
  const allowedArticles = await db
    .select({ id: articles.id })
    .from(articles)
    .where(inArray(articles.lawId, scope.lawIds))
  const allowedArticleIds = allowedArticles.map((a) => a.id)

  if (allowedArticleIds.length === 0) {
    return []
  }

  // Mantenemos el INNER JOIN con `tests` para preservar el filtro
  // `is_completed = true` (mismo comportamiento que la RPC baseline:
  // respuestas de tests abandonados no cuentan para "problematic").
  // El resto de datos (user_id, article_id, article_number, law_name)
  // viene denormalizado de test_questions.
  const rows = await db
    .select({
      articleId: testQuestions.articleId,
      articleNumber: testQuestions.articleNumber,
      lawName: testQuestions.lawName,
      totalAttempts: sql<number>`COUNT(*)::int`,
      correctAttempts: sql<number>`SUM(CASE WHEN ${testQuestions.isCorrect} THEN 1 ELSE 0 END)::int`,
      accuracyPct: sql<string>`ROUND((SUM(CASE WHEN ${testQuestions.isCorrect} THEN 1 ELSE 0 END)::numeric / COUNT(*)) * 100, 1)`,
      lastAttemptDate: sql<string | null>`MAX(${testQuestions.createdAt})`,
    })
    .from(testQuestions)
    .innerJoin(tests, eq(testQuestions.testId, tests.id))
    .where(
      and(
        eq(testQuestions.userId, params.userId),
        eq(tests.isCompleted, true),
        gte(testQuestions.createdAt, sinceExpr),
        isNotNull(testQuestions.articleId),
        inArray(testQuestions.articleId, allowedArticleIds)
      )
    )
    .groupBy(testQuestions.articleId, testQuestions.articleNumber, testQuestions.lawName)
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

// Cache: gestionado en el route con Redis stale-while-error (refactor 2026-05-07).
// Antes este archivo exportaba un wrapper con `unstable_cache`, pero su modo
// fail-on-error propagaba 503s en pool blips. Ahora el route usa el patrón
// de theme-stats: getCached/setCached + fallback a stale en timeout.
// Ver app/api/notifications/problematic-articles/route.ts.
