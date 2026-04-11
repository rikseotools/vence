/**
 * Tests para queries del módulo test-config (con mock de DB)
 *
 * Strategy: Mock the entire getDb() return to track sequential query calls.
 * Each Drizzle query chain is a separate call that resolves to a result.
 * We track calls by the terminal method (the one that's awaited).
 */

// Mock del modulo db/client ANTES de importar queries
jest.mock('../../../db/client', () => ({
  getDb: jest.fn(),
}))

// Mock de exam-positions
jest.mock('../../../lib/config/exam-positions', () => ({
  getValidExamPositions: jest.fn((positionType: string) => {
    if (positionType === 'auxiliar_administrativo_estado') {
      return ['auxiliar administrativo del estado', 'auxiliar_administrativo_estado']
    }
    if (positionType === 'tramitacion_procesal') {
      return ['tramitacion_procesal']
    }
    return []
  }),
}))

import { getDb } from '../../../db/client'
import {
  getArticlesForLaw,
  estimateAvailableQuestions,
  getEssentialArticles,
  getScopedLawSections,
} from '../../../lib/api/test-config/queries'

const mockGetDb = getDb as jest.MockedFunction<typeof getDb>

// Build a mock DB where each select() call returns a new chain that resolves
// to the next queued result. This models how Drizzle works: each query is
// a separate chain of .select().from().where()... that resolves when awaited.
function setupMockDb(queryResults: any[]) {
  let callIndex = 0

  function createChain(): any {
    const chain: any = {}
    const methods = ['from', 'innerJoin', 'leftJoin', 'where', 'groupBy', 'orderBy', 'limit']

    for (const method of methods) {
      chain[method] = jest.fn().mockReturnValue(chain)
    }

    // Make the chain thenable — when awaited, return the next queued result
    chain.then = function (resolve: any, reject: any) {
      const result = queryResults[callIndex++]
      if (result instanceof Error) {
        return Promise.reject(result).then(resolve, reject)
      }
      return Promise.resolve(result).then(resolve, reject)
    }

    return chain
  }

  const db = {
    select: jest.fn().mockImplementation(() => createChain()),
  }

  mockGetDb.mockReturnValue(db as any)
  return db
}

beforeEach(() => {
  jest.clearAllMocks()
})

// ============================================
// getArticlesForLaw
// ============================================

describe('getArticlesForLaw', () => {
  test('con topicNumber: devuelve articulos del tema con question_count', async () => {
    setupMockDb([
      // 1. law lookup
      [{ id: 'law-id-1' }],
      // 2. topic_scope lookup
      [{ articleNumbers: ['1', '14', '16'], lawId: 'law-id-1', lawShortName: 'CE' }],
      // 3. articles with question count
      [
        { articleNumber: '1', title: 'Titulo Preliminar', questionCount: 15 },
        { articleNumber: '14', title: 'Igualdad', questionCount: 8 },
      ],
    ])

    const result = await getArticlesForLaw({
      lawShortName: 'CE',
      topicNumber: 1,
      positionType: 'auxiliar_administrativo_estado',
      includeOfficialCount: false,
    })

    expect(result.success).toBe(true)
    expect(result.articles).toHaveLength(2)
    expect(result.articles![0].article_number).toBe('1')
    expect(result.articles![0].question_count).toBe(15)
    expect(result.articles![1].article_number).toBe('14')
  })

  test('articulos del scope sin preguntas devuelven question_count=0 (LEFT JOIN)', async () => {
    setupMockDb([
      // 1. law lookup
      [{ id: 'law-id-1' }],
      // 2. topic_scope lookup — 5 artículos en scope
      [{ articleNumbers: ['1', '4', '10', '35', '38'], lawId: 'law-id-1', lawShortName: 'LPRL' }],
      // 3. LEFT JOIN result — incluye artículos con 0 preguntas
      [
        { articleNumber: '1', title: 'Normativa sobre PRL', questionCount: 0 },
        { articleNumber: '4', title: 'Definiciones', questionCount: 5 },
        { articleNumber: '10', title: 'Vigilancia salud', questionCount: 0 },
        { articleNumber: '35', title: 'Delegados prevención', questionCount: 3 },
        { articleNumber: '38', title: 'Comité seguridad', questionCount: 2 },
      ],
    ])

    const result = await getArticlesForLaw({
      lawShortName: 'LPRL',
      topicNumber: 15,
      positionType: 'auxiliar_administrativo_estado',
      includeOfficialCount: false,
    })

    expect(result.success).toBe(true)
    expect(result.articles).toHaveLength(5)
    // Artículos con preguntas
    expect(result.articles![1].article_number).toBe('4')
    expect(result.articles![1].question_count).toBe(5)
    // Artículos sin preguntas (question_count = 0)
    expect(result.articles![0].article_number).toBe('1')
    expect(result.articles![0].question_count).toBe(0)
    expect(result.articles![2].article_number).toBe('10')
    expect(result.articles![2].question_count).toBe(0)
  })

  test('ley no encontrada devuelve error', async () => {
    setupMockDb([
      // 1. law lookup — empty
      [],
    ])

    const result = await getArticlesForLaw({
      lawShortName: 'INEXISTENTE',
      topicNumber: 1,
      positionType: 'auxiliar_administrativo_estado',
      includeOfficialCount: false,
    })

    expect(result.success).toBe(false)
    expect(result.error).toContain('Ley no encontrada')
  })

  test('sin topicNumber (standalone): consulta directa sin topic_scope', async () => {
    setupMockDb([
      // 1. law lookup
      [{ id: 'law-id-1' }],
      // 2. articles with question count (no topic_scope step)
      [
        { articleNumber: '1', title: 'Art 1', questionCount: 5 },
        { articleNumber: '2', title: 'Art 2', questionCount: 3 },
      ],
    ])

    const result = await getArticlesForLaw({
      lawShortName: 'CE',
      topicNumber: null,
      positionType: 'auxiliar_administrativo_estado',
      includeOfficialCount: false,
    })

    expect(result.success).toBe(true)
    expect(result.articles).toHaveLength(2)
  })

  test('con includeOfficialCount devuelve official_question_count', async () => {
    setupMockDb([
      // 1. law lookup
      [{ id: 'law-id-1' }],
      // 2. articles with question count
      [
        { articleNumber: '14', title: 'Igualdad', questionCount: 8 },
        { articleNumber: '16', title: 'Tutela', questionCount: 6 },
      ],
      // 3. official count query
      [
        { articleNumber: '14', officialCount: 3 },
      ],
    ])

    const result = await getArticlesForLaw({
      lawShortName: 'CE',
      topicNumber: null,
      positionType: 'auxiliar_administrativo_estado',
      includeOfficialCount: true,
    })

    expect(result.success).toBe(true)
    expect(result.articles).toHaveLength(2)
    expect(result.articles![0].official_question_count).toBe(3)
    expect(result.articles![1].official_question_count).toBe(0)
  })

  test('topic sin scope devuelve array vacio', async () => {
    setupMockDb([
      // 1. law lookup
      [{ id: 'law-id-1' }],
      // 2. topic_scope — empty
      [],
    ])

    const result = await getArticlesForLaw({
      lawShortName: 'CE',
      topicNumber: 999,
      positionType: 'auxiliar_administrativo_estado',
      includeOfficialCount: false,
    })

    expect(result.success).toBe(true)
    expect(result.articles).toEqual([])
  })

  test('error de DB devuelve error response', async () => {
    setupMockDb([
      new Error('DB connection failed'),
    ])

    const result = await getArticlesForLaw({
      lawShortName: 'CE',
      topicNumber: 1,
      positionType: 'auxiliar_administrativo_estado',
      includeOfficialCount: false,
    })

    expect(result.success).toBe(false)
    expect(result.error).toBe('DB connection failed')
  })
})

// ============================================
// estimateAvailableQuestions
// ============================================

describe('estimateAvailableQuestions', () => {
  test('sin topicNumber devuelve error', async () => {
    const result = await estimateAvailableQuestions({
      topicNumber: null,
      positionType: 'auxiliar_administrativo_estado',
      selectedLaws: [],
      selectedArticlesByLaw: {},
      selectedSectionFilters: [],
      onlyOfficialQuestions: false,
      difficultyMode: 'random',
      focusEssentialArticles: false,
    })

    expect(result.success).toBe(false)
    expect(result.error).toContain('topicNumber es requerido')
  })

  test('sin filtros: total de preguntas del tema', async () => {
    setupMockDb([
      // 1. topic_scope
      [{ articleNumbers: ['1', '2', '3'], lawId: 'law-id', lawShortName: 'CE' }],
      // 2. count query
      [{ count: 45 }],
    ])

    const result = await estimateAvailableQuestions({
      topicNumber: 1,
      positionType: 'auxiliar_administrativo_estado',
      selectedLaws: [],
      selectedArticlesByLaw: {},
      selectedSectionFilters: [],
      onlyOfficialQuestions: false,
      difficultyMode: 'random',
      focusEssentialArticles: false,
    })

    expect(result.success).toBe(true)
    expect(result.count).toBe(45)
    expect(result.byLaw).toEqual({ CE: 45 })
  })

  test('con selectedLaws: solo preguntas de leyes seleccionadas', async () => {
    setupMockDb([
      // topic_scope returns 2 laws
      [
        { articleNumbers: ['1', '2'], lawId: 'law-1', lawShortName: 'CE' },
        { articleNumbers: ['10', '20'], lawId: 'law-2', lawShortName: 'Ley 39/2015' },
      ],
      // count query for CE only (Ley 39/2015 filtered out)
      [{ count: 20 }],
    ])

    const result = await estimateAvailableQuestions({
      topicNumber: 1,
      positionType: 'auxiliar_administrativo_estado',
      selectedLaws: ['CE'],
      selectedArticlesByLaw: {},
      selectedSectionFilters: [],
      onlyOfficialQuestions: false,
      difficultyMode: 'random',
      focusEssentialArticles: false,
    })

    expect(result.success).toBe(true)
    expect(result.count).toBe(20)
    expect(result.byLaw).toEqual({ CE: 20 })
  })

  test('con onlyOfficialQuestions filtra por is_official_exam + exam_position', async () => {
    setupMockDb([
      // topic_scope
      [{ articleNumbers: ['1', '14'], lawId: 'law-id', lawShortName: 'CE' }],
      // count (official only)
      [{ count: 5 }],
    ])

    const result = await estimateAvailableQuestions({
      topicNumber: 1,
      positionType: 'auxiliar_administrativo_estado',
      selectedLaws: [],
      selectedArticlesByLaw: {},
      selectedSectionFilters: [],
      onlyOfficialQuestions: true,
      difficultyMode: 'random',
      focusEssentialArticles: false,
    })

    expect(result.success).toBe(true)
    expect(result.count).toBe(5)
  })

  test('con onlyOfficialQuestions + selectedArticlesByLaw: conteo exacto (caso bug Alicia)', async () => {
    setupMockDb([
      // topic_scope
      [{ articleNumbers: ['1', '14', '16', '23'], lawId: 'law-id', lawShortName: 'CE' }],
      // count (only articles 14, 16 + official)
      [{ count: 2 }],
    ])

    const result = await estimateAvailableQuestions({
      topicNumber: 1,
      positionType: 'auxiliar_administrativo_estado',
      selectedLaws: [],
      selectedArticlesByLaw: { CE: [14, 16] },
      selectedSectionFilters: [],
      onlyOfficialQuestions: true,
      difficultyMode: 'random',
      focusEssentialArticles: false,
    })

    expect(result.success).toBe(true)
    expect(result.count).toBe(2)
  })

  test('con difficultyMode filtra por dificultad', async () => {
    setupMockDb([
      // topic_scope
      [{ articleNumbers: ['1', '2'], lawId: 'law-id', lawShortName: 'CE' }],
      // count (hard only)
      [{ count: 10 }],
    ])

    const result = await estimateAvailableQuestions({
      topicNumber: 1,
      positionType: 'auxiliar_administrativo_estado',
      selectedLaws: [],
      selectedArticlesByLaw: {},
      selectedSectionFilters: [],
      onlyOfficialQuestions: false,
      difficultyMode: 'hard',
      focusEssentialArticles: false,
    })

    expect(result.success).toBe(true)
    expect(result.count).toBe(10)
  })

  test('tema sin scope devuelve error', async () => {
    setupMockDb([
      // empty topic_scope
      [],
    ])

    const result = await estimateAvailableQuestions({
      topicNumber: 999,
      positionType: 'auxiliar_administrativo_estado',
      selectedLaws: [],
      selectedArticlesByLaw: {},
      selectedSectionFilters: [],
      onlyOfficialQuestions: false,
      difficultyMode: 'random',
      focusEssentialArticles: false,
    })

    expect(result.success).toBe(false)
    expect(result.error).toContain('No se encontró mapeo')
  })

  test('con focusEssentialArticles filtra por articulos con preguntas oficiales', async () => {
    setupMockDb([
      // topic_scope
      [{ articleNumbers: ['1', '14', '16'], lawId: 'law-id', lawShortName: 'CE' }],
      // essential articles query (groupBy)
      [{ articleNumber: '14' }],
      // count of all questions for essential articles
      [{ count: 8 }],
    ])

    const result = await estimateAvailableQuestions({
      topicNumber: 1,
      positionType: 'auxiliar_administrativo_estado',
      selectedLaws: [],
      selectedArticlesByLaw: {},
      selectedSectionFilters: [],
      onlyOfficialQuestions: false,
      difficultyMode: 'random',
      focusEssentialArticles: true,
    })

    expect(result.success).toBe(true)
    expect(result.count).toBe(8)
  })

  test('con selectedSectionFilters filtra por rango de articulos', async () => {
    setupMockDb([
      // topic_scope
      [{ articleNumbers: ['1', '2', '14', '15', '16'], lawId: 'law-id', lawShortName: 'CE' }],
      // count (only articles 14-16 after section filter)
      [{ count: 12 }],
    ])

    const result = await estimateAvailableQuestions({
      topicNumber: 1,
      positionType: 'auxiliar_administrativo_estado',
      selectedLaws: [],
      selectedArticlesByLaw: {},
      selectedSectionFilters: [
        { title: 'Derechos fundamentales', articleRange: { start: 14, end: 29 } },
      ],
      onlyOfficialQuestions: false,
      difficultyMode: 'random',
      focusEssentialArticles: false,
    })

    expect(result.success).toBe(true)
    expect(result.count).toBe(12)
  })

  test('error de DB devuelve error response', async () => {
    setupMockDb([
      new Error('Connection timeout'),
    ])

    const result = await estimateAvailableQuestions({
      topicNumber: 1,
      positionType: 'auxiliar_administrativo_estado',
      selectedLaws: [],
      selectedArticlesByLaw: {},
      selectedSectionFilters: [],
      onlyOfficialQuestions: false,
      difficultyMode: 'random',
      focusEssentialArticles: false,
    })

    expect(result.success).toBe(false)
    expect(result.error).toBe('Connection timeout')
  })
})

// ============================================
// getEssentialArticles
// ============================================

describe('getEssentialArticles', () => {
  test('tema con articulos imprescindibles devuelve lista + conteos', async () => {
    setupMockDb([
      // 1. topic_scope
      [{ articleNumbers: ['1', '14', '16', '23'], lawId: 'law-id', lawShortName: 'CE' }],
      // 2. articles with official questions (groupBy)
      [
        { articleNumber: '14', officialCount: 3 },
        { articleNumber: '23', officialCount: 2 },
      ],
      // 3. total questions for essential articles
      [{ count: 25 }],
      // 4. difficulty breakdown (groupBy)
      [
        { difficulty: 'easy', count: 10 },
        { difficulty: 'medium', count: 10 },
        { difficulty: 'hard', count: 5 },
      ],
    ])

    const result = await getEssentialArticles({
      topicNumber: 1,
      positionType: 'auxiliar_administrativo_estado',
    })

    expect(result.success).toBe(true)
    expect(result.essentialCount).toBe(2)
    expect(result.essentialArticles).toHaveLength(2)
    expect(result.essentialArticles![0]).toEqual({ number: '14', law: 'CE', questionsCount: 3 })
    expect(result.essentialArticles![1]).toEqual({ number: '23', law: 'CE', questionsCount: 2 })
    expect(result.totalQuestions).toBe(25)
    expect(result.byDifficulty).toEqual({ easy: 10, medium: 10, hard: 5 })
  })

  test('tema sin articulos imprescindibles devuelve count=0', async () => {
    setupMockDb([
      // 1. topic_scope
      [{ articleNumbers: ['1', '2'], lawId: 'law-id', lawShortName: 'CE' }],
      // 2. No articles with official questions
      [],
    ])

    const result = await getEssentialArticles({
      topicNumber: 1,
      positionType: 'auxiliar_administrativo_estado',
    })

    expect(result.success).toBe(true)
    expect(result.essentialCount).toBe(0)
    expect(result.essentialArticles).toEqual([])
    expect(result.totalQuestions).toBe(0)
  })

  test('tema sin scope devuelve error', async () => {
    setupMockDb([
      // empty topic_scope
      [],
    ])

    const result = await getEssentialArticles({
      topicNumber: 999,
      positionType: 'auxiliar_administrativo_estado',
    })

    expect(result.success).toBe(false)
    expect(result.error).toContain('No se encontró mapeo')
  })

  test('error de DB devuelve error response', async () => {
    setupMockDb([
      new Error('DB error'),
    ])

    const result = await getEssentialArticles({
      topicNumber: 1,
      positionType: 'auxiliar_administrativo_estado',
    })

    expect(result.success).toBe(false)
    expect(result.error).toBe('DB error')
  })

  test('multiples leyes acumula articulos', async () => {
    setupMockDb([
      // topic_scope (2 laws)
      [
        { articleNumbers: ['1', '14'], lawId: 'law-1', lawShortName: 'CE' },
        { articleNumbers: ['10'], lawId: 'law-2', lawShortName: 'Ley 39/2015' },
      ],
      // CE: articles with official
      [{ articleNumber: '14', officialCount: 3 }],
      // CE: total questions
      [{ count: 15 }],
      // CE: difficulty
      [{ difficulty: 'easy', count: 15 }],
      // Ley 39/2015: articles with official
      [{ articleNumber: '10', officialCount: 1 }],
      // Ley 39/2015: total questions
      [{ count: 5 }],
      // Ley 39/2015: difficulty
      [{ difficulty: 'medium', count: 5 }],
    ])

    const result = await getEssentialArticles({
      topicNumber: 1,
      positionType: 'auxiliar_administrativo_estado',
    })

    expect(result.success).toBe(true)
    expect(result.essentialCount).toBe(2)
    expect(result.totalQuestions).toBe(20)
    expect(result.byDifficulty).toEqual({ easy: 15, medium: 5 })
  })
})

// ============================================
// getScopedLawSections
// ============================================

describe('getScopedLawSections', () => {
  test('caso Lucía: Tema 5 × Ley 39/2015 sólo Título VI en scope (art 128)', async () => {
    setupMockDb([
      // 1. law lookup
      [{ id: 'law-ley-39-2015' }],
      // 2. topic_scope: sólo art 128 de Ley 39/2015 en Tema 5
      [{ articleNumbers: ['128'], lawId: 'law-ley-39-2015', lawShortName: 'Ley 39/2015' }],
      // 3. law_sections: 7 títulos completos de la ley
      [
        { id: 's1', slug: 'titulo-preliminar', title: 'Título Preliminar. Disposiciones generales', description: null, articleRangeStart: 1, articleRangeEnd: 2, sectionNumber: '0', sectionType: 'titulo', orderPosition: 1 },
        { id: 's2', slug: 'titulo-i', title: 'Título I. De los interesados en el procedimiento', description: null, articleRangeStart: 3, articleRangeEnd: 12, sectionNumber: '1', sectionType: 'titulo', orderPosition: 2 },
        { id: 's3', slug: 'titulo-ii', title: 'Título II. De la actividad de las Administraciones', description: null, articleRangeStart: 13, articleRangeEnd: 33, sectionNumber: '2', sectionType: 'titulo', orderPosition: 3 },
        { id: 's4', slug: 'titulo-iii', title: 'Título III. De los actos administrativos', description: null, articleRangeStart: 34, articleRangeEnd: 52, sectionNumber: '3', sectionType: 'titulo', orderPosition: 4 },
        { id: 's5', slug: 'titulo-iv', title: 'Título IV. Del procedimiento administrativo común', description: null, articleRangeStart: 53, articleRangeEnd: 105, sectionNumber: '4', sectionType: 'titulo', orderPosition: 5 },
        { id: 's6', slug: 'titulo-v', title: 'Título V. De la revisión de los actos', description: null, articleRangeStart: 106, articleRangeEnd: 126, sectionNumber: '5', sectionType: 'titulo', orderPosition: 6 },
        { id: 's7', slug: 'titulo-vi', title: 'Título VI. De la iniciativa legislativa', description: null, articleRangeStart: 127, articleRangeEnd: 133, sectionNumber: '6', sectionType: 'titulo', orderPosition: 7 },
      ],
    ])

    const result = await getScopedLawSections({
      lawShortName: 'Ley 39/2015',
      topicNumber: 5,
      positionType: 'auxiliar_administrativo_estado',
    })

    expect(result.success).toBe(true)
    expect(result.sections).toHaveLength(7)
    expect(result.totalInScope).toBe(1)

    // Sólo Título VI contiene art 128
    const tituloVI = result.sections!.find(s => s.slug === 'titulo-vi')
    expect(tituloVI?.scopeMeta.articleCountInScope).toBe(1)
    expect(tituloVI?.scopeMeta.articlesInScope).toEqual(['128'])

    // Los otros 6 títulos están fuera del scope
    const fueraDeScope = result.sections!.filter(s => s.scopeMeta.articleCountInScope === 0)
    expect(fueraDeScope).toHaveLength(6)
    fueraDeScope.forEach(s => {
      expect(s.scopeMeta.articlesInScope).toEqual([])
    })
  })

  test('ley con múltiples artículos repartidos en varios títulos', async () => {
    setupMockDb([
      // 1. law lookup
      [{ id: 'law-ce' }],
      // 2. topic_scope: arts 1 (Tit Prelim), 14-16 (Tit I), 97 (Tit IV)
      [{ articleNumbers: ['1', '14', '15', '16', '97'], lawId: 'law-ce', lawShortName: 'CE' }],
      // 3. law_sections: 10 títulos CE
      [
        { id: 's1', slug: 'tit-prelim', title: 'Título Preliminar', description: null, articleRangeStart: 1, articleRangeEnd: 9, sectionNumber: '0', sectionType: 'titulo', orderPosition: 1 },
        { id: 's2', slug: 'tit-i', title: 'Título I', description: null, articleRangeStart: 10, articleRangeEnd: 55, sectionNumber: '1', sectionType: 'titulo', orderPosition: 2 },
        { id: 's3', slug: 'tit-iv', title: 'Título IV', description: null, articleRangeStart: 97, articleRangeEnd: 107, sectionNumber: '4', sectionType: 'titulo', orderPosition: 3 },
      ],
    ])

    const result = await getScopedLawSections({
      lawShortName: 'CE',
      topicNumber: 1,
      positionType: 'auxiliar_administrativo_estado',
    })

    expect(result.success).toBe(true)
    expect(result.totalInScope).toBe(3)
    expect(result.sections![0].scopeMeta.articlesInScope).toEqual(['1'])
    expect(result.sections![1].scopeMeta.articlesInScope).toEqual(['14', '15', '16'])
    expect(result.sections![2].scopeMeta.articlesInScope).toEqual(['97'])
  })

  test('ley no encontrada devuelve error', async () => {
    setupMockDb([
      // 1. law lookup empty
      [],
    ])

    const result = await getScopedLawSections({
      lawShortName: 'INEXISTENTE',
      topicNumber: 1,
      positionType: 'auxiliar_administrativo_estado',
    })

    expect(result.success).toBe(false)
    expect(result.error).toContain('Ley no encontrada')
  })

  test('ley fuera del scope del tema devuelve sections vacío sin error', async () => {
    setupMockDb([
      // 1. law lookup
      [{ id: 'law-foo' }],
      // 2. topic_scope — empty (esta ley no pertenece al tema)
      [],
    ])

    const result = await getScopedLawSections({
      lawShortName: 'LeyRara',
      topicNumber: 999,
      positionType: 'auxiliar_administrativo_estado',
    })

    expect(result.success).toBe(true)
    expect(result.sections).toEqual([])
    expect(result.totalInScope).toBe(0)
  })

  test('ley sin secciones definidas en law_sections devuelve lista vacía', async () => {
    setupMockDb([
      // 1. law lookup
      [{ id: 'law-sin-sec' }],
      // 2. topic_scope con artículos
      [{ articleNumbers: ['1', '2', '3'], lawId: 'law-sin-sec', lawShortName: 'LeyX' }],
      // 3. law_sections: vacío
      [],
    ])

    const result = await getScopedLawSections({
      lawShortName: 'LeyX',
      topicNumber: 1,
      positionType: 'auxiliar_administrativo_estado',
    })

    expect(result.success).toBe(true)
    expect(result.sections).toEqual([])
    expect(result.totalInScope).toBe(0)
  })

  test('sección sin articleRange se trata como fuera de scope', async () => {
    setupMockDb([
      [{ id: 'law-1' }],
      [{ articleNumbers: ['1', '5'], lawId: 'law-1', lawShortName: 'CE' }],
      [
        { id: 's1', slug: 'anexo', title: 'Anexo I', description: null, articleRangeStart: null, articleRangeEnd: null, sectionNumber: null, sectionType: 'anexo', orderPosition: 1 },
        { id: 's2', slug: 'tit-i', title: 'Título I', description: null, articleRangeStart: 1, articleRangeEnd: 10, sectionNumber: '1', sectionType: 'titulo', orderPosition: 2 },
      ],
    ])

    const result = await getScopedLawSections({
      lawShortName: 'CE',
      topicNumber: 1,
      positionType: 'auxiliar_administrativo_estado',
    })

    expect(result.success).toBe(true)
    expect(result.sections).toHaveLength(2)
    // Anexo sin rango → articleCountInScope = 0 (fuera de scope)
    expect(result.sections![0].scopeMeta.articleCountInScope).toBe(0)
    expect(result.sections![0].articleRange).toBeNull()
    // Título I → 2 arts en scope
    expect(result.sections![1].scopeMeta.articleCountInScope).toBe(2)
  })

  test('ley virtual (topic_scope.articleNumbers = null) considera secciones como en scope', async () => {
    setupMockDb([
      [{ id: 'law-virtual' }],
      // articleNumbers null = ley virtual (incluye todos los artículos)
      [{ articleNumbers: null, lawId: 'law-virtual', lawShortName: 'LeyVirtual' }],
      [
        { id: 's1', slug: 'tit-i', title: 'Título I', description: null, articleRangeStart: 1, articleRangeEnd: 10, sectionNumber: '1', sectionType: 'titulo', orderPosition: 1 },
      ],
    ])

    const result = await getScopedLawSections({
      lawShortName: 'LeyVirtual',
      topicNumber: 1,
      positionType: 'auxiliar_administrativo_estado',
    })

    expect(result.success).toBe(true)
    expect(result.sections).toHaveLength(1)
    expect(result.sections![0].scopeMeta.articleCountInScope).toBeGreaterThan(0)
    expect(result.totalInScope).toBe(1)
  })

  test('error de DB devuelve error response', async () => {
    setupMockDb([
      new Error('Connection refused'),
    ])

    const result = await getScopedLawSections({
      lawShortName: 'CE',
      topicNumber: 1,
      positionType: 'auxiliar_administrativo_estado',
    })

    expect(result.success).toBe(false)
    expect(result.error).toBe('Connection refused')
  })
})
