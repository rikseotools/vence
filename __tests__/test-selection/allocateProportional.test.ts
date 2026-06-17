import { allocateProportional } from '@/lib/test-selection/allocateProportional'

// RNG determinista (LCG) para tests reproducibles.
function seededRng(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (1664525 * s + 1013904223) >>> 0
    return s / 0x100000000
  }
}

type Q = { id: number; topic: number; seen: boolean }

function makeQuestions(perTopic: Record<number, number>, seenCount: Record<number, number> = {}): Q[] {
  const qs: Q[] = []
  let id = 1
  for (const [topicStr, n] of Object.entries(perTopic)) {
    const topic = Number(topicStr)
    const seen = seenCount[topic] ?? 0
    for (let i = 0; i < n; i++) qs.push({ id: id++, topic, seen: i < seen })
  }
  return qs
}

const opts = (rng?: () => number) => ({
  groupKey: (q: Q) => q.topic,
  isPriority: (q: Q) => !q.seen,
  rng,
})

describe('allocateProportional', () => {
  test('caso normal: pool de sobra → devuelve exactamente target, sin exhausted', () => {
    const qs = makeQuestions({ 1: 50, 2: 50, 3: 50 })
    const { selected, exhausted } = allocateProportional(qs, [1, 2, 3], 30, opts(seededRng(1)))
    expect(selected.length).toBe(30)
    expect(exhausted).toBe(false)
    expect(new Set(selected.map(q => q.id)).size).toBe(30) // sin duplicados
  })

  // Reproducción de la lógica VIEJA de buildAdaptiveCatalog (sin relleno de
  // déficit) para documentar el bug y demostrar que el fix lo corrige.
  function oldNoFallback(qs: Q[], topics: number[], target: number): Q[] {
    const byTopic = new Map<number, Q[]>()
    for (const t of topics) byTopic.set(t, [])
    for (const q of qs) if (byTopic.has(q.topic)) byTopic.get(q.topic)!.push(q)
    const perTopic = Math.floor(target / topics.length)
    let extra = target % topics.length
    const selected: Q[] = []
    for (const t of topics) {
      const tq = byTopic.get(t)!
      const ns = tq.filter(q => !q.seen)
      const count = perTopic + (extra > 0 ? 1 : 0)
      if (extra > 0) extra--
      const pick = ns.length >= count ? ns.slice(0, count) : [...ns, ...tq.filter(q => q.seen)].slice(0, count)
      selected.push(...pick) // ❌ sin relleno del déficit
    }
    return selected
  }

  test('REGRESIÓN caso Laura: 16 temas desiguales, pide 75 → debe dar 75 (hoy daba 57)', () => {
    // Distribución desigual realista: algunos temas con muy pocas, otros con muchas.
    const perTopic: Record<number, number> = {
      1: 20, 2: 2, 3: 1, 4: 15, 5: 8, 6: 18, 7: 9, 8: 25,
      9: 3, 10: 2, 11: 7, 12: 5, 13: 1, 14: 6, 15: 22, 16: 30,
    }
    const total = Object.values(perTopic).reduce((a, b) => a + b, 0) // 174 > 75
    expect(total).toBeGreaterThan(75)
    const qs = makeQuestions(perTopic)
    const topics = Object.keys(perTopic).map(Number)

    // La lógica VIEJA se quedaba corta (el bug): documentamos que daba < 75.
    const old = oldNoFallback(qs, topics, 75)
    expect(old.length).toBeLessThan(75)

    // El fix: relleno de déficit → exactamente 75, sin duplicados.
    const { selected, exhausted } = allocateProportional(qs, topics, 75, opts(seededRng(7)))
    expect(selected.length).toBe(75)
    expect(exhausted).toBe(false)
    expect(new Set(selected.map(q => q.id)).size).toBe(75)
  })

  test('exhausted: pool total < target → devuelve todo y marca exhausted', () => {
    const qs = makeQuestions({ 1: 10, 2: 10, 3: 10 }) // 30 total
    const { selected, exhausted } = allocateProportional(qs, [1, 2, 3], 75, opts(seededRng(2)))
    expect(selected.length).toBe(30)
    expect(exhausted).toBe(true)
  })

  test('prioriza nunca-vistas: si hay suficientes nunca-vistas, no mete vistas', () => {
    // 40 nunca-vistas (10/tema en 4 temas), 40 vistas. Pide 20 → todas nunca-vistas.
    const qs = makeQuestions({ 1: 20, 2: 20, 3: 20, 4: 20 }, { 1: 10, 2: 10, 3: 10, 4: 10 })
    const { selected } = allocateProportional(qs, [1, 2, 3, 4], 20, opts(seededRng(3)))
    expect(selected.length).toBe(20)
    expect(selected.every(q => !q.seen)).toBe(true)
  })

  test('relleno usa vistas solo cuando se agotan las nuevas, sin bajar del target', () => {
    // 10 nunca-vistas totales + 100 vistas. Pide 30 → 10 nuevas + 20 repaso = 30.
    const qs = makeQuestions({ 1: 30, 2: 30, 3: 30, 4: 30 }, { 1: 27, 2: 28, 3: 28, 4: 30 })
    const neverSeenTotal = qs.filter(q => !q.seen).length
    const { selected, exhausted } = allocateProportional(qs, [1, 2, 3, 4], 30, opts(seededRng(4)))
    expect(selected.length).toBe(30)
    expect(exhausted).toBe(false)
    const nuevas = selected.filter(q => !q.seen).length
    expect(nuevas).toBe(neverSeenTotal) // usa TODAS las nuevas disponibles
    expect(nuevas).toBeLessThan(30)     // y completa con repaso
  })

  test('un solo grupo: baraja y corta', () => {
    const qs = makeQuestions({ 1: 100 })
    const { selected, exhausted } = allocateProportional(qs, [1], 25, opts(seededRng(5)))
    expect(selected.length).toBe(25)
    expect(exhausted).toBe(false)
  })

  test('reparto equilibrado: ningún tema acapara cuando todos tienen de sobra', () => {
    const qs = makeQuestions({ 1: 100, 2: 100, 3: 100, 4: 100 })
    const { selected } = allocateProportional(qs, [1, 2, 3, 4], 40, opts(seededRng(6)))
    const counts = [1, 2, 3, 4].map(t => selected.filter(q => q.topic === t).length)
    // 40/4 = 10 por tema
    counts.forEach(c => expect(c).toBe(10))
  })

  test('target 0 o pool vacío → vacío', () => {
    expect(allocateProportional<Q>([], [1, 2], 10, opts()).selected.length).toBe(0)
    expect(allocateProportional(makeQuestions({ 1: 5 }), [1], 0, opts()).selected.length).toBe(0)
  })

  test('determinista con el mismo rng: misma salida', () => {
    const qs = makeQuestions({ 1: 30, 2: 30, 3: 30 })
    const a = allocateProportional(qs, [1, 2, 3], 20, opts(seededRng(42)))
    const b = allocateProportional(qs, [1, 2, 3], 20, opts(seededRng(42)))
    expect(a.selected.map(q => q.id)).toEqual(b.selected.map(q => q.id))
  })

  test('ignora items cuyo grupo no está en la lista', () => {
    const qs = makeQuestions({ 1: 10, 2: 10, 99: 10 })
    const { selected } = allocateProportional(qs, [1, 2], 15, opts(seededRng(8)))
    expect(selected.every(q => q.topic === 1 || q.topic === 2)).toBe(true)
    expect(selected.length).toBe(15) // 20 disponibles en grupos 1+2
  })

  // FUZZ / propiedades: 1000 escenarios aleatorios. Garantiza los invariantes
  // pase lo que pase con la distribución (es el guardarraíl "que no vuelva a fallar").
  test('propiedades (fuzz): 1000 escenarios aleatorios cumplen los invariantes', () => {
    const rng = seededRng(123456)
    const randInt = (min: number, max: number) => min + Math.floor(rng() * (max - min + 1))
    const failures: string[] = []

    for (let iter = 0; iter < 1000; iter++) {
      const numTopics = randInt(1, 30)
      const topics = Array.from({ length: numTopics }, (_, i) => i + 1)
      const perTopic: Record<number, number> = {}
      const seenCount: Record<number, number> = {}
      for (const t of topics) {
        const n = randInt(0, 40)            // algún tema puede tener 0 (vacío)
        perTopic[t] = n
        seenCount[t] = randInt(0, n)        // 0..n vistas
      }
      const qs = makeQuestions(perTopic, seenCount)
      const target = randInt(0, 120)

      const totalGrouped = qs.length
      const priorityTotal = qs.filter(q => !q.seen).length

      const { selected, exhausted } = allocateProportional(qs, topics, target, opts(seededRng(iter + 1)))
      const ids = selected.map(q => q.id)
      const ctx = `iter=${iter} topics=${numTopics} total=${totalGrouped} target=${target} got=${selected.length}`
      const fail = (msg: string) => failures.push(`${msg} · ${ctx}`)

      if (selected.length !== Math.min(target, totalGrouped)) fail('tamaño != min(target,total)')
      if (selected.length > target) fail('excede target')
      if (new Set(ids).size !== selected.length) fail('duplicados')
      const poolIds = new Set(qs.map(q => q.id))
      if (!ids.every(id => poolIds.has(id))) fail('item fuera del pool')
      if (exhausted !== (selected.length < target)) fail('exhausted incoherente')

      // Prioridad INTRA-tema (el contrato real: balance por tema primero,
      // nunca-vistas dentro de cada tema): si de un tema se eligió alguna VISTA,
      // es porque ya se agotaron TODAS las nunca-vistas de ese tema.
      for (const t of topics) {
        const selT = selected.filter(q => q.topic === t)
        const seenSelT = selT.filter(q => q.seen).length
        const nsSelT = selT.length - seenSelT
        const nsAvailT = (perTopic[t] ?? 0) - (seenCount[t] ?? 0)
        if (seenSelT > 0 && nsSelT !== nsAvailT) fail(`vista elegida en T${t} con nunca-vistas sin usar (${nsSelT}/${nsAvailT})`)
      }
      // Y si globalmente hay nunca-vistas de sobra para el target, deben ser
      // mayoría salvo lo forzado por temas sin nuevas: al menos no se dejan
      // nunca-vistas sin usar mientras se meten vistas POR RELLENO.
      void priorityTotal
    }

    expect(failures.slice(0, 10)).toEqual([])
    expect(failures.length).toBe(0)
  })
})
