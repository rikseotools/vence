/** @jest-environment node */
// Tests de los endpoints que reemplazan los .from/.rpc de components/OnboardingModal.tsx (C1):
//   POST /api/v2/onboarding/save-field        (guardado progresivo, WHITELIST de campos)
//   GET  /api/v2/custom-oposiciones/popular   (RPC get_popular_custom_oposiciones)
//   POST /api/v2/custom-oposiciones           (RPC create_or_select_custom_oposicion)
// Seguridad clave (sustituye RLS): id/user_id SIEMPRE del token; save-field no
// permite escribir columnas fuera de la whitelist; create no acepta user_id del body.

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

import { POST as SAVE_FIELD } from '@/app/api/v2/onboarding/save-field/route'
import { GET as POPULAR } from '@/app/api/v2/custom-oposiciones/popular/route'
import { POST as CREATE_CUSTOM } from '@/app/api/v2/custom-oposiciones/route'

function reqBody(body: unknown, url = 'https://x') {
  return { headers: { get: () => null }, url, json: async () => body } as unknown as NextRequest
}
function reqUrl(url: string) {
  return { headers: { get: () => null }, url } as unknown as NextRequest
}

beforeEach(() => {
  jest.clearAllMocks()
  mockExecute.mockResolvedValue({ rows: [] })
})

describe('POST /api/v2/onboarding/save-field', () => {
  test('401 sin auth', async () => {
    mockVerifyAuth.mockResolvedValue({ success: false, status: 401 })
    expect((await SAVE_FIELD(reqBody({ field: 'age', value: 30 }))).status).toBe(401)
    expect(mockExecute).not.toHaveBeenCalled()
  })

  test('400 + NO escribe si el campo no está en la whitelist', async () => {
    mockVerifyAuth.mockResolvedValue({ success: true, userId: 'U_TOKEN', email: 'a@b.c' })
    const res = await SAVE_FIELD(reqBody({ field: 'plan_type', value: 'premium' }))
    expect(res.status).toBe(400)
    expect(mockExecute).not.toHaveBeenCalled()
  })

  test('age: UPDATE con el userId del TOKEN', async () => {
    mockVerifyAuth.mockResolvedValue({ success: true, userId: 'U_TOKEN', email: 'a@b.c' })
    await SAVE_FIELD(reqBody({ field: 'age', value: 30 }))
    const s = JSON.stringify(mockExecute.mock.calls[0][0])
    expect(s).toContain('U_TOKEN')
    expect(s).toContain('age')
  })

  test('target_oposicion_data: castea a jsonb', async () => {
    mockVerifyAuth.mockResolvedValue({ success: true, userId: 'U_TOKEN', email: 'a@b.c' })
    await SAVE_FIELD(reqBody({ field: 'target_oposicion_data', value: { id: 'x', tipo: 'custom' } }))
    expect(JSON.stringify(mockExecute.mock.calls[0][0])).toContain('jsonb')
  })
})

describe('GET /api/v2/custom-oposiciones/popular', () => {
  test('401 sin auth', async () => {
    mockVerifyAuth.mockResolvedValue({ success: false, status: 401 })
    expect((await POPULAR(reqUrl('https://x?limit=10'))).status).toBe(401)
  })

  test('200 devuelve items', async () => {
    mockVerifyAuth.mockResolvedValue({ success: true, userId: 'U_TOKEN', email: 'a@b.c' })
    mockExecute.mockResolvedValue({ rows: [{ id: 'o1', nombre: 'Admin' }] })
    const res = await POPULAR(reqUrl('https://x?limit=10'))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ success: true, items: [{ id: 'o1', nombre: 'Admin' }] })
  })

  test('limit fuera de rango cae a 10 (default seguro)', async () => {
    mockVerifyAuth.mockResolvedValue({ success: true, userId: 'U_TOKEN', email: 'a@b.c' })
    await POPULAR(reqUrl('https://x?limit=9999'))
    expect(JSON.stringify(mockExecute.mock.calls[0][0])).toContain('10')
  })
})

describe('POST /api/v2/custom-oposiciones', () => {
  test('401 sin auth', async () => {
    mockVerifyAuth.mockResolvedValue({ success: false, status: 401 })
    expect((await CREATE_CUSTOM(reqBody({ nombre: 'X' }))).status).toBe(401)
  })

  test('400 si falta nombre', async () => {
    mockVerifyAuth.mockResolvedValue({ success: true, userId: 'U_TOKEN', email: 'a@b.c' })
    expect((await CREATE_CUSTOM(reqBody({ categoria: 'C1' }))).status).toBe(400)
  })

  test('200 devuelve oposicionId del jsonb de la función', async () => {
    mockVerifyAuth.mockResolvedValue({ success: true, userId: 'U_TOKEN', email: 'a@b.c' })
    mockExecute.mockResolvedValue({ rows: [{ result: { oposicion_id: 'NEW_OPO' } }] })
    const res = await CREATE_CUSTOM(reqBody({ nombre: 'Mi oposición', categoria: 'C1' }))
    expect(res.status).toBe(200)
    expect((await res.json()).oposicionId).toBe('NEW_OPO')
  })

  test('AISLAMIENTO: p_user_id del TOKEN, el body NO puede inyectarlo', async () => {
    mockVerifyAuth.mockResolvedValue({ success: true, userId: 'U_TOKEN', email: 'a@b.c' })
    mockExecute.mockResolvedValue({ rows: [{ result: { oposicion_id: 'X' } }] })
    await CREATE_CUSTOM(reqBody({ nombre: 'X', p_user_id: 'U_ATTACKER', userId: 'U_ATTACKER' }))
    const s = JSON.stringify(mockExecute.mock.calls[0][0])
    expect(s).toContain('U_TOKEN')
    expect(s).not.toContain('U_ATTACKER')
  })
})
