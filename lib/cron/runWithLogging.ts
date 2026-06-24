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
import { sql } from 'drizzle-orm'
import { getAdminDb } from '@/db/client'

// AGNÓSTICO (Fase C1): el logging de cron_runs va por Drizzle (getAdminDb, pool
// max:12 — NO el getDb max:1 que satura) en vez de supabase.rpc. El param `supabase`
// se mantiene en la firma (los crons lo siguen usando para su propio trabajo);
// runWithLogging ya no lo usa para el logging.
function rowsOf(res: unknown): any[] {
  return (Array.isArray(res) ? res : (res as { rows?: unknown[] }).rows || []) as any[]
}

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
    const startRes = await getAdminDb().execute(sql`SELECT cron_run_start(${cronName}, '{}'::jsonb) AS run_id`)
    const rid = rowsOf(startRes)[0]?.run_id
    if (rid) runId = rid as string
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
        await getAdminDb().execute(sql`
          SELECT cron_run_end(${runId}::uuid, ${result.status}, ${result.processed ?? null},
            ${result.errorMessage ?? null}, ${result.metadata ? JSON.stringify(result.metadata) : null}::jsonb)
        `)
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
        await getAdminDb().execute(sql`
          SELECT cron_run_end(${runId}::uuid, 'error', ${null},
            ${errorMessage}, ${JSON.stringify({ stack: err instanceof Error ? err.stack?.slice(0, 500) : null })}::jsonb)
        `)
      } catch {
        // Silently ignore
      }
    }

    // Re-throw para que el endpoint maneje el error normalmente
    throw err
  }
}
