// __tests__/api/boe-changes/chunking.test.ts
//
// Tests del bucle de chunking del cron /api/cron/check-boe-changes.
//
// El handler procesa N leyes en chunks paralelos de tamaño CHUNK_SIZE con
// Promise.allSettled. Estos tests verifican el comportamiento del bucle
// de chunking en aislamiento — sin depender del runtime de Next.js ni de
// HTTP real. Replicamos el mismo patrón del handler para poder ejercitarlo.
//
// Bug histórico que estos tests blindan:
//   - El cron procesaba leyes en serie con await dentro de un for.
//   - Si una ley lanzaba excepción, el for NO la capturaba y abortaba
//     el bucle entero (las restantes no se procesaban).
//   - Con 337 leyes y outliers de 1s en HEAD, el cron superaba los 300s.
//
// Invariantes del bucle:
//   1. TODAS las leyes se procesan incluso si algunas fallan.
//   2. stats.checked cuenta cada ley intentada (éxito o error).
//   3. stats.errors se incrementa por ley que rechaza o retorna !== true.
//   4. Chunks paralelos — el tiempo total ≈ max(chunk), no sum(chunk).
//   5. Orden de finalización no importa; el bucle es determinista en counts.

const CHUNK_SIZE = 10

interface FakeStats {
  checked: number
  errors: number
}

/**
 * Réplica exacta del bucle de chunking del handler, para poder testearlo
 * en aislamiento. Si el handler cambia, actualizar esta función.
 */
async function runChunkedLoop<T>(
  items: T[],
  processItem: (item: T) => Promise<boolean>,
  stats: FakeStats,
): Promise<void> {
  for (let i = 0; i < items.length; i += CHUNK_SIZE) {
    const chunk = items.slice(i, i + CHUNK_SIZE)
    const results = await Promise.allSettled(chunk.map(processItem))
    for (const r of results) {
      stats.checked++
      if (r.status === 'rejected' || r.value !== true) {
        stats.errors++
      }
    }
  }
}

function makeItems(n: number): Array<{ id: number }> {
  return Array.from({ length: n }, (_, i) => ({ id: i }))
}

describe('runChunkedLoop — blindaje del bucle de chunking del cron BOE', () => {
  it('procesa TODOS los items incluso cuando no son múltiplo de CHUNK_SIZE', async () => {
    const items = makeItems(25) // 25 = 2 chunks de 10 + 1 chunk de 5
    const seen = new Set<number>()
    const stats: FakeStats = { checked: 0, errors: 0 }

    await runChunkedLoop(items, async (item) => {
      seen.add(item.id)
      return true
    }, stats)

    expect(seen.size).toBe(25)
    expect(stats.checked).toBe(25)
    expect(stats.errors).toBe(0)
  })

  it('procesa los 337 items (count real de leyes BOE en prod)', async () => {
    const items = makeItems(337)
    const stats: FakeStats = { checked: 0, errors: 0 }

    await runChunkedLoop(items, async () => true, stats)

    expect(stats.checked).toBe(337)
    expect(stats.errors).toBe(0)
  })

  it('sigue procesando los items restantes cuando algunos fallan con excepción', async () => {
    const items = makeItems(30)
    const stats: FakeStats = { checked: 0, errors: 0 }

    await runChunkedLoop(items, async (item) => {
      if (item.id === 5 || item.id === 15 || item.id === 25) {
        throw new Error(`boom ${item.id}`)
      }
      return true
    }, stats)

    expect(stats.checked).toBe(30) // todas procesadas
    expect(stats.errors).toBe(3)   // 3 rechazadas
  })

  it('cuenta como error las que retornan false (no solo las que lanzan)', async () => {
    const items = makeItems(20)
    const stats: FakeStats = { checked: 0, errors: 0 }

    await runChunkedLoop(items, async (item) => {
      return item.id % 2 === 0 // mitad true, mitad false
    }, stats)

    expect(stats.checked).toBe(20)
    expect(stats.errors).toBe(10)
  })

  it('cuenta como error las que retornan undefined/null/otros non-true', async () => {
    const items = makeItems(10)
    const stats: FakeStats = { checked: 0, errors: 0 }

    await runChunkedLoop(items, async () => undefined as any, stats)

    expect(stats.checked).toBe(10)
    expect(stats.errors).toBe(10) // ninguna retornó `true`
  })

  it('paraleliza dentro del chunk — tiempo ≈ max(chunk), no sum(chunk)', async () => {
    const items = makeItems(10) // 1 chunk de 10
    const stats: FakeStats = { checked: 0, errors: 0 }

    const start = Date.now()
    await runChunkedLoop(items, async (item) => {
      // Cada item tarda 100ms
      await new Promise(r => setTimeout(r, 100))
      return true
    }, stats)
    const elapsed = Date.now() - start

    // Serial serían 1000ms, paralelo ~100-200ms
    expect(elapsed).toBeLessThan(500)
    expect(stats.checked).toBe(10)
  })

  it('entre chunks es secuencial — espera a que drene el chunk antes del siguiente', async () => {
    const items = makeItems(20) // 2 chunks de 10
    const stats: FakeStats = { checked: 0, errors: 0 }
    const active = { count: 0, max: 0 }

    await runChunkedLoop(items, async () => {
      active.count++
      active.max = Math.max(active.max, active.count)
      await new Promise(r => setTimeout(r, 30))
      active.count--
      return true
    }, stats)

    // Nunca más de CHUNK_SIZE en ejecución simultánea
    expect(active.max).toBeLessThanOrEqual(CHUNK_SIZE)
    expect(stats.checked).toBe(20)
  })

  it('array vacío no rompe y deja stats intactos', async () => {
    const stats: FakeStats = { checked: 0, errors: 0 }
    await runChunkedLoop([], async () => true, stats)
    expect(stats).toEqual({ checked: 0, errors: 0 })
  })

  it('CHUNK_SIZE en 1 se comporta como el bucle serial antiguo', async () => {
    const items = makeItems(15)
    const stats: FakeStats = { checked: 0, errors: 0 }
    const active = { count: 0, max: 0 }

    // Helper con chunk size=1 para comparar con el comportamiento viejo
    for (let i = 0; i < items.length; i += 1) {
      const chunk = items.slice(i, i + 1)
      const results = await Promise.allSettled(chunk.map(async () => {
        active.count++
        active.max = Math.max(active.max, active.count)
        await new Promise(r => setTimeout(r, 10))
        active.count--
        return true
      }))
      for (const r of results) {
        stats.checked++
        if (r.status === 'rejected' || r.value !== true) stats.errors++
      }
    }

    expect(active.max).toBe(1) // nunca dos en paralelo
    expect(stats.checked).toBe(15)
  })
})
