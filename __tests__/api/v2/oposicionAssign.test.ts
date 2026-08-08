/** @jest-environment node */
// Tests de POST /api/v2/oposicion/assign (Fase C1, migración de OposicionDetector).
// Asigna target_oposicion al usuario del TOKEN (UPDATE). Seguridad: id del token.

import { NextRequest } from 'next/server'

const mockVerifyAuth = jest.fn()
const mockExecute = jest.fn()
const mockBuscarPersonalizada = jest.fn()
const mockEmit = jest.fn()

jest.mock('@/lib/api/auth/verifyAuth', () => ({
  verifyAuth: (...a: unknown[]) => mockVerifyAuth(...a),
}))
jest.mock('@/db/client', () => ({
  getAdminDb: () => ({ execute: mockExecute }),
}))
jest.mock('@/lib/api/withErrorLogging', () => ({
  withErrorLogging: (_p: string, h: unknown) => h,
}))
jest.mock('@/lib/api/oposicionPersonalizada/consultas', () => ({
  buscarPersonalizada: (...a: unknown[]) => mockBuscarPersonalizada(...a),
}))
jest.mock('@/lib/observability/emit', () => ({
  emitFireAndForget: (...a: unknown[]) => mockEmit(...a),
}))

import { POST } from '@/app/api/v2/oposicion/assign/route'

function reqBody(body: unknown) {
  return { headers: { get: () => null }, url: 'https://x', json: async () => body } as unknown as NextRequest
}
const valid = { oposicionId: 'auxiliar_administrativo_estado', oposicionData: { id: 'auxiliar_administrativo_estado', name: 'Aux' } }

beforeEach(() => {
  jest.clearAllMocks()
  mockExecute.mockResolvedValue({ rows: [{ id: 'U_TOKEN' }] })
  mockBuscarPersonalizada.mockResolvedValue(null)
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

/**
 * CUARTA puerta de `target_oposicion`, encontrada al revisar [T-339].
 *
 * Se EJECUTA la ruta a propósito: el guardarraíl hermano comprueba que el fichero
 * mencione `personalizadaUtilizable`, y eso lo sigue cumpliendo un `if (false && …)`.
 * Un guardarraíl de texto no demuestra que la puerta corte.
 */
describe('POST /api/v2/oposicion/assign — personalizada sin temario', () => {
  const personalizada = {
    oposicionId: 'personalizada_11111111222233334444555566667777',
    oposicionData: { id: 'x', name: 'La mía' },
  }

  beforeEach(() => {
    mockVerifyAuth.mockResolvedValue({ success: true, userId: 'U_TOKEN', email: 'a@b.c' })
  })

  test('409 y NINGÚN update si la personalizada tiene 0 temas', async () => {
    mockBuscarPersonalizada.mockResolvedValue({ nombre: 'La mía', temas: 0 })
    const res = await POST(reqBody(personalizada))
    expect(res.status).toBe(409)
    expect(mockExecute).not.toHaveBeenCalled()
  })

  test('deja rastro: sin el evento no nos enteraríamos otra vez', async () => {
    mockBuscarPersonalizada.mockResolvedValue({ nombre: 'La mía', temas: 0 })
    await POST(reqBody(personalizada))
    expect(mockEmit).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'objetivo_personalizado_vacio' }),
    )
  })

  test('una personalizada CON temario sí se asigna (la puerta no se pasa de frenada)', async () => {
    mockBuscarPersonalizada.mockResolvedValue({ nombre: 'La mía', temas: 12 })
    expect((await POST(reqBody(personalizada))).status).toBe(200)
    expect(mockExecute).toHaveBeenCalled()
  })

  test('FAIL-OPEN: si no se sabe nada de ella, no bloquea', async () => {
    // `buscarPersonalizada` devuelve null tanto si no existe como si la consulta falla; las
    // otras tres puertas siguen adelante en ese caso y ésta tiene que hacer lo mismo.
    mockBuscarPersonalizada.mockResolvedValue(null)
    expect((await POST(reqBody(personalizada))).status).toBe(200)
    expect(mockExecute).toHaveBeenCalled()
  })

  test('una oposición del catálogo ni siquiera consulta la tabla', async () => {
    await POST(reqBody(valid))
    expect(mockBuscarPersonalizada).not.toHaveBeenCalled()
    expect(mockExecute).toHaveBeenCalled()
  })
})
