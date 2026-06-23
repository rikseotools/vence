/** @jest-environment node */
// Tests del endpoint /api/v2/account/deletion-request (Fase C1, migración de
// app/perfil/page.tsx). Materializa la solicitud de borrado como fila en
// user_feedback (type='account_deletion', status='pending').
//   GET  → { pending: boolean }
//   POST → { pending: true }  (idempotente: INSERT ... WHERE NOT EXISTS)
// Seguridad (sustituye RLS): el user_id sale SIEMPRE del token verificado.

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

import { GET, POST } from '@/app/api/v2/account/deletion-request/route'

function req() {
  return { headers: { get: () => null }, url: 'https://x' } as unknown as NextRequest
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('GET /api/v2/account/deletion-request', () => {
  test('401 sin auth', async () => {
    mockVerifyAuth.mockResolvedValue({ success: false, reason: 'no_bearer_token', status: 401 })
    const res = await GET(req())
    expect(res.status).toBe(401)
    expect(mockExecute).not.toHaveBeenCalled()
  })

  test('pending=true si hay fila', async () => {
    mockVerifyAuth.mockResolvedValue({ success: true, userId: 'U_TOKEN', email: 'a@b.c' })
    mockExecute.mockResolvedValue({ rows: [{ '?column?': 1 }] })
    expect(await (await GET(req())).json()).toEqual({ success: true, pending: true })
  })

  test('pending=false si no hay fila', async () => {
    mockVerifyAuth.mockResolvedValue({ success: true, userId: 'U_TOKEN', email: 'a@b.c' })
    mockExecute.mockResolvedValue({ rows: [] })
    expect(await (await GET(req())).json()).toEqual({ success: true, pending: false })
  })

  test('AISLAMIENTO: el SELECT filtra por el userId del TOKEN', async () => {
    mockVerifyAuth.mockResolvedValue({ success: true, userId: 'U_TOKEN', email: 'a@b.c' })
    mockExecute.mockResolvedValue({ rows: [] })
    await GET(req())
    expect(JSON.stringify(mockExecute.mock.calls[0][0])).toContain('U_TOKEN')
  })
})

describe('POST /api/v2/account/deletion-request', () => {
  test('401 sin auth', async () => {
    mockVerifyAuth.mockResolvedValue({ success: false, reason: 'no_bearer_token', status: 401 })
    const res = await POST(req())
    expect(res.status).toBe(401)
    expect(mockExecute).not.toHaveBeenCalled()
  })

  test('200 pending=true (crea o ya existía — idempotente)', async () => {
    mockVerifyAuth.mockResolvedValue({ success: true, userId: 'U_TOKEN', email: 'a@b.c' })
    mockExecute.mockResolvedValue(undefined)
    const res = await POST(req())
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ success: true, pending: true })
    expect(mockExecute).toHaveBeenCalledTimes(1)
  })

  test('AISLAMIENTO: el INSERT usa el userId del TOKEN', async () => {
    mockVerifyAuth.mockResolvedValue({ success: true, userId: 'U_TOKEN', email: 'a@b.c' })
    mockExecute.mockResolvedValue(undefined)
    await POST(req())
    const sqlStr = JSON.stringify(mockExecute.mock.calls[0][0])
    expect(sqlStr).toContain('U_TOKEN')
    expect(sqlStr).toContain('account_deletion')
  })
})
