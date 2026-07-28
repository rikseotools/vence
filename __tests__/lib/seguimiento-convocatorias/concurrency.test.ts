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

  // La otra bomba de reloj del fichero, del mismo T-248: medía `Date.now()` contra 50 ms para
  // comprobar que «termina inmediatamente». Lo que de verdad importa no es que tarde poco, sino
  // que **no llame al worker ni una vez** — y eso se comprueba sin cronómetro.
  it('array vacío: no llama al worker y no se cuelga', async () => {
    let llamadas = 0
    await runWithConcurrency([], 5, async () => {
      llamadas++
    })
    expect(llamadas).toBe(0)
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

  // Cede el bucle de eventos para que los workers lleguen a su primer `await`. NO es una espera
  // temporizada: da igual lo cargada que esté la máquina, porque lo que se comprueba después es el
  // ORDEN de los hechos, no cuánto han tardado. (`setImmediate` no existe en el entorno de jsdom.)
  const cede = () => new Promise((r) => setTimeout(r, 0))

  // REESCRITO (T-248, 28/07/2026). Antes medía RELOJ DE PARED —«10 items × 30 ms / 5 workers = 60 ms
  // ideal, generosamente <150 ms»— y en el pre-commit este fichero compite con ~800 suites por la
  // máquina, así que 150 ms se pasan sin que nada esté roto. Tumbó el hook TRES veces el 28/07 y
  // obligó a `--no-verify`, que es el daño de verdad: un rojo aleatorio enseña a desconfiar del
  // guardarraíl. Un test que mide velocidad relativa bajo carga variable es inestable por
  // construcción, no por un bug.
  //
  // Ahora se comprueba LO MISMO —que los items avanzan en paralelo y no en fila— observando el
  // ESTADO en vez del tiempo: se retienen los workers con promesas que resuelve el propio test, y
  // se exige que haya 5 en vuelo ANTES de que termine ninguno. Es determinista pase lo que pase
  // en la máquina, y de hecho prueba MÁS que el cronómetro: el cronómetro no distinguía «5 a la
  // vez» de «2 a la vez pero rápido».
  it('paralelismo real: arranca N a la vez SIN esperar a que termine ninguno', async () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    const soltar: Array<() => void> = []
    let arrancados = 0
    let terminados = 0

    const corriendo = runWithConcurrency(items, 5, async () => {
      arrancados++
      await new Promise<void>((r) => soltar.push(r))
      terminados++
    })

    // Ceder el bucle de eventos para que los workers lleguen a su primer `await`.
    await cede()

    expect(arrancados).toBe(5)   // cinco en vuelo…
    expect(terminados).toBe(0)   // …y ninguno ha terminado: es paralelo, no una fila

    while (soltar.length) soltar.pop()!()
    await cede()
    while (soltar.length) soltar.pop()!()
    await corriendo

    expect(arrancados).toBe(10)
    expect(terminados).toBe(10)
  })

  it('con concurrencia 1 NO arranca el segundo hasta que acaba el primero (la otra cara)', async () => {
    const soltar: Array<() => void> = []
    let arrancados = 0

    const corriendo = runWithConcurrency([1, 2, 3], 1, async () => {
      arrancados++
      await new Promise<void>((r) => soltar.push(r))
    })
    await cede()
    expect(arrancados).toBe(1)

    while (soltar.length) soltar.pop()!()
    await cede()
    while (soltar.length) soltar.pop()!()
    await cede()
    while (soltar.length) soltar.pop()!()
    await corriendo
    expect(arrancados).toBe(3)
  })
})
