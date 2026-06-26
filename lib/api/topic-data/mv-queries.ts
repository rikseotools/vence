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
import { getValidExamPositions } from '@/lib/config/exam-positions'
import { pgIntArray, pgTextArray } from '@/lib/api/sqlArrays'
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
 * @param positionType Position type interno (no slug). Se usa para filtrar las
 *           oficiales por exam_position (EXAM_POSITION_MAP), de modo que el
 *           conteo sea de la PROPIA oposición — coherente con
 *           buildOfficialExamFilter que filtered-questions aplica siempre
 *           (casos Laura/Sergio, 26/05/2026). La MV ya guarda el desglose por
 *           (topic_id, exam_position), así que solo sumamos las posiciones
 *           válidas.
 */
export async function getTopicAggregatesFromMV(
  db: ReturnType<typeof getDb>,
  topicId: string,
  positionType: string,
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

  // Official: solo las preguntas oficiales de la PROPIA oposición
  // (exam_position ∈ EXAM_POSITION_MAP). filtered-questions aplica SIEMPRE
  // buildOfficialExamFilter (casos Laura/Sergio, 26/05/2026), que sirve solo
  // las propias; contar cross-oposición inflaba el label (p.ej. Seg. Social T3
  // "Tribunal Constitucional": 115 cross vs ~1 propia). La MV ya trae el
  // desglose por exam_position, así que filtramos antes de sumar.
  const validPositions = getValidExamPositions(positionType)
  let officialQuestionsCount = 0
  for (const r of officialRows) {
    if (validPositions.includes(r.exam_position)) {
      officialQuestionsCount += Number(r.official_questions)
    }
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

export interface ThemeCount {
  topicNumber: number
  total: number
  official: number
}

/**
 * Versión MULTI-TOPIC para los conteos por tema del configurador
 * (`lib/api/random-test/queries.ts`). Lee `total` (todas) + `official` (solo las
 * oficiales de la PROPIA oposición, por `exam_position`) de las MVs, en vez del
 * join 4-tablas `topics→topic_scope→articles→questions` + `count(DISTINCT)` en
 * vivo (~2s/llamada, mayor consumidor de BD del sistema → ~5ms por lookup índice).
 *
 * Devuelve la MISMA forma que el `countsResult` de la query viva
 * (`{ topicNumber, total, official }[]`), solo temas activos de `positionType`
 * cuyo `topic_number ∈ topicNumbers`, para que el caller no cambie su mapeo.
 *
 * ⚠️ PARIDAD: la MV cuenta con los mismos filtros (`is_active` + `exam_case_id IS
 * NULL`) — verificado 27/28 exacto vs la query viva (la única diferencia es un
 * doble-conteo pre-existente por `topic_scope` solapado, que la MV ya tiene y el
 * temario ya muestra). **NO aplica filtro por tags** → válido para callers SIN
 * `tagFilter` (random-test sí; random-test-data NO, ese conserva la vía viva).
 */
export async function getThemeCountsFromMV(
  db: ReturnType<typeof getDb>,
  positionType: string,
  topicNumbers: number[],
  validPositions: string[],
): Promise<ThemeCount[]> {
  if (topicNumbers.length === 0) return []

  // La MV `topic_official_by_position` guarda `lower(exam_position)`.
  const lowerPositions = validPositions.map((p) => p.toLowerCase())
  const officialExpr =
    lowerPositions.length > 0
      ? sql`COALESCE((SELECT sum(o.official_questions) FROM topic_official_by_position o
              WHERE o.topic_id = t.id AND o.exam_position = ANY(${pgTextArray(lowerPositions)})), 0)`
      : sql`0`

  const result = await db.execute<{ topic_number: number; total: number; official: number } & Record<string, unknown>>(sql`
    SELECT t.topic_number AS topic_number,
           COALESCE((SELECT sum(s.total_questions) FROM topic_law_question_summary s WHERE s.topic_id = t.id), 0)::int AS total,
           ${officialExpr}::int AS official
    FROM topics t
    WHERE t.position_type = ${positionType}
      AND t.is_active = true
      AND t.topic_number = ANY(${pgIntArray(topicNumbers)})
  `)

  const rows = (result as unknown as Array<{ topic_number: number; total: number; official: number }>) ?? []
  return rows.map((r) => ({
    topicNumber: Number(r.topic_number),
    total: Number(r.total),
    official: Number(r.official),
  }))
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
