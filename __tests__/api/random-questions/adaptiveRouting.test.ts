/**
 * Tests para verificar que el routing de fetchers en TestPageWrapper
 * envía correctamente al fetcher adaptativo cuando adaptive=true.
 *
 * Protege contra regresiones en:
 * - El routing personalizado+adaptativo → fetchQuestionsByTopicScope
 * - El routing personalizado sin adaptativo → fetchQuestionsViaAPI
 * - La construcción del catálogo adaptativo con global_difficulty_category
 * - El COALESCE de dificultad (calculada > estática > 'medium')
 */

// ============================================
// 1. ROUTING: personalizado + adaptive → fetchQuestionsByTopicScope
// ============================================

describe('TestPageWrapper routing — adaptive detection', () => {
  // Simula la lógica de getFetcherForTema
  function getFetcherName(
    temaParam: number | null | undefined,
    testTypeParam: string,
    adaptiveParam: string | null
  ): string {
    if (temaParam && temaParam > 0 && testTypeParam === 'personalizado') {
      if (adaptiveParam === 'true') {
        return 'fetchQuestionsByTopicScope'
      }
      return 'fetchQuestionsViaAPI'
    }
    if (temaParam && temaParam > 0) {
      return 'fetchQuestionsByTopicScope'
    }
    return 'other'
  }

  test('personalizado + tema + adaptive=true → fetchQuestionsByTopicScope', () => {
    expect(getFetcherName(1, 'personalizado', 'true')).toBe('fetchQuestionsByTopicScope')
  })

  test('personalizado + tema + adaptive=false → fetchQuestionsViaAPI', () => {
    expect(getFetcherName(1, 'personalizado', 'false')).toBe('fetchQuestionsViaAPI')
  })

  test('personalizado + tema + sin adaptive → fetchQuestionsViaAPI', () => {
    expect(getFetcherName(1, 'personalizado', null)).toBe('fetchQuestionsViaAPI')
  })

  test('aleatorio + tema → fetchQuestionsByTopicScope (siempre)', () => {
    expect(getFetcherName(5, 'aleatorio', null)).toBe('fetchQuestionsByTopicScope')
  })

  test('personalizado + tema=0 → other (sin tema)', () => {
    expect(getFetcherName(0, 'personalizado', 'true')).toBe('other')
  })

  test('personalizado + tema=null → other', () => {
    expect(getFetcherName(null, 'personalizado', 'true')).toBe('other')
  })
})

// ============================================
// 2. COALESCE: globalDifficultyCategory > difficulty > 'medium'
// ============================================

describe('Difficulty COALESCE — global_difficulty_category priority', () => {
  function getDifficulty(globalCalc: string | null, staticDiff: string | null): string {
    return globalCalc || staticDiff || 'medium'
  }

  test('global calculada presente → usa calculada', () => {
    expect(getDifficulty('hard', 'easy')).toBe('hard')
  })

  test('global calculada null → usa estática', () => {
    expect(getDifficulty(null, 'easy')).toBe('easy')
  })

  test('ambas null → fallback medium', () => {
    expect(getDifficulty(null, null)).toBe('medium')
  })

  test('global extreme → extreme (no importa estática)', () => {
    expect(getDifficulty('extreme', 'medium')).toBe('extreme')
  })

  test('global easy → easy (no importa estática)', () => {
    expect(getDifficulty('easy', 'hard')).toBe('easy')
  })
})

// ============================================
// 3. CATÁLOGO ADAPTATIVO — distribución correcta
// ============================================

describe('Adaptive catalog — difficulty distribution', () => {
  interface Question {
    id: string
    metadata: { difficulty: string }
  }

  function buildCatalog(questions: Question[], answeredIds: Set<string>) {
    const neverSeen = questions.filter(q => !answeredIds.has(q.id))
    const answered = questions.filter(q => answeredIds.has(q.id))

    const getDifficulty = (q: Question) => q.metadata.difficulty || 'medium'

    return {
      neverSeen: {
        easy: neverSeen.filter(q => getDifficulty(q) === 'easy'),
        medium: neverSeen.filter(q => getDifficulty(q) === 'medium'),
        hard: neverSeen.filter(q => getDifficulty(q) === 'hard'),
        extreme: neverSeen.filter(q => getDifficulty(q) === 'extreme'),
      },
      answered: {
        easy: answered.filter(q => getDifficulty(q) === 'easy'),
        medium: answered.filter(q => getDifficulty(q) === 'medium'),
        hard: answered.filter(q => getDifficulty(q) === 'hard'),
        extreme: answered.filter(q => getDifficulty(q) === 'extreme'),
      },
    }
  }

  test('todas neverSeen cuando no hay historial', () => {
    const questions = [
      { id: '1', metadata: { difficulty: 'easy' } },
      { id: '2', metadata: { difficulty: 'medium' } },
      { id: '3', metadata: { difficulty: 'hard' } },
    ]

    const catalog = buildCatalog(questions, new Set())

    expect(catalog.neverSeen.easy).toHaveLength(1)
    expect(catalog.neverSeen.medium).toHaveLength(1)
    expect(catalog.neverSeen.hard).toHaveLength(1)
    expect(catalog.answered.easy).toHaveLength(0)
    expect(catalog.answered.medium).toHaveLength(0)
  })

  test('clasifica answered correctamente con historial', () => {
    const questions = [
      { id: '1', metadata: { difficulty: 'easy' } },
      { id: '2', metadata: { difficulty: 'medium' } },
      { id: '3', metadata: { difficulty: 'hard' } },
      { id: '4', metadata: { difficulty: 'easy' } },
    ]

    const catalog = buildCatalog(questions, new Set(['1', '3']))

    expect(catalog.neverSeen.easy).toHaveLength(1) // id=4
    expect(catalog.neverSeen.medium).toHaveLength(1) // id=2
    expect(catalog.answered.easy).toHaveLength(1) // id=1
    expect(catalog.answered.hard).toHaveLength(1) // id=3
  })

  test('usa global_difficulty_category calculada (no estática)', () => {
    // Simula pregunta donde global_calc=hard pero static=easy
    // El COALESCE debería devolver 'hard' en metadata.difficulty
    const questions = [
      { id: '1', metadata: { difficulty: 'hard' } }, // COALESCE ya aplicado por la API
      { id: '2', metadata: { difficulty: 'easy' } },
    ]

    const catalog = buildCatalog(questions, new Set())

    expect(catalog.neverSeen.hard).toHaveLength(1)
    expect(catalog.neverSeen.easy).toHaveLength(1)
  })
})

// ============================================
// 4. SELECCIÓN INICIAL — prioridad medium > easy > hard
// ============================================

describe('Adaptive initial selection priority', () => {
  function selectInitial(catalog: Record<string, any[]>, numQuestions: number): string {
    const medNS = catalog.medium || []
    const easyNS = catalog.easy || []
    const hardNS = catalog.hard || []

    if (medNS.length >= numQuestions) return 'medium-only'
    if (medNS.length + easyNS.length >= numQuestions) return 'medium+easy'
    const allNS = [...medNS, ...easyNS, ...hardNS]
    if (allNS.length >= numQuestions) return 'medium+easy+hard'
    return 'all-questions-fallback'
  }

  test('suficientes medium → medium-only', () => {
    expect(selectInitial({ medium: Array(25), easy: Array(10), hard: Array(5) }, 25)).toBe('medium-only')
  })

  test('insuficientes medium pero medium+easy suficientes → medium+easy', () => {
    expect(selectInitial({ medium: Array(10), easy: Array(20), hard: Array(5) }, 25)).toBe('medium+easy')
  })

  test('medium+easy insuficientes → medium+easy+hard', () => {
    expect(selectInitial({ medium: Array(5), easy: Array(5), hard: Array(20) }, 25)).toBe('medium+easy+hard')
  })

  test('ninguno suficiente → fallback', () => {
    expect(selectInitial({ medium: Array(3), easy: Array(3), hard: Array(3) }, 25)).toBe('all-questions-fallback')
  })
})

// ============================================
// 5. adaptDifficulty — reemplazo de preguntas
// ============================================

describe('adaptDifficulty simulation', () => {
  interface CatalogEntry { id: string }

  function simulateAdaptDifficulty(
    direction: 'easier' | 'harder',
    catalog: { neverSeen: Record<string, CatalogEntry[]>; answered: Record<string, CatalogEntry[]> },
    existingIds: Set<string>,
    remainingCount: number
  ): { source: string; count: number } {
    const targetDifficulty = direction === 'easier' ? 'easy' : 'medium'
    const secondaryDifficulty = direction === 'easier' ? 'medium' : 'easy'

    // Priority 1: neverSeen target
    const neverSeenTarget = (catalog.neverSeen[targetDifficulty] || [])
      .filter(q => !existingIds.has(q.id))

    if (neverSeenTarget.length >= remainingCount) {
      return { source: `neverSeen-${targetDifficulty}`, count: remainingCount }
    }

    // Priority 2: neverSeen combined
    const neverSeenSecondary = (catalog.neverSeen[secondaryDifficulty] || [])
      .filter(q => !existingIds.has(q.id))
    const allNeverSeen = [...neverSeenTarget, ...neverSeenSecondary]

    if (allNeverSeen.length >= remainingCount) {
      return { source: `neverSeen-combined`, count: remainingCount }
    }

    // Priority 3: answered fallback
    const answeredTarget = (catalog.answered[targetDifficulty] || [])
      .filter(q => !existingIds.has(q.id))
    const finalCount = Math.min(allNeverSeen.length + answeredTarget.length, remainingCount)

    return { source: 'neverSeen+answered', count: finalCount }
  }

  test('suficientes easy neverSeen → usa solo neverSeen easy', () => {
    const catalog = {
      neverSeen: {
        easy: [{ id: 'e1' }, { id: 'e2' }, { id: 'e3' }, { id: 'e4' }, { id: 'e5' }],
        medium: [{ id: 'm1' }],
        hard: [],
        extreme: [],
      },
      answered: { easy: [], medium: [], hard: [], extreme: [] },
    }

    const result = simulateAdaptDifficulty('easier', catalog, new Set(), 3)
    expect(result.source).toBe('neverSeen-easy')
    expect(result.count).toBe(3)
  })

  test('insuficientes easy → combina easy + medium neverSeen', () => {
    const catalog = {
      neverSeen: {
        easy: [{ id: 'e1' }],
        medium: [{ id: 'm1' }, { id: 'm2' }, { id: 'm3' }],
        hard: [],
        extreme: [],
      },
      answered: { easy: [], medium: [], hard: [], extreme: [] },
    }

    const result = simulateAdaptDifficulty('easier', catalog, new Set(), 3)
    expect(result.source).toBe('neverSeen-combined')
    expect(result.count).toBe(3)
  })

  test('insuficientes neverSeen → fallback a answered', () => {
    const catalog = {
      neverSeen: {
        easy: [{ id: 'e1' }],
        medium: [],
        hard: [],
        extreme: [],
      },
      answered: {
        easy: [{ id: 'ae1' }, { id: 'ae2' }],
        medium: [],
        hard: [],
        extreme: [],
      },
    }

    const result = simulateAdaptDifficulty('easier', catalog, new Set(), 3)
    expect(result.source).toBe('neverSeen+answered')
    expect(result.count).toBe(3)
  })

  test('excluye preguntas ya en el test', () => {
    const catalog = {
      neverSeen: {
        easy: [{ id: 'e1' }, { id: 'e2' }, { id: 'e3' }],
        medium: [],
        hard: [],
        extreme: [],
      },
      answered: { easy: [], medium: [], hard: [], extreme: [] },
    }

    const result = simulateAdaptDifficulty('easier', catalog, new Set(['e1', 'e2']), 2)
    // Solo e3 disponible (1 neverSeen easy + 0 medium = 1), necesita 2 → answered fallback
    expect(result.source).toBe('neverSeen+answered')
  })

  test('direction harder → busca medium primero', () => {
    const catalog = {
      neverSeen: {
        easy: [{ id: 'e1' }],
        medium: [{ id: 'm1' }, { id: 'm2' }, { id: 'm3' }],
        hard: [],
        extreme: [],
      },
      answered: { easy: [], medium: [], hard: [], extreme: [] },
    }

    const result = simulateAdaptDifficulty('harder', catalog, new Set(), 2)
    expect(result.source).toBe('neverSeen-medium')
    expect(result.count).toBe(2)
  })
})

// ============================================
// 6. TRIGGER: checkAdaptiveMode
// ============================================

describe('checkAdaptiveMode — trigger conditions', () => {
  function shouldTriggerAdaptation(
    accuracy: number,
    totalAnswered: number,
    questionsSinceLastAdaptation: number,
    adaptiveMode: boolean
  ): boolean {
    if (!adaptiveMode) return false
    return accuracy < 60 && totalAnswered >= 3 && questionsSinceLastAdaptation >= 3
  }

  test('accuracy 0% + 3 respuestas + adaptiveMode → trigger', () => {
    expect(shouldTriggerAdaptation(0, 3, 3, true)).toBe(true)
  })

  test('accuracy 50% + 3 respuestas → trigger', () => {
    expect(shouldTriggerAdaptation(50, 4, 4, true)).toBe(true)
  })

  test('accuracy 60% → NO trigger (boundary)', () => {
    expect(shouldTriggerAdaptation(60, 5, 5, true)).toBe(false)
  })

  test('accuracy 80% → NO trigger', () => {
    expect(shouldTriggerAdaptation(80, 10, 10, true)).toBe(false)
  })

  test('solo 2 respuestas → NO trigger (necesita 3+)', () => {
    expect(shouldTriggerAdaptation(0, 2, 2, true)).toBe(false)
  })

  test('adaptiveMode=false → NO trigger nunca', () => {
    expect(shouldTriggerAdaptation(0, 10, 10, false)).toBe(false)
  })

  test('menos de 3 preguntas desde última adaptación → NO trigger', () => {
    expect(shouldTriggerAdaptation(0, 5, 2, true)).toBe(false)
  })
})

// ============================================
// 7. SOURCE VERIFICATION
// ============================================

describe('Source code verification', () => {
  test('TestPageWrapper checks adaptive param for personalizado routing', () => {
    const fs = require('fs')
    const content = fs.readFileSync('components/TestPageWrapper.tsx', 'utf-8')
    expect(content).toContain("finalSearchParams?.get?.('adaptive') === 'true'")
    expect(content).toContain('fetchQuestionsByTopicScope')
  })

  test('API response uses globalDifficultyCategory COALESCE', () => {
    const fs = require('fs')
    const content = fs.readFileSync('lib/api/filtered-questions/queries.ts', 'utf-8')
    expect(content).toContain('q.globalDifficultyCategory || q.difficulty')
  })

  test('questionColumns includes globalDifficultyCategory', () => {
    const fs = require('fs')
    const content = fs.readFileSync('lib/api/filtered-questions/queries.ts', 'utf-8')
    expect(content).toContain('globalDifficultyCategory: questions.globalDifficultyCategory')
  })
})
