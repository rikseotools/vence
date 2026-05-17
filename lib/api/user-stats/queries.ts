// lib/api/user-stats/queries.ts - User Stats via tabla pre-computada
// Antes: count(*) sobre test_questions (8s para heavy users, causaba 504s)
// Ahora: lookup por PK en user_stats_summary (<1ms), actualizada por trigger
//
// CANARY self-hosted pooler (Fase 4 oleada 4 — URGENTE 2026-05-10 20:35 UTC):
// Migrado tras blip activo de Supavisor causando 504s en user-stats.
// Read-only puro (PK lookups + reads). Cero riesgo, alto impacto.
//
// Ampliación 2026-05-17: añadido targetOposicion, userCreatedAt, longestStreak,
// totalTestsCompleted, today*. Todo en Drizzle con queries paralelas
// (Promise.all). Sin RPCs Supabase ni triggers SQL — portable a AWS.
import { getDb, getPoolerDb } from '@/db/client'

function getUserStatsDb() {
  return process.env.USE_SELF_HOSTED_POOLER === 'true' ? getPoolerDb() : getDb()
}
import { userStreaks, userProfiles, tests, testQuestions } from '@/db/schema'
import { and, eq, gte, lt, sql } from 'drizzle-orm'
import type { UserPublicStats } from './schemas'

export async function getUserPublicStats(userId: string): Promise<UserPublicStats> {
  const db = getUserStatsDb()  // canary pooler

  // Madrid timezone day bounds (today_* siempre en hora peninsular)
  const madridNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Madrid' }))
  const madridTodayStart = new Date(madridNow); madridTodayStart.setHours(0,0,0,0)
  const madridTomorrowStart = new Date(madridTodayStart); madridTomorrowStart.setDate(madridTomorrowStart.getDate() + 1)
  const todayStartIso = madridTodayStart.toISOString()
  const tomorrowStartIso = madridTomorrowStart.toISOString()

  // Lanzar todas las queries en paralelo (Promise.all)
  // El tiempo total = max(individuales), no la suma.
  const [
    summaryResult,
    streakRows,
    profileRows,
    testsCompletedRows,
    todayTestsRows,
    todayAnswersRows,
  ] = await Promise.all([
    // 1. Stats agregadas (PK lookup en user_stats_summary, <1ms)
    db.execute(
      sql`SELECT total_questions, correct_answers, blank_answers,
                 questions_this_week, week_start
          FROM user_stats_summary
          WHERE user_id = ${userId}`
    ),

    // 2. Streak (PK lookup, <1ms)
    db
      .select({
        currentStreak: userStreaks.currentStreak,
        longestStreak: userStreaks.longestStreak,
      })
      .from(userStreaks)
      .where(eq(userStreaks.userId, userId))
      .limit(1),

    // 3. Perfil (PK lookup, <1ms)
    db
      .select({
        targetOposicion: userProfiles.targetOposicion,
        createdAt: userProfiles.createdAt,
      })
      .from(userProfiles)
      .where(eq(userProfiles.id, userId))
      .limit(1),

    // 4. Tests completados totales (índice idx_tests_user_completed)
    db
      .select({ c: sql<number>`count(*)::int` })
      .from(tests)
      .where(and(eq(tests.userId, userId), eq(tests.isCompleted, true))),

    // 5. Tests hoy (índice idx_tests_user_created)
    db
      .select({ c: sql<number>`count(*)::int` })
      .from(tests)
      .where(
        and(
          eq(tests.userId, userId),
          gte(tests.createdAt, todayStartIso),
          lt(tests.createdAt, tomorrowStartIso),
        )
      ),

    // 6. Preguntas y correctas hoy (test_questions tiene user_id directo
    //    + created_at; con índice por user_id se filtra rápido para usuarios
    //    no-heavy. Si surge problema con heavy users, mover a tabla agregada.)
    db
      .select({
        total: sql<number>`count(*)::int`,
        correct: sql<number>`count(*) filter (where ${testQuestions.isCorrect})::int`,
      })
      .from(testQuestions)
      .where(
        and(
          eq(testQuestions.userId, userId),
          gte(testQuestions.createdAt, todayStartIso),
          lt(testQuestions.createdAt, tomorrowStartIso),
        )
      ),
  ])

  const summary = (summaryResult as any)?.[0] as {
    total_questions: number
    correct_answers: number
    blank_answers: number
    questions_this_week: number
    week_start: string
  } | undefined
  const streak = (streakRows as Array<{ currentStreak: number | null; longestStreak: number | null }>)?.[0]
  const profile = (profileRows as Array<{ targetOposicion: string | null; createdAt: string | null }>)?.[0]
  const testsCompletedRow = (testsCompletedRows as Array<{ c: number }>)?.[0]
  const todayTestsRow = (todayTestsRows as Array<{ c: number }>)?.[0]
  const todayAnswersRow = (todayAnswersRows as Array<{ total: number; correct: number }>)?.[0]

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
    // Fallback: usuario sin fila en summary (race condition extrema o si el
    // trigger init_user_stats_summary_on_signup fue dropeado por error).
    // Defensa en profundidad: el trigger en user_profiles AFTER INSERT
    // crea la fila default desde signup, así que este path NO debería
    // ejecutarse en condiciones normales. Si lo hace, indica:
    //   (a) race condition entre signup y primera consulta (raro)
    //   (b) trigger dropeado/no instalado (alerta)
    //
    // BUG FIX (1 may 2026): la versión anterior usaba GROUP BY tq.user_id
    // que devolvía 0 filas cuando el user no tiene actividad → INSERT no-op
    // → fila nunca se creaba → bucle infinito de "computing" para 1.171
    // users (27.2% del total). Ahora sin GROUP BY + COALESCE: la agregación
    // sin filas devuelve 1 fila con NULL, COALESCE convierte a 0, INSERT
    // SIEMPRE crea/actualiza 1 fila.
    console.warn(`⚠️ [user-stats] No summary for ${userId.slice(0, 8)}, computing...`)
    const fallbackResult = await db.execute(
      sql`INSERT INTO user_stats_summary (user_id, total_questions, correct_answers, blank_answers, questions_this_week, week_start)
          SELECT
            ${userId}::uuid,
            COALESCE(count(tq.id)::int, 0),
            COALESCE(sum(case when tq.is_correct then 1 else 0 end)::int, 0),
            COALESCE(sum(case when tq.was_blank then 1 else 0 end)::int, 0),
            COALESCE(sum(case when tq.created_at >= date_trunc('week', now()) then 1 else 0 end)::int, 0),
            date_trunc('week', now())::date
          FROM test_questions tq
          WHERE tq.user_id = ${userId}
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

  const incorrect = total - correct - blank

  return {
    totalQuestions: total,
    globalAccuracy: total > 0 ? Math.round((correct / total) * 1000) / 10 : 0,
    currentStreak: streak?.currentStreak ?? 0,
    questionsThisWeek: thisWeek,
    correctAnswers: correct,
    incorrectAnswers: Math.max(0, incorrect),
    blankAnswers: blank,

    targetOposicion: profile?.targetOposicion ?? null,
    userCreatedAt: profile?.createdAt ?? null,

    longestStreak: streak?.longestStreak ?? 0,

    totalTestsCompleted: Number(testsCompletedRow?.c ?? 0),

    todayTests: Number(todayTestsRow?.c ?? 0),
    todayQuestions: Number(todayAnswersRow?.total ?? 0),
    todayCorrect: Number(todayAnswersRow?.correct ?? 0),
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
