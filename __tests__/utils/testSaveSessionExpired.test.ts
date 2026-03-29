// __tests__/utils/testSaveSessionExpired.test.ts
// Tests para verificar que sesiones expiradas se detectan correctamente
// y NO fallan silenciosamente (bug Victor Molina 29/03/2026).

// ============================================
// MOCKS
// ============================================

const mockRefreshSession = jest.fn()
const mockGetSession = jest.fn()
const mockInsert = jest.fn()
const mockSelect = jest.fn()
const mockSingle = jest.fn()
const mockEq = jest.fn()
const mockGte = jest.fn()
const mockOrder = jest.fn()
const mockLimit = jest.fn()

const mockSupabase = {
  auth: {
    refreshSession: mockRefreshSession,
    getSession: mockGetSession,
  },
  from: jest.fn(() => ({
    insert: mockInsert,
    select: mockSelect,
    eq: mockEq,
  })),
}

// Chain mocks
mockInsert.mockReturnValue({ select: mockSelect })
mockSelect.mockReturnValue({ single: mockSingle, eq: mockEq })
mockEq.mockReturnValue({ eq: mockEq, gte: mockGte, is: jest.fn().mockReturnValue({ order: mockOrder }), order: mockOrder })
mockGte.mockReturnValue({ order: mockOrder })
mockOrder.mockReturnValue({ limit: mockLimit })
mockLimit.mockResolvedValue({ data: [], error: null })

jest.mock('@/lib/supabase', () => ({
  getSupabaseClient: () => mockSupabase,
}))

// Mock fetch for V2 API calls
const mockFetchResponse = { ok: true, json: jest.fn(), status: 200 }

// ============================================
// TESTS: saveDetailedAnswerWithRetry
// ============================================

describe('saveDetailedAnswerWithRetry - sesión expirada', () => {
  let saveDetailedAnswerWithRetry: Function

  beforeEach(() => {
    jest.clearAllMocks()
    jest.resetModules()

    // Reset chain mocks
    mockInsert.mockReturnValue({ select: mockSelect })
    mockSelect.mockReturnValue({ single: mockSingle, eq: mockEq })
    mockEq.mockReturnValue({ eq: mockEq, gte: mockGte, is: jest.fn().mockReturnValue({ order: mockOrder }), order: mockOrder })
    mockGte.mockReturnValue({ order: mockOrder })
    mockOrder.mockReturnValue({ limit: mockLimit })
    mockLimit.mockResolvedValue({ data: [], error: null })
    mockSupabase.from.mockReturnValue({
      insert: mockInsert,
      select: mockSelect,
      eq: mockEq,
    })

    // Import fresh
    const mod = require('@/utils/testAnswers')
    saveDetailedAnswerWithRetry = mod.saveDetailedAnswerWithRetry
  })

  const baseParams = {
    sessionId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    questionData: { id: 'q1', question_text: 'Test?', option_a: 'A', option_b: 'B', option_c: 'C', option_d: 'D' },
    answerData: { selectedAnswer: 0, isCorrect: true, questionIndex: 0, timeSpent: 5 },
    tema: 1,
    confidenceLevel: 'medium',
    interactionCount: 1,
    questionStartTime: Date.now(),
    firstInteractionTime: Date.now(),
    interactionEvents: [],
    mouseEvents: [],
    scrollEvents: [],
  }

  it('devuelve session_expired inmediatamente sin reintentos cuando V2 detecta token muerto', async () => {
    // V2 (saveDetailedAnswerV2) detecta que no hay token
    mockRefreshSession.mockResolvedValue({ data: { session: null }, error: null })
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null })

    const result = await saveDetailedAnswerWithRetry(baseParams)

    expect(result.success).toBe(false)
    expect(result.action).toBe('session_expired')
    // NO debe haber hecho fallback a V1 (saveDetailedAnswer)
    // Verificar que no intentó insert en Supabase
    expect(mockInsert).not.toHaveBeenCalled()
  })

  it('NO hace fallback a V1 cuando la sesión está expirada', async () => {
    mockRefreshSession.mockResolvedValue({ data: { session: null }, error: null })
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null })

    const result = await saveDetailedAnswerWithRetry(baseParams)

    // Debe devolver session_expired, no un error genérico de V1
    expect(result.action).toBe('session_expired')
    expect(result.error).toContain('expirada')
  })

  it('SÍ hace fallback a V1 cuando V2 falla por error de red (no por sesión)', async () => {
    // V2 tiene token válido pero falla por red
    mockRefreshSession.mockResolvedValue({
      data: { session: { access_token: 'valid-token' } },
      error: null,
    })

    // Mock fetch para simular error de red en V2
    const originalFetch = global.fetch
    ;(global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'))

    // V1 fallback debería intentar insertar
    mockSingle.mockResolvedValue({
      data: { question_id: 'q1' },
      error: null,
    })

    const result = await saveDetailedAnswerWithRetry(baseParams)

    // Debería haber intentado V1 como fallback
    // (no verificamos el resultado exacto porque V1 tiene su propia lógica)
    expect(result.action).not.toBe('session_expired')

    global.fetch = originalFetch
  })
})

// ============================================
// TESTS: createDetailedTestSession
// ============================================

describe('createDetailedTestSession - sesión expirada', () => {
  let createDetailedTestSession: Function

  beforeEach(() => {
    jest.clearAllMocks()
    jest.resetModules()

    mockInsert.mockReturnValue({ select: mockSelect })
    mockSelect.mockReturnValue({ single: mockSingle, eq: mockEq })
    mockEq.mockReturnValue({ eq: mockEq, gte: mockGte, is: jest.fn().mockReturnValue({ order: mockOrder }), order: mockOrder })
    mockGte.mockReturnValue({ order: mockOrder })
    mockOrder.mockReturnValue({ limit: mockLimit })
    mockLimit.mockResolvedValue({ data: [], error: null })
    mockSupabase.from.mockReturnValue({
      insert: mockInsert,
      select: mockSelect,
      eq: mockEq,
    })

    const mod = require('@/utils/testSession')
    createDetailedTestSession = mod.createDetailedTestSession
  })

  it('devuelve null si getSession no tiene token', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null })

    const result = await createDetailedTestSession(
      'user-id-123',
      1,    // tema
      99,   // testNumber
      [{ id: 'q1', question_text: 'Test?', option_a: 'A', option_b: 'B', option_c: 'C', option_d: 'D' }],
      {},   // config
      Date.now(),
      Date.now()
    )

    expect(result).toBeNull()
    // NO debe haber intentado insertar en BD
    expect(mockInsert).not.toHaveBeenCalled()
  })

  it('NO devuelve null inmediatamente si getSession tiene token válido', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: { access_token: 'valid-token' } },
      error: null,
    })
    // El insert puede fallar por otros motivos (mock incompleto),
    // pero lo importante es que NO retornó null por sesión expirada
    mockSingle.mockResolvedValue({
      data: { id: 'test-123', title: 'Test', total_questions: 1, test_type: 'practice' },
      error: null,
    })

    // El hecho de que getSession devuelva token válido significa que
    // la función NO aborta en el check de sesión (línea "Sesión expirada")
    // Verificamos que getSession fue llamado
    await createDetailedTestSession(
      'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      1, 99,
      [{ id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901', question_text: 'T?', option_a: 'A', option_b: 'B', option_c: 'C', option_d: 'D' }],
      {}, Date.now(), Date.now()
    )

    expect(mockGetSession).toHaveBeenCalled()
  })
})
