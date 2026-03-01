// __tests__/api/filtered-questions/difficultyFilter.test.ts
// Tests para verificar que el filtro de dificultad funciona correctamente
import { z } from 'zod'

// Schema de dificultad (copia del real para validar)
const difficultyModeSchema = z.enum(['random', 'easy', 'medium', 'hard', 'adaptive'])

describe('Schema de difficultyMode', () => {
  test('acepta todos los valores válidos', () => {
    expect(difficultyModeSchema.parse('random')).toBe('random')
    expect(difficultyModeSchema.parse('easy')).toBe('easy')
    expect(difficultyModeSchema.parse('medium')).toBe('medium')
    expect(difficultyModeSchema.parse('hard')).toBe('hard')
    expect(difficultyModeSchema.parse('adaptive')).toBe('adaptive')
  })

  test('rechaza valores inválidos', () => {
    expect(() => difficultyModeSchema.parse('mixed')).toThrow()
    expect(() => difficultyModeSchema.parse('all')).toThrow()
    expect(() => difficultyModeSchema.parse('')).toThrow()
  })
})

describe('Mapeo UI difficulty → API difficultyMode', () => {
  // Simula el mapeo que hace fetchAleatorioMultiTema
  function mapDifficulty(uiValue: string): string {
    return uiValue === 'mixed' ? 'random' : uiValue
  }

  test('mixed (UI default) se mapea a random (API)', () => {
    expect(mapDifficulty('mixed')).toBe('random')
  })

  test('easy, medium, hard pasan sin cambio', () => {
    expect(mapDifficulty('easy')).toBe('easy')
    expect(mapDifficulty('medium')).toBe('medium')
    expect(mapDifficulty('hard')).toBe('hard')
  })

  test('el resultado siempre es válido para el schema', () => {
    const uiValues = ['mixed', 'easy', 'medium', 'hard']
    for (const ui of uiValues) {
      const mapped = mapDifficulty(ui)
      expect(() => difficultyModeSchema.parse(mapped)).not.toThrow()
    }
  })
})

describe('Filtro de dificultad en query', () => {
  // Simula el filtro que aplica getFilteredQuestions en queries.ts
  function applyDifficultyFilter(
    questions: Array<{ id: string; global_difficulty_category: string | null }>,
    difficultyMode: string
  ) {
    if (!difficultyMode || difficultyMode === 'random') {
      return questions // Sin filtro
    }
    return questions.filter(q => q.global_difficulty_category === difficultyMode)
  }

  const mockQuestions = [
    { id: 'q1', global_difficulty_category: 'easy' },
    { id: 'q2', global_difficulty_category: 'easy' },
    { id: 'q3', global_difficulty_category: 'medium' },
    { id: 'q4', global_difficulty_category: 'medium' },
    { id: 'q5', global_difficulty_category: 'medium' },
    { id: 'q6', global_difficulty_category: 'hard' },
    { id: 'q7', global_difficulty_category: null },
  ]

  test('random devuelve todas las preguntas (sin filtro)', () => {
    const result = applyDifficultyFilter(mockQuestions, 'random')
    expect(result).toHaveLength(7)
  })

  test('easy devuelve solo preguntas fáciles', () => {
    const result = applyDifficultyFilter(mockQuestions, 'easy')
    expect(result).toHaveLength(2)
    expect(result.every(q => q.global_difficulty_category === 'easy')).toBe(true)
  })

  test('medium devuelve solo preguntas medias', () => {
    const result = applyDifficultyFilter(mockQuestions, 'medium')
    expect(result).toHaveLength(3)
    expect(result.every(q => q.global_difficulty_category === 'medium')).toBe(true)
  })

  test('hard devuelve solo preguntas difíciles', () => {
    const result = applyDifficultyFilter(mockQuestions, 'hard')
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('q6')
  })

  test('preguntas sin categoría de dificultad se excluyen al filtrar', () => {
    const result = applyDifficultyFilter(mockQuestions, 'easy')
    const nullQuestion = result.find(q => q.global_difficulty_category === null)
    expect(nullQuestion).toBeUndefined()
  })
})

describe('Flujo completo: URL → fetchAleatorioMultiTema → API', () => {
  // Simula la extracción de params como lo hace fetchAleatorioMultiTema
  function extractApiParams(urlParams: Record<string, string>) {
    const rawDifficulty = urlParams['difficulty'] || 'mixed'
    const difficultyMode = rawDifficulty === 'mixed' ? 'random' : rawDifficulty

    return {
      numQuestions: parseInt(urlParams['n'] || '20'),
      difficultyMode,
      onlyOfficialQuestions: urlParams['official_only'] === 'true',
      focusEssentialArticles: urlParams['focus_essential'] === 'true',
      multipleTopics: (urlParams['themes'] || '').split(',').map(Number),
    }
  }

  test('URL sin difficulty → difficultyMode random', () => {
    const params = extractApiParams({ themes: '1,2', n: '25' })
    expect(params.difficultyMode).toBe('random')
  })

  test('URL con difficulty=mixed → difficultyMode random', () => {
    const params = extractApiParams({ themes: '1,2', n: '25', difficulty: 'mixed' })
    expect(params.difficultyMode).toBe('random')
  })

  test('URL con difficulty=easy → difficultyMode easy', () => {
    const params = extractApiParams({ themes: '201', n: '10', difficulty: 'easy' })
    expect(params.difficultyMode).toBe('easy')
    expect(params.multipleTopics).toEqual([201])
  })

  test('URL con difficulty=hard → difficultyMode hard', () => {
    const params = extractApiParams({ themes: '301,302', n: '50', difficulty: 'hard' })
    expect(params.difficultyMode).toBe('hard')
  })

  test('todos los filtros se extraen correctamente juntos', () => {
    const params = extractApiParams({
      themes: '1,2,3,201,301',
      n: '100',
      difficulty: 'medium',
      official_only: 'true',
      focus_essential: 'true',
    })
    expect(params.numQuestions).toBe(100)
    expect(params.difficultyMode).toBe('medium')
    expect(params.onlyOfficialQuestions).toBe(true)
    expect(params.focusEssentialArticles).toBe(true)
    expect(params.multipleTopics).toEqual([1, 2, 3, 201, 301])
  })
})
