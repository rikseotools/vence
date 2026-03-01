/**
 * Tests para queries de psychometric-test-data
 * Verifica lógica de queries con mocks de DB
 */

// Setup mocks before any imports
jest.mock('@/db/client', () => {
  const chainable: Record<string, jest.Mock> = {}
  const methods = ['select', 'from', 'where', 'orderBy', 'groupBy', 'limit']
  for (const m of methods) {
    chainable[m] = jest.fn(() => chainable)
  }
  return {
    getDb: jest.fn(() => chainable),
    __chainable: chainable,
  }
})

jest.mock('@/db/schema', () => ({
  psychometricCategories: {
    id: 'id',
    categoryKey: 'category_key',
    displayName: 'display_name',
    isActive: 'is_active',
    displayOrder: 'display_order',
  },
  psychometricSections: {
    id: 'id',
    categoryId: 'category_id',
    sectionKey: 'section_key',
    displayName: 'display_name',
    isActive: 'is_active',
    displayOrder: 'display_order',
  },
  psychometricQuestions: {
    id: 'id',
    categoryId: 'category_id',
    sectionId: 'section_id',
    questionSubtype: 'question_subtype',
    questionText: 'question_text',
    optionA: 'option_a',
    optionB: 'option_b',
    optionC: 'option_c',
    optionD: 'option_d',
    correctOption: 'correct_option',
    contentData: 'content_data',
    difficulty: 'difficulty',
    timeLimitSeconds: 'time_limit_seconds',
    cognitiveSkills: 'cognitive_skills',
    isActive: 'is_active',
    isOfficialExam: 'is_official_exam',
    examSource: 'exam_source',
  },
}))

jest.mock('drizzle-orm', () => ({
  eq: jest.fn((...args: unknown[]) => ({ type: 'eq', args })),
  and: jest.fn((...args: unknown[]) => ({ type: 'and', args })),
  inArray: jest.fn((...args: unknown[]) => ({ type: 'inArray', args })),
  sql: jest.fn((...args: unknown[]) => {
    const result: { type: string; args: unknown[]; as: jest.Mock } = { type: 'sql', args, as: jest.fn() }
    result.as = jest.fn(() => result)
    return result
  }),
}))

import { getPsychometricCategories, getPsychometricQuestions, invalidatePsychometricCategoriesCache } from '@/lib/api/psychometric-test-data/queries'

// Access the mock chainable for setup
const { __chainable: chainable } = jest.requireMock('@/db/client') as { __chainable: Record<string, jest.Mock> }

describe('getPsychometricCategories', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    invalidatePsychometricCategoriesCache()
    // Re-chain
    for (const fn of Object.values(chainable)) {
      fn.mockReturnValue(chainable)
    }
  })

  it('debe devolver success:true con categorías', async () => {
    // 1. categories query -> orderBy
    chainable.orderBy.mockResolvedValueOnce([
      { id: 'cat1', key: 'series-letras', name: 'Series de letras', displayOrder: 1 },
    ])
    // 2. sections query -> orderBy
    chainable.orderBy.mockResolvedValueOnce([
      { id: 'sec1', categoryId: 'cat1', key: 'series-letras-correlativas', name: 'Correlativas', displayOrder: 1 },
    ])
    // 3. section counts -> groupBy
    chainable.groupBy.mockResolvedValueOnce([
      { sectionId: 'sec1', count: 48 },
    ])
    // 4. category counts -> groupBy
    chainable.groupBy.mockResolvedValueOnce([
      { categoryId: 'cat1', count: 48 },
    ])

    const result = await getPsychometricCategories()

    expect(result.success).toBe(true)
    expect(result.categories).toBeDefined()
    expect(result.categories).toHaveLength(1)
    expect(result.categories![0].key).toBe('series-letras')
    expect(result.categories![0].questionCount).toBe(48)
    expect(result.categories![0].sections).toHaveLength(1)
    expect(result.categories![0].sections[0].count).toBe(48)
  })

  it('debe devolver error en caso de excepción', async () => {
    chainable.orderBy.mockRejectedValueOnce(new Error('DB connection failed'))

    const result = await getPsychometricCategories()

    expect(result.success).toBe(false)
    expect(result.error).toContain('DB connection failed')
  })
})

describe('getPsychometricQuestions', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    for (const fn of Object.values(chainable)) {
      fn.mockReturnValue(chainable)
    }
  })

  it('debe devolver preguntas sin correctOption', async () => {
    // 1. Resolve category keys
    chainable.where.mockResolvedValueOnce([
      { id: 'cat1', key: 'series-letras' },
    ])
    // 2. Fetch questions
    chainable.where.mockResolvedValueOnce([
      {
        id: 'q1',
        categoryId: 'cat1',
        sectionId: 'sec1',
        questionSubtype: 'sequence_letter',
        questionText: 'Test?',
        optionA: 'A',
        optionB: 'B',
        optionC: 'C',
        optionD: 'D',
        contentData: {},
        difficulty: 'medium',
        timeLimitSeconds: 120,
        cognitiveSkills: null,
        isOfficialExam: false,
        examSource: null,
      },
    ])

    const result = await getPsychometricQuestions(['series-letras'], 10)

    expect(result.success).toBe(true)
    expect(result.questions).toHaveLength(1)
    // SECURITY check
    const q = result.questions![0]
    expect('correctOption' in q).toBe(false)
    expect('correct_option' in q).toBe(false)
  })

  it('debe devolver array vacío para categorías inexistentes', async () => {
    chainable.where.mockResolvedValueOnce([])

    const result = await getPsychometricQuestions(['nonexistent'], 10)

    expect(result.success).toBe(true)
    expect(result.questions).toEqual([])
    expect(result.totalAvailable).toBe(0)
  })

  it('debe respetar numQuestions', async () => {
    chainable.where.mockResolvedValueOnce([
      { id: 'cat1', key: 'series-numericas' },
    ])
    const manyQuestions = Array.from({ length: 50 }, (_, i) => ({
      id: `q${i}`,
      categoryId: 'cat1',
      sectionId: 'sec1',
      questionSubtype: 'sequence_numeric',
      questionText: `Q${i}?`,
      optionA: 'A',
      optionB: 'B',
      optionC: 'C',
      optionD: 'D',
      contentData: {},
      difficulty: 'medium',
      timeLimitSeconds: 120,
      cognitiveSkills: null,
      isOfficialExam: false,
      examSource: null,
    }))
    chainable.where.mockResolvedValueOnce(manyQuestions)

    const result = await getPsychometricQuestions(['series-numericas'], 10)

    expect(result.success).toBe(true)
    expect(result.questions).toHaveLength(10)
    expect(result.totalAvailable).toBe(50)
  })

  it('debe devolver error en caso de excepción', async () => {
    chainable.where.mockRejectedValueOnce(new Error('Query timeout'))

    const result = await getPsychometricQuestions(['series-letras'], 10)

    expect(result.success).toBe(false)
    expect(result.error).toContain('Query timeout')
  })
})
