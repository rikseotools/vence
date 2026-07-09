/** @jest-environment node */
// __tests__/security/profileEndpointIdentity.test.ts
//
// Regresión de seguridad para /api/profile (GET + PUT).
//
// BUG cerrado (jul-2026): el endpoint resolvía el perfil por el `?userId=`
// (GET) / `body.userId` (PUT) que mandaba el CLIENTE, con un `shadowAuthCheck`
// que sólo logueaba. Consecuencias probadas en prod:
//   - IDOR de lectura: sin token (o con el de otro), `?userId=<ajeno>` devolvía
//     el perfil ajeno (email, nombre, ciudad, edad, género...).
//   - IDOR de escritura: PUT con `body.userId=<ajeno>` modificaba a otro usuario.
//   - 404 "Perfil no encontrado" espurio cuando el cliente arrastraba un id
//     stale/fantasma en el query.
//
// INVARIANTE que fija estos tests: la identidad SIEMPRE sale del token
// verificado (verifyAuth). El `userId` del cliente se IGNORA. Sin token → 401.
// Estos tests fallarían con el código anterior (que pasaba el id del cliente).

import { NextRequest } from 'next/server'

const U_TOKEN = '11111111-1111-4111-8111-111111111111'
const U_OTHER = '22222222-2222-4222-8222-222222222222'

const mockVerifyAuth = jest.fn()
const mockGetProfile = jest.fn()
const mockUpdateProfile = jest.fn()

jest.mock('@/lib/api/auth/verifyAuth', () => ({
  verifyAuth: (...a: unknown[]) => mockVerifyAuth(...a),
}))
jest.mock('@/lib/api/profile', () => {
  const actual = jest.requireActual('@/lib/api/profile')
  return {
    ...actual, // conserva safeParseUpdateProfileRequest (Zod real)
    getProfileForSelfCached: (...a: unknown[]) => mockGetProfile(...a),
    updateProfile: (...a: unknown[]) => mockUpdateProfile(...a),
  }
})
jest.mock('@/lib/db/timeout', () => ({
  withDbTimeout: (fn: () => unknown) => fn(),
  isDbTimeoutError: () => false,
}))
jest.mock('@/lib/api/checkout-sync', () => ({
  reconcileUserPremium: jest.fn().mockResolvedValue({ fixed: false }),
}))
jest.mock('@/lib/api/withErrorLogging', () => ({
  withErrorLogging: (_p: string, h: unknown) => h,
}))
jest.mock('next/server', () => ({
  ...jest.requireActual('next/server'),
  after: jest.fn(),
}))

import { GET, PUT } from '@/app/api/profile/route'

function getReq(query: string): NextRequest {
  return {
    headers: { get: () => null },
    url: `https://x/api/profile${query}`,
  } as unknown as NextRequest
}
function putReq(body: unknown): NextRequest {
  return {
    headers: { get: () => null },
    url: 'https://x/api/profile',
    json: async () => body,
  } as unknown as NextRequest
}

beforeEach(() => jest.clearAllMocks())

describe('GET /api/profile — identidad del token', () => {
  test('401 sin token (antes: servía el perfil → fuga de PII)', async () => {
    mockVerifyAuth.mockResolvedValue({ success: false, status: 401, reason: 'no_bearer_token' })
    const res = await GET(getReq(`?userId=${U_OTHER}`))
    expect(res.status).toBe(401)
    expect(mockGetProfile).not.toHaveBeenCalled()
  })

  test('IDOR: con token de A, ?userId=<B> devuelve el perfil de A (nunca el de B)', async () => {
    mockVerifyAuth.mockResolvedValue({ success: true, userId: U_TOKEN, email: 'a@b.c' })
    mockGetProfile.mockResolvedValue({ success: true, data: { id: U_TOKEN, planType: 'premium' } })
    const res = await GET(getReq(`?userId=${U_OTHER}`))
    expect(res.status).toBe(200)
    // La query se hizo con el id del TOKEN, no con el `?userId=` del cliente.
    expect(mockGetProfile).toHaveBeenCalledWith({ userId: U_TOKEN })
    expect(JSON.stringify(mockGetProfile.mock.calls[0][0])).not.toContain(U_OTHER)
  })

  test('404 se conserva sólo cuando el perfil del PROPIO token no existe', async () => {
    mockVerifyAuth.mockResolvedValue({ success: true, userId: U_TOKEN, email: 'a@b.c' })
    mockGetProfile.mockResolvedValue({ success: false, error: 'Perfil no encontrado' })
    const res = await GET(getReq(''))
    expect(res.status).toBe(404)
    expect(mockGetProfile).toHaveBeenCalledWith({ userId: U_TOKEN })
  })
})

describe('PUT /api/profile — identidad del token', () => {
  test('401 sin token (antes: escribía)', async () => {
    mockVerifyAuth.mockResolvedValue({ success: false, status: 401, reason: 'no_bearer_token' })
    const res = await PUT(putReq({ userId: U_OTHER, data: { studyGoal: 20 } }))
    expect(res.status).toBe(401)
    expect(mockUpdateProfile).not.toHaveBeenCalled()
  })

  test('IDOR de escritura: body.userId=<B> se ignora, se escribe en A (token)', async () => {
    mockVerifyAuth.mockResolvedValue({ success: true, userId: U_TOKEN, email: 'a@b.c' })
    mockUpdateProfile.mockResolvedValue({ success: true, data: { id: U_TOKEN } })
    const res = await PUT(putReq({ userId: U_OTHER, data: { studyGoal: 20 } }))
    expect(res.status).toBe(200)
    const arg = mockUpdateProfile.mock.calls[0][0] as { userId: string; data: { studyGoal: number } }
    expect(arg.userId).toBe(U_TOKEN) // NO U_OTHER
    expect(arg.data.studyGoal).toBe(20)
  })
})
