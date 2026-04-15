// lib/api/user-stats/queries.ts - Drizzle queries para User Stats v2
// Reemplaza la RPC get_user_public_stats (5 CTEs, ~1.8s) con 2 queries simples
import { getDb } from '@/db/client'
import { tests, testQuestions, userStreaks } from '@/db/schema'
import { eq, sql } from 'drizzle-orm'
import type { UserPublicStats } from './schemas'

export async function getUserPublicStats(userId: string): Promise<UserPublicStats> {
  const db = getDb()

  const mondayThisWeek = getMondayThisWeek()

  // Query 1: total + accuracy + this week + desglose correct/blank (un solo
  // scan de test_questions). blankAnswers requiere was_blank=true (añadido
  // 15/4/2026 con la feature "Dejar en blanco"). Para filas legacy (before
  // was_blank), el valor default es false y cuentan como incorrectas.
  const [statsResult] = await db
    .select({
      totalQuestions: sql<number>`count(*)::int`,
      correctAnswers: sql<number>`sum(case when ${testQuestions.isCorrect} then 1 else 0 end)::int`,
      blankAnswers: sql<number>`sum(case when ${testQuestions.wasBlank} then 1 else 0 end)::int`,
      questionsThisWeek: sql<number>`sum(case when ${testQuestions.createdAt} >= ${mondayThisWeek} then 1 else 0 end)::int`,
    })
    .from(testQuestions)
    .innerJoin(tests, eq(testQuestions.testId, tests.id))
    .where(eq(tests.userId, userId))

  // Query 2: streak (lookup directo por user_id, instantaneo)
  const [streakResult] = await db
    .select({
      currentStreak: userStreaks.currentStreak,
    })
    .from(userStreaks)
    .where(eq(userStreaks.userId, userId))
    .limit(1)

  const total = statsResult?.totalQuestions ?? 0
  const correct = statsResult?.correctAnswers ?? 0
  const blank = statsResult?.blankAnswers ?? 0
  // incorrectas REALES = no acertadas Y no en blanco. Rama legacy: filas con
  // wasBlank=false pero que eran -1 en realidad (rare edge case de respuestas
  // pre-15/4/2026 que podrían haber quedado con letra incorrecta) cuentan como
  // incorrectas — pérdida aceptable, era pre-feature.
  const incorrect = total - correct - blank

  return {
    totalQuestions: total,
    globalAccuracy: total > 0 ? Math.round((correct / total) * 1000) / 10 : 0,
    currentStreak: streakResult?.currentStreak ?? 0,
    questionsThisWeek: statsResult?.questionsThisWeek ?? 0,
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
