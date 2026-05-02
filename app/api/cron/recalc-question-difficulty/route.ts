// app/api/cron/recalc-question-difficulty/route.ts
// Cron endpoint: recalcula questions.difficulty para preguntas marcadas
// como stats_dirty=true por el trigger #2 (update_question_difficulty_immediate).
// Detalle: docs/ARCHITECTURE_ROADMAP.md, supabase/migrations/20260502_questions_difficulty_*.sql
//
// Observabilidad: cada ejecución se registra en tabla cron_runs.
// Para ver últimas ejecuciones:
//   SELECT * FROM cron_runs WHERE cron_name = 'recalc-question-difficulty' ORDER BY started_at DESC LIMIT 20

import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { runCronWithLogging } from '@/lib/cron/runWithLogging'

export const maxDuration = 60

async function _GET(request: NextRequest): Promise<NextResponse> {
  const authHeader = request.headers.get('authorization')
  const expectedAuth = `Bearer ${process.env.CRON_SECRET}`
  if (!process.env.CRON_SECRET || authHeader !== expectedAuth) {
    console.error('❌ [cron/recalc-question-difficulty] Unauthorized')
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  try {
    const result = await runCronWithLogging(supabase, 'recalc-question-difficulty', async () => {
      const { data, error } = await supabase.rpc('recalculate_dirty_question_difficulty', {
        // LIMIT 100: bajado de 500 tras incidente 2 may 17:14 CEST donde un UPDATE
        // batch grande coincidio con saturacion del pool max:1 → cascada timeouts.
        // 100 = batch update mas pequeno → menor lock contention en questions,
        // menos probabilidad de bloquear endpoints user-facing.
        // Capacidad: 100 cada 5min = 1.200/h. Si insuficiente, subir cron a 2min.
        p_limit: 100,
      })

      if (error) {
        return { status: 'error', errorMessage: error.message }
      }

      const processed = typeof data === 'number' ? data : 0
      if (processed === -1) {
        return { status: 'skipped', metadata: { reason: 'another instance running' } }
      }
      return { status: 'success', processed }
    })

    if (result.skipped) {
      console.log(`⏭️  [cron/recalc-question-difficulty] Skipped (${result.durationMs}ms)`)
      return NextResponse.json({
        success: true,
        skipped: true,
        reason: 'another instance running',
        durationMs: result.durationMs,
        runId: result.runId,
      })
    }

    if (result.errorMessage) {
      console.error('❌ [cron/recalc-question-difficulty]', result.errorMessage)
      return NextResponse.json(
        { success: false, error: result.errorMessage, runId: result.runId },
        { status: 500 },
      )
    }

    console.log(`✅ [cron/recalc-question-difficulty] Processed ${result.processed} in ${result.durationMs}ms (run ${result.runId})`)
    return NextResponse.json({
      success: true,
      processed: result.processed,
      durationMs: result.durationMs,
      runId: result.runId,
    })
  } catch (err) {
    console.error('❌ [cron/recalc-question-difficulty] Exception:', err)
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Error interno' },
      { status: 500 },
    )
  }
}

export const GET = withErrorLogging('/api/cron/recalc-question-difficulty', _GET)
