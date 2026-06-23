/** @jest-environment node */
// Tests del endpoint /api/v2/psychometric-evolution/history (Fase C1, gemelo de
// question-evolution). Foco: AISLAMIENTO — filtra por el userId del TOKEN, nunca
// por uno del request. + 401/400 y passthrough de filas.

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

import { GET } from '@/app/api/v2/psychometric-evolution/history/route'

const QID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'
function req(url: string) {
  return { headers: { get: () => 'Bearer t' }, url } as unknown as NextRequest
}

beforeEach(() => {
  jest.clearAllMocks()
  mockExecute.mockResolvedValue([])
})

describe('GET /api/v2/psychometric-evolution/history', () => {
  test('401 sin auth', async () => {
    mockVerifyAuth.mockResolvedValue({ success: false, status: 401 })
    const res = await GET(req(`https://x/api?questionId=${QID}`))
    expect(res.status).toBe(401)
    expect(mockExecute).not.toHaveBeenCalled()
  })

  test('400 si questionId no es UUID', async () => {
    mockVerifyAuth.mockResolvedValue({ success: true, userId: 'U_A', email: 'a@b.c' })
    const res = await GET(req('https://x/api?questionId=nope'))
    expect(res.status).toBe(400)
    expect(mockExecute).not.toHaveBeenCalled()
  })

  test('200 devuelve las filas (passthrough)', async () => {
    mockVerifyAuth.mockResolvedValue({ success: true, userId: 'U_A', email: 'a@b.c' })
    mockExecute.mockResolvedValue([
      { id: 'a1', user_answer: 2, is_correct: true, time_spent_seconds: 9, created_at: '2026-06-20T10:00:00Z', test_session_id: 's1', question_order: 1 },
    ])
    const res = await GET(req(`https://x/api?questionId=${QID}`))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.history).toHaveLength(1)
    expect(body.history[0]).toMatchObject({ id: 'a1', is_correct: true, created_at: '2026-06-20T10:00:00Z' })
  })

  test('AISLAMIENTO: usa el userId del TOKEN e ignora un userId del request', async () => {
    mockVerifyAuth.mockResolvedValue({ success: true, userId: 'U_TOKEN', email: 'a@b.c' })
    await GET(req(`https://x/api?questionId=${QID}&userId=U_ATTACKER`))
    expect(mockExecute).toHaveBeenCalledTimes(1)
    const serialized = JSON.stringify(mockExecute.mock.calls[0][0])
    expect(serialized).toContain('U_TOKEN')
    expect(serialized).not.toContain('U_ATTACKER')
  })

  test('tolera shape { rows } (driver pg)', async () => {
    mockVerifyAuth.mockResolvedValue({ success: true, userId: 'U_A', email: 'a@b.c' })
    mockExecute.mockResolvedValue({ rows: [{ id: 'a9' }] })
    const res = await GET(req(`https://x/api?questionId=${QID}`))
    expect((await res.json()).history[0].id).toBe('a9')
  })
})
