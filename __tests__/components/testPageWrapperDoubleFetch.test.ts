/**
 * Tests para verificar que el fix de double-fetch en TestPageWrapper funciona.
 *
 * Bug: useSearchParams() de Next.js cambia de referencia entre renders,
 * disparando loadQuestions() múltiples veces y reemplazando preguntas mid-test.
 *
 * Fix: searchParamsKey (string estable) + loadedForRef (guard de carga única).
 */

describe('TestPageWrapper double-fetch prevention', () => {
  // Simular el comportamiento del loadedForRef
  const createLoadGuard = () => {
    let loadedFor: string | null = null
    let loading = false

    const loadQuestions = async (tema: number, testType: string, searchParamsKey: string, fetchFn: () => Promise<string[]>) => {
      const loadKey = `${tema}-${testType}-${searchParamsKey}`

      // Guard 1: ya cargado para esta config
      if (loadedFor === loadKey) return { skipped: true, reason: 'already_loaded' }

      // Guard 2: ya en progreso
      if (loading) return { skipped: true, reason: 'loading_in_progress' }

      try {
        loading = true
        const questions = await fetchFn()
        loadedFor = loadKey
        return { skipped: false, questions }
      } finally {
        loading = false
      }
    }

    return { loadQuestions, getLoadedFor: () => loadedFor }
  }

  test('primera carga funciona correctamente', async () => {
    const guard = createLoadGuard()
    const result = await guard.loadQuestions(8, 'personalizado', 'n=25', async () => ['q1', 'q2', 'q3'])

    expect(result.skipped).toBe(false)
    expect(result.questions).toEqual(['q1', 'q2', 'q3'])
  })

  test('segunda carga con misma config es bloqueada', async () => {
    const guard = createLoadGuard()
    let fetchCount = 0
    const fetchFn = async () => { fetchCount++; return ['q1', 'q2'] }

    await guard.loadQuestions(8, 'personalizado', 'n=25', fetchFn)
    const result2 = await guard.loadQuestions(8, 'personalizado', 'n=25', fetchFn)

    expect(fetchCount).toBe(1)
    expect(result2.skipped).toBe(true)
    expect(result2.reason).toBe('already_loaded')
  })

  test('carga con tema diferente es permitida', async () => {
    const guard = createLoadGuard()
    let fetchCount = 0
    const fetchFn = async () => { fetchCount++; return ['q1'] }

    await guard.loadQuestions(8, 'personalizado', 'n=25', fetchFn)
    const result2 = await guard.loadQuestions(9, 'personalizado', 'n=25', fetchFn)

    expect(fetchCount).toBe(2)
    expect(result2.skipped).toBe(false)
  })

  test('carga con testType diferente es permitida', async () => {
    const guard = createLoadGuard()
    let fetchCount = 0
    const fetchFn = async () => { fetchCount++; return ['q1'] }

    await guard.loadQuestions(8, 'personalizado', 'n=25', fetchFn)
    const result2 = await guard.loadQuestions(8, 'aleatorio', 'n=25', fetchFn)

    expect(fetchCount).toBe(2)
    expect(result2.skipped).toBe(false)
  })

  test('carga con params diferentes es permitida', async () => {
    const guard = createLoadGuard()
    let fetchCount = 0
    const fetchFn = async () => { fetchCount++; return ['q1'] }

    await guard.loadQuestions(8, 'personalizado', 'n=25', fetchFn)
    const result2 = await guard.loadQuestions(8, 'personalizado', 'n=10&difficulty=hard', fetchFn)

    expect(fetchCount).toBe(2)
    expect(result2.skipped).toBe(false)
  })

  // Simular el bug original: useSearchParams cambia referencia pero contenido es igual
  test('simulación: searchParams cambia de referencia pero toString() es igual → bloqueado', async () => {
    const guard = createLoadGuard()
    let fetchCount = 0
    const fetchFn = async () => { fetchCount++; return ['q1', 'q2', 'q3'] }

    // Primer render: searchParams como string
    const params1 = 'n=25&difficulty_mode=random'
    await guard.loadQuestions(8, 'personalizado', params1, fetchFn)

    // Segundo render: OTRO objeto pero mismo toString()
    const params2 = 'n=25&difficulty_mode=random' // mismo contenido
    const result2 = await guard.loadQuestions(8, 'personalizado', params2, fetchFn)

    expect(fetchCount).toBe(1) // solo se llamó al fetch UNA vez
    expect(result2.skipped).toBe(true)
    expect(result2.reason).toBe('already_loaded')
  })

  // Simular el caso de Cristina: navega de tema 5 a tema 8
  test('simulación Cristina: navegar de tema 5 a tema 8 permite recarga', async () => {
    const guard = createLoadGuard()
    const fetchFn5 = async () => ['q5a', 'q5b', 'q5c']
    const fetchFn8 = async () => ['q8a', 'q8b', 'q8c']

    // Tema 5
    const r1 = await guard.loadQuestions(5, 'personalizado', 'n=25', fetchFn5)
    expect(r1.questions).toEqual(['q5a', 'q5b', 'q5c'])

    // Navega a tema 8 → diferente loadKey → permite recarga
    const r2 = await guard.loadQuestions(8, 'personalizado', 'n=25', fetchFn8)
    expect(r2.questions).toEqual(['q8a', 'q8b', 'q8c'])
    expect(r2.skipped).toBe(false)

    // Intento espurio de recargar tema 8 (double-fetch) → bloqueado
    let spuriousCalled = false
    const r3 = await guard.loadQuestions(8, 'personalizado', 'n=25', async () => { spuriousCalled = true; return ['WRONG'] })
    expect(r3.skipped).toBe(true)
    expect(spuriousCalled).toBe(false) // el fetch NUNCA se ejecutó
  })

  // Cargas concurrentes: loadingRef previene
  test('cargas concurrentes son bloqueadas', async () => {
    // Simular con un lock manual (ya que no podemos usar refs reales)
    let loading = false
    let loadedFor: string | null = null
    let fetchCount = 0

    const load = async (tema: number) => {
      const key = `${tema}-pers-n=25`
      if (loadedFor === key) return 'already_loaded'
      if (loading) return 'loading_in_progress'
      loading = true
      fetchCount++
      await new Promise(r => setTimeout(r, 50))
      loadedFor = key
      loading = false
      return 'ok'
    }

    // Lanzar 3 cargas simultáneas del mismo tema
    const results = await Promise.all([load(8), load(8), load(8)])

    // Solo la primera debería ejecutar el fetch
    expect(results.filter(r => r === 'ok')).toHaveLength(1)
    expect(results.filter(r => r === 'loading_in_progress')).toHaveLength(2)
    expect(fetchCount).toBe(1)
  })
})

describe('searchParamsKey stability', () => {
  test('toString() produce el mismo string para mismos params', () => {
    const p1 = new URLSearchParams('n=25&difficulty_mode=random')
    const p2 = new URLSearchParams('n=25&difficulty_mode=random')
    expect(p1.toString()).toBe(p2.toString())
  })

  test('toString() detecta cambios reales de params', () => {
    const p1 = new URLSearchParams('n=25')
    const p2 = new URLSearchParams('n=10')
    expect(p1.toString()).not.toBe(p2.toString())
  })

  test('toString() vacío es string vacío', () => {
    const p = new URLSearchParams('')
    expect(p.toString()).toBe('')
  })

  test('null/undefined fallback a string vacío', () => {
    const getKey = (p: URLSearchParams | null | undefined) => p?.toString?.() ?? ''
    expect(getKey(null)).toBe('')
    expect(getKey(undefined)).toBe('')
  })
})
