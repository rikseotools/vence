// __tests__/api/filtered-questions/idFirstParity.test.ts
// Capa 2: tests de paridad legacy vs idFirst con mocks.
//
// Estrategia: mock de getReadDb que responde a queries con datasets
// fijos. Ambas implementaciones reciben los MISMOS datos del mock; con
// Math.random seeded, deben producir los MISMOS IDs en el MISMO orden.
//
// Si la paridad falla, el refactor introduce divergencia de comportamiento
// y debe corregirse antes de habilitar el flag.
//
// La paridad mock NO sustituye a paridad real DB (Capa 4 sesión 2). Es la
// red de seguridad inicial: si esto rompe, sabemos que algo va mal sin
// salir a producción.

export {}

const POSITION = 'auxiliar_administrativo_estado'

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000'

// ============================================
// FIXTURE: dataset común para los tests
// ============================================
// Construido para ejercitar diferentes paths del pipeline JS sin depender
// de BD real. Cada test selecciona un subset.

function makeFullQuestionRow(opts: {
  id: string
  articleNumber: string
  lawShortName: string
  lawId?: string
  lawName?: string
  isOfficialExam?: boolean
}) {
  return {
    id: opts.id,
    questionText: `Q ${opts.id}`,
    optionA: 'A',
    optionB: 'B',
    optionC: 'C',
    optionD: 'D',
    optionE: null,
    explanation: 'expl',
    difficulty: 'medium',
    questionType: 'single',
    tags: null,
    isActive: true,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    primaryArticleId: `art-${opts.articleNumber}-${opts.lawShortName}`,
    isOfficialExam: opts.isOfficialExam ?? false,
    examSource: null,
    examDate: null,
    examEntity: null,
    examPosition: null,
    officialDifficultyLevel: null,
    imageUrl: null,
    contentData: null,
    correctOption: 0,
    globalDifficultyCategory: null,
    articleId: `art-${opts.articleNumber}-${opts.lawShortName}`,
    articleNumber: opts.articleNumber,
    articleTitle: `Art ${opts.articleNumber}`,
    articleContent: 'content',
    lawId: opts.lawId ?? `law-${opts.lawShortName}`,
    lawName: opts.lawName ?? `Ley ${opts.lawShortName}`,
    lawShortName: opts.lawShortName,
  }
}

// ============================================
// MOCK DB: responde a queries Drizzle con datos preconfigurados
// ============================================
//
// Cada test setupa los datasets que quiere devolver. Ambas funciones
// (legacy e idFirst) reciben las mismas respuestas para las mismas queries.
//
// El mock es "thenable" — los await sobre la chain final resuelven con
// el array configurado. Detecta el tipo de query mirando "from" + "innerJoin".

interface MockDataset {
  laws: Array<{ lawId: string, lawShortName: string, lawName: string }>
  topicScopes: Array<{
    articleNumbers: string[]
    lawId: string
    lawShortName: string
    lawName: string
    topicNumber: number
  }>
  articlesByLawId: Record<string, Array<{ articleNumber: string }>>
  questions: ReturnType<typeof makeFullQuestionRow>[]  // pool global; filtramos por WHERE
  recentlyAnsweredByUserId: Record<string, string[]>
  neverSeenByUserId: Record<string, Set<string>>  // ids que SE consideran "nunca vistas"
}

function createMockDb(data: MockDataset) {
  // Cada chain construye un descriptor de query. Cuando se hace .then() (await),
  // miramos el descriptor para devolver los datos correctos.
  type QueryDescriptor = {
    fromTable: 'laws' | 'articles' | 'topicScope' | 'questions' | 'testQuestions' | 'unknown'
    joinedTables: string[]
    selectedCols: Record<string, unknown>
  }

  function buildBuilder(desc: QueryDescriptor) {
    const builder: Record<string, unknown> = {
      from: jest.fn((table: unknown) => {
        // Detectar tabla por símbolo. Drizzle pasa el objeto schema.
        const tableStr = String(table?.constructor?.name || '')
        // Hack: en el setup de test, asignaremos schemas para identificar
        if ((table as { _name?: string })?._name) desc.fromTable = (table as { _name: string })._name as QueryDescriptor['fromTable']
        return builder
      }),
      innerJoin: jest.fn((table: unknown) => {
        if ((table as { _name?: string })?._name) desc.joinedTables.push((table as { _name: string })._name)
        return builder
      }),
      where: jest.fn(() => builder),
      orderBy: jest.fn(() => builder),
      limit: jest.fn(() => builder),
      then: (resolve: (value: unknown) => void) => {
        const result = resolveQuery(desc)
        resolve(result)
        return Promise.resolve(result)
      },
    }
    return builder
  }

  function resolveQuery(desc: QueryDescriptor): unknown[] {
    // 'questions' query (path 5-6): select questions + articles + laws con WHERE law_id + ...
    // El mock devuelve TODAS las preguntas del dataset. Las funciones JS aplicarán
    // filtros (esto es OK porque estamos testando el pipeline JS, no SQL).
    //
    // PARIDAD: legacy y idFirst llaman a esta query con el mismo law_id (en el
    // for-loop por mapping). El mock devuelve la misma data → both filtran igual.
    if (desc.fromTable === 'questions' && desc.joinedTables.includes('articles')) {
      return data.questions
    }
    if (desc.fromTable === 'laws') return data.laws
    if (desc.fromTable === 'topicScope') return data.topicScopes
    if (desc.fromTable === 'articles') {
      // Devolver concatenación de todos los articleNumbers del dataset
      return Object.values(data.articlesByLawId).flat()
    }
    if (desc.fromTable === 'testQuestions') {
      // Esta query la hacen getRecentlyAnsweredQuestionIds y getNeverSeenQuestionIds
      // Devolver array vacío para tests que no usan esas features
      return []
    }
    return []
  }

  return {
    select: jest.fn((cols: Record<string, unknown> = {}) => {
      const desc: QueryDescriptor = {
        fromTable: 'unknown',
        joinedTables: [],
        selectedCols: cols,
      }
      return buildBuilder(desc)
    }),
  }
}

// ============================================
// SETUP COMÚN
// ============================================
function setupCommonMocks() {
  jest.doMock('@/db/schema', () => {
    // Etiquetar cada tabla para que el mock pueda identificarla
    const tag = (name: string) => Object.assign({}, { _name: name })
    return {
      questions: tag('questions'),
      articles: tag('articles'),
      laws: tag('laws'),
      topicScope: tag('topicScope'),
      topics: tag('topics'),
      tests: tag('tests'),
      testQuestions: tag('testQuestions'),
      userQuestionHistory: tag('userQuestionHistory'),
    }
  })

  jest.doMock('drizzle-orm', () => {
    // Stubs no-op — la lógica de WHERE se aplica via mock de DB, no Drizzle
    const noop = jest.fn(() => ({}))
    return {
      eq: noop,
      and: noop,
      inArray: noop,
      sql: Object.assign(noop, { raw: noop }),
      notInArray: noop,
      desc: noop,
      or: noop,
      lt: noop,
    }
  })

  jest.doMock('@/lib/api/oposicion-scope/queries', () => ({
    getAllowedLawIds: jest.fn().mockResolvedValue({ lawIds: [], positionType: POSITION }),
    buildOfficialExamFilter: jest.fn(() => ({})),
  }))

  jest.doMock('@/lib/api/validation-error-log', () => ({
    logValidationError: jest.fn(),
  }))

  jest.doMock('@/lib/config/oposiciones', () => ({
    getOposicionByPositionType: jest.fn(() => ({ questionTag: null })),
    EXCLUSIVE_QUESTION_TAGS: [],
  }))

  jest.doMock('@/lib/config/exam-positions', () => ({
    getValidExamPositions: jest.fn(() => []),
  }))
}

function applyDbMock(data: MockDataset) {
  jest.doMock('@/db/client', () => ({
    getDb: () => createMockDb(data),
    getReadDb: () => createMockDb(data),
  }))
}

// ============================================
// SEEDED RANDOM
// ============================================
function seedMathRandom(seed = 0.5) {
  const original = Math.random
  Math.random = jest.fn(() => seed)
  return () => { Math.random = original }
}

// ============================================
// TESTS DE PARIDAD
// ============================================

describe('Paridad legacy vs idFirst — path 5 (modo ley-only)', () => {
  beforeEach(() => {
    jest.resetModules()
  })

  it('single law CE con 10 preguntas en 5 artículos: mismos IDs ganadores', async () => {
    setupCommonMocks()

    const dataset: MockDataset = {
      laws: [{ lawId: 'law-CE', lawShortName: 'CE', lawName: 'Constitución' }],
      topicScopes: [],
      articlesByLawId: {
        'law-CE': Array.from({ length: 5 }, (_, i) => ({ articleNumber: String(i + 1) })),
      },
      questions: Array.from({ length: 10 }, (_, i) =>
        makeFullQuestionRow({
          id: `q${i + 1}`,
          articleNumber: String((i % 5) + 1),
          lawShortName: 'CE',
          lawId: 'law-CE',
          lawName: 'Constitución',
        }),
      ),
      recentlyAnsweredByUserId: {},
      neverSeenByUserId: {},
    }

    applyDbMock(dataset)

    const params = {
      topicNumber: 0,
      positionType: POSITION,
      multipleTopics: [],
      numQuestions: 5,
      selectedLaws: ['CE'],
      selectedArticlesByLaw: {},
      selectedSectionFilters: [],
      onlyOfficialQuestions: false,
      includeSharedOfficials: false,
      difficultyMode: 'random' as const,
      excludeRecentDays: 0,
      focusEssentialArticles: false,
      prioritizeNeverSeen: false,
      proportionalByTopic: false,
      onlyFailedQuestions: false,
      failedQuestionIds: [],
      primaryArticleIds: [],
    }

    const restoreA = seedMathRandom(0.5)
    const { getFilteredQuestionsLegacy: legacyA } = require('@/lib/api/filtered-questions/queries')
    const legacyResult = await legacyA(params)
    restoreA()

    jest.resetModules()
    setupCommonMocks()
    applyDbMock(dataset)
    const restoreB = seedMathRandom(0.5)
    const { getFilteredQuestionsIdFirst: idFirstA } = require('@/lib/api/filtered-questions/queries')
    const idFirstResult = await idFirstA(params)
    restoreB()

    expect(legacyResult.success).toBe(true)
    expect(idFirstResult.success).toBe(true)
    expect(legacyResult.questions?.length).toBe(idFirstResult.questions?.length)
    const legacyIds = (legacyResult.questions || []).map((q: { id: string }) => q.id).sort()
    const idFirstIds = (idFirstResult.questions || []).map((q: { id: string }) => q.id).sort()
    expect(idFirstIds).toEqual(legacyIds)
  })

  it('multi-ley CE + Ley 39: ambas producen distribución equitativa con misma cardinalidad por ley', async () => {
    setupCommonMocks()

    const dataset: MockDataset = {
      laws: [
        { lawId: 'law-CE', lawShortName: 'CE', lawName: 'Constitución' },
        { lawId: 'law-L39', lawShortName: 'Ley 39/2015', lawName: 'Ley 39/2015' },
      ],
      topicScopes: [],
      articlesByLawId: {
        'law-CE': [{ articleNumber: '1' }, { articleNumber: '2' }, { articleNumber: '3' }],
        'law-L39': [{ articleNumber: '1' }, { articleNumber: '2' }, { articleNumber: '3' }],
      },
      questions: [
        ...Array.from({ length: 6 }, (_, i) => makeFullQuestionRow({
          id: `q-CE-${i + 1}`,
          articleNumber: String((i % 3) + 1),
          lawShortName: 'CE',
          lawId: 'law-CE',
          lawName: 'Constitución',
        })),
        ...Array.from({ length: 6 }, (_, i) => makeFullQuestionRow({
          id: `q-L39-${i + 1}`,
          articleNumber: String((i % 3) + 1),
          lawShortName: 'Ley 39/2015',
          lawId: 'law-L39',
          lawName: 'Ley 39/2015',
        })),
      ],
      recentlyAnsweredByUserId: {},
      neverSeenByUserId: {},
    }

    applyDbMock(dataset)
    const params = {
      topicNumber: 0,
      positionType: POSITION,
      multipleTopics: [],
      numQuestions: 6,
      selectedLaws: ['CE', 'Ley 39/2015'],
      selectedArticlesByLaw: {},
      selectedSectionFilters: [],
      onlyOfficialQuestions: false,
      includeSharedOfficials: false,
      difficultyMode: 'random' as const,
      excludeRecentDays: 0,
      focusEssentialArticles: false,
      prioritizeNeverSeen: false,
      proportionalByTopic: false,
      onlyFailedQuestions: false,
      failedQuestionIds: [],
      primaryArticleIds: [],
    }

    const restoreA = seedMathRandom(0.42)
    const { getFilteredQuestionsLegacy } = require('@/lib/api/filtered-questions/queries')
    const legacyResult = await getFilteredQuestionsLegacy(params)
    restoreA()

    jest.resetModules()
    setupCommonMocks()
    applyDbMock(dataset)
    const restoreB = seedMathRandom(0.42)
    const { getFilteredQuestionsIdFirst } = require('@/lib/api/filtered-questions/queries')
    const idFirstResult = await getFilteredQuestionsIdFirst(params)
    restoreB()

    // Misma cardinalidad
    expect(idFirstResult.questions?.length).toBe(legacyResult.questions?.length)

    // Misma distribución por ley (selectEquitativeByLaw debe dar mismo split)
    const lawCount = (qs: Array<{ article: { law_short_name: string } }>) => {
      const c: Record<string, number> = {}
      for (const q of qs) c[q.article.law_short_name] = (c[q.article.law_short_name] || 0) + 1
      return c
    }
    expect(lawCount(idFirstResult.questions || [])).toEqual(lawCount(legacyResult.questions || []))
  })

  it('zero results: ambas devuelven empty con mismo emptyReason', async () => {
    setupCommonMocks()

    const dataset: MockDataset = {
      laws: [{ lawId: 'law-CE', lawShortName: 'CE', lawName: 'Constitución' }],
      topicScopes: [],
      articlesByLawId: { 'law-CE': [{ articleNumber: '1' }] },
      questions: [], // pool vacío
      recentlyAnsweredByUserId: {},
      neverSeenByUserId: {},
    }

    applyDbMock(dataset)
    const params = {
      topicNumber: 0,
      positionType: POSITION,
      multipleTopics: [],
      numQuestions: 5,
      selectedLaws: ['CE'],
      selectedArticlesByLaw: {},
      selectedSectionFilters: [],
      onlyOfficialQuestions: false,
      includeSharedOfficials: false,
      difficultyMode: 'random' as const,
      excludeRecentDays: 0,
      focusEssentialArticles: false,
      prioritizeNeverSeen: false,
      proportionalByTopic: false,
      onlyFailedQuestions: false,
      failedQuestionIds: [],
      primaryArticleIds: [],
    }

    const { getFilteredQuestionsLegacy } = require('@/lib/api/filtered-questions/queries')
    const legacyResult = await getFilteredQuestionsLegacy(params)

    jest.resetModules()
    setupCommonMocks()
    applyDbMock(dataset)
    const { getFilteredQuestionsIdFirst } = require('@/lib/api/filtered-questions/queries')
    const idFirstResult = await getFilteredQuestionsIdFirst(params)

    expect(legacyResult.success).toBe(true)
    expect(idFirstResult.success).toBe(true)
    expect(legacyResult.questions).toHaveLength(0)
    expect(idFirstResult.questions).toHaveLength(0)
    expect(idFirstResult.emptyReason).toBeDefined()
    // Mismo emptyReason (verificación cualitativa)
    expect(idFirstResult.emptyReason).toBe(legacyResult.emptyReason)
  })
})

describe('Paridad legacy vs idFirst — path 6 (modo tema)', () => {
  beforeEach(() => {
    jest.resetModules()
  })

  it('topic 1 con scope CE artículos 1-3: mismos IDs ganadores', async () => {
    setupCommonMocks()

    const dataset: MockDataset = {
      laws: [],
      topicScopes: [{
        articleNumbers: ['1', '2', '3'],
        lawId: 'law-CE',
        lawShortName: 'CE',
        lawName: 'Constitución',
        topicNumber: 1,
      }],
      articlesByLawId: {},
      questions: Array.from({ length: 6 }, (_, i) =>
        makeFullQuestionRow({
          id: `q${i + 1}`,
          articleNumber: String((i % 3) + 1),
          lawShortName: 'CE',
          lawId: 'law-CE',
        }),
      ),
      recentlyAnsweredByUserId: {},
      neverSeenByUserId: {},
    }

    applyDbMock(dataset)
    const params = {
      topicNumber: 1,
      positionType: POSITION,
      multipleTopics: [],
      numQuestions: 4,
      selectedLaws: [],
      selectedArticlesByLaw: {},
      selectedSectionFilters: [],
      onlyOfficialQuestions: false,
      includeSharedOfficials: false,
      difficultyMode: 'random' as const,
      excludeRecentDays: 0,
      focusEssentialArticles: false,
      prioritizeNeverSeen: false,
      proportionalByTopic: false,
      onlyFailedQuestions: false,
      failedQuestionIds: [],
      primaryArticleIds: [],
    }

    const restoreA = seedMathRandom(0.5)
    const { getFilteredQuestionsLegacy } = require('@/lib/api/filtered-questions/queries')
    const legacyResult = await getFilteredQuestionsLegacy(params)
    restoreA()

    jest.resetModules()
    setupCommonMocks()
    applyDbMock(dataset)
    const restoreB = seedMathRandom(0.5)
    const { getFilteredQuestionsIdFirst } = require('@/lib/api/filtered-questions/queries')
    const idFirstResult = await getFilteredQuestionsIdFirst(params)
    restoreB()

    expect(legacyResult.success).toBe(true)
    expect(idFirstResult.success).toBe(true)
    expect(idFirstResult.questions?.length).toBe(legacyResult.questions?.length)
    expect(idFirstResult.questions?.length).toBeGreaterThan(0)

    const legacyIds = (legacyResult.questions || []).map((q: { id: string }) => q.id).sort()
    const idFirstIds = (idFirstResult.questions || []).map((q: { id: string }) => q.id).sort()
    expect(idFirstIds).toEqual(legacyIds)
  })

  it('topic sin scope configurado: ambas devuelven empty', async () => {
    setupCommonMocks()

    const dataset: MockDataset = {
      laws: [],
      topicScopes: [], // ningún scope
      articlesByLawId: {},
      questions: [],
      recentlyAnsweredByUserId: {},
      neverSeenByUserId: {},
    }

    applyDbMock(dataset)
    const params = {
      topicNumber: 99,
      positionType: POSITION,
      multipleTopics: [],
      numQuestions: 5,
      selectedLaws: [],
      selectedArticlesByLaw: {},
      selectedSectionFilters: [],
      onlyOfficialQuestions: false,
      includeSharedOfficials: false,
      difficultyMode: 'random' as const,
      excludeRecentDays: 0,
      focusEssentialArticles: false,
      prioritizeNeverSeen: false,
      proportionalByTopic: false,
      onlyFailedQuestions: false,
      failedQuestionIds: [],
      primaryArticleIds: [],
    }

    const { getFilteredQuestionsLegacy } = require('@/lib/api/filtered-questions/queries')
    const legacyResult = await getFilteredQuestionsLegacy(params)

    jest.resetModules()
    setupCommonMocks()
    applyDbMock(dataset)
    const { getFilteredQuestionsIdFirst } = require('@/lib/api/filtered-questions/queries')
    const idFirstResult = await getFilteredQuestionsIdFirst(params)

    expect(legacyResult.success).toBe(true)
    expect(idFirstResult.success).toBe(true)
    expect(legacyResult.questions).toHaveLength(0)
    expect(idFirstResult.questions).toHaveLength(0)
    expect(idFirstResult.emptyReason).toBe(legacyResult.emptyReason)
  })
})

describe('Paridad legacy vs idFirst — payload shape', () => {
  beforeEach(() => {
    jest.resetModules()
  })

  it('preguntas devueltas tienen el mismo shape (id, question, options, etc.)', async () => {
    setupCommonMocks()

    const dataset: MockDataset = {
      laws: [{ lawId: 'law-CE', lawShortName: 'CE', lawName: 'Constitución' }],
      topicScopes: [],
      articlesByLawId: { 'law-CE': [{ articleNumber: '1' }] },
      questions: [makeFullQuestionRow({
        id: 'q-only',
        articleNumber: '1',
        lawShortName: 'CE',
        lawId: 'law-CE',
        lawName: 'Constitución',
      })],
      recentlyAnsweredByUserId: {},
      neverSeenByUserId: {},
    }

    applyDbMock(dataset)
    const params = {
      topicNumber: 0,
      positionType: POSITION,
      multipleTopics: [],
      numQuestions: 1,
      selectedLaws: ['CE'],
      selectedArticlesByLaw: {},
      selectedSectionFilters: [],
      onlyOfficialQuestions: false,
      includeSharedOfficials: false,
      difficultyMode: 'random' as const,
      excludeRecentDays: 0,
      focusEssentialArticles: false,
      prioritizeNeverSeen: false,
      proportionalByTopic: false,
      onlyFailedQuestions: false,
      failedQuestionIds: [],
      primaryArticleIds: [],
    }

    const { getFilteredQuestionsLegacy } = require('@/lib/api/filtered-questions/queries')
    const legacyResult = await getFilteredQuestionsLegacy(params)

    jest.resetModules()
    setupCommonMocks()
    applyDbMock(dataset)
    const { getFilteredQuestionsIdFirst } = require('@/lib/api/filtered-questions/queries')
    const idFirstResult = await getFilteredQuestionsIdFirst(params)

    const legacyQ = legacyResult.questions?.[0]
    const idFirstQ = idFirstResult.questions?.[0]

    expect(legacyQ).toBeDefined()
    expect(idFirstQ).toBeDefined()
    if (!legacyQ || !idFirstQ) return

    // Mismo shape de campos de primer nivel
    expect(Object.keys(idFirstQ).sort()).toEqual(Object.keys(legacyQ).sort())
    // Mismo article shape
    expect(Object.keys(idFirstQ.article).sort()).toEqual(Object.keys(legacyQ.article).sort())
    // Mismo metadata shape
    expect(Object.keys(idFirstQ.metadata).sort()).toEqual(Object.keys(legacyQ.metadata).sort())

    // Mismos valores en cada field crítico
    expect(idFirstQ.id).toBe(legacyQ.id)
    expect(idFirstQ.question).toBe(legacyQ.question)
    expect(idFirstQ.correct_option).toBe(legacyQ.correct_option)
    expect(idFirstQ.article.law_short_name).toBe(legacyQ.article.law_short_name)
    expect(idFirstQ.metadata.is_official_exam).toBe(legacyQ.metadata.is_official_exam)
  })
})
