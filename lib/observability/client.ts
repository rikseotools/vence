// lib/observability/client.ts
//
// Observabilidad client-side 100% IN-HOUSE (Sentry retirado 05/07/2026).
// Este SDK es ahora la ÚNICA captura de errores de cliente.
//
// installClientObservability() instala:
//   - window 'error'        → 'unhandled_error' (excepción JS no capturada)
//   - 'unhandledrejection'  → 'unhandled_rejection'
//   - console.error/warn    → 'console_error' / 'console_warn'
//   - wrapper de fetch      → 'http_5xx' / 'http_4xx' / 'http_network_error'
//   - EarlyErrorsBridge     → 'pre_hydration_error' (errores pre-hydration)
//   - Intent tracking       → 'intent_unfulfilled' (clic sin efecto visible)
//   - Eventos custom de UX (tts, banners, imágenes…) para análisis SQL
//
// Los React Error Boundaries (app/error.tsx, global-error.tsx) emiten aparte
// ('react_error_boundary'). Todo va a /api/observability/ingest → observable_events.
// Cada evento pasa por pushEvent(): sampling + rate-limit (5/msg/60s) + scrubPII.

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
  // Flechitas de tendencia del temario — bajo volumen, 100% para señal completa.
  topic_trend_action: 1.0,
  // Avisos de la campana (Fase 8) — 100% para CTR fiable (shown=denominador,
  // clicked=numerador) mientras el volumen sea bajo.
  oposicion_alert_shown: 1.0,
  oposicion_alert_clicked: 1.0,
  oposicion_alert_dismissed: 1.0,
  // Captura nativa: errores al 100% (señal accionable); console.warn muestreado
  // (alto volumen). El rate-limit por fingerprint (5/msg/60s) es el segundo cerco.
  unhandled_error: 1.0,
  unhandled_rejection: 1.0,
  console_error: 1.0,
  console_warn: 0.3,
  http_5xx: 1.0,
  http_4xx: 1.0,
  http_network_error: 1.0,
  react_error_boundary: 1.0,
  chunk_load_error: 1.0,
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
  // Límite de uso alcanzado (dispositivos / diario) al guardar una respuesta. Es
  // una respuesta ESPERADA del servidor (403; el usuario ve un modal), NO un error.
  // event_type propio para CONSERVAR visibilidad (cuántos usuarios topan el límite)
  // SIN disparar RULE_CLIENT_ERROR_SPIKE (que solo cuenta unhandled_error/
  // unhandled_rejection/react_error_boundary/client_error). Ver
  // utils/answerSaveQueue.ts + utils/psychometricSaveQueue.ts.
  | 'usage_limit_hit'
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
  // Flechitas de tendencia (▲/▼ de 30 días) en el temario: quién las oculta /
  // re-activa, para entender la fricción de la métrica. metadata.action ∈
  // {'show','hide','toggle_failed'}. userId va auto.
  | 'topic_trend_action'
  // Banner global "Inscripción abierta" (boca-oreja). Antes era CIEGO (20/06): ni
  // impresiones, ni aperturas, ni cierres. Ahora medimos por convocatoria
  // (metadata.slug) → CTR, tasa de cierre y si el cooldown reduce el martilleo.
  | 'banner_inscription_viewed'
  | 'banner_inscription_clicked'
  | 'banner_inscription_dismissed'
  // Cards de "Otras convocatorias abiertas (sin test todavía)" en /oposiciones/
  // inscripcion-abierta: clic hacia la convocatoria OFICIAL. Señal de demanda directa
  // (qué catalogada construir después). metadata.slug = qué convocatoria.
  | 'catalogada_inscription_clicked'
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
  // ── Captura nativa in-house (2026-07-05, retirada de Sentry) ──────────────
  // Reemplazan lo que antes delegábamos a Sentry (window.onerror,
  // unhandledrejection, console, httpClientIntegration). Documentado en
  // docs/runbooks/observability.md §Captura nativa cliente.
  | 'unhandled_error' // window 'error' (excepción JS no capturada)
  | 'unhandled_rejection' // promesa rechazada sin catch
  | 'console_error' // console.error() del código de la app
  | 'console_warn' // console.warn()
  | 'http_5xx' // fetch cliente → respuesta 5xx (alimenta RULE_HTTP_5XX_SPIKE)
  | 'http_4xx' // fetch cliente → 4xx inesperado (excluye 401/403/404/409/429)
  | 'http_network_error' // fetch que revienta (offline/DNS/CORS)
  | 'react_error_boundary' // app/error.tsx + global-error.tsx
  | 'client_error' // logClientError() — errores manejados en componentes
  | 'chunk_load_error' // chunk viejo 404 tras deploy → auto-reload de recuperación

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
 * Instala UNA vez todos los hooks de captura in-house (ver cabecera del fichero).
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

  // Captura nativa in-house (reemplaza las integraciones de Sentry, ya retirado).
  installNativeCaptures()

  setInterval(() => flush(false), BUFFER_FLUSH_MS)
  window.addEventListener('beforeunload', () => { pageLeaving = true; flush(true) })
  window.addEventListener('pagehide', () => { pageLeaving = true; flush(true) })
  // Restaurada de bfcache → la página vuelve a estar viva; los fetch ya no se
  // están abortando por navegación.
  window.addEventListener('pageshow', () => { pageLeaving = false })
}

// ═══════════════════════════════════════════════════════════════════════════
// Captura nativa: window.onerror, unhandledrejection, console, fetch.
// Antes lo hacía Sentry (httpClientIntegration + captureConsoleIntegration +
// auto onerror/unhandledrejection). Retirado Sentry → lo hacemos in-house.
// Todo va por pushEvent() → sampling + rate-limit + scrubPII + buffer/flush.
// ═══════════════════════════════════════════════════════════════════════════

/** fetch original, guardado antes de envolver (para uso interno seguro). */
let origFetch: typeof fetch | null = null
/**
 * `true` mientras la página se está descargando/navegando (beforeunload/pagehide).
 * Los fetch en vuelo que revientan en ese momento lo hacen porque el navegador
 * está cancelando la request (a menudo "Failed to fetch", que NO es AbortError),
 * no por un fallo de red real → no se reportan como http_network_error. Es la
 * misma semántica que la exclusión de AbortError, extendida al cierre de pestaña
 * y al background en móvil (visibility hidden), que era la fuente dominante de
 * ruido en /api/auth/* (diagnóstico 08/07/2026).
 */
let pageLeaving = false
/** Anti-recursión del wrapper de console (nuestro propio código no se re-captura). */
let inConsoleCapture = false

function installNativeCaptures(): void {
  // 1. Excepciones JS no capturadas (antes: Sentry auto onerror).
  window.addEventListener('error', (event: ErrorEvent) => {
    // Errores de carga de recurso (img/script) llegan aquí sin event.error;
    // los de imágenes ya se cubren con question_image_error → ignorar ruido.
    if (event.target && event.target !== window) return
    const err = event.error as Error | undefined
    const stack = err?.stack
    const msg = event.message || err?.message || 'unhandled error'
    // Chunk viejo 404 tras deploy → recuperar con reload (ver recoverFromChunkError).
    if (recoverFromChunkError(err?.name, msg)) return
    // Extensiones del navegador = causa #1 de ruido → debug, no error.
    if (stack && /chrome-extension:\/\/|moz-extension:\/\/|safari-extension:\/\//.test(stack)) {
      pushEvent({ severity: 'debug', eventType: 'browser_extension_error', errorMessage: msg, metadata: { stack } })
      return
    }
    pushEvent({
      severity: 'error',
      eventType: 'unhandled_error',
      errorMessage: msg,
      metadata: { stack, filename: event.filename, lineno: event.lineno, colno: event.colno },
    })
  })

  // 2. Promesas rechazadas sin catch (antes: Sentry auto unhandledrejection).
  window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
    const reason = event.reason
    const isErr = reason instanceof Error
    const msg = isErr ? reason.message : typeof reason === 'string' ? reason : safeStringify(reason)
    // import() dinámico que falla (chunk viejo 404 tras deploy) llega como rejection.
    if (recoverFromChunkError(isErr ? reason.name : undefined, msg)) return
    pushEvent({
      severity: 'error',
      eventType: 'unhandled_rejection',
      errorMessage: msg || 'unhandled rejection',
      metadata: { stack: isErr ? reason.stack : undefined },
    })
  })

  // 3. console.error / console.warn (antes: captureConsoleIntegration).
  installConsoleCapture()

  // 4. fetch cliente 4xx/5xx/red (antes: httpClientIntegration, solo 5xx).
  installFetchCapture()
}

function installConsoleCapture(): void {
  for (const level of ['error', 'warn'] as const) {
    const original = console[level].bind(console)
    console[level] = (...args: unknown[]) => {
      original(...args) // preservar comportamiento nativo SIEMPRE
      if (inConsoleCapture) return // no re-capturar nuestro propio ruido
      inConsoleCapture = true
      try {
        const msg = args
          .map((a) => (a instanceof Error ? a.stack || a.message : typeof a === 'string' ? a : safeStringify(a)))
          .join(' ')
        // Ruido conocido (se SIGUE trackeando en debug, pero no cuenta como error):
        //  - Google Sign-In FedCM (widget de terceros, no es bug nuestro)
        //  - 401 esperados pre-login (componentes que fetchean antes de auth;
        //    coherente con isExpectedStatus del wrapper de fetch)
        const isNoise = /\[GSI_LOGGER\]|FedCM|\b401\b|HTTP 401/i.test(msg)
        pushEvent({
          severity: isNoise ? 'debug' : level === 'error' ? 'error' : 'warn',
          eventType: level === 'error' ? 'console_error' : 'console_warn',
          errorMessage: msg,
        })
      } catch {
        // nunca romper console
      } finally {
        inConsoleCapture = false
      }
    }
  }
}

function installFetchCapture(): void {
  if (typeof window.fetch !== 'function') return
  origFetch = window.fetch.bind(window)
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    const method = (init?.method || (input instanceof Request ? input.method : 'GET') || 'GET').toUpperCase()
    try {
      const res = await origFetch!(input as RequestInfo, init)
      if (observeUrl(url) && !isExpectedStatus(res.status, url)) {
        if (res.status >= 500) {
          pushEvent({ severity: 'error', eventType: 'http_5xx', endpoint: pathOf(url), errorMessage: `${method} ${res.status} ${res.statusText}`, metadata: { method, status: res.status } })
        } else if (res.status >= 400) {
          pushEvent({ severity: 'warn', eventType: 'http_4xx', endpoint: pathOf(url), errorMessage: `${method} ${res.status} ${res.statusText}`, metadata: { method, status: res.status } })
        }
      }
      return res
    } catch (err) {
      // fetch que revienta: offline, DNS, CORS, abort. NO reportar cuando:
      //  - Es AbortError (navegación/cancelación explícita del usuario).
      //  - La página se está descargando (pageLeaving) o está en background
      //    (visibility hidden). En esos casos el navegador cancela las requests
      //    en vuelo con "Failed to fetch" — que no es AbortError — y era el
      //    grueso del ruido benigno en /api/auth/* desde móviles (08/07/2026).
      const name = err instanceof Error ? err.name : ''
      const leaving = pageLeaving
        || (typeof document !== 'undefined' && document.visibilityState === 'hidden')
      if (observeUrl(url) && name !== 'AbortError' && !leaving) {
        pushEvent({ severity: 'warn', eventType: 'http_network_error', endpoint: pathOf(url), errorMessage: err instanceof Error ? err.message : String(err), metadata: { method } })
      }
      throw err // NUNCA alterar el comportamiento del fetch original
    }
  }
}

/** Solo observamos API same-origin; excluye el propio /ingest (anti-bucle) y hosts externos. */
export function observeUrl(url: string): boolean {
  try {
    const u = new URL(url, window.location.origin)
    if (u.origin !== window.location.origin) return false
    if (u.pathname.startsWith('/api/observability')) return false
    return u.pathname.startsWith('/api/')
  } catch {
    return false
  }
}

/** Estados 4xx que son parte del flujo normal → NO son señal de bug. */
export function isExpectedStatus(status: number, url: string): boolean {
  if (status < 400) return true
  if (status === 401) return true // pre-login / refresh de token
  if (status === 403) return true // reto anti-scraping (/api/answer, /questions/filtered) + permisos
  if (status === 404) return true // recurso opcional; demasiado ruidoso
  if (status === 409) return true // conflicto manejado (anti-duplicado)
  if (status === 429) return true // rate-limit esperado
  void url
  return false
}

function pathOf(url: string): string {
  try {
    return new URL(url, window.location.origin).pathname
  } catch {
    return url.slice(0, 200)
  }
}

function safeStringify(v: unknown): string {
  try {
    return typeof v === 'object' ? JSON.stringify(v) : String(v)
  } catch {
    return String(v)
  }
}

/**
 * Recuperación de `ChunkLoadError`: cuando el usuario está en un bundle viejo y
 * tras un deploy pide un chunk que ya no existe en el origen (404), Next.js tira
 * un ChunkLoadError → sin manejo, la app se CONGELA. Aquí lo detectamos y forzamos
 * un reload (que trae el index.html + bundle nuevos, con chunks que sí existen).
 *
 * Anti-bucle: guardamos el timestamp del último reload en sessionStorage; si el
 * chunk vuelve a fallar en <30s NO recargamos otra vez (evita loop si el problema
 * persistiera). Devuelve true si era un chunk error (ya manejado → el caller
 * NO debe emitir un error genérico encima).
 */
/** Predicado puro: ¿es un fallo de carga de chunk (bundle viejo tras deploy)? */
export function isChunkLoadError(errName: string | undefined, msg: string): boolean {
  return (
    errName === 'ChunkLoadError' ||
    /Loading chunk [\w-]+ failed|Loading CSS chunk|Failed to fetch dynamically imported module|error loading dynamically imported module|importing a module script failed/i.test(msg || '')
  )
}

const CHUNK_RELOAD_KEY = 'vence_chunk_reload_at'
function recoverFromChunkError(errName: string | undefined, msg: string): boolean {
  if (!isChunkLoadError(errName, msg)) return false

  pushEvent({
    severity: 'warn',
    eventType: 'chunk_load_error',
    errorMessage: msg,
    metadata: { recovered: true },
  })

  try {
    const last = Number(sessionStorage.getItem(CHUNK_RELOAD_KEY) || 0)
    const now = Date.now()
    if (now - last < 30_000) return true // ya recargamos hace poco → no re-loop
    sessionStorage.setItem(CHUNK_RELOAD_KEY, String(now))
    flush(true) // enviar el evento (beacon) ANTES de recargar
    window.location.reload()
  } catch {
    // sessionStorage bloqueado / SSR → intento de reload de todos modos
    try {
      window.location.reload()
    } catch {
      /* noop */
    }
  }
  return true
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
