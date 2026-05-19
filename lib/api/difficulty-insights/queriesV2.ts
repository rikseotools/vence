// lib/api/difficulty-insights/queriesV2.ts
//
// Queries directas a user_question_history_v2 (lookup PK <10ms en lugar de
// scan masivo de test_questions). Mismo schema de retorno que las RPCs v1.
//
// Diseño: cada función tiene la MISMA firma que su equivalente v1. El switch
// se hace en queries.ts vía feature flag USE_UQH_V2_PCT (% de usuarios).
//
// Bug detectado 2026-05-19: las RPCs v1 (get_struggling_questions etc.)
// timeoutaban para heavy users con 33k+ test_questions (Nila → 8s timeout).
// Validación shadow (1h tráfico real, top 10 heavy users): v2 = ground truth
// EXACTAMENTE en 10/10 (v1 inflado +74.812 attempts globales por doble
// contabilización ya parcheada en commit c812f02a).
//
// Rollback: setear USE_UQH_V2_PCT=0 → todos vuelven a v1 sin redeploy.

import type { getDb } from '@/db/client'
import { sql } from 'drizzle-orm'
import type {
  DifficultyMetrics,
  PersonalBreakdown,
  QuestionResult,
  ProgressTrends,
} from './schemas'

// Métricas globales del usuario desde user_question_history_v2.
// Reemplaza RPC get_user_difficulty_metrics (5.4s para Nila → <10ms).
export async function getMetricsV2(
  db: ReturnType<typeof getDb>,
  userId: string,
): Promise<DifficultyMetrics> {
  const result = await db.execute(sql`
    SELECT
      COUNT(*)::int AS total_questions_attempted,
      COUNT(*) FILTER (WHERE success_rate >= 0.8 AND total_attempts >= 2)::int AS questions_mastered,
      COUNT(*) FILTER (WHERE success_rate < 0.4 AND total_attempts >= 2)::int AS questions_struggling,
      COALESCE(ROUND(AVG((1 - success_rate) * 100)::numeric, 1), 0)::float AS avg_personal_difficulty
    FROM user_question_history_v2
    WHERE user_id = ${userId}::uuid
  `)
  const row = (result as Record<string, unknown>[])[0]
  return {
    totalQuestionsAttempted: Number(row?.total_questions_attempted) || 0,
    questionsMastered: Number(row?.questions_mastered) || 0,
    questionsStruggling: Number(row?.questions_struggling) || 0,
    avgPersonalDifficulty: Number(row?.avg_personal_difficulty) || 0,
    accuracyTrend: 'stable',
  }
}

// Preguntas con peor rendimiento — reemplaza get_struggling_questions
// (TIMEOUT 8s para Nila → <50ms).
export async function getStrugglingQuestionsV2(
  db: ReturnType<typeof getDb>,
  userId: string,
  limit: number,
): Promise<QuestionResult[]> {
  const result = await db.execute(sql`
    SELECT
      uqh.question_id,
      q.question_text,
      uqh.total_attempts,
      ROUND(uqh.success_rate * 100, 1)::float AS success_rate,
      ROUND((1 - uqh.success_rate) * 100, 1)::float AS personal_difficulty
    FROM user_question_history_v2 uqh
    INNER JOIN questions q ON uqh.question_id = q.id
    WHERE uqh.user_id = ${userId}::uuid
      AND uqh.total_attempts >= 2
      AND uqh.success_rate < 0.4
    ORDER BY uqh.success_rate ASC, uqh.total_attempts DESC
    LIMIT ${limit}
  `)
  return mapResults(result as Record<string, unknown>[])
}

// Preguntas dominadas — reemplaza get_mastered_questions.
export async function getMasteredQuestionsV2(
  db: ReturnType<typeof getDb>,
  userId: string,
  limit: number,
): Promise<QuestionResult[]> {
  const result = await db.execute(sql`
    SELECT
      uqh.question_id,
      q.question_text,
      uqh.total_attempts,
      ROUND(uqh.success_rate * 100, 1)::float AS success_rate,
      ROUND((1 - uqh.success_rate) * 100, 1)::float AS personal_difficulty
    FROM user_question_history_v2 uqh
    INNER JOIN questions q ON uqh.question_id = q.id
    WHERE uqh.user_id = ${userId}::uuid
      AND uqh.total_attempts >= 2
      AND uqh.success_rate >= 0.8
    ORDER BY uqh.success_rate DESC, uqh.total_attempts DESC
    LIMIT ${limit}
  `)
  return mapResults(result as Record<string, unknown>[])
}

// Desglose por dificultad personal — reemplaza scan masivo de test_questions.
export async function getPersonalBreakdownV2(
  db: ReturnType<typeof getDb>,
  userId: string,
): Promise<PersonalBreakdown> {
  const result = await db.execute(sql`
    SELECT
      COUNT(*) FILTER (WHERE success_rate >= 0.8)::int AS easy,
      COUNT(*) FILTER (WHERE success_rate >= 0.6 AND success_rate < 0.8)::int AS medium,
      COUNT(*) FILTER (WHERE success_rate >= 0.4 AND success_rate < 0.6)::int AS hard,
      COUNT(*) FILTER (WHERE success_rate < 0.4)::int AS extreme,
      COUNT(*)::int AS total
    FROM user_question_history_v2
    WHERE user_id = ${userId}::uuid
      AND total_attempts >= 2
  `)
  const row = (result as Record<string, unknown>[])[0]
  return {
    easy: Number(row?.easy) || 0,
    medium: Number(row?.medium) || 0,
    hard: Number(row?.hard) || 0,
    extreme: Number(row?.extreme) || 0,
    total: Number(row?.total) || 0,
  }
}

// Tendencias — reemplaza get_user_progress_trends.
// v2 mantiene trend='stable' por defecto (sin computing histórico complejo).
// Si en el futuro se quiere recuperar el trend real, se puede añadir aquí.
export async function getProgressTrendsV2(
  db: ReturnType<typeof getDb>,
  userId: string,
): Promise<ProgressTrends> {
  const result = await db.execute(sql`
    SELECT
      COUNT(*) FILTER (WHERE trend = 'improving')::int AS improving,
      COUNT(*) FILTER (WHERE trend = 'declining')::int AS declining,
      COUNT(*) FILTER (WHERE trend = 'stable' OR trend IS NULL)::int AS stable,
      COUNT(*)::int AS total
    FROM user_question_history_v2
    WHERE user_id = ${userId}::uuid
  `)
  const row = (result as Record<string, unknown>[])[0]
  return {
    improving: Number(row?.improving) || 0,
    declining: Number(row?.declining) || 0,
    stable: Number(row?.stable) || 0,
    total: Number(row?.total) || 0,
  }
}

function mapResults(rows: Record<string, unknown>[]): QuestionResult[] {
  return rows.map(row => ({
    questionId: String(row.question_id || ''),
    questionText: String(row.question_text || ''),
    totalAttempts: Number(row.total_attempts) || 0,
    successRate: Number(row.success_rate) || 0,
    personalDifficulty: Number(row.personal_difficulty) || 0,
  }))
}
