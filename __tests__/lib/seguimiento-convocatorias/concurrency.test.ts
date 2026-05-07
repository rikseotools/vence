// __tests__/lib/seguimiento-convocatorias/concurrency.test.ts
// Tests para los helpers de paralelización del cron check-seguimiento.

import { groupByDomain, runWithConcurrency } from '@/lib/api/seguimiento-convocatorias/concurrency'

describe('groupByDomain', () => {
  it('agrupa items con misma hostname', () => {
    const items = [
      { id: '1', url: 'https://boe.es/a' },
      { id: '2', url: 'https://boe.es/b' },
      { id: '3', url: 'https://inap.es/c' },
    ]
    const groups = groupByDomain(items, (i) => i.url)
    expect(groups).toHaveLength(2)
    const boeGroup = groups.find((g) => g[0].url.includes('boe'))
    const inapGroup = groups.find((g) => g[0].url.includes('inap'))
    expect(boeGroup).toHaveLength(2)
    expect(inapGroup).toHaveLength(1)
  })

  it('items con URLs malformadas se agrupan en bucket "unknown"', () => {
    const items = [
      { id: '1', url: 'not-a-url' },
      { id: '2', url: '   ' },
      { id: '3', url: 'https://valid.com/x' },
    ]
    const groups = groupByDomain(items, (i) => i.url)
    expect(groups).toHaveLength(2)
    const unknownGroup = groups.find((g) => g.length === 2)
    expect(unknownGroup).toBeDefined()
  })

  it('array vacío devuelve []', () => {
    expect(groupByDomain([], (i: { url: string }) => i.url)).toEqual([])
  })

  it('hostname distingue subdominios', () => {
    const items = [
      { id: '1', url: 'https://www.boe.es/a' },
      { id: '2', url: 'https://api.boe.es/b' },
    ]
    const groups = groupByDomain(items, (i) => i.url)
    expect(groups).toHaveLength(2)
  })

  it('querystring/path no afecta agrupación', () => {
    const items = [
      { id: '1', url: 'https://boe.es/a?x=1' },
      { id: '2', url: 'https://boe.es/b?y=2&z=3' },
    ]
    const groups = groupByDomain(items, (i) => i.url)
    expect(groups).toHaveLength(1)
    expect(groups[0]).toHaveLength(2)
  })
})

describe('runWithConcurrency', () => {
  it('procesa todos los items', async () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    const seen: number[] = []
    await runWithConcurrency(items, 3, async (item) => {
      seen.push(item)
    })
    expect(seen.sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
  })

  it('limita la concurrencia (max N en flight a la vez)', async () => {
    const items = Array.from({ length: 20 }, (_, i) => i)
    let inFlight = 0
    let maxObserved = 0

    await runWithConcurrency(items, 5, async () => {
      inFlight++
      if (inFlight > maxObserved) maxObserved = inFlight
      await new Promise((r) => setTimeout(r, 10))
      inFlight--
    })

    expect(maxObserved).toBeLessThanOrEqual(5)
    expect(maxObserved).toBeGreaterThan(0)
  })

  it('un worker fallando NO aborta el resto', async () => {
    const items = [1, 2, 3, 4, 5]
    const completed: number[] = []
    await runWithConcurrency(items, 2, async (item) => {
      if (item === 3) throw new Error('fallo intencional en 3')
      completed.push(item)
    })
    expect(completed.sort()).toEqual([1, 2, 4, 5])
  })

  it('array vacío termina inmediatamente', async () => {
    const t0 = Date.now()
    await runWithConcurrency([], 5, async () => {
      throw new Error('no debería ejecutarse')
    })
    expect(Date.now() - t0).toBeLessThan(50)
  })

  it('concurrency > items.length spawnea solo items.length workers', async () => {
    const items = [1, 2]
    let workersStarted = 0
    await runWithConcurrency(items, 100, async () => {
      workersStarted++
      await new Promise((r) => setTimeout(r, 1))
    })
    // Cada item se procesa exactamente una vez
    expect(workersStarted).toBe(2)
  })

  it('paralelismo real: items independientes terminan más rápido que secuencial', async () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    const itemDelayMs = 30

    const t0 = Date.now()
    await runWithConcurrency(items, 5, async () => {
      await new Promise((r) => setTimeout(r, itemDelayMs))
    })
    const elapsed = Date.now() - t0

    // 10 items × 30ms / 5 workers = 60ms ideal, generosamente <150ms
    expect(elapsed).toBeLessThan(150)
    // Si fuera secuencial sería 300ms
    expect(elapsed).toBeLessThan(300)
  })
})
