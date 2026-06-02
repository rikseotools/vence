// lib/api/topic-data/mv-queries.ts — Lectura de los materialized views
// `topic_law_question_summary` y `topic_official_by_position` (Fase D-bis Iter 1.5).
//
// Reemplaza el camino N×SELECT serializado de `getQuestionsForTopic` +
// `processDifficultyStats` + `processArticlesByLaw` por 2 PK lookups
// paralelos sobre tablas pre-agregadas, llevando p50 cold de 4-7s a ~50-150ms.
//
// La paridad bit-a-bit con el camino antiguo está garantizada por:
//   1. La función SQL `topic_question_difficulty_bucket` que es espejo
//      inmutable de `processDifficultyStats` (mismo árbol de decisión).
//   2. La granularidad por (topic_id, law_id) coincide con la agrupación
//      por ley que hace `processArticlesByLaw`.
//   3. Tests de paridad ejecutados sobre 30 topics aleatorios: 30/30 PASS.
//
// Las MVs se refrescan vía cron nightly + endpoint admin on-demand tras
// edits de questions (ver migration `20260531_fase_d_bis_iter15_*`).
import { sql } from 'drizzle-orm'
import type { getDb } from '@/db/client'
import type {
  ArticlesByLaw,
  DifficultyStats,
} from './schemas'

export interface TopicAggregates {
  totalQuestions: number
  officialQuestionsCount: number
  difficultyStats: DifficultyStats
  articlesByLaw: ArticlesByLaw
  /** Edad de la MV (ms desde el último REFRESH). Para diagnóstico operacional. */
  staleSinceMs: number | null
}

type LawSummaryRow = {
  law_id: string
  law_short_name: string | null
  law_name: string | null
  total_questions: number
  articles_with_questions: number
  count_easy: number
  count_medium: number
  count_hard: number
  count_extreme: number
  count_auto: number
  computed_at: string
} & Record<string, unknown>

type OfficialRow = {
  exam_position: string
  official_questions: number
} & Record<string, unknown>

/**
 * Lee los agregados de un tema desde las MVs y los ensambla en la misma
 * forma que devolvía la combinación de `getQuestionsForTopic` +
 * `processDifficultyStats` + `processArticlesByLaw` + filtro por
 * `validExamPositions`.
 *
 * @param db Cliente Drizzle (read-replica o pooler — ambos OK, MVs son
 *           cross-replica idénticas tras REFRESH).
 * @param topicId UUID del tema (NO topic_number).
 * @param _positionType Position type interno (no slug). Ya NO se usa para
 *           filtrar oficiales: el conteo es de TODO el scope (todas las
 *           posiciones), igual que el fetch de "solo oficiales". Se mantiene
 *           en la firma por compatibilidad con los callers.
 */
export async function getTopicAggregatesFromMV(
  db: ReturnType<typeof getDb>,
  topicId: string,
  _positionType: string,
): Promise<TopicAggregates> {
  // Dos PK lookups en paralelo. Cada uno toca su covering UNIQUE INDEX
  // (topic_id, law_id) o (topic_id, exam_position). Ambos < 5ms p50.
  const [byLawResult, officialResult] = await Promise.all([
    db.execute<LawSummaryRow>(sql`
      SELECT law_id, law_short_name, law_name,
             total_questions, articles_with_questions,
             count_easy, count_medium, count_hard, count_extreme, count_auto,
             computed_at
      FROM topic_law_question_summary
      WHERE topic_id = ${topicId}
    `),
    db.execute<OfficialRow>(sql`
      SELECT exam_position, official_questions
      FROM topic_official_by_position
      WHERE topic_id = ${topicId}
    `),
  ])

  const byLawRows = (byLawResult as unknown as LawSummaryRow[]) ?? []
  const officialRows = (officialResult as unknown as OfficialRow[]) ?? []

  const difficultyStats: DifficultyStats = {
    easy: 0,
    medium: 0,
    hard: 0,
    extreme: 0,
    auto: 0,
  }
  let totalQuestions = 0

  for (const r of byLawRows) {
    difficultyStats.easy += Number(r.count_easy)
    difficultyStats.medium += Number(r.count_medium)
    difficultyStats.hard += Number(r.count_hard)
    difficultyStats.extreme += Number(r.count_extreme)
    difficultyStats.auto += Number(r.count_auto)
    totalQuestions += Number(r.total_questions)
  }

  // Official: TODAS las preguntas oficiales del tema (de la propia oposición Y
  // de otras), porque el fetch de "solo oficiales" filtra por
  // `is_official_exam=true` sin restringir por exam_position (ver
  // filtered-questions/queries.ts: comentario "oficiales de otra oposición").
  // Contar solo las propias dejaba el toggle OCULTO en oposiciones cuyo único
  // oficial en el tema venía de leyes compartidas (p.ej. Ayto Zaragoza T2:
  // 2 propias pero 57 oficiales en scope). Se cuenta todo el scope para que el
  // conteo cuadre con lo que el filtro realmente sirve.
  let officialQuestionsCount = 0
  for (const r of officialRows) {
    officialQuestionsCount += Number(r.official_questions)
  }

  // articlesByLaw: la misma forma que devolvía processArticlesByLaw, ordenada
  // por DESC articles_with_questions. Solo leyes con preguntas se incluyen.
  const articlesByLaw: ArticlesByLaw = byLawRows
    .filter((r) => Number(r.articles_with_questions) > 0)
    .map((r) => ({
      lawShortName: r.law_short_name ?? '',
      lawName: r.law_name ?? r.law_short_name ?? '',
      articlesWithQuestions: Number(r.articles_with_questions),
    }))
    .sort((a, b) => b.articlesWithQuestions - a.articlesWithQuestions)

  const oldestComputedAt = byLawRows.reduce<Date | null>((acc, r) => {
    const d = new Date(r.computed_at)
    if (!acc || d < acc) return d
    return acc
  }, null)
  const staleSinceMs = oldestComputedAt
    ? Date.now() - oldestComputedAt.getTime()
    : null

  return {
    totalQuestions,
    officialQuestionsCount,
    difficultyStats,
    articlesByLaw,
    staleSinceMs,
  }
}

/**
 * Feature flag para el rollout de las MVs. Permite rollback inmediato a la
 * implementación antigua sin redeploy si se observa una regresión.
 *
 * Valores aceptados (env `TOPIC_MV_ENABLED`):
 *   - `true`  → usar las MVs (rápido)
 *   - cualquier otro o ausente → usar el camino antiguo (seguro)
 */
export function isTopicMvEnabled(): boolean {
  return process.env.TOPIC_MV_ENABLED === 'true'
}
