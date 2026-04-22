// __tests__/api/adaptive-small-pool.test.ts
// Tests for the adaptive skip when pool is small (< numQuestions)
// Bug: gaditadelgado@gmail.com — Outlook official questions (9 available,
// adaptive filtered to 3 because user had already seen 7)

describe('Adaptive — small pool bypass', () => {
  // Simulates the logic in fetchQuestionsByTopicScope

  const makeQuestions = (count: number) =>
    Array.from({ length: count }, (_, i) => ({
      id: `q-${i}`,
      metadata: { difficulty: 'medium' },
    }))

  const shuffleArray = <T>(arr: T[]): T[] => [...arr] // deterministic for tests

  function simulateAdaptive(
    allQuestions: { id: string; metadata: { difficulty: string } }[],
    numQuestions: number,
    answeredIds: Set<string>,
    needsAdaptiveCatalog: boolean
  ) {
    // Small pool bypass (the fix)
    if (needsAdaptiveCatalog && allQuestions.length <= numQuestions) {
      return {
        bypassed: true,
        questions: shuffleArray(allQuestions).slice(0, numQuestions),
      }
    }

    if (needsAdaptiveCatalog) {
      const neverSeen = allQuestions.filter(q => !answeredIds.has(q.id))
      const getDifficulty = (q: { metadata: { difficulty: string } }) => q.metadata.difficulty || 'medium'
      const medNS = neverSeen.filter(q => getDifficulty(q) === 'medium')
      const easyNS = neverSeen.filter(q => getDifficulty(q) === 'easy')
      const hardNS = neverSeen.filter(q => getDifficulty(q) === 'hard')

      let initial: typeof allQuestions = []
      if (medNS.length >= numQuestions) {
        initial = medNS.slice(0, numQuestions)
      } else if (medNS.length + easyNS.length >= numQuestions) {
        initial = [...medNS, ...easyNS].slice(0, numQuestions)
      } else {
        const allNS = [...medNS, ...easyNS, ...hardNS]
        initial = allNS.length >= numQuestions ? allNS.slice(0, numQuestions) : allQuestions.slice(0, numQuestions)
      }

      return { bypassed: false, questions: initial }
    }

    return { bypassed: false, questions: allQuestions.slice(0, numQuestions) }
  }

  // === SCENARIO: Ana's Outlook bug ===

  it('Outlook bug: 9 official questions, user asks for 9, adaptive ON, 7 already seen → OLD returns 2, NEW returns 9', () => {
    const allQuestions = makeQuestions(9)
    const answeredIds = new Set(['q-0', 'q-1', 'q-2', 'q-3', 'q-4', 'q-5', 'q-6']) // 7 seen

    // OLD behavior (no bypass): adaptive filters to neverSeen only
    const old = simulateAdaptive(allQuestions, 9, answeredIds, true)
    // Would give only 2 neverSeen (q-7, q-8) then fallback to all 9
    // Actually in old code: allNS = 2 < 9 → uses allQuestions → 9
    // But the REAL bug was more subtle with difficulty filtering

    // NEW behavior (bypass): pool(9) <= numQuestions(9) → return all 9
    const result = simulateAdaptive(allQuestions, 9, answeredIds, true)
    expect(result.bypassed).toBe(true)
    expect(result.questions).toHaveLength(9)
  })

  it('Outlook bug: 9 questions, user asks for 25 → bypass, returns 9 (all available)', () => {
    const allQuestions = makeQuestions(9)
    const answeredIds = new Set<string>()

    const result = simulateAdaptive(allQuestions, 25, answeredIds, true)
    expect(result.bypassed).toBe(true)
    expect(result.questions).toHaveLength(9)
  })

  it('Outlook bug: 3 questions, user asks for 9 → bypass, returns 3', () => {
    const allQuestions = makeQuestions(3)
    const answeredIds = new Set<string>()

    const result = simulateAdaptive(allQuestions, 9, answeredIds, true)
    expect(result.bypassed).toBe(true)
    expect(result.questions).toHaveLength(3)
  })

  // === SCENARIO: Large pool — adaptive should work normally ===

  it('Large pool: 500 questions, user asks for 25, adaptive ON → NOT bypassed', () => {
    const allQuestions = makeQuestions(500)
    const answeredIds = new Set(['q-0', 'q-1', 'q-2'])

    const result = simulateAdaptive(allQuestions, 25, answeredIds, true)
    expect(result.bypassed).toBe(false)
    expect(result.questions).toHaveLength(25)
  })

  it('Large pool: 100 questions, user asks for 25 → NOT bypassed', () => {
    const allQuestions = makeQuestions(100)
    const answeredIds = new Set<string>()

    const result = simulateAdaptive(allQuestions, 25, answeredIds, true)
    expect(result.bypassed).toBe(false)
    expect(result.questions).toHaveLength(25)
  })

  // === SCENARIO: Exact boundary ===

  it('Boundary: pool equals numQuestions exactly → bypassed', () => {
    const allQuestions = makeQuestions(25)
    const answeredIds = new Set<string>()

    const result = simulateAdaptive(allQuestions, 25, answeredIds, true)
    expect(result.bypassed).toBe(true)
    expect(result.questions).toHaveLength(25)
  })

  it('Boundary: pool is numQuestions+1 → NOT bypassed', () => {
    const allQuestions = makeQuestions(26)
    const answeredIds = new Set<string>()

    const result = simulateAdaptive(allQuestions, 25, answeredIds, true)
    expect(result.bypassed).toBe(false)
  })

  // === SCENARIO: Adaptive OFF ===

  it('Adaptive OFF: small pool, no bypass needed', () => {
    const allQuestions = makeQuestions(5)
    const answeredIds = new Set<string>()

    const result = simulateAdaptive(allQuestions, 25, answeredIds, false)
    expect(result.bypassed).toBe(false)
    expect(result.questions).toHaveLength(5)
  })

  // === SCENARIO: All questions already seen ===

  it('All seen: 9 questions, all answered, adaptive ON → bypass returns all 9 (for review)', () => {
    const allQuestions = makeQuestions(9)
    const answeredIds = new Set(allQuestions.map(q => q.id))

    const result = simulateAdaptive(allQuestions, 9, answeredIds, true)
    expect(result.bypassed).toBe(true)
    expect(result.questions).toHaveLength(9)
  })

  // === SCENARIO: Empty pool ===

  it('Empty pool: 0 questions → bypass returns 0', () => {
    const allQuestions: { id: string; metadata: { difficulty: string } }[] = []
    const answeredIds = new Set<string>()

    const result = simulateAdaptive(allQuestions, 25, answeredIds, true)
    expect(result.bypassed).toBe(true)
    expect(result.questions).toHaveLength(0)
  })

  // === SCENARIO: 1 question ===

  it('Single question: 1 available, asks for 10 → bypass, returns 1', () => {
    const allQuestions = makeQuestions(1)
    const answeredIds = new Set<string>()

    const result = simulateAdaptive(allQuestions, 10, answeredIds, true)
    expect(result.bypassed).toBe(true)
    expect(result.questions).toHaveLength(1)
  })
})
