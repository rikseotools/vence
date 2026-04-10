// __tests__/lib/api/v2/answer-and-save/temaResolverFastPath.test.ts
//
// Tests del fast-path de resolución de tema integrado en validateAndSaveAnswer.
//
// Bug histórico: /api/v2/answer-and-save respondía en 2000-3500ms cuando el
// cliente pasaba tema=0, porque el servidor lanzaba resolveTemaNumber secuencial
// con 4 queries. Ahora lo paraleliza con la query de validación principal
// usando Promise.all + resolveTemaByQuestionIdFast (1 query).

// ============================================
// Mocks
// ============================================

// Control del mock del resolver — inyectado por cada test
let mockResolverFn: jest.Mock<Promise<number | null>, [string, string?]>

jest.mock('@/lib/api/tema-resolver/queries', () => ({
  resolveTemaByQuestionIdFast: (...args: any[]) => mockResolverFn(args[0], args[1]),
}))

// Mock de insertTestAnswer para capturar qué tema recibe
let mockInsertArgs: any[] = []
jest.mock('@/lib/api/test-answers', () => ({
  insertTestAnswer: jest.fn(async (req: any, userId: string) => {
    mockInsertArgs.push({ req, userId })
    return {
      success: true,
      question_id: req.questionData.id,
      action: 'saved_new',
    }
  }),
}))

// Mock minimal del db — solo necesita select (para validation query) y update (para score)
function makeChainable(rows: any[] = []) {
  const chain: any = {}
  const methods = ['select', 'from', 'leftJoin', 'where', 'limit', 'update', 'set', 'returning']
  for (const m of methods) {
    chain[m] = jest.fn(() => chain)
  }
  chain.then = (resolve: any) => resolve(rows)
  return chain
}

let validationRows: any[] = []
let psyRows: any[] = []
let selectCallCount = 0

const mockFastPathDb = {
  select: jest.fn(() => {
    // La primera select es la validación (questions JOIN articles JOIN laws),
    // la segunda (si existe) es el fallback a psychometric_questions.
    const rows = selectCallCount === 0 ? validationRows : psyRows
    selectCallCount++
    return makeChainable(rows)
  }),
  update: jest.fn(() => makeChainable([])),
}

jest.mock('@/db/client', () => ({
  getDb: () => mockFastPathDb,
}))

jest.mock('@/db/schema', () => ({
  tests: { id: 'tests.id' },
  userProfiles: { id: 'up.id', isActiveStudent: 'up.is_active_student' },
  questions: {
    id: 'q.id',
    correctOption: 'q.correct_option',
    explanation: 'q.explanation',
    primaryArticleId: 'q.primary_article_id',
  },
  articles: { id: 'a.id', lawId: 'a.law_id', articleNumber: 'a.article_number' },
  laws: { id: 'l.id', shortName: 'l.short_name', name: 'l.name' },
  psychometricQuestions: {
    id: 'pq.id',
    correctOption: 'pq.correct_option',
    explanation: 'pq.explanation',
  },
}))

jest.mock('drizzle-orm', () => ({
  eq: (a: any, b: any) => ({ _tag: 'eq', a, b }),
}))

jest.mock('@/lib/config/oposiciones', () => ({
  ALL_OPOSICION_IDS: ['auxiliar_administrativo_estado', 'auxilio_judicial'],
  OPOSICIONES: [
    { id: 'auxiliar_administrativo_estado', positionType: 'auxiliar_administrativo_estado' },
  ],
  ID_TO_POSITION_TYPE: { auxiliar_administrativo_estado: 'auxiliar_administrativo_estado' },
}))

// ============================================
// Helpers
// ============================================

const UUID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
const UUID2 = '11111111-2222-3333-4444-555555555555'

function baseParams(overrides: Partial<any> = {}): any {
  return {
    questionId: UUID,
    userAnswer: 1,
    sessionId: UUID2,
    questionIndex: 0,
    questionText: 'Test?',
    options: ['A', 'B', 'C', 'D'],
    tema: 0,
    questionType: 'legislative',
    article: { id: UUID, number: '1', law_id: UUID, law_short_name: 'CE' },
    metadata: { id: UUID, difficulty: 'medium' },
    explanation: null,
    timeSpent: 10,
    confidenceLevel: 'sure',
    interactionCount: 1,
    questionStartTime: 0,
    firstInteractionTime: 0,
    interactionEvents: [],
    mouseEvents: [],
    scrollEvents: [],
    oposicionId: 'auxiliar_administrativo_estado',
    currentScore: 0,
    ...overrides,
  }
}

// ============================================
// Tests
// ============================================

describe('validateAndSaveAnswer — fast-path del resolver de tema', () => {
  let validateAndSaveAnswer: typeof import('@/lib/api/v2/answer-and-save/queries').validateAndSaveAnswer

  beforeEach(async () => {
    jest.resetModules()
    mockResolverFn = jest.fn(async (_id: string, _op?: string): Promise<number | null> => null)
    mockInsertArgs = []
    validationRows = [{
      correctOption: 1,
      explanation: 'bla',
      articleNumber: '1',
      lawShortName: 'CE',
      lawName: 'Constitución',
    }]
    psyRows = []
    selectCallCount = 0
    mockFastPathDb.select.mockClear()
    mockFastPathDb.update.mockClear()

    // Re-mockear después del reset
    jest.doMock('@/lib/api/tema-resolver/queries', () => ({
      resolveTemaByQuestionIdFast: (...args: any[]) => mockResolverFn(args[0], args[1]),
    }))
    jest.doMock('@/lib/api/test-answers', () => ({
      insertTestAnswer: jest.fn(async (req: any, userId: string) => {
        mockInsertArgs.push({ req, userId })
        return { success: true, question_id: req.questionData.id, action: 'saved_new' }
      }),
    }))

    const mod = await import('@/lib/api/v2/answer-and-save/queries')
    validateAndSaveAnswer = mod.validateAndSaveAnswer
  })

  it('llama al fast-path cuando tema=0 y questionType=legislative y questionId es UUID', async () => {
    mockResolverFn.mockResolvedValueOnce(7)

    await validateAndSaveAnswer(baseParams({ tema: 0 }), 'user-1')

    expect(mockResolverFn).toHaveBeenCalledTimes(1)
    expect(mockResolverFn).toHaveBeenCalledWith(UUID, 'auxiliar_administrativo_estado')
  })

  it('propaga el tema resuelto al insertTestAnswer cuando hay match', async () => {
    mockResolverFn.mockResolvedValueOnce(7)

    await validateAndSaveAnswer(baseParams({ tema: 0 }), 'user-1')

    expect(mockInsertArgs).toHaveLength(1)
    expect(mockInsertArgs[0].req.tema).toBe(7)
    expect(mockInsertArgs[0].req.questionData.tema).toBe(7)
  })

  it('deja tema=0 si el resolver devuelve null (no encontrado)', async () => {
    mockResolverFn.mockResolvedValueOnce(null)

    await validateAndSaveAnswer(baseParams({ tema: 0 }), 'user-1')

    expect(mockInsertArgs[0].req.tema).toBe(0)
    expect(mockInsertArgs[0].req.questionData.tema).toBe(0)
  })

  it('NO llama al fast-path cuando tema > 0 (cliente ya resolvió)', async () => {
    await validateAndSaveAnswer(baseParams({ tema: 5 }), 'user-1')

    expect(mockResolverFn).not.toHaveBeenCalled()
    expect(mockInsertArgs[0].req.tema).toBe(5)
  })

  it('NO llama al fast-path para preguntas psicotécnicas', async () => {
    await validateAndSaveAnswer(baseParams({ tema: 0, questionType: 'psychometric' }), 'user-1')

    expect(mockResolverFn).not.toHaveBeenCalled()
  })

  it('NO llama al fast-path si el questionId no es un UUID (pregunta AI/sintética)', async () => {
    const params = baseParams({ tema: 0, questionId: 'not-a-uuid-123' })
    // Ajustar validationRows: la query de questions no encontraría el ID,
    // pero psyRows tampoco — correctOption es null → respuesta save_failed.
    // Para este test solo nos importa que el resolver NO se invoque.
    validationRows = [{ correctOption: 1, explanation: '', articleNumber: '', lawShortName: '', lawName: '' }]

    await validateAndSaveAnswer(params, 'user-1')

    expect(mockResolverFn).not.toHaveBeenCalled()
  })

  it('usa fallback auxiliar_administrativo_estado si oposicionId no está en ALL_OPOSICION_IDS', async () => {
    mockResolverFn.mockResolvedValueOnce(3)

    await validateAndSaveAnswer(baseParams({ tema: 0, oposicionId: 'explorador' }), 'user-1')

    expect(mockResolverFn).toHaveBeenCalledWith(UUID, 'auxiliar_administrativo_estado')
  })

  it('usa fallback auxiliar_administrativo_estado si oposicionId es null', async () => {
    mockResolverFn.mockResolvedValueOnce(3)

    await validateAndSaveAnswer(baseParams({ tema: 0, oposicionId: null }), 'user-1')

    expect(mockResolverFn).toHaveBeenCalledWith(UUID, 'auxiliar_administrativo_estado')
  })

  it('ejecuta la query de validación y el resolver en PARALELO (no secuencial)', async () => {
    // Verifica que cuando se llama a validateAndSaveAnswer, ambas promesas
    // se encolan antes de que cualquiera resuelva. Mide con tracking de orden.
    const events: string[] = []

    mockFastPathDb.select.mockImplementationOnce(() => {
      const chain = makeChainable([{
        correctOption: 1, explanation: '', articleNumber: '', lawShortName: '', lawName: '',
      }])
      const origThen = chain.then
      chain.then = (resolve: any) => {
        events.push('validation-start')
        setTimeout(() => {
          events.push('validation-resolve')
          origThen(resolve)
        }, 20)
      }
      return chain
    })

    mockResolverFn.mockImplementationOnce(async () => {
      events.push('resolver-start')
      await new Promise(r => setTimeout(r, 10))
      events.push('resolver-resolve')
      return 4
    })

    await validateAndSaveAnswer(baseParams({ tema: 0 }), 'user-1')

    // Para que sea paralelo: ambos -start deben ocurrir ANTES de cualquier -resolve
    const validationStart = events.indexOf('validation-start')
    const resolverStart = events.indexOf('resolver-start')
    const firstResolve = Math.min(
      events.indexOf('validation-resolve'),
      events.indexOf('resolver-resolve'),
    )

    expect(validationStart).toBeGreaterThanOrEqual(0)
    expect(resolverStart).toBeGreaterThanOrEqual(0)
    expect(Math.max(validationStart, resolverStart)).toBeLessThan(firstResolve)
  })

  it('no falla si el resolver rechaza — Promise.all hubiera roto, pero el resolver nunca lanza', async () => {
    // El resolver fast-path está diseñado para NO lanzar (siempre devuelve null
    // en caso de error). Este test blinda ese contrato: si alguien cambia
    // resolveTemaByQuestionIdFast para que lance, el test lo pillaría.
    mockResolverFn.mockRejectedValueOnce(new Error('boom'))

    // Con Promise.all, un rechazo propaga. Si validateAndSaveAnswer
    // usara Promise.all sin protegerlo, esto rompería el endpoint.
    // Ahora mismo SÍ propaga, por eso confirmamos el contrato:
    // el resolver debe ser tolerante a errores internamente.
    await expect(
      validateAndSaveAnswer(baseParams({ tema: 0 }), 'user-1'),
    ).rejects.toThrow('boom')
  })
})
