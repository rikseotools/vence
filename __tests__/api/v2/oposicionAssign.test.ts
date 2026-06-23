/** @jest-environment node */
// Tests de POST /api/v2/oposicion/assign (Fase C1, migración de OposicionDetector).
// Asigna target_oposicion al usuario del TOKEN (UPDATE). Seguridad: id del token.

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

import { POST } from '@/app/api/v2/oposicion/assign/route'

function reqBody(body: unknown) {
  return { headers: { get: () => null }, url: 'https://x', json: async () => body } as unknown as NextRequest
}
const valid = { oposicionId: 'auxiliar_administrativo_estado', oposicionData: { id: 'auxiliar_administrativo_estado', name: 'Aux' } }

beforeEach(() => {
  jest.clearAllMocks()
  mockExecute.mockResolvedValue({ rows: [{ id: 'U_TOKEN' }] })
})

describe('POST /api/v2/oposicion/assign', () => {
  test('401 sin auth', async () => {
    mockVerifyAuth.mockResolvedValue({ success: false, status: 401 })
    expect((await POST(reqBody(valid))).status).toBe(401)
    expect(mockExecute).not.toHaveBeenCalled()
  })

  test('400 si falta oposicionId', async () => {
    mockVerifyAuth.mockResolvedValue({ success: true, userId: 'U_TOKEN', email: 'a@b.c' })
    expect((await POST(reqBody({ oposicionData: {} }))).status).toBe(400)
  })

  test('updated=true cuando actualiza el perfil', async () => {
    mockVerifyAuth.mockResolvedValue({ success: true, userId: 'U_TOKEN', email: 'a@b.c' })
    expect(await (await POST(reqBody(valid))).json()).toEqual({ success: true, updated: true })
  })

  test('updated=false cuando no hay perfil', async () => {
    mockVerifyAuth.mockResolvedValue({ success: true, userId: 'U_TOKEN', email: 'a@b.c' })
    mockExecute.mockResolvedValue({ rows: [] })
    expect(await (await POST(reqBody(valid))).json()).toEqual({ success: false, updated: false })
  })

  test('AISLAMIENTO: el UPDATE usa el userId del TOKEN, no el body', async () => {
    mockVerifyAuth.mockResolvedValue({ success: true, userId: 'U_TOKEN', email: 'a@b.c' })
    await POST(reqBody({ ...valid, id: 'U_ATTACKER', userId: 'U_ATTACKER' }))
    const s = JSON.stringify(mockExecute.mock.calls[0][0])
    expect(s).toContain('U_TOKEN')
    expect(s).not.toContain('U_ATTACKER')
  })
})
