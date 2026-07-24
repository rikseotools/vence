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

/** Umbrales de lag (ms). Baseline sano del loop ~1-5ms; el incidente tuvo
 *  stalls de cientos de ms a segundos. */
export const EVENT_LOOP_LAG_THRESHOLDS = {
  p99WarnMs: 100, // p99 sostenido alto = loop pegajoso
  maxWarnMs: 500, // un stall puntual de medio segundo
  maxCriticalMs: 2000, // stall multi-segundo = territorio de health-check-killer
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
  if (maxMs >= thresholds.maxCriticalMs) return { emit: true, severity: 'critical' }
  if (p99Ms >= thresholds.p99WarnMs || maxMs >= thresholds.maxWarnMs) {
    return { emit: true, severity: 'warn' }
  }
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
