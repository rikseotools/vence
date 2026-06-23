/** @jest-environment node */
// Tests del endpoint /api/v2/medals/badge (Fase C1). GET = medallas guardadas;
// POST = marcar vistas. user_id del TOKEN. Foco: aislamiento + el quirk viewed=false.

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

import { GET, POST } from '@/app/api/v2/medals/badge/route'

function req(method = 'GET') {
  return { method, headers: { get: () => 'Bearer t' }, url: 'https://x/api/v2/medals/badge' } as unknown as NextRequest
}

beforeEach(() => {
  jest.clearAllMocks()
  mockExecute.mockResolvedValue([])
})

describe('GET /api/v2/medals/badge', () => {
  test('401 sin auth', async () => {
    mockVerifyAuth.mockResolvedValue({ success: false, status: 401 })
    expect((await GET(req())).status).toBe(401)
    expect(mockExecute).not.toHaveBeenCalled()
  })

  test('devuelve las medallas del usuario', async () => {
    mockVerifyAuth.mockResolvedValue({ success: true, userId: 'U_A', email: 'a@b.c' })
    mockExecute.mockResolvedValue([{ medal_id: 'm1', unlocked_at: '2026-06-20T10:00:00Z', viewed: false }])
    const body = await (await GET(req())).json()
    expect(body.medals).toHaveLength(1)
    expect(body.medals[0]).toMatchObject({ medal_id: 'm1', viewed: false })
  })

  test('AISLAMIENTO (GET): filtra por el userId del TOKEN', async () => {
    mockVerifyAuth.mockResolvedValue({ success: true, userId: 'U_TOKEN', email: 'a@b.c' })
    await GET(req())
    expect(JSON.stringify(mockExecute.mock.calls[0][0])).toContain('U_TOKEN')
  })
})

describe('POST /api/v2/medals/badge (marcar vistas)', () => {
  test('401 sin auth', async () => {
    mockVerifyAuth.mockResolvedValue({ success: false, status: 401 })
    expect((await POST(req('POST'))).status).toBe(401)
    expect(mockExecute).not.toHaveBeenCalled()
  })

  test('ejecuta el UPDATE y devuelve success', async () => {
    mockVerifyAuth.mockResolvedValue({ success: true, userId: 'U_A', email: 'a@b.c' })
    const res = await POST(req('POST'))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ success: true })
    expect(mockExecute).toHaveBeenCalledTimes(1)
  })

  test('AISLAMIENTO (POST): el UPDATE filtra por userId del TOKEN', async () => {
    mockVerifyAuth.mockResolvedValue({ success: true, userId: 'U_TOKEN', email: 'a@b.c' })
    await POST(req('POST'))
    expect(JSON.stringify(mockExecute.mock.calls[0][0])).toContain('U_TOKEN')
  })
})
