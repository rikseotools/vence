import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { getReadDb } from '@/db/client'
import { tests } from '@/db/schema'
import { eq, and, gt, desc, sql } from 'drizzle-orm'

const userIdSchema = z.string().uuid()

/**
 * GET /api/v2/official-exams/user-stats
 *
 * Query params:
 * - userId: string - Required
 * - oposicion: string - Optional filter
 *
 * Returns user's best score for each official exam they've taken
 */
async function _GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const oposicion = searchParams.get('oposicion')

    if (!userId || !userIdSchema.safeParse(userId).success) {
      return NextResponse.json(
        { success: false, error: 'userId inválido o faltante (debe ser UUID)' },
        { status: 400 }
      )
    }

    // Query tests table for official exams completed by user
    // Filter directly in DB by detailed_analytics->>'isOfficialExam' = 'true'
    // IMPORTANT: Filter total_questions > 0 to skip corrupted test sessions
    const conditions = [
      eq(tests.userId, userId),
      eq(tests.testType, 'exam'),
      eq(tests.isCompleted, true),
      gt(tests.totalQuestions, 0),
      sql`${tests.detailedAnalytics}->>'isOfficialExam' = 'true'`,
    ]
    // Filter by oposicion directly in the query if provided
    if (oposicion) {
      conditions.push(sql`${tests.detailedAnalytics}->>'oposicion' = ${oposicion}`)
    }

    let sessions: Array<Record<string, any>>
    try {
      sessions = await getReadDb()
        .select({
          id: tests.id,
          score: tests.score,
          total_questions: tests.totalQuestions,
          detailed_analytics: tests.detailedAnalytics,
          created_at: tests.createdAt,
        })
        .from(tests)
        .where(and(...conditions))
        .orderBy(desc(tests.score))
    } catch (error) {
      console.error('❌ [API/v2/official-exams/user-stats] Error:', error)
      return NextResponse.json(
        { success: false, error: 'Error consultando estadísticas' },
        { status: 500 }
      )
    }

    // Group by exam date + parte and get best score for each
    const statsByExam: Record<string, {
      accuracy: number
      correct: number
      total: number
      lastAttempt: string
    }> = {}

    sessions?.forEach(session => {
      const analytics = session.detailed_analytics as Record<string, unknown> | null
      const examDate = analytics?.examDate as string
      if (!examDate) return

      // Build key: examDate-parte (e.g., "2024-07-09-primera") or just examDate if no parte
      const parte = analytics?.parte as string | undefined
      const key = parte ? `${examDate}-${parte}` : examDate

      // Use correctCount from detailed_analytics, fallback to score for old tests
      // (old tests stored correct count in score field)
      const correctCount = Number(analytics?.correctCount) || Number(session.score) || 0
      const total = session.total_questions || 0
      const accuracy = total > 0 ? Math.round((correctCount / total) * 100) : 0

      // Keep best attempt (most correct answers) for each exam+parte combination
      if (!statsByExam[key] || statsByExam[key].correct < correctCount) {
        statsByExam[key] = {
          accuracy,
          correct: correctCount,
          total,
          lastAttempt: session.created_at
        }
      }
    })

    return NextResponse.json({
      success: true,
      stats: statsByExam
    })

  } catch (error) {
    console.error('❌ [API/v2/official-exams/user-stats] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

export const GET = withErrorLogging('/api/v2/official-exams/user-stats', _GET)
