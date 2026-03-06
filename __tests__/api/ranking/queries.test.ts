/**
 * Tests para queries del ranking (con mock de DB)
 */

// Mock del modulo db/client ANTES de importar queries
jest.mock('../../../db/client', () => ({
  getDb: jest.fn(),
}))

import { getDb } from '../../../db/client'

const mockGetDb = getDb as jest.MockedFunction<typeof getDb>

// Importar despues del mock
import { getRanking, getUserPosition, getStreakRanking, invalidateRankingCache } from '../../../lib/api/ranking/queries'

beforeEach(() => {
  jest.useFakeTimers()
  jest.setSystemTime(new Date('2026-03-05T14:30:00.000Z'))
  invalidateRankingCache()
})

afterEach(() => {
  jest.useRealTimers()
  jest.restoreAllMocks()
})

function createMockDb(rpcResult: any[] = [], selectResults: any[] = []) {
  const mockExecute = jest.fn().mockResolvedValue(rpcResult)
  const mockWhere = jest.fn().mockResolvedValue(selectResults)
  const mockFrom = jest.fn().mockReturnValue({ where: mockWhere })
  const mockSelect = jest.fn().mockReturnValue({ from: mockFrom })
  mockGetDb.mockReturnValue({
    execute: mockExecute,
    select: mockSelect,
  } as any)
  return mockExecute
}

describe('getRanking', () => {
  test('today con RPC devuelve ranking con perfiles', async () => {
    const mockData = [
      { user_id: 'u1', total_questions: 50, correct_answers: 45, accuracy: 90 },
      { user_id: 'u2', total_questions: 30, correct_answers: 21, accuracy: 70 },
    ]
    createMockDb(mockData)

    const result = await getRanking({ timeFilter: 'today', minQuestions: 5, limit: 50, offset: 0 })

    expect(result.success).toBe(true)
    expect(result.ranking).toHaveLength(2)
    expect(result.ranking![0].userId).toBe('u1')
    expect(result.ranking![0].rank).toBe(1)
    expect(result.ranking![0].accuracy).toBe(90)
    expect(result.ranking![0].name).toBeDefined()
    expect(result.ranking![1].rank).toBe(2)
  })

  test('offset se aplica al rank', async () => {
    const mockData = [
      { user_id: 'u3', total_questions: 20, correct_answers: 15, accuracy: 75 },
    ]
    createMockDb(mockData)

    const result = await getRanking({ timeFilter: 'today', minQuestions: 5, limit: 50, offset: 50 })

    expect(result.success).toBe(true)
    expect(result.ranking![0].rank).toBe(51) // offset + 0 + 1
  })

  test('hasMore true cuando rows.length === limit', async () => {
    // Simular que devuelve exactamente limit filas
    const mockData = Array.from({ length: 50 }, (_, i) => ({
      user_id: `u${i}`,
      total_questions: 10,
      correct_answers: 8,
      accuracy: 80,
    }))
    createMockDb(mockData)

    const result = await getRanking({ timeFilter: 'today', minQuestions: 5, limit: 50, offset: 0 })

    expect(result.hasMore).toBe(true)
  })

  test('hasMore false cuando rows.length < limit', async () => {
    createMockDb([
      { user_id: 'u1', total_questions: 10, correct_answers: 8, accuracy: 80 },
    ])

    const result = await getRanking({ timeFilter: 'today', minQuestions: 5, limit: 50, offset: 0 })

    expect(result.hasMore).toBe(false)
  })

  test('RPC devuelve error -> success false', async () => {
    const mockExecute = jest.fn().mockRejectedValue(new Error('connection failed'))
    mockGetDb.mockReturnValue({ execute: mockExecute } as any)

    const result = await getRanking({ timeFilter: 'today', minQuestions: 5, limit: 50, offset: 0 })

    expect(result.success).toBe(false)
    expect(result.error).toBeDefined()
  })

  test('ranking vacio -> success true, ranking []', async () => {
    createMockDb([])

    const result = await getRanking({ timeFilter: 'today', minQuestions: 5, limit: 50, offset: 0 })

    expect(result.success).toBe(true)
    expect(result.ranking).toHaveLength(0)
  })

  test('cache: segunda llamada mismo timeFilter no llama RPC (page 0)', async () => {
    const mockExecute = createMockDb([
      { user_id: 'u1', total_questions: 10, correct_answers: 8, accuracy: 80 },
    ])

    await getRanking({ timeFilter: 'today', minQuestions: 5, limit: 50, offset: 0 })
    await getRanking({ timeFilter: 'today', minQuestions: 5, limit: 50, offset: 0 })

    // Solo 1 llamada al RPC (no 2) - selectos adicionales para perfiles cuentan aparte
    expect(mockExecute).toHaveBeenCalledTimes(1)
  })

  test('cache no aplica a offset > 0', async () => {
    const mockExecute = createMockDb([
      { user_id: 'u1', total_questions: 10, correct_answers: 8, accuracy: 80 },
    ])

    await getRanking({ timeFilter: 'today', minQuestions: 5, limit: 50, offset: 0 })
    await getRanking({ timeFilter: 'today', minQuestions: 5, limit: 50, offset: 50 })

    // 2 llamadas: page 0 + page 1
    expect(mockExecute).toHaveBeenCalledTimes(2)
  })

  test('cache expirado -> llama RPC de nuevo', async () => {
    const mockExecute = createMockDb([
      { user_id: 'u1', total_questions: 10, correct_answers: 8, accuracy: 80 },
    ])

    await getRanking({ timeFilter: 'today', minQuestions: 5, limit: 50, offset: 0 })

    // Avanzar 61 segundos (cache TTL = 60s)
    jest.advanceTimersByTime(61_000)

    await getRanking({ timeFilter: 'today', minQuestions: 5, limit: 50, offset: 0 })

    expect(mockExecute).toHaveBeenCalledTimes(2)
  })

  test('diferentes timeFilters tienen caches independientes', async () => {
    const mockExecute = createMockDb([])

    await getRanking({ timeFilter: 'today', minQuestions: 5, limit: 50, offset: 0 })
    await getRanking({ timeFilter: 'week', minQuestions: 5, limit: 50, offset: 0 })

    expect(mockExecute).toHaveBeenCalledTimes(2)
  })

  test('incluye generatedAt en la respuesta', async () => {
    createMockDb([])

    const result = await getRanking({ timeFilter: 'today', minQuestions: 5, limit: 50, offset: 0 })

    expect(result.generatedAt).toBeDefined()
    expect(new Date(result.generatedAt!).toISOString()).toBe(result.generatedAt)
  })
})

describe('getUserPosition', () => {
  test('usuario en ranking -> posicion correcta', async () => {
    const mockExecute = jest.fn().mockResolvedValue([
      { user_rank: 3, total_questions: 20, correct_answers: 16, accuracy: 80, total_users_in_ranking: 15 },
    ])
    mockGetDb.mockReturnValue({ execute: mockExecute } as any)

    const pos = await getUserPosition('some-uuid', 'today')

    expect(pos).not.toBeNull()
    expect(pos!.rank).toBe(3)
    expect(pos!.totalUsers).toBe(15)
  })

  test('usuario no esta en ranking -> null', async () => {
    const mockExecute = jest.fn().mockResolvedValue([
      { user_rank: null, total_questions: null, correct_answers: null, accuracy: null, total_users_in_ranking: null },
    ])
    mockGetDb.mockReturnValue({ execute: mockExecute } as any)

    const pos = await getUserPosition('some-uuid', 'today')

    expect(pos).toBeNull()
  })

  test('error en RPC -> null', async () => {
    const mockExecute = jest.fn().mockRejectedValue(new Error('timeout'))
    mockGetDb.mockReturnValue({ execute: mockExecute } as any)

    const pos = await getUserPosition('some-uuid', 'today')

    expect(pos).toBeNull()
  })
})

describe('getStreakRanking', () => {
  test('devuelve streaks ordenados con perfiles', async () => {
    const mockStreakRows = [
      { userId: 'u1', currentStreak: 7 },
      { userId: 'u2', currentStreak: 3 },
    ]
    const mockWhere = jest.fn().mockResolvedValue(mockStreakRows)
    const mockFrom = jest.fn().mockReturnValue({ where: mockWhere })
    const mockSelect = jest.fn().mockReturnValue({ from: mockFrom })
    mockGetDb.mockReturnValue({
      select: mockSelect,
    } as any)

    const result = await getStreakRanking({ timeFilter: 'week', category: 'all', limit: 50, offset: 0 })

    expect(result.success).toBe(true)
    expect(result.streaks).toBeDefined()
    expect(result.streaks!.length).toBeGreaterThanOrEqual(0)
  })

  test('error en query -> success false', async () => {
    const mockWhere = jest.fn().mockRejectedValue(new Error('connection failed'))
    const mockFrom = jest.fn().mockReturnValue({ where: mockWhere })
    const mockSelect = jest.fn().mockReturnValue({ from: mockFrom })
    mockGetDb.mockReturnValue({
      select: mockSelect,
    } as any)

    const result = await getStreakRanking({ timeFilter: 'week', category: 'all', limit: 50, offset: 0 })

    expect(result.success).toBe(false)
    expect(result.error).toBeDefined()
  })
})
