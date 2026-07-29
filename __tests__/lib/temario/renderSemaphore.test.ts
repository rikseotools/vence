/**
 * @jest-environment node
 */
// Contención del render de PDFs en línea (T-270 Fase 1).
//
// El incidente del 29/07 no fue "los PDFs tardan": fue 5 instancias con el bucle de eventos
// bloqueado hasta 215 s y 59 respuestas de usuarios sin guardar, porque nada limitaba cuántos
// renders de 7,2 s podían acumularse en la misma task. Estos tests fijan que ahora se limitan
// y que, cuando la espera se agota, se SUELTA CARGA en vez de amontonar más trabajo.
import {
  createRenderSemaphore,
  maxConcurrentFromEnv,
  waitMsFromEnv,
} from '@/lib/temario/pdf/renderSemaphore'

describe('createRenderSemaphore', () => {
  it('deja pasar hasta el techo y no más', () => {
    const sem = createRenderSemaphore(2)
    expect(sem.tryAcquire()).not.toBeNull()
    expect(sem.tryAcquire()).not.toBeNull()
    expect(sem.tryAcquire()).toBeNull()
    expect(sem.inFlight()).toBe(2)
  })

  it('al soltar un slot, el siguiente entra', () => {
    const sem = createRenderSemaphore(1)
    const slot = sem.tryAcquire()!
    expect(sem.tryAcquire()).toBeNull()
    slot.release()
    expect(sem.inFlight()).toBe(0)
    expect(sem.tryAcquire()).not.toBeNull()
  })

  it('release es IDEMPOTENTE (un contador que baja de más deja la puerta abierta para siempre)', () => {
    const sem = createRenderSemaphore(1)
    const slot = sem.tryAcquire()!
    slot.release()
    slot.release()
    slot.release()
    expect(sem.inFlight()).toBe(0)
    expect(sem.tryAcquire()).not.toBeNull()
    expect(sem.tryAcquire()).toBeNull() // el techo sigue siendo 1
  })

  it('espera a que se libere en vez de rechazar al primer intento', async () => {
    // Con renders de ~7 s, un segundo clic tiene que acabar sirviéndose: rechazar a la primera
    // convertiría cualquier ráfaga moderada en errores.
    let t = 0
    let polls = 0
    let ocupado: { release(): void } | null = null
    const sem = createRenderSemaphore(1, {
      now: () => t,
      sleep: async (ms) => {
        t += ms
        polls++
        if (polls === 2) ocupado?.release()   // se libera al segundo sondeo
      },
      pollMs: 100,
    })
    ocupado = sem.tryAcquire()
    expect(ocupado).not.toBeNull()

    const slot = await sem.acquire(5_000)

    expect(slot).not.toBeNull()
    expect(polls).toBe(2)          // esperó, no entró de inmediato
    expect(sem.inFlight()).toBe(1) // el que esperaba, y solo él
  })

  it('SUELTA CARGA cuando se agota la espera (lo que no pasó el 29/07)', async () => {
    let t = 0
    const sem = createRenderSemaphore(1, {
      now: () => t,
      sleep: async (ms) => { t += ms },
      pollMs: 250,
    })
    sem.tryAcquire() // ocupado y nunca se libera
    const r = await sem.acquire(1_000)
    expect(r).toBeNull()
    expect(t).toBeGreaterThanOrEqual(1_000) // esperó de verdad antes de rendirse
  })

  it('el techo nunca baja de 1 (un cero dejaría el PDF inservible)', () => {
    expect(createRenderSemaphore(0).max()).toBe(1)
    expect(createRenderSemaphore(-3).max()).toBe(1)
  })
})

describe('configuración por entorno', () => {
  it('el techo por defecto es 1: dos renders simultáneos no van en paralelo, se entrelazan', () => {
    expect(maxConcurrentFromEnv({} as NodeJS.ProcessEnv)).toBe(1)
    expect(maxConcurrentFromEnv({ PDF_MAX_CONCURRENT_RENDERS: 'x' } as NodeJS.ProcessEnv)).toBe(1)
    expect(maxConcurrentFromEnv({ PDF_MAX_CONCURRENT_RENDERS: '0' } as NodeJS.ProcessEnv)).toBe(1)
  })

  it('se puede subir a mano si la Fase 2 tarda', () => {
    expect(maxConcurrentFromEnv({ PDF_MAX_CONCURRENT_RENDERS: '3' } as NodeJS.ProcessEnv)).toBe(3)
  })

  it('la espera por defecto son 20 s (unos 3 renders de 7 s en fila)', () => {
    expect(waitMsFromEnv({} as NodeJS.ProcessEnv)).toBe(20_000)
    expect(waitMsFromEnv({ PDF_RENDER_WAIT_MS: '5000' } as NodeJS.ProcessEnv)).toBe(5_000)
    expect(waitMsFromEnv({ PDF_RENDER_WAIT_MS: 'abc' } as NodeJS.ProcessEnv)).toBe(20_000)
  })
})
