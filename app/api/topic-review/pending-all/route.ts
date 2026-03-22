// app/api/topic-review/pending-all/route.ts
// Stats globales de TODAS las preguntas únicas + IDs pendientes
import { NextResponse } from 'next/server'
import { getDb } from '@/db/client'
import { sql } from 'drizzle-orm'
import { withErrorLogging } from '@/lib/api/withErrorLogging'

async function _GET() {
  try {
    const db = getDb()

    // Stats globales de preguntas únicas (sin duplicados)
    // Incluye activas e inactivas para que el admin vea el conteo real de errores
    const statsResult = await db.execute(sql`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE topic_review_status IS NULL OR topic_review_status = 'pending')::int AS pending,
        COUNT(*) FILTER (WHERE topic_review_status IN ('perfect', 'tech_perfect'))::int AS perfect,
        COUNT(*) FILTER (WHERE topic_review_status NOT IN ('pending', 'perfect', 'tech_perfect') AND topic_review_status IS NOT NULL)::int AS problems
      FROM questions
      WHERE is_active = true OR topic_review_status IN (
        'bad_answer', 'bad_explanation', 'bad_answer_and_explanation',
        'wrong_article', 'wrong_article_bad_explanation', 'wrong_article_bad_answer',
        'all_wrong', 'invalid_structure',
        'tech_bad_answer', 'tech_bad_answer_and_explanation', 'tech_bad_explanation'
      )
    `)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stats = (statsResult as any[])[0] || { total: 0, pending: 0, perfect: 0, problems: 0 }

    // IDs pendientes para verificación (solo activas — no re-verificar las ya desactivadas)
    const pendingResult = await db.execute(sql`
      SELECT id FROM questions
      WHERE is_active = true
        AND (topic_review_status IS NULL OR topic_review_status = 'pending')
      ORDER BY created_at ASC
    `)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const questionIds = (pendingResult as any[]).map((r: Record<string, unknown>) => r.id as string)

    return NextResponse.json({
      success: true,
      stats,
      questionIds,
      total: questionIds.length,
    })
  } catch (error) {
    console.error('Error getting pending questions:', error)
    return NextResponse.json({ success: false, error: 'Error interno' }, { status: 500 })
  }
}

export const GET = withErrorLogging('/api/topic-review/pending-all', _GET)
