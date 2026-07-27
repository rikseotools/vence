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

  // ⚠️ RECALIBRADO 28/07/2026 (T-160). Antes un `max` >= 500 ms emitía warn y un
  // `max` >= 2 s emitía CRITICAL POR SÍ SOLO. Medido: 626 CRITICAL en 7 días
  // mientras el p99 solo pasó de 100 ms TRES veces — la alerta nº1 del correo
  // describiendo un loop que estaba sano. Y un Node OCIOSO con esta resolución
  // reporta mean/p99 ~20 ms y max ~21 ms, así que ese suelo ES la resolución.
  // Ahora la severidad la manda el p99 (sostenido) y el max solo ESCALA.
  it('un pico aislado con el loop SANO ya no es crítico: solo warn', () => {
    // El caso REAL de producción: p99 en el suelo de resolución y stall de 3 s.
    expect(classifyEventLoopLag({ p99Ms: 22, maxMs: 3100 })).toEqual({
      emit: true,
      severity: 'warn',
    })
  })

  it('un pico de medio segundo con el loop sano NO emite (era el grueso del ruido)', () => {
    expect(classifyEventLoopLag({ p99Ms: 21, maxMs: 756 })).toEqual({
      emit: false,
      severity: null,
    })
  })

  it('CRITICAL exige corroboración: p99 degradado Y pico — la firma del 21/07', () => {
    expect(classifyEventLoopLag({ p99Ms: 150, maxMs: 2500 })).toEqual({
      emit: true,
      severity: 'critical',
    })
  })

  it('CRITICAL también con p99 severo por sí solo, sin pico puntual', () => {
    expect(classifyEventLoopLag({ p99Ms: 600, maxMs: 900 })).toEqual({
      emit: true,
      severity: 'critical',
    })
  })

  it('p99 alto sin pico se queda en warn (aún no es cascada)', () => {
    expect(classifyEventLoopLag({ p99Ms: 150, maxMs: 900 })).toEqual({
      emit: true,
      severity: 'warn',
    })
  })

  it('justo por debajo de los umbrales no emite (fronteras)', () => {
    expect(
      classifyEventLoopLag({ p99Ms: T.p99WarnMs - 0.1, maxMs: T.maxSpikeMs - 0.1 }),
    ).toEqual({ emit: false, severity: null })
  })

  it('respeta umbrales inyectados', () => {
    const custom = { p99WarnMs: 10, p99CriticalMs: 50, maxSpikeMs: 100 } as const
    expect(classifyEventLoopLag({ p99Ms: 12, maxMs: 5 }, custom).severity).toBe('warn')
    expect(classifyEventLoopLag({ p99Ms: 12, maxMs: 150 }, custom).severity).toBe('critical')
    expect(classifyEventLoopLag({ p99Ms: 60, maxMs: 5 }, custom).severity).toBe('critical')
    expect(classifyEventLoopLag({ p99Ms: 5, maxMs: 5 }, custom).emit).toBe(false)
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
