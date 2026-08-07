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
  // Forma real de postgres.js (drizzle `db.execute`): array plano, no `{rows:[...]}` — los
  // routes de este fichero son defensivos con las dos formas (ver `filas()`/`Array.isArray`),
  // así que el default modela la que de verdad devuelve producción.
  mockExecute.mockResolvedValue([])
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

  // [T-077] Guardarraíl: este endpoint es de ONBOARDING, no un segundo escritor libre de
  // target_oposicion. Antes de este fix, nada lo impedía (ver la nota junto al `case
  // 'target_oposicion'` de la ruta) — se podía llamar en cualquier momento y pisar el
  // objetivo de un usuario que ya había completado el onboarding, sin pasar por
  // `/api/profile/target` ni por su guardarraíl de T-508.
  describe('target_oposicion / target_oposicion_data — solo ANTES de completar el onboarding', () => {
    test('FIJAR target_oposicion pide onboarding_completed_at IS NULL en el UPDATE', async () => {
      mockVerifyAuth.mockResolvedValue({ success: true, userId: 'U_TOKEN', email: 'a@b.c' })
      mockExecute.mockResolvedValue([{ id: 'U_TOKEN' }]) // forma real: array plano (postgres.js)
      await SAVE_FIELD(reqBody({ field: 'target_oposicion', value: 'guardia_civil' }))
      expect(JSON.stringify(mockExecute.mock.calls[0][0])).toContain('onboarding_completed_at')
    })

    test('si el UPDATE afecta 0 filas (ya completado), responde 409 onboarding_ya_completado', async () => {
      mockVerifyAuth.mockResolvedValue({ success: true, userId: 'U_TOKEN', email: 'a@b.c' })
      mockExecute.mockResolvedValue([]) // 0 filas: la condición WHERE no casó
      const res = await SAVE_FIELD(reqBody({ field: 'target_oposicion', value: 'guardia_civil' }))
      expect(res.status).toBe(409)
      expect((await res.json()).error).toBe('onboarding_ya_completado')
    })

    test('si el UPDATE afecta 1 fila (primera vez), responde 200 success', async () => {
      mockVerifyAuth.mockResolvedValue({ success: true, userId: 'U_TOKEN', email: 'a@b.c' })
      mockExecute.mockResolvedValue([{ id: 'U_TOKEN' }])
      const res = await SAVE_FIELD(reqBody({ field: 'target_oposicion', value: 'guardia_civil' }))
      expect(res.status).toBe(200)
      expect((await res.json()).success).toBe(true)
    })

    test('VACIAR (value: null) nunca se bloquea, aunque el UPDATE devuelva 0 filas', async () => {
      mockVerifyAuth.mockResolvedValue({ success: true, userId: 'U_TOKEN', email: 'a@b.c' })
      mockExecute.mockResolvedValue([]) // p.ej. el perfil ya estaba a NULL
      const res = await SAVE_FIELD(reqBody({ field: 'target_oposicion', value: null }))
      expect(res.status).toBe(200)
      // Y el UPDATE de vaciado no lleva la condición — vaciar es SIEMPRE legítimo.
      expect(JSON.stringify(mockExecute.mock.calls[0][0])).not.toContain('onboarding_completed_at')
    })

    test('mismo guardarraíl para target_oposicion_data (bloqueado)', async () => {
      mockVerifyAuth.mockResolvedValue({ success: true, userId: 'U_TOKEN', email: 'a@b.c' })
      mockExecute.mockResolvedValue([])
      const res = await SAVE_FIELD(reqBody({ field: 'target_oposicion_data', value: { id: 'x' } }))
      expect(res.status).toBe(409)
      expect((await res.json()).error).toBe('onboarding_ya_completado')
    })

    test('compatible con la forma {rows:[...]} además del array plano (defensivo, como los routes hermanos)', async () => {
      mockVerifyAuth.mockResolvedValue({ success: true, userId: 'U_TOKEN', email: 'a@b.c' })
      mockExecute.mockResolvedValue({ rows: [{ id: 'U_TOKEN' }] })
      const res = await SAVE_FIELD(reqBody({ field: 'target_oposicion', value: 'guardia_civil' }))
      expect(res.status).toBe(200)
    })
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
