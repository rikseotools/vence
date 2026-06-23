/** @jest-environment node */
// Tests del endpoint /api/v2/question-evolution/history (Fase C1).
// Foco: AISLAMIENTO — el historial se filtra por el userId del TOKEN (verifyAuth),
// nunca por uno del request. Más: 401/400, reconstrucción del embed tests(...).

import { NextRequest } from 'next/server'

const mockVerifyAuth = jest.fn()
const mockExecute = jest.fn()

jest.mock('@/lib/api/auth/verifyAuth', () => ({
  verifyAuth: (...a: unknown[]) => mockVerifyAuth(...a),
}))
jest.mock('@/db/client', () => ({
  getDb: () => ({ execute: mockExecute }),
  getPoolerDb: () => ({ execute: mockExecute }),
}))
jest.mock('@/lib/api/withErrorLogging', () => ({
  withErrorLogging: (_p: string, h: unknown) => h,
}))

import { GET } from '@/app/api/v2/question-evolution/history/route'

const QID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'
function req(url: string) {
  return { headers: { get: () => 'Bearer t' }, url } as unknown as NextRequest
}

beforeEach(() => {
  jest.clearAllMocks()
  mockExecute.mockResolvedValue([])
})

describe('GET /api/v2/question-evolution/history', () => {
  test('401 sin auth', async () => {
    mockVerifyAuth.mockResolvedValue({ success: false, status: 401 })
    const res = await GET(req(`https://x/api?questionId=${QID}`))
    expect(res.status).toBe(401)
    expect(mockExecute).not.toHaveBeenCalled()
  })

  test('400 si questionId no es UUID', async () => {
    mockVerifyAuth.mockResolvedValue({ success: true, userId: 'U_A', email: 'a@b.c' })
    const res = await GET(req('https://x/api?questionId=not-uuid'))
    expect(res.status).toBe(400)
    expect(mockExecute).not.toHaveBeenCalled()
  })

  test('reconstruye el embed tests(...) anidado', async () => {
    mockVerifyAuth.mockResolvedValue({ success: true, userId: 'U_A', email: 'a@b.c' })
    mockExecute.mockResolvedValue([{
      id: 'tq1', user_answer: 'A', correct_answer: 'B', is_correct: false, was_blank: false,
      confidence_level: 'sure', time_spent_seconds: 12, created_at: '2026-06-20T10:00:00Z',
      test_id: 't1', question_order: 3,
      t_id: 't1', t_title: 'Test 1', t_completed_at: null, t_created_at: '2026-06-19T09:00:00Z',
      t_tema_number: 5, t_user_id: 'U_A', t_total_questions: 20, t_score: '15',
    }])
    const res = await GET(req(`https://x/api?questionId=${QID}`))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.history).toHaveLength(1)
    expect(body.history[0]).toMatchObject({ id: 'tq1', is_correct: false, created_at: '2026-06-20T10:00:00Z', question_order: 3 })
    expect(body.history[0].tests).toMatchObject({ id: 't1', title: 'Test 1', tema_number: 5, total_questions: 20 })
  })

  test('tests=null cuando el LEFT JOIN no encuentra test', async () => {
    mockVerifyAuth.mockResolvedValue({ success: true, userId: 'U_A', email: 'a@b.c' })
    mockExecute.mockResolvedValue([{ id: 'tq1', t_id: null }])
    const res = await GET(req(`https://x/api?questionId=${QID}`))
    expect((await res.json()).history[0].tests).toBeNull()
  })

  test('AISLAMIENTO: usa el userId del TOKEN e ignora un userId del request', async () => {
    mockVerifyAuth.mockResolvedValue({ success: true, userId: 'U_TOKEN', email: 'a@b.c' })
    await GET(req(`https://x/api?questionId=${QID}&userId=U_ATTACKER`))
    expect(mockExecute).toHaveBeenCalledTimes(1)
    const serialized = JSON.stringify(mockExecute.mock.calls[0][0])
    expect(serialized).toContain('U_TOKEN')        // filtra por el del token
    expect(serialized).not.toContain('U_ATTACKER') // nunca por el del request
  })

  test('tolera shape { rows } (driver pg)', async () => {
    mockVerifyAuth.mockResolvedValue({ success: true, userId: 'U_A', email: 'a@b.c' })
    mockExecute.mockResolvedValue({ rows: [{ id: 'tq9', t_id: null }] })
    const res = await GET(req(`https://x/api?questionId=${QID}`))
    expect((await res.json()).history[0].id).toBe('tq9')
  })
})
