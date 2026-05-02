// lib/cron/runWithLogging.ts
// Helper para envolver cron jobs con observabilidad robusta.
//
// Cada ejecución registra start/end/duration/processed/error en la tabla
// cron_runs (vía RPC supabase, NO usa el pool max:1 de Drizzle que se
// satura). Permite diagnosticar incidentes en 30s consultando:
//   SELECT * FROM cron_runs ORDER BY started_at DESC LIMIT 50
//
// Uso típico en endpoint cron:
//   const supabase = createClient(URL, SERVICE_ROLE_KEY)
//   return await runCronWithLogging(supabase, 'recalc-question-difficulty', async () => {
//     const { data } = await supabase.rpc('recalculate_dirty_question_difficulty', { p_limit: 100 })
//     return { processed: data, status: data === -1 ? 'skipped' : 'success' }
//   })

import type { SupabaseClient } from '@supabase/supabase-js'

export interface CronResult {
  processed?: number
  status: 'success' | 'error' | 'skipped'
  metadata?: Record<string, unknown>
  errorMessage?: string
}

export interface CronEnvelope {
  success: boolean
  runId: string | null
  durationMs: number
  processed?: number
  status: string
  errorMessage?: string
  skipped?: boolean
}

/**
 * Envuelve la ejecución de un cron con logging robusto:
 * - INSERT en cron_runs con status='running' al empezar
 * - UPDATE con status final + duration al terminar (success/error/skipped)
 * - Si el logging falla, el cron sigue ejecutando (no bloquea)
 * - Si el cron falla, se loggea pero la excepción NO se traga (re-throw)
 */
export async function runCronWithLogging(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  cronName: string,
  fn: () => Promise<CronResult>,
): Promise<CronEnvelope> {
  const startTime = Date.now()
  let runId: string | null = null

  // 1. Intentar abrir log de start (best-effort, no bloquea si falla)
  try {
    const { data, error } = await supabase.rpc('cron_run_start', {
      p_cron_name: cronName,
      p_metadata: {},
    })
    if (!error && data) {
      runId = data as string
    }
  } catch {
    // Si no podemos loggear el start, continuamos igualmente
  }

  // 2. Ejecutar el cron real
  try {
    const result = await fn()
    const durationMs = Date.now() - startTime

    // 3. Cerrar log con resultado
    if (runId) {
      try {
        await supabase.rpc('cron_run_end', {
          p_run_id: runId,
          p_status: result.status,
          p_processed: result.processed ?? null,
          p_error_message: result.errorMessage ?? null,
          p_metadata: result.metadata ?? null,
        })
      } catch {
        // Silently ignore — ya loggeado en respuesta del endpoint
      }
    }

    return {
      success: result.status !== 'error',
      runId,
      durationMs,
      processed: result.processed,
      status: result.status,
      errorMessage: result.errorMessage,
      skipped: result.status === 'skipped',
    }
  } catch (err) {
    const durationMs = Date.now() - startTime
    const errorMessage = err instanceof Error ? err.message : String(err)

    // 3b. Cerrar log con error
    if (runId) {
      try {
        await supabase.rpc('cron_run_end', {
          p_run_id: runId,
          p_status: 'error',
          p_processed: null,
          p_error_message: errorMessage,
          p_metadata: { stack: err instanceof Error ? err.stack?.slice(0, 500) : null },
        })
      } catch {
        // Silently ignore
      }
    }

    // Re-throw para que el endpoint maneje el error normalmente
    throw err
  }
}
