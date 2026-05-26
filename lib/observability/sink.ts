// lib/observability/sink.ts
//
// Interfaz `ObservableSink` — preparación para la migración Vercel+Supabase
// → AWS (Kinesis/MSK + OpenSearch/RDS) sin reescribir el código de app.
//
// FILOSOFÍA (alineada con docs/runbooks/observability.md §4):
//   «AWS-native by default. Agnóstico by contract.»
//
// El código de aplicación solo conoce `ObservableSink`. La implementación
// concreta se decide en una sola fábrica (`getSink()`) por env/config:
//
//   - HOY (Vercel+Supabase, 5k DAU): PostgresSink → INSERT directo a
//     observable_events.
//   - FUTURO (AWS, 30k+ DAU): KinesisSink → PutRecord a Kinesis Data
//     Streams. Firehose hace el fan-out garantizado at-least-once a
//     OpenSearch (hot), S3 Parquet (cold) y/o Aurora (subset SQL).
//
// El swap es UNA línea en `getSink()`. Cero cambios en callers.
//
// ¿Por qué interfaz y no función? — Permite ser inyectada en tests
// (FakeSink que captura llamadas) y permite múltiples sinks paralelos
// (PostgresSink + CloudWatchLogsSink durante migración AWS).

import { getAdminDb } from '@/db/client'
import { sql } from 'drizzle-orm'

// ─── Modelo de evento (compatible con OpenTelemetry semantic conventions) ──
// Mantenemos la shape actual para back-compat. Los campos opcionales
// `traceId`/`spanId` quedan reservados para Fase 5 (tracing distribuido).

export type EventSeverity = 'debug' | 'info' | 'warn' | 'error' | 'critical'
export type EventSource = 'vercel' | 'fargate' | 'gha' | 'frontend'

export interface ObservableEvent {
  source: EventSource
  severity: EventSeverity
  eventType: string
  endpoint?: string | null
  userId?: string | null
  deployVersion?: string | null
  durationMs?: number | null
  httpStatus?: number | null
  errorMessage?: string | null
  metadata?: Record<string, unknown> | null
  /** Timestamp del evento. Default NOW() en sink — sobrescribir solo si
   *  se emite en background (cron retroactivo, replay). Acepta `Date` o
   *  string ISO 8601 (postgres-js coerciona ambos en el INSERT). */
  ts?: Date | string
  /** Reservado Fase 5 — OpenTelemetry trace context propagation. */
  traceId?: string | null
  spanId?: string | null
}

// ─── Contrato del sink ────────────────────────────────────────────────────

export interface ObservableSink {
  /**
   * Persiste un evento. Debe ser at-most-once en single sink (no duplicar)
   * y resilient: NUNCA propagar errores al caller. La observabilidad
   * NO debe romper requests reales.
   */
  emit(event: ObservableEvent): Promise<void>

  /**
   * Identificador del sink — útil para logs/diagnostico cuando hay
   * múltiples sinks activos.
   */
  readonly name: string
}

// ─── Implementación HOY: PostgresSink ─────────────────────────────────────

class PostgresSink implements ObservableSink {
  readonly name = 'postgres'

  async emit(event: ObservableEvent): Promise<void> {
    try {
      const db = getAdminDb()
      if (!db) {
        console.warn('[sink/postgres] getAdminDb() devolvió null — evento perdido')
        return
      }
      const severity = normalizeSeverity(event.severity)
      await db.execute(sql`
        INSERT INTO public.observable_events (
          ts, source, severity, event_type, endpoint, user_id,
          deploy_version, duration_ms, http_status, error_message, metadata
        ) VALUES (
          COALESCE(${event.ts ?? null}, NOW()),
          ${event.source},
          ${severity},
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
      console.warn(
        '[sink/postgres] INSERT falló:',
        err instanceof Error ? err.message : String(err),
      )
    }
  }
}

// ─── Implementación FUTURA: KinesisSink (placeholder, no activado) ────────
//
// Cuando migremos a AWS (~30k DAU), descomentar y configurar:
//
//   class KinesisSink implements ObservableSink {
//     readonly name = 'kinesis'
//     constructor(private streamName: string, private region: string) {}
//     async emit(event: ObservableEvent): Promise<void> {
//       try {
//         await kinesisClient.send(new PutRecordCommand({
//           StreamName: this.streamName,
//           PartitionKey: event.source,
//           Data: Buffer.from(JSON.stringify(event)),
//         }))
//       } catch (err) {
//         console.warn('[sink/kinesis] PutRecord falló:', err)
//       }
//     }
//   }
//
// Firehose hace fan-out automático a:
//   - S3 Parquet (cold path, Athena queries)
//   - OpenSearch (hot path, dashboard sub-segundo)
//   - Lambda → RDS/Aurora (subset crítico para JOIN con users)
//
// La interfaz `ObservableSink` no cambia. Solo cambia la fábrica.

// ─── Normalización severity (compartida entre sinks) ──────────────────────
// validation_error_logs usa 'warning' (con -ing), observable_events
// estandariza en 'warn'. Aceptamos también variantes obvias para que
// callers diversos no rompan el CHECK constraint.

export function normalizeSeverity(s: string): EventSeverity {
  const lower = String(s).toLowerCase()
  if (lower === 'warning') return 'warn'
  if (lower === 'fatal' || lower === 'crit') return 'critical'
  if (lower === 'err') return 'error'
  if (['debug', 'info', 'warn', 'error', 'critical'].includes(lower)) {
    return lower as EventSeverity
  }
  return 'warn' // default conservador
}

// ─── Fábrica — punto único de decisión ────────────────────────────────────
//
// Cambiar de sink = cambiar AQUÍ. Cero líneas en callers afectadas.
// En producción Vercel hoy: Postgres. Mañana AWS: Kinesis (+ Postgres
// secundario durante migración para A/B).

let _singleton: ObservableSink | null = null

export function getSink(): ObservableSink {
  if (_singleton) return _singleton
  // Hoy: única opción. En migración AWS, leer process.env.OBS_SINK
  // ('postgres' | 'kinesis' | 'multi') y construir según corresponda.
  _singleton = new PostgresSink()
  return _singleton
}

/** Solo para tests — permite inyectar FakeSink. NO USAR en producción. */
export function _setSinkForTests(sink: ObservableSink | null): void {
  _singleton = sink
}
