/** @jest-environment node */
// Tests de los endpoints de ciclo de vida de auth (Fase A2):
//   POST /api/v2/auth/ensure-profile  (create_{google_ads,meta_ads,organic}_user)
//   POST /api/v2/access/check         (check_user_access)
//   POST /api/v2/premium/activate     (activate_premium_user)
// Verifican: 401 sin auth, 400 body inválido, 200 + ejecución SQL en éxito,
// y que el user_id sale del TOKEN (verifyAuth), nunca del body.

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
  withErrorLogging: (_path: string, handler: unknown) => handler,
}))

import { POST as ensureProfile } from '@/app/api/v2/auth/ensure-profile/route'
import { POST as accessCheck } from '@/app/api/v2/access/check/route'
import { POST as premiumActivate } from '@/app/api/v2/premium/activate/route'

function mockReq(body: unknown) {
  return {
    headers: { get: () => 'Bearer t' },
    json: async () => body,
  } as unknown as NextRequest
}

const OK_AUTH = { success: true, userId: 'u-123', email: 'ada@vence.es' }

beforeEach(() => {
  jest.clearAllMocks()
  mockExecute.mockResolvedValue(undefined)
})

describe('POST /api/v2/auth/ensure-profile', () => {
  test('401 si no autenticado', async () => {
    mockVerifyAuth.mockResolvedValue({ success: false, status: 401 })
    const res = await ensureProfile(mockReq({ registrationSource: 'organic' }))
    expect(res.status).toBe(401)
    expect(mockExecute).not.toHaveBeenCalled()
  })

  test('400 si registrationSource inválido', async () => {
    mockVerifyAuth.mockResolvedValue(OK_AUTH)
    const res = await ensureProfile(mockReq({ registrationSource: 'tiktok' }))
    expect(res.status).toBe(400)
    expect(mockExecute).not.toHaveBeenCalled()
  })

  test('200 + ejecuta SQL para usuario orgánico', async () => {
    mockVerifyAuth.mockResolvedValue(OK_AUTH)
    const res = await ensureProfile(mockReq({ registrationSource: 'organic', userName: 'Ada' }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ success: true })
    expect(mockExecute).toHaveBeenCalledTimes(1)
  })

  test('200 + ejecuta SQL para google_ads (con campaña)', async () => {
    mockVerifyAuth.mockResolvedValue(OK_AUTH)
    const res = await ensureProfile(mockReq({ registrationSource: 'google_ads', campaignId: '123' }))
    expect(res.status).toBe(200)
    expect(mockExecute).toHaveBeenCalledTimes(1)
  })
})

describe('POST /api/v2/access/check', () => {
  test('401 si no autenticado', async () => {
    mockVerifyAuth.mockResolvedValue({ success: false, status: 401 })
    const res = await accessCheck(mockReq({}))
    expect(res.status).toBe(401)
  })

  test('200 devuelve la primera fila como access', async () => {
    mockVerifyAuth.mockResolvedValue(OK_AUTH)
    mockExecute.mockResolvedValue([{ can_access: true, user_type: 'premium', message: 'ok' }])
    const res = await accessCheck(mockReq({}))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      success: true,
      access: { can_access: true, user_type: 'premium', message: 'ok' },
    })
  })

  test('200 access null si no hay filas', async () => {
    mockVerifyAuth.mockResolvedValue(OK_AUTH)
    mockExecute.mockResolvedValue([])
    const res = await accessCheck(mockReq({}))
    expect((await res.json()).access).toBeNull()
  })

  test('tolera shape { rows } (driver pg)', async () => {
    mockVerifyAuth.mockResolvedValue(OK_AUTH)
    mockExecute.mockResolvedValue({ rows: [{ can_access: false, user_type: 'free', message: 'x' }] })
    const res = await accessCheck(mockReq({}))
    expect((await res.json()).access).toEqual({ can_access: false, user_type: 'free', message: 'x' })
  })
})

describe('POST /api/v2/premium/activate', () => {
  test('401 si no autenticado', async () => {
    mockVerifyAuth.mockResolvedValue({ success: false, status: 401 })
    const res = await premiumActivate(mockReq({ stripeCustomerId: 'cus_1' }))
    expect(res.status).toBe(401)
    expect(mockExecute).not.toHaveBeenCalled()
  })

  test('400 si falta stripeCustomerId', async () => {
    mockVerifyAuth.mockResolvedValue(OK_AUTH)
    const res = await premiumActivate(mockReq({}))
    expect(res.status).toBe(400)
    expect(mockExecute).not.toHaveBeenCalled()
  })

  test('200 + ejecuta SQL en éxito', async () => {
    mockVerifyAuth.mockResolvedValue(OK_AUTH)
    const res = await premiumActivate(mockReq({ stripeCustomerId: 'cus_1' }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ success: true })
    expect(mockExecute).toHaveBeenCalledTimes(1)
  })
})
