// __tests__/lib/api/tema-resolver/resolveTemaByQuestionIdFast.test.ts
//
// Tests del fast path del resolver de tema usado por /api/v2/answer-and-save.
//
// Bug histórico: el cron de validación lanzaba 4 queries secuenciales a
// Postgres (~180ms + 3 round-trips Vercel↔Supabase) que en prod escalaban
// a 2000-3500ms. El fast path los reduce a 1 round-trip.

// ============================================
// Mocks
// ============================================

let executeCalls: Array<{ sql: any; params?: any }> = []
let mockRows: any[] = []
let shouldThrow = false

const mockTemaResolverDb = {
  execute: jest.fn(async (queryObj: any) => {
    executeCalls.push({ sql: queryObj })
    if (shouldThrow) throw new Error('simulated db error')
    // Emular shape real del driver: drizzle con neon-http devuelve array
    return mockRows
  }),
}

jest.mock('@/db/client', () => ({
  getDb: () => mockTemaResolverDb,
}))

jest.mock('@/db/schema', () => ({
  questions: { id: 'questions.id', primaryArticleId: 'questions.primary_article_id' },
  articles: { id: 'articles.id', lawId: 'articles.law_id', articleNumber: 'articles.article_number' },
  topics: { id: 'topics.id', positionType: 'topics.position_type', isActive: 'topics.is_active', topicNumber: 'topics.topic_number', title: 'topics.title' },
  topicScope: { topicId: 'topic_scope.topic_id', lawId: 'topic_scope.law_id', articleNumbers: 'topic_scope.article_numbers' },
  laws: { id: 'laws.id', shortName: 'laws.short_name', name: 'laws.name' },
}))

jest.mock('drizzle-orm', () => ({
  sql: Object.assign(
    (strings: TemplateStringsArray, ...values: any[]) => ({ _tag: 'sql', strings, values }),
    { raw: (s: string) => ({ _tag: 'raw', s }) },
  ),
  eq: (a: any, b: any) => ({ _tag: 'eq', a, b }),
  and: (...args: any[]) => ({ _tag: 'and', args }),
  inArray: (a: any, b: any) => ({ _tag: 'inArray', a, b }),
}))

jest.mock('@/lib/config/oposiciones', () => ({
  OPOSICIONES: [
    { id: 'auxiliar_administrativo_estado', positionType: 'auxiliar_administrativo_estado' },
    { id: 'auxilio_judicial', positionType: 'auxilio_judicial' },
    { id: 'tramitacion_procesal', positionType: 'tramitacion_procesal' },
  ],
  ID_TO_POSITION_TYPE: {
    auxiliar_administrativo_estado: 'auxiliar_administrativo_estado',
    auxilio_judicial: 'auxilio_judicial',
    tramitacion_procesal: 'tramitacion_procesal',
  },
  ALL_OPOSICION_IDS: ['auxiliar_administrativo_estado', 'auxilio_judicial', 'tramitacion_procesal'],
}))

// ============================================
// Test suite
// ============================================

describe('resolveTemaByQuestionIdFast', () => {
  beforeEach(() => {
    executeCalls = []
    mockRows = []
    shouldThrow = false
    jest.resetModules()
    mockTemaResolverDb.execute.mockClear()
  })

  async function loadModule() {
    return await import('@/lib/api/tema-resolver/queries')
  }

  it('devuelve null inmediatamente si questionId es vacío', async () => {
    const { resolveTemaByQuestionIdFast } = await loadModule()
    const result = await resolveTemaByQuestionIdFast('', 'auxiliar_administrativo_estado' as any)
    expect(result).toBeNull()
    expect(mockTemaResolverDb.execute).not.toHaveBeenCalled()
  })

  it('ejecuta UNA sola query contra la BD (no 4 secuenciales)', async () => {
    mockRows = [{
      question_id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      topic_id: '11111111-2222-3333-4444-555555555555',
      topic_number: 5,
      topic_title: 'Tema 5',
    }]
    const { resolveTemaByQuestionIdFast } = await loadModule()
    const result = await resolveTemaByQuestionIdFast(
      'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      'auxiliar_administrativo_estado' as any,
    )

    expect(result).toBe(5)
    expect(mockTemaResolverDb.execute).toHaveBeenCalledTimes(1)
  })

  it('devuelve null si no se encontró ningún topic_scope match', async () => {
    mockRows = [] // no rows → sin tema resuelto
    const { resolveTemaByQuestionIdFast } = await loadModule()
    const result = await resolveTemaByQuestionIdFast(
      'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      'auxiliar_administrativo_estado' as any,
    )
    expect(result).toBeNull()
  })

  it('devuelve null si la query lanza excepción (no propaga)', async () => {
    shouldThrow = true
    const { resolveTemaByQuestionIdFast } = await loadModule()
    const result = await resolveTemaByQuestionIdFast(
      'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      'auxiliar_administrativo_estado' as any,
    )
    expect(result).toBeNull()
  })

  it('maneja el shape { rows: [...] } de drivers alternativos', async () => {
    // Algunos drivers de drizzle devuelven { rows } en vez de array directo
    mockTemaResolverDb.execute.mockImplementationOnce(async () => ({ rows: [
      { question_id: 'qid', topic_id: 'tid', topic_number: 7, topic_title: null },
    ] }) as any)

    const { resolveTemaByQuestionIdFast } = await loadModule()
    const result = await resolveTemaByQuestionIdFast('qid', 'auxiliar_administrativo_estado' as any)
    expect(result).toBe(7)
  })

  it('cachea el resultado — la segunda llamada no toca la BD', async () => {
    mockRows = [{
      question_id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      topic_id: 'tid',
      topic_number: 3,
      topic_title: null,
    }]
    const { resolveTemaByQuestionIdFast } = await loadModule()

    const first = await resolveTemaByQuestionIdFast(
      'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      'auxiliar_administrativo_estado' as any,
    )
    const second = await resolveTemaByQuestionIdFast(
      'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      'auxiliar_administrativo_estado' as any,
    )

    expect(first).toBe(3)
    expect(second).toBe(3)
    expect(mockTemaResolverDb.execute).toHaveBeenCalledTimes(1) // solo la primera toca BD
  })

  it('no reusa cache entre distintos positionTypes', async () => {
    mockRows = [{ question_id: 'qid', topic_id: 'tid', topic_number: 1, topic_title: null }]
    const { resolveTemaByQuestionIdFast } = await loadModule()

    await resolveTemaByQuestionIdFast('qid', 'auxiliar_administrativo_estado' as any)

    // Cambiar la respuesta para la segunda oposición
    mockRows = [{ question_id: 'qid', topic_id: 'tid', topic_number: 99, topic_title: null }]
    const second = await resolveTemaByQuestionIdFast('qid', 'auxilio_judicial' as any)

    expect(second).toBe(99)
    expect(mockTemaResolverDb.execute).toHaveBeenCalledTimes(2) // cada positionType es key distinta
  })

  it('usa auxiliar_administrativo_estado por defecto si no se pasa oposición', async () => {
    mockRows = [{ question_id: 'qid', topic_id: 'tid', topic_number: 2, topic_title: null }]
    const { resolveTemaByQuestionIdFast } = await loadModule()
    const result = await (resolveTemaByQuestionIdFast as any)('qid')
    expect(result).toBe(2)
  })

  it('devuelve null si la row no tiene topic_number numérico', async () => {
    mockRows = [{ question_id: 'qid', topic_id: 'tid', topic_number: null, topic_title: null }]
    const { resolveTemaByQuestionIdFast } = await loadModule()
    const result = await resolveTemaByQuestionIdFast('qid', 'auxiliar_administrativo_estado' as any)
    expect(result).toBeNull()
  })
})
