// lib/api/psychometric-stats/queries.ts
import { getDb } from '@/db/client'
import { sql, eq, and, desc, isNotNull } from 'drizzle-orm'
import {
  psychometricTestAnswers,
  psychometricTestSessions,
  psychometricCategories,
} from '@/db/schema'
import type {
  GetPsychometricStatsResponse,
  CategoryStat,
  RecentPsychometricTest,
} from './schemas'

export async function getPsychometricStats(userId: string): Promise<GetPsychometricStatsResponse> {
  try {
    const db = getDb()

    const [categoryStats, recentTests] = await Promise.all([
      getCategoryStats(db, userId),
      getRecentTests(db, userId),
    ])

    return {
      success: true,
      data: {
        categoryStats,
        recentTests,
      },
    }
  } catch (error) {
    console.error('Error obteniendo psychometric stats:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    }
  }
}

// Precisión por categoría — aggregación en SQL, filtrado por user_id
async function getCategoryStats(
  db: ReturnType<typeof getDb>,
  userId: string
): Promise<CategoryStat[]> {
  const result = await db
    .select({
      displayName: psychometricCategories.displayName,
      categoryKey: psychometricCategories.categoryKey,
      total: sql<number>`COUNT(${psychometricTestAnswers.id})::int`,
      correct: sql<number>`SUM(CASE WHEN ${psychometricTestAnswers.isCorrect} THEN 1 ELSE 0 END)::int`,
    })
    .from(psychometricTestAnswers)
    .innerJoin(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      sql`psychometric_questions` as any,
      sql`psychometric_questions.id = ${psychometricTestAnswers.questionId}`
    )
    .innerJoin(
      psychometricCategories,
      sql`${psychometricCategories.id} = psychometric_questions.category_id`
    )
    .where(and(
      eq(psychometricTestAnswers.userId, userId),
      isNotNull(psychometricTestAnswers.userAnswer),
    ))
    .groupBy(psychometricCategories.id, psychometricCategories.displayName, psychometricCategories.categoryKey)
    .orderBy(sql`COUNT(${psychometricTestAnswers.id}) DESC`)

  return result.map(row => ({
    displayName: row.displayName,
    categoryKey: row.categoryKey,
    total: row.total,
    correct: row.correct,
    accuracy: row.total > 0 ? Math.round((row.correct / row.total) * 100) : 0,
  }))
}

// Tests recientes completados
async function getRecentTests(
  db: ReturnType<typeof getDb>,
  userId: string
): Promise<RecentPsychometricTest[]> {
  const result = await db
    .select({
      id: psychometricTestSessions.id,
      totalQuestions: psychometricTestSessions.totalQuestions,
      correctAnswers: psychometricTestSessions.correctAnswers,
      accuracyPercentage: psychometricTestSessions.accuracyPercentage,
      totalTimeSeconds: psychometricTestSessions.totalTimeSeconds,
      startedAt: psychometricTestSessions.startedAt,
      completedAt: psychometricTestSessions.completedAt,
      createdAt: psychometricTestSessions.createdAt,
    })
    .from(psychometricTestSessions)
    .where(and(
      eq(psychometricTestSessions.userId, userId),
      eq(psychometricTestSessions.isCompleted, true),
    ))
    .orderBy(desc(psychometricTestSessions.completedAt))
    .limit(10)

  return result.map(row => {
    const timeSeconds = row.totalTimeSeconds ||
      (row.startedAt && row.completedAt
        ? Math.round((new Date(row.completedAt).getTime() - new Date(row.startedAt).getTime()) / 1000)
        : 0)
    const total = row.totalQuestions || 0
    const score = row.correctAnswers || 0

    return {
      id: row.id,
      score,
      total,
      percentage: Math.round(Number(row.accuracyPercentage) || 0),
      date: new Date(row.completedAt || row.createdAt || '').toLocaleDateString('es-ES', { timeZone: 'Europe/Madrid' }),
      timeSeconds,
      avgTimePerQuestion: total > 0 ? Math.round(timeSeconds / total) : 0,
    }
  })
}
