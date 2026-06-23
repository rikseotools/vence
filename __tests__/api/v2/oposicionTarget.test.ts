/** @jest-environment node */
// Tests del endpoint /api/v2/oposicion/target (Fase C1). Lee la oposición objetivo
// del usuario por el userId del TOKEN. Foco: aislamiento + null si no hay fila.

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

import { GET } from '@/app/api/v2/oposicion/target/route'

function req() {
  return { headers: { get: () => 'Bearer t' }, url: 'https://x/api/v2/oposicion/target' } as unknown as NextRequest
}

beforeEach(() => {
  jest.clearAllMocks()
  mockExecute.mockResolvedValue([])
})

describe('GET /api/v2/oposicion/target', () => {
  test('401 sin auth', async () => {
    mockVerifyAuth.mockResolvedValue({ success: false, status: 401 })
    const res = await GET(req())
    expect(res.status).toBe(401)
    expect(mockExecute).not.toHaveBeenCalled()
  })

  test('devuelve target_oposicion + data (JSONB como objeto)', async () => {
    mockVerifyAuth.mockResolvedValue({ success: true, userId: 'U_A', email: 'a@b.c' })
    mockExecute.mockResolvedValue([{ target_oposicion: 'administrativo-madrid', target_oposicion_data: { nombre: 'X', plazas: 129 } }])
    const res = await GET(req())
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      success: true,
      target_oposicion: 'administrativo-madrid',
      target_oposicion_data: { nombre: 'X', plazas: 129 },
    })
  })

  test('null si el usuario no tiene fila/target', async () => {
    mockVerifyAuth.mockResolvedValue({ success: true, userId: 'U_A', email: 'a@b.c' })
    mockExecute.mockResolvedValue([])
    expect(await (await GET(req())).json()).toEqual({ success: true, target_oposicion: null, target_oposicion_data: null })
  })

  test('AISLAMIENTO: filtra por el userId del TOKEN', async () => {
    mockVerifyAuth.mockResolvedValue({ success: true, userId: 'U_TOKEN', email: 'a@b.c' })
    mockExecute.mockResolvedValue([])
    await GET(req())
    expect(JSON.stringify(mockExecute.mock.calls[0][0])).toContain('U_TOKEN')
  })

  test('tolera shape { rows }', async () => {
    mockVerifyAuth.mockResolvedValue({ success: true, userId: 'U_A', email: 'a@b.c' })
    mockExecute.mockResolvedValue({ rows: [{ target_oposicion: 'x', target_oposicion_data: null }] })
    expect((await (await GET(req())).json()).target_oposicion).toBe('x')
  })
})
