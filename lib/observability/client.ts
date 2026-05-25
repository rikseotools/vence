// lib/observability/client.ts
//
// Captura activa client-side COMPLEMENTARIA a Sentry. Bloque 4 Gap 1.
//
// Sentry (sentry.client.config.ts) cubre:
//   - window.onerror, unhandledrejection (auto)
//   - console.error/warn (vía captureConsoleIntegration)
//   - fetch 5xx (vía httpClientIntegration)
//   - React Error Boundary (vía app/error.tsx + boundaries explícitos)
//   - Session Replay + breadcrumbs + grouping
//   - beforeSend hook espeja TODO a observable_events automáticamente
//
// Lo que Sentry NO cubre y CAPTURAMOS aquí:
//   - Errores pre-hydration (los pilla EarlyErrorsBridge inline script)
//   - Intent tracking — bug silencioso "clic sin efecto" donde el usuario
//     hace algo pero nada visible pasa (no es un Error como tal, no llega
//     a Sentry)
//   - Eventos custom de UX que queramos analizar con SQL
//
// El emit va a /api/observability/ingest directo (no por beforeSend Sentry,
// porque estos eventos no pasan por Sentry).

'use client'

import type { EventSeverity, EventSource } from './emit'

const SAMPLE_RATES: Record<string, number> = {
  intent_unfulfilled: 1.0,
  pre_hydration_error: 1.0,
}

const BUFFER_FLUSH_MS = 5000
const BUFFER_MAX_SIZE = 10
const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_PER_MSG = 5
const MAX_MESSAGE_LEN = 500
const MAX_STACK_LEN = 2000

export type ClientEventType =
  | 'pre_hydration_error'
  | 'intent_unfulfilled'
  | 'web_vital_degraded'
  | 'custom'

interface ClientEvent {
  ts: string
  source: EventSource
  severity: EventSeverity
  eventType: ClientEventType
  errorMessage?: string
  endpoint?: string
  userId?: string | null
  deployVersion?: string | null
  durationMs?: number | null
  metadata?: Record<string, unknown>
}

const buffer: ClientEvent[] = []
let installed = false
let currentUserId: string | null = null
let deployVersion: string | null = null
const rateLimitMap = new Map<string, number[]>()

/** Intent tracking: registra clicks que esperan respuesta visible. */
const pendingIntents = new Map<string, { startedAt: number; description: string }>()

/**
 * Instala UNA vez. Hooks redundantes con Sentry NO se instalan —
 * delegamos a Sentry (sentry.client.config.ts).
 */
export function installClientObservability(options?: {
  userId?: string | null
  deployVersion?: string | null
}): void {
  if (typeof window === 'undefined') return
  if (installed) return
  installed = true

  if (options?.userId !== undefined) currentUserId = options.userId
  if (options?.deployVersion !== undefined)
    deployVersion = options.deployVersion

  // Procesar errores pre-hydration que EarlyErrorsBridge capturó.
  // Sentry NO los pilla porque corre tras hydration.
  const earlyErrors = (
    window as Window & {
      __earlyErrors?: { msg: string; stack?: string; ts: number }[]
    }
  ).__earlyErrors
  if (Array.isArray(earlyErrors) && earlyErrors.length > 0) {
    for (const e of earlyErrors) {
      pushEvent({
        severity: 'error',
        eventType: 'pre_hydration_error',
        errorMessage: e.msg,
        metadata: { stack: e.stack, originalTs: e.ts },
      })
    }
    earlyErrors.length = 0
  }

  setInterval(() => flush(false), BUFFER_FLUSH_MS)
  window.addEventListener('beforeunload', () => flush(true))
  window.addEventListener('pagehide', () => flush(true))
}

export function setObservabilityUserId(userId: string | null): void {
  currentUserId = userId
}

/**
 * Marca un "intent" (intención del usuario). Llamar ANTES del click/action.
 * Si no se confirma con `confirmIntent` en N segundos → reporta como bug silencioso.
 *
 * @example
 *   <button onClick={() => {
 *     trackIntent('save-answer', 'Click guardar respuesta', 3000)
 *     await saveAnswer()
 *     confirmIntent('save-answer')
 *   }}>Guardar</button>
 */
export function trackIntent(
  id: string,
  description: string,
  timeoutMs = 5000,
): void {
  pendingIntents.set(id, { startedAt: Date.now(), description })
  setTimeout(() => {
    const intent = pendingIntents.get(id)
    if (intent) {
      // No se confirmó → bug silencioso
      pushEvent({
        severity: 'warn',
        eventType: 'intent_unfulfilled',
        errorMessage: `Intent no confirmado: ${intent.description}`,
        durationMs: Date.now() - intent.startedAt,
        metadata: { intentId: id },
      })
      pendingIntents.delete(id)
    }
  }, timeoutMs)
}

/** Confirma que la intención del usuario tuvo el efecto esperado. */
export function confirmIntent(id: string): void {
  pendingIntents.delete(id)
}

/** Emite un evento custom — para casos puntuales que no encajan en ninguna otra categoría. */
export function emitClientEvent(event: {
  severity: EventSeverity
  eventType: ClientEventType
  errorMessage?: string
  endpoint?: string
  durationMs?: number
  metadata?: Record<string, unknown>
}): void {
  pushEvent(event)
}

export function flushClientObservability(useBeacon = false): void {
  flush(useBeacon)
}

function pushEvent(partial: {
  severity: EventSeverity
  eventType: ClientEventType
  errorMessage?: string
  endpoint?: string
  durationMs?: number
  metadata?: Record<string, unknown>
}): void {
  const sampleRate = SAMPLE_RATES[partial.eventType] ?? 1.0
  if (Math.random() > sampleRate) return

  const fingerprint = `${partial.eventType}:${partial.errorMessage ?? '(no-msg)'}`
  if (!checkRateLimit(fingerprint)) return

  const scrubbedMsg = partial.errorMessage
    ? scrubPII(partial.errorMessage).slice(0, MAX_MESSAGE_LEN)
    : undefined

  const metadata = partial.metadata ? { ...partial.metadata } : undefined
  if (metadata?.stack && typeof metadata.stack === 'string') {
    metadata.stack = scrubPII(metadata.stack).slice(0, MAX_STACK_LEN)
  }

  buffer.push({
    ts: new Date().toISOString(),
    source: 'frontend',
    severity: partial.severity,
    eventType: partial.eventType,
    errorMessage: scrubbedMsg,
    endpoint: partial.endpoint ?? safeLocationPath(),
    userId: currentUserId,
    deployVersion,
    durationMs: partial.durationMs,
    metadata: {
      ...metadata,
      url: safeLocationPath(),
      userAgent: safeUserAgent(),
    },
  })

  if (buffer.length >= BUFFER_MAX_SIZE) flush(false)
}

function flush(useBeacon: boolean): void {
  if (buffer.length === 0) return
  const events = buffer.splice(0, buffer.length)
  const body = JSON.stringify({ events })

  if (useBeacon && typeof navigator !== 'undefined' && navigator.sendBeacon) {
    try {
      navigator.sendBeacon('/api/observability/ingest', body)
      return
    } catch {
      // fallthrough a fetch
    }
  }

  fetch('/api/observability/ingest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true,
  }).catch(() => {})
}

function checkRateLimit(fingerprint: string): boolean {
  const now = Date.now()
  const arr = rateLimitMap.get(fingerprint) ?? []
  const recent = arr.filter((t) => now - t < RATE_LIMIT_WINDOW_MS)
  if (recent.length >= RATE_LIMIT_PER_MSG) return false
  recent.push(now)
  rateLimitMap.set(fingerprint, recent)
  if (rateLimitMap.size > 100 && Math.random() < 0.01) {
    for (const [k, ts] of rateLimitMap.entries()) {
      if (ts.every((t) => now - t > RATE_LIMIT_WINDOW_MS)) {
        rateLimitMap.delete(k)
      }
    }
  }
  return true
}

function safeLocationPath(): string {
  try {
    return typeof location !== 'undefined' ? location.pathname : '/'
  } catch {
    return '/'
  }
}

function safeUserAgent(): string {
  try {
    return typeof navigator !== 'undefined'
      ? navigator.userAgent.slice(0, 200)
      : ''
  } catch {
    return ''
  }
}

function scrubPII(s: string): string {
  return s
    .replace(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi, '[email]')
    .replace(/\b\d{9,}\b/g, '[number]')
    .replace(/\beyJ[a-z0-9_-]+\.[a-z0-9_-]+\.[a-z0-9_-]+/gi, '[jwt]')
}
