/** @jest-environment node */
// Tests de GET /api/v2/test-questions/saved-orders (Fase C1, migración de TestLayout).
// Devuelve los question_order guardados de un test SOLO si es del usuario del token.

import { NextRequest } from 'next/server'

const mockVerifyAuth = jest.fn()
const mockExecute = jest.fn()

jest.mock('@/lib/api/auth/verifyAuth', () => ({
  verifyAuth: (...a: unknown[]) => mockVerifyAuth(...a),
}))
jest.mock('@/db/client', () => ({
  getAdminDb: () => ({ execute: mockExecute }),
}))
jest.mock('@/lib/api/withErrorLogging', () => ({
  withErrorLogging: (_p: string, h: unknown) => h,
}))

import { GET } from '@/app/api/v2/test-questions/saved-orders/route'

const TID = '11111111-1111-4111-8111-111111111111'
function req(url = `https://x?testId=${TID}`) {
  return { headers: { get: () => null }, url } as unknown as NextRequest
}

beforeEach(() => {
  jest.clearAllMocks()
  mockExecute.mockResolvedValue({ rows: [] })
})

describe('GET /api/v2/test-questions/saved-orders', () => {
  test('401 sin auth', async () => {
    mockVerifyAuth.mockResolvedValue({ success: false, status: 401 })
    expect((await GET(req())).status).toBe(401)
  })

  test('400 sin testId', async () => {
    mockVerifyAuth.mockResolvedValue({ success: true, userId: 'U_TOKEN', email: 'a@b.c' })
    expect((await GET(req('https://x'))).status).toBe(400)
  })

  test('devuelve orders; query filtra por testId + user del token', async () => {
    mockVerifyAuth.mockResolvedValue({ success: true, userId: 'U_TOKEN', email: 'a@b.c' })
    mockExecute.mockResolvedValue({ rows: [{ question_order: 1 }, { question_order: 3 }] })
    const j = await (await GET(req())).json()
    expect(j.orders).toEqual([1, 3])
    const s = JSON.stringify(mockExecute.mock.calls[0][0])
    expect(s).toContain('U_TOKEN')
    expect(s).toContain(TID)
  })
})
