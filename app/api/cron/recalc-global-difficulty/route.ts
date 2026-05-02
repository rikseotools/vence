// app/api/cron/recalc-global-difficulty/route.ts
// Cron endpoint: recalcula questions.global_difficulty_category para preguntas
// marcadas como global_dirty=true por trigger #4 (track_question_first_attempt).
// Patron: dirty flag + cron 5min (Fase 2 escalabilidad — ver ARCHITECTURE_ROADMAP.md).
//
// El campo importante es global_difficulty_category (usado para filtrar preguntas
// en /api/random-test y /api/v2/filtered-questions). Lag max 5min — aceptable
// porque el sistema usa fallback `(globalDifficultyCategory IS NULL AND difficulty = X)`.

import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { withErrorLogging } from '@/lib/api/withErrorLogging'

export const maxDuration = 60

async function _GET(request: NextRequest): Promise<NextResponse> {
  const authHeader = request.headers.get('authorization')
  const expectedAuth = `Bearer ${process.env.CRON_SECRET}`
  if (!process.env.CRON_SECRET || authHeader !== expectedAuth) {
    console.error('❌ [cron/recalc-global-difficulty] Unauthorized')
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const startTime = Date.now()
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )

    const { data, error } = await supabase.rpc('recalculate_dirty_global_difficulty', {
      // LIMIT 200: 200 preguntas ~3s (15ms cada una via update_question_global_difficulty).
      // Capacidad: 200 cada 5min = 2400/h - suficiente para ritmo actual de
      // first_attempts (~50-100/min en pico).
      p_limit: 200,
    })

    if (error) {
      console.error('❌ [cron/recalc-global-difficulty] RPC error:', error)
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    const processed = typeof data === 'number' ? data : 0
    const durationMs = Date.now() - startTime

    if (processed === -1) {
      console.log(`⏭️  [cron/recalc-global-difficulty] Skipped: another instance running (${durationMs}ms)`)
      return NextResponse.json({ success: true, skipped: true, reason: 'another instance running', durationMs })
    }

    console.log(`✅ [cron/recalc-global-difficulty] Processed ${processed} questions in ${durationMs}ms`)
    return NextResponse.json({ success: true, processed, durationMs })
  } catch (err) {
    const durationMs = Date.now() - startTime
    console.error(`❌ [cron/recalc-global-difficulty] Error after ${durationMs}ms:`, err)
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Error interno' },
      { status: 500 },
    )
  }
}

export const GET = withErrorLogging('/api/cron/recalc-global-difficulty', _GET)
