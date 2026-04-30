// app/api/v2/topic-progress/theme-stats/route.ts
// Reemplaza supabase.rpc('get_user_theme_stats') que tardaba 16s para heavy users.
// Usa Drizzle con timeout de 10s + cache en memoria 5 min.
import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/db/client'
import { sql } from 'drizzle-orm'
import { withErrorLogging } from '@/lib/api/withErrorLogging'

interface ThemeStat {
  tema_number: number
  total: number
  correct: number
  accuracy: number
  last_study: string | null
}

// Cache en memoria: las stats por tema cambian poco (solo al responder preguntas)
const cache = new Map<string, { data: ThemeStat[]; timestamp: number }>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutos

async function _GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get('userId')
  if (!userId) {
    return NextResponse.json({ success: false, error: 'userId required' }, { status: 400 })
  }

  // Check cache
  const cached = cache.get(userId)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return NextResponse.json({ success: true, stats: cached.data })
  }

  try {
    const db = getDb()

    // Misma query que la RPC pero con timeout
    const queryPromise = db.execute(sql`
      SELECT
        tq.tema_number,
        COUNT(*)::int as total,
        SUM(CASE WHEN tq.is_correct = true THEN 1 ELSE 0 END)::int as correct,
        ROUND((SUM(CASE WHEN tq.is_correct = true THEN 1 ELSE 0 END)::numeric
          / NULLIF(COUNT(*), 0)) * 100, 0)::int as accuracy,
        MAX(tq.created_at)::text as last_study
      FROM test_questions tq
      JOIN tests t ON tq.test_id = t.id
      WHERE t.user_id = ${userId} AND tq.tema_number IS NOT NULL
      GROUP BY tq.tema_number
      ORDER BY tq.tema_number
    `)

    const result = await Promise.race([
      queryPromise,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('theme-stats timeout')), 10_000)
      ),
    ])

    const stats = (result as any[]).map((r: any) => ({
      tema_number: r.tema_number,
      total: Number(r.total),
      correct: Number(r.correct),
      accuracy: Number(r.accuracy),
      last_study: r.last_study,
    }))

    // Guardar en cache
    cache.set(userId, { data: stats, timestamp: Date.now() })

    return NextResponse.json({ success: true, stats })
  } catch (err) {
    // Timeout: devolver cache stale si existe
    if (cached) {
      console.warn(`⏱️ [theme-stats] timeout for ${userId.slice(0, 8)}, returning stale cache`)
      return NextResponse.json({ success: true, stats: cached.data })
    }

    console.warn(`⏱️ [theme-stats] timeout for ${userId.slice(0, 8)}, returning empty`)
    return NextResponse.json({ success: true, stats: [] })
  }
}

export const GET = withErrorLogging('/api/v2/topic-progress/theme-stats', _GET)
