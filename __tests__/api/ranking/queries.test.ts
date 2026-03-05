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
import { getRanking, getUserPosition, invalidateRankingCache } from '../../../lib/api/ranking/queries'

beforeEach(() => {
  jest.useFakeTimers()
  jest.setSystemTime(new Date('2026-03-05T14:30:00.000Z'))
  invalidateRankingCache()
})

afterEach(() => {
  jest.useRealTimers()
  jest.restoreAllMocks()
})

function createMockDb(rpcResult: any[] = []) {
  const mockExecute = jest.fn().mockResolvedValue(rpcResult)
  mockGetDb.mockReturnValue({ execute: mockExecute } as any)
  return mockExecute
}

describe('getRanking', () => {
  test('today con RPC devuelve ranking ordenado', async () => {
    const mockData = [
      { user_id: 'u1', total_questions: 50, correct_answers: 45, accuracy: 90 },
      { user_id: 'u2', total_questions: 30, correct_answers: 21, accuracy: 70 },
    ]
    createMockDb(mockData)

    const result = await getRanking({ timeFilter: 'today', minQuestions: 5, limit: 100 })

    expect(result.success).toBe(true)
    expect(result.ranking).toHaveLength(2)
    expect(result.ranking![0].userId).toBe('u1')
    expect(result.ranking![0].rank).toBe(1)
    expect(result.ranking![0].accuracy).toBe(90)
    expect(result.ranking![1].rank).toBe(2)
  })

  test('RPC devuelve error -> success false', async () => {
    const mockExecute = jest.fn().mockRejectedValue(new Error('connection failed'))
    mockGetDb.mockReturnValue({ execute: mockExecute } as any)

    const result = await getRanking({ timeFilter: 'today', minQuestions: 5, limit: 100 })

    expect(result.success).toBe(false)
    expect(result.error).toBeDefined()
  })

  test('ranking vacio -> success true, ranking []', async () => {
    createMockDb([])

    const result = await getRanking({ timeFilter: 'today', minQuestions: 5, limit: 100 })

    expect(result.success).toBe(true)
    expect(result.ranking).toHaveLength(0)
  })

  test('cache: segunda llamada mismo timeFilter no llama RPC', async () => {
    const mockExecute = createMockDb([
      { user_id: 'u1', total_questions: 10, correct_answers: 8, accuracy: 80 },
    ])

    await getRanking({ timeFilter: 'today', minQuestions: 5, limit: 100 })
    await getRanking({ timeFilter: 'today', minQuestions: 5, limit: 100 })

    // Solo 1 llamada (no 2)
    expect(mockExecute).toHaveBeenCalledTimes(1)
  })

  test('cache expirado -> llama RPC de nuevo', async () => {
    const mockExecute = createMockDb([
      { user_id: 'u1', total_questions: 10, correct_answers: 8, accuracy: 80 },
    ])

    await getRanking({ timeFilter: 'today', minQuestions: 5, limit: 100 })

    // Avanzar 61 segundos (cache TTL = 60s)
    jest.advanceTimersByTime(61_000)

    await getRanking({ timeFilter: 'today', minQuestions: 5, limit: 100 })

    expect(mockExecute).toHaveBeenCalledTimes(2)
  })

  test('diferentes timeFilters tienen caches independientes', async () => {
    const mockExecute = createMockDb([])

    await getRanking({ timeFilter: 'today', minQuestions: 5, limit: 100 })
    await getRanking({ timeFilter: 'week', minQuestions: 5, limit: 100 })

    expect(mockExecute).toHaveBeenCalledTimes(2)
  })

  test('incluye generatedAt en la respuesta', async () => {
    createMockDb([])

    const result = await getRanking({ timeFilter: 'today', minQuestions: 5, limit: 100 })

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
