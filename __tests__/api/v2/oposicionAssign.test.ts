/** @jest-environment node */
// Tests de POST /api/v2/oposicion/assign (Fase C1, migración de OposicionDetector).
// Asigna target_oposicion al usuario del TOKEN (UPDATE). Seguridad: id del token.

import { NextRequest } from 'next/server'

const mockVerifyAuth = jest.fn()
const mockExecute = jest.fn()
const mockBuscarPersonalizada = jest.fn()

jest.mock('@/lib/api/auth/verifyAuth', () => ({
  verifyAuth: (...a: unknown[]) => mockVerifyAuth(...a),
}))
jest.mock('@/db/client', () => ({
  getAdminDb: () => ({ execute: mockExecute }),
}))
jest.mock('@/lib/api/withErrorLogging', () => ({
  withErrorLogging: (_p: string, h: unknown) => h,
}))
jest.mock('@/lib/api/oposicion/buscarPersonalizada', () => ({
  buscarPersonalizada: (...a: unknown[]) => mockBuscarPersonalizada(...a),
}))
jest.mock('@/lib/observability/emit', () => ({
  emitFireAndForget: jest.fn(),
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

  // [T-077] Este endpoint es el CUARTO write-path de target_oposicion (los otros tres:
  // /api/profile/target, save-field y complete-onboarding de onboarding, ya protegidos).
  // Sin estas dos comprobaciones era una puerta trasera: cualquiera con un token válido podía
  // llamarlo directo, sin pasar por el guardarraíl de T-508 ni respetar que solo debe fijar la
  // PRIMERA vez.
  describe('T-508: personalizada sin temario', () => {
    const personalizada = { oposicionId: 'personalizada_abc123', oposicionData: null }

    test('bloquea con 409 si la personalizada tiene 0 temas', async () => {
      mockVerifyAuth.mockResolvedValue({ success: true, userId: 'U_TOKEN', email: 'a@b.c' })
      mockBuscarPersonalizada.mockResolvedValue({ nombre: 'Mi oposición', temas: 0 })
      const res = await POST(reqBody(personalizada))
      expect(res.status).toBe(409)
      expect((await res.json()).error).toBe('personalizada_sin_temario')
      expect(mockExecute).not.toHaveBeenCalled()
    })

    test('permite si la personalizada SÍ tiene temas', async () => {
      mockVerifyAuth.mockResolvedValue({ success: true, userId: 'U_TOKEN', email: 'a@b.c' })
      mockBuscarPersonalizada.mockResolvedValue({ nombre: 'Mi oposición', temas: 5 })
      const res = await POST(reqBody(personalizada))
      expect(res.status).toBe(200)
      expect(mockExecute).toHaveBeenCalledTimes(1)
    })

    test('una oposición del catálogo (no personalizada) ni siquiera consulta buscarPersonalizada', async () => {
      mockVerifyAuth.mockResolvedValue({ success: true, userId: 'U_TOKEN', email: 'a@b.c' })
      await POST(reqBody(valid))
      expect(mockBuscarPersonalizada).not.toHaveBeenCalled()
    })
  })

  describe('solo la PRIMERA vez (target_oposicion IS NULL)', () => {
    test('el UPDATE lleva la condición target_oposicion IS NULL', async () => {
      mockVerifyAuth.mockResolvedValue({ success: true, userId: 'U_TOKEN', email: 'a@b.c' })
      await POST(reqBody(valid))
      const s = JSON.stringify(mockExecute.mock.calls[0][0])
      expect(s).toContain('target_oposicion IS NULL')
    })

    test('si el usuario YA tiene oposición (0 filas afectadas), success:false — no lo sobrescribe', async () => {
      mockVerifyAuth.mockResolvedValue({ success: true, userId: 'U_TOKEN', email: 'a@b.c' })
      mockExecute.mockResolvedValue({ rows: [] })
      const res = await POST(reqBody(valid))
      expect(await res.json()).toEqual({ success: false, updated: false })
    })
  })
})
