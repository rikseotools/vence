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
    // Filter directly in DB by detailed_analytics->>'isOfficialExam' = 'true'
    // IMPORTANT: Filter total_questions > 0 to skip corrupted test sessions
    let query = supabase
      .from('tests')
      .select('id, score, total_questions, detailed_analytics, created_at')
      .eq('user_id', userId)
      .eq('test_type', 'exam')
      .eq('is_completed', true)
      .gt('total_questions', 0)
      .filter('detailed_analytics->>isOfficialExam', 'eq', 'true')
      .order('score', { ascending: false })

    // Filter by oposicion directly in the query if provided
    if (oposicion) {
      query = query.filter('detailed_analytics->>oposicion', 'eq', oposicion)
    }

    const { data: sessions, error } = await query

    if (error) {
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
