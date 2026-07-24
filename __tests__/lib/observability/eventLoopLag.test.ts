import {
  classifyEventLoopLag,
  toMs,
  readHistogramStats,
  startEventLoopLagSampler,
  EVENT_LOOP_LAG_THRESHOLDS as T,
} from '@/lib/observability/eventLoopLag'

describe('classifyEventLoopLag', () => {
  it('no emite con lag sano (loop < umbrales)', () => {
    expect(classifyEventLoopLag({ p99Ms: 5, maxMs: 30 })).toEqual({
      emit: false,
      severity: null,
    })
  })

  it('warn cuando p99 supera el umbral aunque el max no', () => {
    expect(classifyEventLoopLag({ p99Ms: T.p99WarnMs, maxMs: 120 })).toEqual({
      emit: true,
      severity: 'warn',
    })
  })

  it('warn cuando un stall puntual (max) supera maxWarn pero no maxCritical', () => {
    expect(classifyEventLoopLag({ p99Ms: 10, maxMs: T.maxWarnMs })).toEqual({
      emit: true,
      severity: 'warn',
    })
  })

  it('critical cuando el max alcanza el umbral crítico (stall multi-segundo)', () => {
    expect(classifyEventLoopLag({ p99Ms: 10, maxMs: T.maxCriticalMs })).toEqual({
      emit: true,
      severity: 'critical',
    })
  })

  it('critical tiene prioridad sobre warn', () => {
    expect(
      classifyEventLoopLag({ p99Ms: T.p99WarnMs, maxMs: T.maxCriticalMs + 500 }),
    ).toEqual({ emit: true, severity: 'critical' })
  })

  it('justo por debajo de los umbrales no emite (fronteras)', () => {
    expect(
      classifyEventLoopLag({ p99Ms: T.p99WarnMs - 0.1, maxMs: T.maxWarnMs - 0.1 }),
    ).toEqual({ emit: false, severity: null })
  })

  it('respeta umbrales inyectados', () => {
    const custom = { p99WarnMs: 10, maxWarnMs: 20, maxCriticalMs: 40 }
    expect(classifyEventLoopLag({ p99Ms: 11, maxMs: 5 }, custom).severity).toBe('warn')
    expect(classifyEventLoopLag({ p99Ms: 1, maxMs: 40 }, custom).severity).toBe('critical')
  })
})

describe('toMs', () => {
  it('convierte nanosegundos a milisegundos', () => {
    expect(toMs(1_000_000)).toBe(1)
    expect(toMs(2_500_000)).toBe(2.5)
  })
  it('es tolerante a NaN/Infinity (histograma vacío)', () => {
    expect(toMs(NaN)).toBe(0)
    expect(toMs(Infinity)).toBe(0)
  })
})

describe('readHistogramStats', () => {
  it('extrae mean/p50/p99/max en ms de un histograma en ns', () => {
    const fake = {
      mean: 3_000_000, // 3ms
      max: 1_500_000_000, // 1500ms
      percentile: (p: number) => (p === 50 ? 2_000_000 : 900_000_000), // 2ms / 900ms
    }
    expect(readHistogramStats(fake)).toEqual({
      meanMs: 3,
      p50Ms: 2,
      p99Ms: 900,
      maxMs: 1500,
    })
  })
})

describe('startEventLoopLagSampler', () => {
  afterEach(() => {
    // por si un test dejó el sampler arrancado, detén cualquier resto
    jest.useRealTimers()
  })

  it('es idempotente: el segundo arranque devuelve null', () => {
    const stop = startEventLoopLagSampler({ windowMs: 60_000 })
    expect(stop).not.toBeNull()
    const second = startEventLoopLagSampler({ windowMs: 60_000 })
    expect(second).toBeNull()
    stop?.()
  })

  it('stop() permite re-arrancar (resetea el guard)', () => {
    const stop = startEventLoopLagSampler({ windowMs: 60_000 })
    stop?.()
    const again = startEventLoopLagSampler({ windowMs: 60_000 })
    expect(again).not.toBeNull()
    again?.()
  })
})
