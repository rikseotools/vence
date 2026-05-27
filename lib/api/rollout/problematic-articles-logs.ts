// lib/api/rollout/problematic-articles-logs.ts
// Logging fire-and-forget para el rollout de artículos problemáticos.
// Ver docs/maintenance/despliegue-articulos-problematicos.md

import { sql } from 'drizzle-orm'
import { getAdminDb } from '@/db/client'

export type RolloutLogPath = 'new' | 'old'

export type LogRolloutEventInput = {
  userId: string | null
  positionType?: string | null
  path: RolloutLogPath
  articlesCount: number
  lawNames?: string[]
  durationMs?: number
}

/**
 * Registra un evento del rollout. Ejecuta en background (fire-and-forget)
 * para no bloquear la respuesta. Cualquier error se loguea pero no propaga.
 *
 * Migración 27/05/2026 (Fase 3 strangler fig agnosticismo-supabase):
 * `supabase.from('problematic_articles_rollout_logs').insert()` → raw SQL
 * via Drizzle. La tabla no está en `db/schema.ts` (no es prioritaria para
 * tipado), pero el INSERT es 100% portable a cualquier Postgres.
 */
// Timeout máximo para el INSERT fire-and-forget. Sin esto, una conexión
// colgada en wait=Client/ClientRead acumula slot zombie (mismo footgun
// que causó el incidente 27/05/2026 — ver docs/runbooks/observability.md
// §"⚠️ FOOTGUN"). 5s conservador: INSERT normal <5ms.
const ROLLOUT_LOG_TIMEOUT_MS = 5_000

export function logRolloutEvent(input: LogRolloutEventInput): void {
  const run = async () => {
    try {
      const db = getAdminDb()
      const lawNames = (input.lawNames ?? []).slice(0, 5)
      const insertPromise = db.execute(sql`
        INSERT INTO problematic_articles_rollout_logs
          (user_id, position_type, path, articles_count, law_names, duration_ms)
        VALUES
          (${input.userId},
           ${input.positionType ?? null},
           ${input.path},
           ${input.articlesCount},
           ${lawNames}::text[],
           ${input.durationMs ?? null})
      `)
      await Promise.race([
        insertPromise,
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error(`[rollout-log] timeout >${ROLLOUT_LOG_TIMEOUT_MS}ms`)),
            ROLLOUT_LOG_TIMEOUT_MS,
          ),
        ),
      ])
    } catch (e) {
      console.warn('⚠️ [rollout-log] Insert falló:', (e as Error).message)
    }
  }
  void run()
}
