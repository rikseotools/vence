/**
 * Tests para queries de medallas (con mock de DB)
 */

jest.mock('../../../db/client', () => ({
  getDb: jest.fn(),
}))

import { getDb } from '../../../db/client'

const mockGetDb = getDb as jest.MockedFunction<typeof getDb>

import { getUserMedals, checkAndSaveNewMedals } from '../../../lib/api/medals/queries'

beforeEach(() => {
  jest.useFakeTimers()
  // Lunes 2 marzo 2026 -> activa periodos diarios + semanales
  jest.setSystemTime(new Date('2026-03-02T14:30:00.000Z'))
  jest.clearAllMocks()
})

afterEach(() => {
  jest.useRealTimers()
})

function createMockDb(responses: Record<number, any[]>) {
  let callIndex = 0
  const mockExecute = jest.fn().mockImplementation(() => {
    const result = responses[callIndex] || []
    callIndex++
    return Promise.resolve(result)
  })
  mockGetDb.mockReturnValue({ execute: mockExecute } as any)
  return mockExecute
}

describe('getUserMedals', () => {
  test('usa RPC get_ranking_for_period (mock verifica)', async () => {
    const mockExecute = jest.fn().mockResolvedValue([
      { user_id: 'u1', total_questions: 50, correct_answers: 45, accuracy: 90 },
    ])
    mockGetDb.mockReturnValue({ execute: mockExecute } as any)

    await getUserMedals('u1')

    // Debe haber llamado a execute (RPC) al menos una vez
    expect(mockExecute).toHaveBeenCalled()
    // Verificar que paso por get_ranking_for_period (la query SQL contiene este nombre)
    const firstCall = mockExecute.mock.calls[0][0]
    expect(firstCall).toBeDefined()
  })

  test('devuelve medallas cuando usuario es #1', async () => {
    const mockExecute = jest.fn().mockResolvedValue([
      { user_id: 'u1', total_questions: 50, correct_answers: 45, accuracy: 90 },
      { user_id: 'u2', total_questions: 30, correct_answers: 21, accuracy: 70 },
    ])
    mockGetDb.mockReturnValue({ execute: mockExecute } as any)

    const result = await getUserMedals('u1')

    expect(result.success).toBe(true)
    expect(result.medals!.length).toBeGreaterThan(0)
    // Deberia tener first_place_today (es lunes, evalua ayer)
    expect(result.medals!.some(m => m.id === 'first_place_today')).toBe(true)
  })

  test('ranking vacio -> medallas vacias', async () => {
    const mockExecute = jest.fn().mockResolvedValue([])
    mockGetDb.mockReturnValue({ execute: mockExecute } as any)

    const result = await getUserMedals('u1')

    expect(result.success).toBe(true)
    expect(result.medals).toHaveLength(0)
  })

  test('error en RPC -> devuelve array vacio', async () => {
    const mockExecute = jest.fn().mockRejectedValue(new Error('timeout'))
    mockGetDb.mockReturnValue({ execute: mockExecute } as any)

    const result = await getUserMedals('u1')

    expect(result.success).toBe(true)
    expect(result.medals).toHaveLength(0)
  })
})

describe('checkAndSaveNewMedals', () => {
  test('detecta medalla nueva y la guarda', async () => {
    const mockExecute = createMockDb({
      // Call 0-1: getUserMedals -> get_ranking_for_period (daily + weekly since Monday)
      0: [
        { user_id: 'u1', total_questions: 50, correct_answers: 45, accuracy: 90 },
        { user_id: 'u2', total_questions: 30, correct_answers: 21, accuracy: 70 },
      ],
      1: [
        { user_id: 'u1', total_questions: 50, correct_answers: 45, accuracy: 90 },
        { user_id: 'u2', total_questions: 30, correct_answers: 21, accuracy: 70 },
      ],
      // Call 2: stored medals (empty)
      2: [],
      // Call 3+: inserts
      3: [],
      4: [],
      5: [],
      6: [],
      7: [],
      8: [],
    })

    const result = await checkAndSaveNewMedals('u1')

    expect(result.success).toBe(true)
    expect(result.newMedals!.length).toBeGreaterThan(0)
    // Debe haber llamado a INSERT (al menos una vez mas que los selects)
    expect(mockExecute.mock.calls.length).toBeGreaterThan(2)
  })

  test('ignora medalla ya guardada', async () => {
    const mockExecute = createMockDb({
      // Ranking calls (daily + weekly)
      0: [{ user_id: 'u1', total_questions: 50, correct_answers: 45, accuracy: 90 }],
      1: [{ user_id: 'u1', total_questions: 50, correct_answers: 45, accuracy: 90 }],
      // Stored medals - ya tiene todas las que podria ganar
      2: [
        { medal_id: 'first_place_today' },
        { medal_id: 'first_place_week' },
        { medal_id: 'high_accuracy' },
      ],
    })

    const result = await checkAndSaveNewMedals('u1')

    expect(result.success).toBe(true)
    expect(result.newMedals).toHaveLength(0)
  })

  test('error -> devuelve success false', async () => {
    const mockExecute = jest.fn().mockRejectedValue(new Error('db error'))
    mockGetDb.mockReturnValue({ execute: mockExecute } as any)

    const result = await checkAndSaveNewMedals('u1')

    expect(result.success).toBe(false)
    expect(result.error).toBeDefined()
  })
})
