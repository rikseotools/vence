import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * GET /api/v2/official-exams/user-stats
 *
 * Query params:
 * - userId: string - Required
 * - oposicion: string - Optional filter
 *
 * Returns user's best score for each official exam they've taken
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const oposicion = searchParams.get('oposicion')

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'userId es requerido' },
        { status: 400 }
      )
    }

    // Query tests table for official exams completed by user
    // Filter by detailed_analytics->isOfficialExam = true
    const { data: sessions, error } = await supabase
      .from('tests')
      .select('id, score, total_questions, detailed_analytics, created_at')
      .eq('user_id', userId)
      .eq('test_type', 'exam')
      .eq('is_completed', true)
      .order('score', { ascending: false })

    if (error) {
      console.error('❌ [API/v2/official-exams/user-stats] Error:', error)
      return NextResponse.json(
        { success: false, error: 'Error consultando estadísticas' },
        { status: 500 }
      )
    }

    // Group by exam date and get best score for each
    const statsByExamDate: Record<string, {
      accuracy: number
      correct: number
      total: number
      lastAttempt: string
    }> = {}

    sessions?.forEach(session => {
      const analytics = session.detailed_analytics as Record<string, unknown> | null
      if (!analytics?.isOfficialExam) return

      const examDate = analytics.examDate as string
      if (!examDate) return

      // Filter by oposicion if provided
      if (oposicion && analytics.oposicion !== oposicion) return

      const score = Number(session.score) || 0
      const total = session.total_questions || 0
      const correct = Math.round((score / 100) * total)

      // Keep best score for each exam
      if (!statsByExamDate[examDate] || statsByExamDate[examDate].accuracy < score) {
        statsByExamDate[examDate] = {
          accuracy: Math.round(score),
          correct,
          total,
          lastAttempt: session.created_at
        }
      }
    })

    return NextResponse.json({
      success: true,
      stats: statsByExamDate
    })

  } catch (error) {
    console.error('❌ [API/v2/official-exams/user-stats] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
