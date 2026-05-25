// lib/observability/emit.ts
//
// Emisor de eventos observables desde el frontend Vercel.
// Bloque 4 del docs/ARCHITECTURE_ROADMAP.md.
//
// Escribe DIRECTAMENTE a la tabla `observable_events` vía Drizzle (mismo
// patrón que `validation_error_logs` actual — no añade latencia ni
// dependencia HTTP). Cross-runtime coherente: el backend NestJS también
// escribe directo a la misma tabla.
//
// Patrón fire-and-forget: NUNCA bloquea la respuesta del usuario. Si la
// BD cae, el evento se pierde (aceptable — el path principal siempre va
// antes). El error se loguea a `console.warn` para detección secundaria.

import { getAdminDb } from '@/db/client'
import { sql } from 'drizzle-orm'

export type EventSeverity = 'debug' | 'info' | 'warn' | 'error' | 'critical'

export type EventSource = 'vercel' | 'fargate' | 'gha' | 'frontend'

export interface ObservableEvent {
  /** Origen del evento. Para Vercel functions = 'vercel'. */
  source: EventSource
  /** Severidad. */
  severity: EventSeverity
  /** Categoría: 'http_5xx', 'cron_run', 'deploy', 'cache_invalidation', etc. */
  eventType: string
  /** Endpoint asociado al evento (si aplica). */
  endpoint?: string | null
  /** Usuario asociado (si aplica). */
  userId?: string | null
  /** Deploy version (commit SHA del frontend si lo conocemos). */
  deployVersion?: string | null
  /** Duración del evento en ms (si aplica — http requests, jobs). */
  durationMs?: number | null
  /** HTTP status (si aplica). */
  httpStatus?: number | null
  /** Mensaje de error (si aplica). */
  errorMessage?: string | null
  /** Metadata libre — campos específicos del eventType. */
  metadata?: Record<string, unknown> | null
  /** Timestamp del evento. Default NOW() — sobrescribir solo si se emite en background. */
  ts?: Date
}

/**
 * Emite un evento a `observable_events`. Fire-and-forget — no bloquea
 * la respuesta del caller. Si la BD falla, el evento se pierde y se loguea
 * a consola.
 *
 * Uso típico:
 *   import { emit } from '@/lib/observability/emit'
 *   await emit({ source: 'vercel', severity: 'error', eventType: 'http_5xx',
 *                endpoint: '/api/foo', httpStatus: 503, errorMessage: '...' })
 */
export async function emit(event: ObservableEvent): Promise<void> {
  try {
    const db = getAdminDb()
    if (!db) {
      console.warn('[observability/emit] getAdminDb() devolvió null — evento perdido')
      return
    }

    await db.execute(sql`
      INSERT INTO public.observable_events (
        ts, source, severity, event_type, endpoint, user_id,
        deploy_version, duration_ms, http_status, error_message, metadata
      ) VALUES (
        COALESCE(${event.ts ?? null}, NOW()),
        ${event.source},
        ${event.severity},
        ${event.eventType},
        ${event.endpoint ?? null},
        ${event.userId ?? null}::uuid,
        ${event.deployVersion ?? null},
        ${event.durationMs ?? null},
        ${event.httpStatus ?? null},
        ${event.errorMessage ?? null},
        ${event.metadata ? JSON.stringify(event.metadata) : null}::jsonb
      )
    `)
  } catch (err) {
    // NUNCA propagar — observabilidad NO debe romper requests reales
    console.warn(
      '[observability/emit] INSERT falló:',
      err instanceof Error ? err.message : String(err),
    )
  }
}

/**
 * Variant fire-and-forget — no espera la promise. Para callers que no
 * quieren `await emit(...)` (ej. dentro de catch blocks que no son async).
 */
export function emitFireAndForget(event: ObservableEvent): void {
  emit(event).catch(() => {
    /* ya logueado en emit */
  })
}
