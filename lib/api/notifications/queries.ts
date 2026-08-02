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

/**
 * Nº de tests COMPLETADOS del usuario. Alimenta el cooldown de las notificaciones
 * de artículos problemáticos (`shouldShowProblematicArticle`). Server-side (id del
 * token) — cierra el `.from('tests')` de cliente de `loadProblematicArticles`.
 * Usa el índice `idx_tests_user_completed`.
 */
export async function getUserCompletedTestsCount(userId: string): Promise<number> {
  const db = getProblematicArticlesDb()
  const rows = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(tests)
    .where(and(eq(tests.userId, userId), eq(tests.isCompleted, true)))
  return rows[0]?.n ?? 0
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

// ============================================================================
// FEED DE LA CAMPANA — avisos por hito de oposición (Fase 8c)
// ============================================================================
//
// ## El defecto que corrige esta sección (T-480, feedback `d7c1bd2a`)
//
// Marta Pérez escribió *«se me ha quedado enganchada esta notificación, no se
// cierra»*. La ✕ **sí** funcionaba: marcaba `read_at` en la fila (el suyo, del
// 15/07 a las 21:51). Lo que fallaba es que el feed devolvía la fila IGUAL, así
// que la notificación seguía en la campana. La cerró y la siguió viendo 18 días.
//
// Es el único feed de la campana que se comportaba así: las impugnaciones se
// filtran server-side por `is_read=false` y las notificaciones inteligentes
// descartan las leídas al construir la lista. Medido el 01/08: **126 avisos ya
// cerrados seguían sirviéndose a 98 usuarios**, el más antiguo desde el 04/06.
//
// ## Por qué el filtro va en SQL y no después
//
// El feed corta a `FEED_AVISOS_LIMIT`. Filtrar en memoria DESPUÉS del corte
// significa que a quien acumule 30 avisos leídos no le llega ninguno de los
// nuevos: el límite se lo habrían comido los cerrados. El orden correcto es
// filtrar y luego cortar.
//
// La fila NO se borra: sigue en la tabla para historial y auditoría. Lo que
// cambia es lo que se SIRVE.

import { userOposicionAlerts } from '@/db/schema'
import { desc, isNull } from 'drizzle-orm'
import { getAdminDb } from '@/db/client'

/** Cuántos avisos como mucho viajan en el feed. */
export const FEED_AVISOS_LIMIT = 30

export type AvisoOposicion = {
  id: string
  oposicionId: string | null
  hitoId: string | null
  titulo: string
  descripcion: string | null
  severity: string | null
  url: string | null
  readAt: Date | string | null
  createdAt: Date | string
}

/**
 * ¿Este aviso sigue en la campana? Regla ÚNICA de visibilidad del feed.
 *
 * PURA y exportada a propósito: es lo que el usuario entiende por «cerrar», y
 * hasta T-480 estaba implícita en una consulta que no la aplicaba. Tenerla con
 * nombre permite testearla y que no vuelva a divergir del filtro de SQL.
 */
export function avisoSigueEnLaCampana(aviso: { readAt: Date | string | null | undefined }): boolean {
  if (aviso.readAt == null) return true
  // Una fecha vacía no es un cierre. Se falla hacia MOSTRAR: enseñar de más un
  // aviso molesta; esconder uno que el usuario nunca cerró le oculta que su
  // oposición se ha movido, y de eso no se entera por ningún otro sitio.
  if (typeof aviso.readAt === 'string' && aviso.readAt.trim() === '') return true
  return false
}

/**
 * Avisos vivos del usuario (los que no ha cerrado), del más nuevo al más viejo.
 *
 * `unreadCount` es la longitud de lo servido: al no viajar ya nada leído, contar
 * aparte sería una segunda verdad sobre el mismo hecho.
 */
export async function getOposicionAlertsFeed(
  userId: string,
): Promise<{ data: AvisoOposicion[]; unreadCount: number }> {
  const db = getAdminDb()
  const rows = await db
    .select({
      id: userOposicionAlerts.id,
      oposicionId: userOposicionAlerts.oposicionId,
      hitoId: userOposicionAlerts.hitoId,
      titulo: userOposicionAlerts.titulo,
      descripcion: userOposicionAlerts.descripcion,
      severity: userOposicionAlerts.severity,
      url: userOposicionAlerts.url,
      readAt: userOposicionAlerts.readAt,
      createdAt: userOposicionAlerts.createdAt,
    })
    .from(userOposicionAlerts)
    .where(and(eq(userOposicionAlerts.userId, userId), isNull(userOposicionAlerts.readAt)))
    .orderBy(desc(userOposicionAlerts.createdAt))
    .limit(FEED_AVISOS_LIMIT)

  // Cinturón: si alguien tocara el WHERE, la regla con nombre sigue mandando.
  const data = (rows as AvisoOposicion[]).filter(avisoSigueEnLaCampana)

  return { data, unreadCount: data.length }
}
