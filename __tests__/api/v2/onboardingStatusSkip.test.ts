/** @jest-environment node */
// Tests de los endpoints de onboarding (Fase C1, migración de hooks/useOnboarding.ts):
//   GET  /api/v2/onboarding/status  → campos de onboarding del usuario del TOKEN
//   POST /api/v2/onboarding/skip    → incremento atómico del contador de skips
// Clave de seguridad (sustituye a RLS): el id SIEMPRE sale del token verificado,
// nunca de un prop/body → un atacante no puede leer/incrementar a otro usuario.

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

import { GET } from '@/app/api/v2/onboarding/status/route'
import { POST } from '@/app/api/v2/onboarding/skip/route'

function req() {
  return { headers: { get: () => null }, url: 'https://x' } as unknown as NextRequest
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('GET /api/v2/onboarding/status', () => {
  test('401 sin auth', async () => {
    mockVerifyAuth.mockResolvedValue({ success: false, reason: 'no_bearer_token', status: 401 })
    const res = await GET(req())
    expect(res.status).toBe(401)
    expect(mockExecute).not.toHaveBeenCalled()
  })

  test('200 devuelve el perfil del usuario del token', async () => {
    mockVerifyAuth.mockResolvedValue({ success: true, userId: 'U_TOKEN', email: 'a@b.c' })
    mockExecute.mockResolvedValue({ rows: [{ target_oposicion: 'aux-admin', age: 30, gender: 'F' }] })
    const res = await GET(req())
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ success: true, profile: { target_oposicion: 'aux-admin', age: 30, gender: 'F' } })
  })

  test('profile=null si no hay fila', async () => {
    mockVerifyAuth.mockResolvedValue({ success: true, userId: 'U_TOKEN', email: 'a@b.c' })
    mockExecute.mockResolvedValue({ rows: [] })
    expect((await (await GET(req())).json()).profile).toBeNull()
  })

  test('AISLAMIENTO: el SQL filtra por el userId del TOKEN', async () => {
    mockVerifyAuth.mockResolvedValue({ success: true, userId: 'U_TOKEN', email: 'a@b.c' })
    mockExecute.mockResolvedValue({ rows: [] })
    await GET(req())
    expect(JSON.stringify(mockExecute.mock.calls[0][0])).toContain('U_TOKEN')
  })
})

describe('POST /api/v2/onboarding/skip', () => {
  test('401 sin auth', async () => {
    mockVerifyAuth.mockResolvedValue({ success: false, reason: 'no_bearer_token', status: 401 })
    const res = await POST(req())
    expect(res.status).toBe(401)
    expect(mockExecute).not.toHaveBeenCalled()
  })

  test('200 devuelve el nuevo contador', async () => {
    mockVerifyAuth.mockResolvedValue({ success: true, userId: 'U_TOKEN', email: 'a@b.c' })
    mockExecute.mockResolvedValue({ rows: [{ skip_count: 3 }] })
    const res = await POST(req())
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ success: true, skipCount: 3 })
  })

  test('AISLAMIENTO: el UPDATE filtra por el userId del TOKEN', async () => {
    mockVerifyAuth.mockResolvedValue({ success: true, userId: 'U_TOKEN', email: 'a@b.c' })
    mockExecute.mockResolvedValue({ rows: [{ skip_count: 1 }] })
    await POST(req())
    expect(JSON.stringify(mockExecute.mock.calls[0][0])).toContain('U_TOKEN')
  })
})
