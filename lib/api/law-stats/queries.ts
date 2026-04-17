// lib/api/law-stats/queries.ts
// Query Drizzle para estadísticas de preguntas por ley.
// Usada directamente por server components y por la API route.

import { getDb } from '@/db/client'
import { questions, articles, laws } from '@/db/schema'
import { eq, and, sql, isNull } from 'drizzle-orm'

export interface LawStatsResult {
  success: boolean
  lawShortName: string
  totalQuestions: number
  officialQuestions: number
  regularQuestions: number
  hasQuestions: boolean
  hasOfficialQuestions: boolean
  error?: string
}

export async function queryLawStats(lawShortName: string): Promise<LawStatsResult> {
  try {
    const db = getDb()
    const startTime = Date.now()

    const [result] = await db
      .select({
        total: sql<number>`count(*)`.as('total'),
        official: sql<number>`count(*) filter (where ${questions.isOfficialExam} = true)`.as('official'),
      })
      .from(questions)
      .innerJoin(articles, eq(questions.primaryArticleId, articles.id))
      .innerJoin(laws, eq(articles.lawId, laws.id))
      .where(and(
        eq(questions.isActive, true),
        isNull(questions.examCaseId),
        eq(laws.shortName, lawShortName)
      ))

    const queryMs = Date.now() - startTime
    if (queryMs > 2000) {
      console.warn(`⚠️ [law-stats] Query lenta: ${queryMs}ms para ${lawShortName}`)
    }

    const total = Number(result?.total ?? 0)
    const official = Number(result?.official ?? 0)
    const adjustedTotal = Math.max(total, official)

    console.log(`📊 [law-stats] ${lawShortName}: ${adjustedTotal} total, ${official} oficiales (${queryMs}ms)`)

    return {
      success: true,
      lawShortName,
      totalQuestions: adjustedTotal,
      officialQuestions: official,
      regularQuestions: Math.max(0, adjustedTotal - official),
      hasQuestions: adjustedTotal > 0,
      hasOfficialQuestions: official > 0,
    }
  } catch (error) {
    console.error(`❌ [law-stats] Error para ${lawShortName}:`, error)
    return {
      success: false,
      lawShortName,
      totalQuestions: 0,
      officialQuestions: 0,
      regularQuestions: 0,
      hasQuestions: false,
      hasOfficialQuestions: false,
      error: (error as Error).message,
    }
  }
}
