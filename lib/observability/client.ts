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
  // TTS — bajo volumen (1 por sesión) al 100%, alto volumen muestreado.
  tts_session_start: 1.0,
  tts_session_end: 1.0,
  tts_chunk_skip: 1.0, // señal — watchdog skipped chunk, importante
  tts_no_voices: 1.0,
  tts_voices_load_timeout: 1.0,
  tts_chain_advance: 1.0,
  tts_error: 1.0,
  tts_unsupported: 1.0,
  tts_watchdog_retry: 0.1, // alto volumen — muestreo 10%
  tts_user_action: 0.2, // alto volumen — muestreo 20%
  tts_seek: 1.0, // bajo volumen — drag/skip por sección
  // Imágenes de preguntas (psicotécnicas con anexo, capturas Excel/Word, etc.).
  // El ERROR de carga es la señal accionable (usuario ve "no hay información"
  // porque la imagen no renderizó) → 100%. El LOAD exitoso es alto volumen pero
  // se muestrea al 10% para tener denominador y poder calcular la tasa de fallo.
  question_image_error: 1.0,
  question_image_loaded: 0.1,
  // Barra de meta diaria — bajo volumen (premium, interacción manual ocasional)
  // → 100% para tener la señal completa de quién oculta/mueve.
  daily_goal_banner_action: 1.0,
  // Avisos de la campana (Fase 8) — 100% para CTR fiable (shown=denominador,
  // clicked=numerador) mientras el volumen sea bajo.
  oposicion_alert_shown: 1.0,
  oposicion_alert_clicked: 1.0,
  oposicion_alert_dismissed: 1.0,
}

const BUFFER_FLUSH_MS = 5000
const BUFFER_MAX_SIZE = 10
const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_PER_MSG = 5
const MAX_MESSAGE_LEN = 500
const MAX_STACK_LEN = 2000

export type ClientEventType =
  | 'pre_hydration_error'
  // Sub-clasificaciones de errores pre-hydration. Reducen el ruido en el
  // contador de 'pre_hydration_error' severity:'error' (que disparaba alertas
  // por errores manejados automáticamente por React).
  | 'react_hydration_mismatch'
  | 'browser_extension_error'
  | 'intent_unfulfilled'
  | 'web_vital_degraded'
  | 'custom'
  // TTS — taxonomía completa documentada en docs/runbooks/observability.md §TTS
  | 'tts_session_start'
  | 'tts_session_end'
  | 'tts_chunk_skip'
  | 'tts_watchdog_retry'
  | 'tts_no_voices'
  | 'tts_voices_load_timeout'
  | 'tts_chain_advance'
  | 'tts_error'
  | 'tts_unsupported'
  | 'tts_user_action'
  | 'tts_seek'
  // Imágenes de preguntas — ¿renderizó realmente la imagen en el cliente?
  | 'question_image_loaded'
  | 'question_image_error'
  // Panel "Tu Evolución en esta pregunta": invariante de coherencia. Se emite si,
  // tras responder, el "último intento" mostrado NO refleja el intento actual
  // (desfase). Caza regresiones (volver a leer un agregado materializado desfasado)
  // o anomalías de datos SIN esperar a que un usuario lo reporte.
  | 'question_evolution_inconsistency'
  // Barra de meta diaria (premium) en la cabecera: interacciones de UX para
  // entender quién la mueve / oculta / re-activa y así pulir el diseño (en móvil
  // tapaba contenido). metadata.action ∈ {'drag','hide','show'}. userId va auto.
  | 'daily_goal_banner_action'
  // Banner global "Inscripción abierta" (boca-oreja). Antes era CIEGO (20/06): ni
  // impresiones, ni aperturas, ni cierres. Ahora medimos por convocatoria
  // (metadata.slug) → CTR, tasa de cierre y si el cooldown reduce el martilleo.
  | 'banner_inscription_viewed'
  | 'banner_inscription_clicked'
  | 'banner_inscription_dismissed'
  // Avisos de la campana 🔔 (Fase 8): engagement con los hitos de oposiciones
  // seguidas. shown=impresión al abrir la campana, clicked=clic "Ver
  // convocatoria", dismissed=X/swipe. metadata: {oposicion, hitoId, severity}.
  | 'oposicion_alert_shown'
  | 'oposicion_alert_clicked'
  | 'oposicion_alert_dismissed'
  // Diagnóstico (2026-06-18): un test se genera con MENOS preguntas de las
  // pedidas (feedback opoauxiliar... CARM: pide 25, salen 9). Server + adaptativo
  // probados devuelven el total → la merma es client-runtime. Captura el punto
  // exacto: fetcher, pedido, devueltas-server, mostradas-final + selección.
  | 'test_size_shortfall'

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
  //
  // Clasificación 2026-05-25 — Investigando spike de React #418 (hydration
  // mismatch). Antes todo iba con severity:'error' y eventType genérico
  // 'pre_hydration_error', lo que inflaba el contador de errores reales con
  // ruido handled-by-React. Ahora clasificamos:
  //   - React #418-423 (hydration / minified errors handled-by-React)
  //     → severity:'warn', eventType:'react_hydration_mismatch'.
  //     React hace fallback CSR re-render automáticamente; no es bug crítico.
  //   - chrome-extension:// o moz-extension:// en stack
  //     → severity:'debug', eventType:'browser_extension_error'.
  //   - resto → mantener severity:'error', eventType:'pre_hydration_error'.
  const earlyErrors = (
    window as Window & {
      __earlyErrors?: { msg: string; stack?: string; ts: number }[]
    }
  ).__earlyErrors
  if (Array.isArray(earlyErrors) && earlyErrors.length > 0) {
    for (const e of earlyErrors) {
      const classified = classifyEarlyError(e.msg, e.stack)
      pushEvent({
        severity: classified.severity,
        eventType: classified.eventType,
        errorMessage: e.msg,
        metadata: {
          stack: e.stack,
          originalTs: e.ts,
          pageUrl: typeof window !== 'undefined' ? window.location.pathname : null,
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 200) : null,
        },
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

/**
 * Clasifica un error pre-hydration capturado por EarlyErrorsBridge según su
 * forma. Reduce ruido en el contador de errores reales rebajando severity
 * de los errores conocidos handled-by-React o causados por extensiones.
 *
 * Patrones:
 *   - React #418-423 = errores minified de hydration mismatch.
 *     React hace fallback CSR re-render → no degrada UX → severity:'warn'.
 *     Ver https://react.dev/errors/418 — relacionados: 419, 421, 422, 423.
 *   - chrome-extension:// o moz-extension:// en el stack
 *     → causa #1 de errores client en producción (Translate, Grammarly,
 *     password managers que mutan el DOM antes de hydration). severity:'debug'.
 *   - resto → comportamiento previo: severity:'error', eventType original.
 */
function classifyEarlyError(
  msg: string,
  stack?: string,
): { severity: EventSeverity; eventType: ClientEventType } {
  // React errors minified — todos handled-by-React con CSR fallback.
  if (/Minified React error #(418|419|421|422|423)\b/.test(msg)) {
    return { severity: 'warn', eventType: 'react_hydration_mismatch' }
  }
  // Browser extensions tocando el DOM.
  if (stack && /chrome-extension:\/\/|moz-extension:\/\/|safari-extension:\/\//.test(stack)) {
    return { severity: 'debug', eventType: 'browser_extension_error' }
  }
  // Resto: error real, severity max.
  return { severity: 'error', eventType: 'pre_hydration_error' }
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
