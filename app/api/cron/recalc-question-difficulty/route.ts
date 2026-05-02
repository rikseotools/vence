// app/api/cron/recalc-question-difficulty/route.ts
// Cron endpoint: recalcula questions.difficulty para preguntas marcadas como
// stats_dirty=true (Fase 0.2 escalabilidad — ver docs/ARCHITECTURE_ROADMAP.md).
//
// Se invoca desde .github/workflows/recalc-question-difficulty.yml cada 5min.
// Auth: Bearer ${CRON_SECRET} (mismo patrón que refresh-theme-cache).
//
// Procesa max 500 preguntas por ejecución. Si hay backlog mayor, el cron
// siguiente lo retoma (advisory lock evita doble procesamiento).
//
// La función SQL recalculate_dirty_question_difficulty contiene el algoritmo
// idéntico al trigger original (validado byte-exact con test de paridad
// 50/50 matches).

import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { withErrorLogging } from '@/lib/api/withErrorLogging'

export const maxDuration = 60 // procesar 500 preguntas tarda ~8s, margen amplio

async function _GET(request: NextRequest): Promise<NextResponse> {
  // Verificar Bearer token (mismo patrón que otros crons)
  const authHeader = request.headers.get('authorization')
  const expectedAuth = `Bearer ${process.env.CRON_SECRET}`
  if (!process.env.CRON_SECRET || authHeader !== expectedAuth) {
    console.error('❌ [cron/recalc-question-difficulty] Unauthorized')
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const startTime = Date.now()

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )

    const { data, error } = await supabase.rpc('recalculate_dirty_question_difficulty', {
      p_limit: 1000, // 1000 cada 5min = 12k/h, capacidad sobrada para ritmo actual
    })

    if (error) {
      console.error('❌ [cron/recalc-question-difficulty] RPC error:', error)
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 },
      )
    }

    const processed = typeof data === 'number' ? data : 0
    const durationMs = Date.now() - startTime

    // -1 = otro cron ya estaba corriendo (advisory lock no obtenido)
    if (processed === -1) {
      console.log(`⏭️  [cron/recalc-question-difficulty] Skipped: another instance running (${durationMs}ms)`)
      return NextResponse.json({
        success: true,
        skipped: true,
        reason: 'another instance running',
        durationMs,
      })
    }

    console.log(`✅ [cron/recalc-question-difficulty] Processed ${processed} questions in ${durationMs}ms`)
    return NextResponse.json({
      success: true,
      processed,
      durationMs,
    })
  } catch (err) {
    const durationMs = Date.now() - startTime
    console.error(`❌ [cron/recalc-question-difficulty] Error after ${durationMs}ms:`, err)
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Error interno' },
      { status: 500 },
    )
  }
}

export const GET = withErrorLogging('/api/cron/recalc-question-difficulty', _GET)
