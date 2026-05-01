// lib/api/user-stats/queries.ts - User Stats via tabla pre-computada
// Antes: count(*) sobre test_questions (8s para heavy users, causaba 504s)
// Ahora: lookup por PK en user_stats_summary (<1ms), actualizada por trigger
import { getDb } from '@/db/client'
import { userStreaks } from '@/db/schema'
import { eq, sql } from 'drizzle-orm'
import type { UserPublicStats } from './schemas'

export async function getUserPublicStats(userId: string): Promise<UserPublicStats> {
  const db = getDb()

  // Query 1: stats desde tabla pre-computada (PK lookup, <1ms)
  // El trigger update_user_stats_summary_trigger actualiza estos contadores
  // incrementalmente en cada INSERT en test_questions.
  const summaryResult = await db.execute(
    sql`SELECT total_questions, correct_answers, blank_answers,
               questions_this_week, week_start
        FROM user_stats_summary
        WHERE user_id = ${userId}`
  )

  const summary = (summaryResult as any)?.[0] as {
    total_questions: number
    correct_answers: number
    blank_answers: number
    questions_this_week: number
    week_start: string
  } | undefined

  let total: number
  let correct: number
  let blank: number
  let thisWeek: number

  if (summary) {
    total = Number(summary.total_questions)
    correct = Number(summary.correct_answers)
    blank = Number(summary.blank_answers)

    // Si week_start no es la semana actual, questions_this_week está stale → 0
    const currentWeekStart = getMondayThisWeek().slice(0, 10)
    const summaryWeek = typeof summary.week_start === 'string'
      ? summary.week_start.slice(0, 10)
      : new Date(summary.week_start).toISOString().slice(0, 10)
    thisWeek = summaryWeek === currentWeekStart ? Number(summary.questions_this_week) : 0
  } else {
    // Fallback: usuario sin fila en summary (nuevo o no backfilled).
    // Hacer la query pesada UNA VEZ y crear la fila.
    console.warn(`⚠️ [user-stats] No summary for ${userId.slice(0, 8)}, computing...`)
    // Usar tq.user_id directamente (sin JOIN tests)
    const fallbackResult = await db.execute(
      sql`INSERT INTO user_stats_summary (user_id, total_questions, correct_answers, blank_answers, questions_this_week, week_start)
          SELECT
            tq.user_id,
            count(tq.id)::int,
            sum(case when tq.is_correct then 1 else 0 end)::int,
            coalesce(sum(case when tq.was_blank then 1 else 0 end)::int, 0),
            sum(case when tq.created_at >= date_trunc('week', now()) then 1 else 0 end)::int,
            date_trunc('week', now())::date
          FROM test_questions tq
          WHERE tq.user_id = ${userId}
          GROUP BY tq.user_id
          ON CONFLICT (user_id) DO UPDATE SET
            total_questions = EXCLUDED.total_questions,
            correct_answers = EXCLUDED.correct_answers,
            blank_answers = EXCLUDED.blank_answers,
            questions_this_week = EXCLUDED.questions_this_week,
            week_start = EXCLUDED.week_start,
            updated_at = now()
          RETURNING total_questions, correct_answers, blank_answers, questions_this_week`
    )

    const row = (fallbackResult as any)?.[0] as any
    if (row) {
      total = Number(row.total_questions)
      correct = Number(row.correct_answers)
      blank = Number(row.blank_answers)
      thisWeek = Number(row.questions_this_week)
    } else {
      // Usuario sin preguntas respondidas
      total = 0; correct = 0; blank = 0; thisWeek = 0
    }
  }

  // Query 2: streak (lookup directo por PK, instantáneo)
  const [streakResult] = await db
    .select({ currentStreak: userStreaks.currentStreak })
    .from(userStreaks)
    .where(eq(userStreaks.userId, userId))
    .limit(1)

  const incorrect = total - correct - blank

  return {
    totalQuestions: total,
    globalAccuracy: total > 0 ? Math.round((correct / total) * 1000) / 10 : 0,
    currentStreak: streakResult?.currentStreak ?? 0,
    questionsThisWeek: thisWeek,
    correctAnswers: correct,
    incorrectAnswers: Math.max(0, incorrect),
    blankAnswers: blank,
  }
}

function getMondayThisWeek(): string {
  const now = new Date()
  const day = now.getDay()
  const diff = day === 0 ? 6 : day - 1
  const monday = new Date(now)
  monday.setDate(now.getDate() - diff)
  monday.setHours(0, 0, 0, 0)
  return monday.toISOString()
}
