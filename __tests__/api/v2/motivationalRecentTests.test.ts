/** @jest-environment node */
// Tests de GET /api/v2/motivational/recent-tests (Fase C1, migración de
// lib/notifications/motivationalAnalyzer.ts). Tests completados del usuario del TOKEN.

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

import { GET } from '@/app/api/v2/motivational/recent-tests/route'

function req(url = 'https://x?days=14') {
  return { headers: { get: () => null }, url } as unknown as NextRequest
}

beforeEach(() => {
  jest.clearAllMocks()
  mockExecute.mockResolvedValue({ rows: [] })
})

describe('GET /api/v2/motivational/recent-tests', () => {
  test('401 sin auth', async () => {
    mockVerifyAuth.mockResolvedValue({ success: false, status: 401 })
    expect((await GET(req())).status).toBe(401)
    expect(mockExecute).not.toHaveBeenCalled()
  })

  test('devuelve tests del usuario', async () => {
    mockVerifyAuth.mockResolvedValue({ success: true, userId: 'U_TOKEN', email: 'a@b.c' })
    mockExecute.mockResolvedValue({ rows: [{ id: 't1', completed_at: '2026-06-20', is_completed: true }] })
    const res = await GET(req())
    expect(res.status).toBe(200)
    expect((await res.json()).tests).toHaveLength(1)
  })

  test('AISLAMIENTO: filtra por userId del TOKEN', async () => {
    mockVerifyAuth.mockResolvedValue({ success: true, userId: 'U_TOKEN', email: 'a@b.c' })
    await GET(req())
    expect(JSON.stringify(mockExecute.mock.calls[0][0])).toContain('U_TOKEN')
  })

  test('days fuera de rango cae a 14 (default seguro)', async () => {
    mockVerifyAuth.mockResolvedValue({ success: true, userId: 'U_TOKEN', email: 'a@b.c' })
    await GET(req('https://x?days=9999'))
    expect(JSON.stringify(mockExecute.mock.calls[0][0])).toContain('14')
  })
})
