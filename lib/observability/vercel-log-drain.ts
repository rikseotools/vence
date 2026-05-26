// lib/observability/vercel-log-drain.ts
//
// Parser PURO del formato Vercel Log Drain → ObservableEvent.
//
// CONTEXTO (2026-05-26, Gap 14 del manual observability.md):
// Vercel mata lambdas con SIGTERM cuando exceden `maxDuration` (504
// Runtime Timeout). El código de app NUNCA ve esto — la lambda muere
// antes de retornar response. Único modo de capturarlo: que Vercel
// mismo emita los logs HTTP del edge a un HTTPS endpoint nuestro.
//
// Vercel Log Drains: dashboard Vercel → Settings → Log Drains →
//   HTTPS endpoint: https://www.vence.es/api/observability/vercel-log-drain
//   Custom headers: x-ingest-secret: <OBSERVABILITY_INGEST_SECRET>
//   Sources: lambda, edge (sin 'static' para evitar ruido)
//   Format: ndjson (preferido) o json (legacy array)
//
// El parser tolera ambos formatos y campos opcionales (Vercel evoluciona
// el schema). Solo filtra entries relevantes (≥400 o level=error/warn) —
// el ruido de logs info de éxito ya lo capturamos vía
// `withErrorLogging` con sampling 10% en el código de app.

import type { ObservableEvent, EventSeverity } from './sink'

/**
 * Shape laxo de un log entry de Vercel. Tolerante a evolución del schema.
 * Campos opcionales reflejan que diferentes sources/runtimes incluyen
 * diferente metadata.
 */
export interface VercelLogEntry {
  id?: string
  message?: string
  /** Unix ms */
  timestamp?: number
  level?: string // 'info'|'warning'|'warn'|'error'|'log'|'debug'
  source?: string // 'lambda'|'edge'|'build'|'static'|'external'
  type?: string // 'stdout'|'stderr'
  deploymentId?: string
  projectId?: string
  host?: string
  path?: string
  method?: string
  statusCode?: number
  responseStatusCode?: number // alias en algunos formatos
  requestId?: string
  executionRegion?: string
  requestUserAgent?: string
  /** Recolección de cualquier otro campo que llegue. */
  [key: string]: unknown
}

/**
 * Parsea el body de un POST de Vercel Log Drain. Acepta:
 *  - NDJSON: `{...}\n{...}\n{...}`
 *  - JSON array: `[{...}, {...}]`
 *  - JSON single object: `{...}` (raro, pero defensivo)
 *
 * Filas malformadas se ignoran silenciosamente (Vercel a veces inyecta
 * separadores o líneas vacías).
 */
export function parseVercelLogBody(rawBody: string): VercelLogEntry[] {
  const trimmed = rawBody.trim()
  if (!trimmed) return []

  // JSON array
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed)
      if (Array.isArray(parsed)) return parsed as VercelLogEntry[]
    } catch {
      // Cae al NDJSON fallback abajo
    }
  }

  // JSON object único
  if (trimmed.startsWith('{') && !trimmed.includes('\n')) {
    try {
      const parsed = JSON.parse(trimmed)
      if (typeof parsed === 'object' && parsed !== null) {
        return [parsed as VercelLogEntry]
      }
    } catch {
      // Cae al NDJSON fallback
    }
  }

  // NDJSON: una línea por entry
  const lines = trimmed.split('\n')
  const entries: VercelLogEntry[] = []
  for (const line of lines) {
    const l = line.trim()
    if (!l) continue
    try {
      const parsed = JSON.parse(l) as VercelLogEntry
      entries.push(parsed)
    } catch {
      // Línea malformada — Vercel a veces inyecta separadores raros.
      // Ignorar silenciosamente; el resto del batch debe persistir.
    }
  }
  return entries
}

/**
 * Decide si un entry merece ser persistido en `observable_events`.
 * Filtramos info noise — sólo nos interesan errores y warnings.
 *
 * Reglas:
 *  - statusCode ≥ 400 → SÍ (incluye los 504 SIGTERM, motivo del gap).
 *  - level ∈ {error, warning, warn} → SÍ.
 *  - source = 'build' → SÍ si level=error (deploy fallidos).
 *  - Resto (info logs de lambdas exitosas) → NO.
 */
export function shouldPersist(entry: VercelLogEntry): boolean {
  const status = entry.statusCode ?? entry.responseStatusCode
  if (typeof status === 'number' && status >= 400) return true

  const level = entry.level?.toLowerCase()
  if (level === 'error' || level === 'warning' || level === 'warn') return true

  return false
}

/**
 * Mapea level de Vercel → severity canónico de observable_events.
 */
function mapSeverity(entry: VercelLogEntry): EventSeverity {
  const status = entry.statusCode ?? entry.responseStatusCode
  // Status code manda sobre level si ambos están
  if (typeof status === 'number') {
    if (status >= 500) return 'critical'
    if (status >= 400) return 'warn'
  }
  const level = entry.level?.toLowerCase()
  if (level === 'error') return 'error'
  if (level === 'warning' || level === 'warn') return 'warn'
  if (level === 'debug') return 'debug'
  return 'info'
}

/**
 * Mapea el entry de Vercel → eventType canónico.
 *
 * - 5xx con timeout message → `runtime_kill` (es el caso del Gap 14).
 * - 5xx genérico → `http_5xx`.
 * - 4xx → `http_4xx`.
 * - Errores build → `deploy_failed`.
 * - Resto → `vercel_log` (genérico, para no perder señal).
 */
function mapEventType(entry: VercelLogEntry): string {
  const status = entry.statusCode ?? entry.responseStatusCode
  const msg = (entry.message ?? '').toLowerCase()

  if (typeof status === 'number') {
    if (status >= 500) {
      // Detectar runtime kill por mensaje característico
      if (
        msg.includes('runtime timeout') ||
        msg.includes('task timed out') ||
        msg.includes('exceeded memory') ||
        msg.includes('exceeded the maximum')
      ) {
        return 'runtime_kill'
      }
      return 'http_5xx'
    }
    if (status >= 400) return 'http_4xx'
  }

  if (entry.source === 'build' && entry.level === 'error') {
    return 'deploy_failed'
  }

  return 'vercel_log'
}

/**
 * Traduce un VercelLogEntry a ObservableEvent. Asume que `shouldPersist`
 * ya filtró — esta función NO comprueba relevancia.
 */
export function toObservableEvent(entry: VercelLogEntry): ObservableEvent {
  const status = entry.statusCode ?? entry.responseStatusCode ?? null
  // deploymentId es 'dpl_xxxxxxxxx' — extraemos el sufijo corto que se
  // alinea con VERCEL_GIT_COMMIT_SHA?.slice(0,8) usado en el resto del
  // código (longitud diferente, pero ambos identifican el deploy).
  const deployVersion = entry.deploymentId
    ? entry.deploymentId.replace(/^dpl_/, '').slice(0, 8)
    : null

  return {
    source: 'vercel',
    severity: mapSeverity(entry),
    eventType: mapEventType(entry),
    endpoint: entry.path ?? null,
    deployVersion,
    httpStatus: status,
    errorMessage: (entry.message ?? '').slice(0, 2000) || null,
    ts: typeof entry.timestamp === 'number'
      ? new Date(entry.timestamp).toISOString()
      : undefined,
    metadata: {
      drain: true, // marca: este evento vino del Log Drain, no del wrapper
      vercelLogId: entry.id ?? null,
      vercelSource: entry.source ?? null,
      vercelType: entry.type ?? null,
      executionRegion: entry.executionRegion ?? null,
      requestId: entry.requestId ?? null,
      method: entry.method ?? null,
      host: entry.host ?? null,
      userAgent: entry.requestUserAgent?.slice(0, 200) ?? null,
    },
  }
}
