// lib/observability/eventLoopLag.ts
//
// Sampler de EVENT-LOOP LAG del runtime Next.js (frontend, contenedor Fargate
// de larga vida = `node server-keepalive.cjs`). Nace del postmortem del 21/07
// (docs/architecture/incidente-frontend-healthcheck-cascade-21jul.md, Capa 5):
// la cascada de 504 fue el event-loop de Node saturándose bajo el pico (1 vCPU
// + RS256 CPU-bound en `/api/auth/token`) hasta que el health check no obtenía
// CPU para responder y ECS mataba tasks vivos. NO se medía el lag → no se veía
// la saturación hasta que cascadeaba. Esto lo mide con `monitorEventLoopDelay`.
//
// Política de emisión: como el pool-capacity-sampler del backend, emite a
// `observable_events` SOLO cuando un umbral se dispara (no 1.440 muestras/día de
// ruido). El histograma completo va en la metadata del evento disparado.
//
// Portable: mide el proceso donde corra (Fargate hoy, koigrid mañana); no
// depende de infra AWS. Fuente del evento = 'vercel' (convención del codebase
// para eventos server-side de Next.js; ver onRequestError / withErrorLogging).

import { monitorEventLoopDelay } from 'node:perf_hooks'
import { emit } from './emit'
import { INSTANCE_ID } from './instanceId'
import { shouldSkipObservabilityPersistence } from './runtimeGate'

// T-206 (06/08): mismo hueco que T-572 ya cerró en withErrorLogging.ts y
// validation-error-log/queries.ts — el .env.local de este repo apunta `next
// dev` a la RDS de PRODUCCIÓN, y este sampler arranca sin condición desde
// `register()` (instrumentation.ts) en CUALQUIER proceso Node, portátil
// incluido. MEDIDO contra observable_events (28/07-06/08, 9 días): el 77%
// (17/22) de los eventos `critical` de event_loop_lag venían de instancias
// con INSTANCE_ID prefijado por HOSTNAME (`fedora:…`, el portátil de Manuel
// corriendo `next dev` en local) — un proceso de desarrollo sin el
// aislamiento de recursos de un contenedor Fargate, así que sus stalls no
// dicen nada de la salud del servicio en producción, y de paso ensuciaban
// la investigación de T-206 (¿los picos de CPU son de una sola tarea, o
// reales?). A diferencia del `request_completed` de T-572 (se dispara solo
// si alguien pega al endpoint), este sampler es un DAEMON que corre solo
// cada 60s sin que nadie lo invoque — la contaminación es pasiva y constante.
const SKIP_EVENT_LOOP_LAG_EMIT = shouldSkipObservabilityPersistence()

/**
 * Umbrales de lag (ms).
 *
 * ⚠️ RECALIBRADO 28/07/2026 (T-160) — la versión anterior generaba **65 avisos
 * CRITICAL al día** y era la alerta nº1 del correo, tapando lo demás.
 *
 * Lo que se midió antes de tocar nada:
 *  · Un proceso Node **OCIOSO** con `resolution: 20` reporta `mean/p50/p99 ≈ 20 ms`:
 *    ese suelo **es la resolución, no lag**. En producción el p99 mediano era de
 *    **22-24 ms**, o sea el loop estaba SANO mientras la alerta gritaba.
 *  · En 7 días hubo **626 CRITICAL**… y el p99 solo pasó de 100 ms **3 veces**.
 *    Un `max` aislado no dice nada del servicio: el ocioso local nunca pasa de 21 ms,
 *    así que el stall es real, pero no degrada al usuario si el loop vuelve enseguida.
 *
 * De ahí la regla nueva: **la severidad la manda el p99 (sostenido); el `max` solo
 * ESCALA**. Un pico suelto ya no es crítico por sí mismo, y un loop sano ya no emite.
 * Simulado sobre esos 7 días: de 530 eventos/día a 90, y de ~65 avisos/día a <1.
 */
export const EVENT_LOOP_LAG_THRESHOLDS = {
  /** p99 sostenido alto = loop pegajoso de verdad. Es la señal del 21/07. */
  p99WarnMs: 100,
  /** p99 severo sostenido: crítico por sí solo, sin necesitar un pico. */
  p99CriticalMs: 500,
  /** Stall multi-segundo. Ya NO basta para crítico: necesita corroboración del p99. */
  maxSpikeMs: 2000,
} as const

export interface EventLoopLagStats {
  meanMs: number
  p50Ms: number
  p99Ms: number
  maxMs: number
}

export type LagSeverity = 'warn' | 'critical'

/** Núcleo puro y testeable: dado el lag observado, ¿emitir? y ¿con qué
 *  severidad? Mantiene la política "flags only". */
export function classifyEventLoopLag(
  stats: Pick<EventLoopLagStats, 'p99Ms' | 'maxMs'>,
  thresholds: typeof EVENT_LOOP_LAG_THRESHOLDS = EVENT_LOOP_LAG_THRESHOLDS,
): { emit: boolean; severity: LagSeverity | null } {
  const { p99Ms, maxMs } = stats
  const sostenido = p99Ms >= thresholds.p99WarnMs
  const pico = maxMs >= thresholds.maxSpikeMs

  // Severamente sostenido: crítico aunque no haya un pico puntual.
  if (p99Ms >= thresholds.p99CriticalMs) return { emit: true, severity: 'critical' }
  // Sostenido Y con pico: la firma del 21/07 (loop pegajoso que además se atasca).
  if (sostenido && pico) return { emit: true, severity: 'critical' }
  // Uno de los dos: se registra, no se grita.
  if (sostenido || pico) return { emit: true, severity: 'warn' }
  // Loop sano: NO emitir. Antes un pico de 500 ms bastaba y eran 530 eventos/día
  // en una tabla que ya está bajo presión (ver T-173).
  return { emit: false, severity: null }
}

/** ns → ms, tolerante a NaN/∞ (histograma vacío devuelve valores raros). */
export function toMs(ns: number): number {
  return Number.isFinite(ns) ? ns / 1e6 : 0
}

/** Extrae las stats en ms de un histograma de `monitorEventLoopDelay` (que
 *  reporta en nanosegundos). Aislado para poder testearlo con un doble. */
export function readHistogramStats(h: {
  mean: number
  max: number
  percentile: (p: number) => number
}): EventLoopLagStats {
  return {
    meanMs: toMs(h.mean),
    p50Ms: toMs(h.percentile(50)),
    p99Ms: toMs(h.percentile(99)),
    maxMs: toMs(h.max),
  }
}

const round1 = (n: number) => Math.round(n * 10) / 10

let started = false

export interface EventLoopLagSamplerOptions {
  windowMs?: number
  resolutionMs?: number
}

/**
 * Arranca el sampler (idempotente). Devuelve un `stop()` para tests, o `null`
 * si ya estaba arrancado o el runtime no soporta `monitorEventLoopDelay`
 * (p.ej. Edge runtime). Pensado para llamarse UNA vez desde
 * `instrumentation.ts#register()` bajo `NEXT_RUNTIME === 'nodejs'`.
 */
export function startEventLoopLagSampler(
  opts: EventLoopLagSamplerOptions = {},
): (() => void) | null {
  if (started) return null
  if (typeof monitorEventLoopDelay !== 'function') return null

  const windowMs = opts.windowMs ?? 60_000
  const resolutionMs = opts.resolutionMs ?? 20
  const histogram = monitorEventLoopDelay({ resolution: resolutionMs })
  histogram.enable()
  started = true

  const tick = async () => {
    try {
      const stats = readHistogramStats(histogram)
      histogram.reset() // ventana deslizante: cada tick mide su propio minuto
      const { emit: shouldEmit, severity } = classifyEventLoopLag(stats)
      if (!shouldEmit || !severity) return
      if (SKIP_EVENT_LOOP_LAG_EMIT) return
      await emit({
        source: 'vercel',
        severity,
        eventType: 'event_loop_lag',
        durationMs: Math.round(stats.maxMs),
        deployVersion: process.env.GIT_COMMIT_SHA ?? null,
        metadata: {
          meanMs: round1(stats.meanMs),
          p50Ms: round1(stats.p50Ms),
          p99Ms: round1(stats.p99Ms),
          maxMs: round1(stats.maxMs),
          windowMs,
          resolutionMs,
          // Sin esto el evento es inservible para investigar: con 9 tareas no se
          // sabe CUÁL se atascó y toda correlación queda diluida por 9. El helper
          // ya existía (creado el 26/07 por este mismo problema con
          // `isr_purge_applied`) y este sampler, del 24/07, no lo usaba.
          instanceId: INSTANCE_ID,
        },
      })
    } catch {
      // Best-effort: el sampler de observabilidad JAMÁS debe tumbar el proceso
      // que está observando.
    }
  }

  const interval = setInterval(tick, windowMs)
  // No mantener vivo el proceso solo por el sampler (apagado limpio).
  if (typeof interval.unref === 'function') interval.unref()

  return () => {
    clearInterval(interval)
    histogram.disable()
    started = false
  }
}
