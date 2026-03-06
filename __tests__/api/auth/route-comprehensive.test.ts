/**
 * Tests exhaustivos para la route POST /api/v2/auth/process-callback
 * Cubre: seguridad, edge cases HTTP, validacion exhaustiva
 *
 * @jest-environment node
 */

jest.mock('../../../lib/api/shared/auth', () => ({
  getAuthenticatedUser: jest.fn(),
}))

jest.mock('../../../lib/api/auth/queries', () => ({
  processAuthCallback: jest.fn(),
}))

import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '../../../lib/api/shared/auth'
import { processAuthCallback } from '../../../lib/api/auth/queries'
import { POST } from '../../../app/api/v2/auth/process-callback/route'

const mockAuth = getAuthenticatedUser as jest.MockedFunction<typeof getAuthenticatedUser>
const mockProcess = processAuthCallback as jest.MockedFunction<typeof processAuthCallback>

const UUID_1 = '550e8400-e29b-41d4-a716-446655440000'
const UUID_2 = '660e8400-e29b-41d4-a716-446655440000'

function makeRequest(body: any, token = 'valid-token') {
  return new NextRequest('http://localhost:3000/api/v2/auth/process-callback', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })
}

function authSuccess(userId = UUID_1, email = 'test@example.com') {
  mockAuth.mockResolvedValue({
    ok: true,
    user: { id: userId, email } as any,
    supabase: {} as any,
  })
}

function authFail(status = 401) {
  mockAuth.mockResolvedValue({
    ok: false,
    response: NextResponse.json({ error: 'No autorizado' }, { status }),
  })
}

beforeEach(() => {
  jest.clearAllMocks()
})

// ============================================
// AUTENTICACION
// ============================================

describe('autenticacion', () => {
  test('sin Authorization header → 401', async () => {
    authFail(401)

    const req = makeRequest({ userId: UUID_1, userEmail: 'test@example.com' })
    const res = await POST(req)
    const data = await res.json()

    expect(data.error).toBe('No autorizado')
  })

  test('Bearer token invalido → 401', async () => {
    authFail(401)

    const req = makeRequest({ userId: UUID_1, userEmail: 'test@example.com' }, 'invalid-jwt')
    const res = await POST(req)
    const data = await res.json()

    expect(data.error).toBe('No autorizado')
  })

  test('token expirado → 401', async () => {
    authFail(401)

    const req = makeRequest({ userId: UUID_1, userEmail: 'test@example.com' }, 'expired-token')
    const res = await POST(req)

    // auth failure returns the response from getAuthenticatedUser
    expect(res.status).toBe(401)
  })
})

// ============================================
// VALIDACION DEL BODY
// ============================================

describe('validacion del body', () => {
  test('body vacio → 400', async () => {
    authSuccess()

    const req = makeRequest({})
    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.success).toBe(false)
    expect(data.error).toBe('Datos invalidos')
    expect(data.details).toBeDefined()
  })

  test('userId invalido → 400', async () => {
    authSuccess()

    const req = makeRequest({ userId: 'not-uuid', userEmail: 'test@example.com' })
    const res = await POST(req)

    expect(res.status).toBe(400)
  })

  test('email invalido → 400', async () => {
    authSuccess()

    const req = makeRequest({ userId: UUID_1, userEmail: 'bad-email' })
    const res = await POST(req)

    expect(res.status).toBe(400)
  })

  test('solo userId sin email → 400', async () => {
    authSuccess()

    const req = makeRequest({ userId: UUID_1 })
    const res = await POST(req)

    expect(res.status).toBe(400)
  })

  test('solo email sin userId → 400', async () => {
    authSuccess()

    const req = makeRequest({ userEmail: 'test@example.com' })
    const res = await POST(req)

    expect(res.status).toBe(400)
  })

  test('campos extra son ignorados (stripped)', async () => {
    authSuccess()
    mockProcess.mockResolvedValue({
      success: true, isNewUser: false, redirectUrl: '/',
    })

    const req = makeRequest({
      userId: UUID_1,
      userEmail: 'test@example.com',
      maliciousField: '<script>alert("xss")</script>',
      admin: true,
    })
    const res = await POST(req)
    const data = await res.json()

    expect(data.success).toBe(true)

    // processAuthCallback no debe recibir campos extra
    const args = mockProcess.mock.calls[0][0]
    expect((args as any).maliciousField).toBeUndefined()
    expect((args as any).admin).toBeUndefined()
  })
})

// ============================================
// SEGURIDAD: userId mismatch
// ============================================

describe('seguridad - userId mismatch', () => {
  test('body userId != token userId → 403', async () => {
    authSuccess(UUID_2)

    const req = makeRequest({
      userId: UUID_1,
      userEmail: 'test@example.com',
    })
    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(403)
    expect(data.success).toBe(false)
    expect(data.error).toBe('userId no coincide con el token')
  })

  test('intento de spoofing: usar token de otro usuario → 403', async () => {
    // Simula que el atacante tiene un token valido de UUID_2
    // pero intenta procesar callback para UUID_1
    authSuccess(UUID_2, 'attacker@example.com')

    const req = makeRequest({
      userId: UUID_1,
      userEmail: 'victim@example.com',
    })
    const res = await POST(req)

    expect(res.status).toBe(403)
    // processAuthCallback NO debe ser llamado
    expect(mockProcess).not.toHaveBeenCalled()
  })

  test('userId coincide → proceede normalmente', async () => {
    authSuccess(UUID_1)
    mockProcess.mockResolvedValue({
      success: true, isNewUser: true, redirectUrl: '/',
    })

    const req = makeRequest({
      userId: UUID_1,
      userEmail: 'test@example.com',
    })
    const res = await POST(req)

    expect(res.status).toBe(200)
    expect(mockProcess).toHaveBeenCalledTimes(1)
  })
})

// ============================================
// RESPUESTAS EXITOSAS
// ============================================

describe('respuestas exitosas', () => {
  test('usuario nuevo → 200 con isNewUser true', async () => {
    authSuccess()
    mockProcess.mockResolvedValue({
      success: true,
      isNewUser: true,
      redirectUrl: '/auxiliar-administrativo-estado',
    })

    const req = makeRequest({
      userId: UUID_1,
      userEmail: 'test@example.com',
    })
    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.isNewUser).toBe(true)
    expect(data.redirectUrl).toBe('/auxiliar-administrativo-estado')
  })

  test('usuario existente → 200 con isNewUser false', async () => {
    authSuccess()
    mockProcess.mockResolvedValue({
      success: true,
      isNewUser: false,
      redirectUrl: '/tramitacion-procesal',
    })

    const req = makeRequest({
      userId: UUID_1,
      userEmail: 'test@example.com',
      returnUrl: '/tramitacion-procesal',
    })
    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.isNewUser).toBe(false)
    expect(data.redirectUrl).toBe('/tramitacion-procesal')
  })

  test('request minimo (solo userId + userEmail) → 200 con defaults', async () => {
    authSuccess()
    mockProcess.mockResolvedValue({
      success: true,
      isNewUser: false,
      redirectUrl: '/auxiliar-administrativo-estado',
    })

    const req = makeRequest({
      userId: UUID_1,
      userEmail: 'test@example.com',
    })
    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(200)

    // Verificar que los defaults de Zod se aplicaron
    const args = mockProcess.mock.calls[0][0]
    expect(args.returnUrl).toBe('/auxiliar-administrativo-estado')
    expect(args.isGoogleAds).toBe(false)
    expect(args.isGoogleAdsFromUrl).toBe(false)
    expect(args.isMetaAds).toBe(false)
  })

  test('request completo con Google Ads params', async () => {
    authSuccess()
    mockProcess.mockResolvedValue({
      success: true, isNewUser: true, redirectUrl: '/premium-ads',
    })

    const req = makeRequest({
      userId: UUID_1,
      userEmail: 'test@example.com',
      fullName: 'Ana Martinez',
      avatarUrl: 'https://lh3.googleusercontent.com/photo.jpg',
      returnUrl: '/premium-ads',
      oposicion: 'auxiliar_administrativo_estado',
      funnel: 'google_ads_landing',
      isGoogleAds: true,
      isGoogleAdsFromUrl: true,
      isMetaAds: false,
      googleParams: {
        gclid: 'Cj0KCQiA2KitBhCIARIsAPPMEhJ',
        utm_source: 'google',
      },
      metaParams: null,
    })
    const res = await POST(req)

    expect(res.status).toBe(200)

    const args = mockProcess.mock.calls[0][0]
    expect(args.isGoogleAds).toBe(true)
    expect(args.isGoogleAdsFromUrl).toBe(true)
    expect(args.googleParams?.gclid).toBe('Cj0KCQiA2KitBhCIARIsAPPMEhJ')
    expect(args.oposicion).toBe('auxiliar_administrativo_estado')
    expect(args.funnel).toBe('google_ads_landing')
  })

  test('request completo con Meta Ads params', async () => {
    authSuccess()
    mockProcess.mockResolvedValue({
      success: true, isNewUser: true, redirectUrl: '/',
    })

    const req = makeRequest({
      userId: UUID_1,
      userEmail: 'test@example.com',
      isMetaAds: true,
      metaParams: {
        fbclid: 'IwAR3NmPqR2X8Q9v5K7',
        utm_source: 'facebook',
      },
    })
    const res = await POST(req)

    expect(res.status).toBe(200)
    const args = mockProcess.mock.calls[0][0]
    expect(args.isMetaAds).toBe(true)
    expect(args.metaParams?.fbclid).toBe('IwAR3NmPqR2X8Q9v5K7')
  })
})

// ============================================
// ERRORES DEL SERVER
// ============================================

describe('errores del server', () => {
  test('processAuthCallback devuelve error → 500', async () => {
    authSuccess()
    mockProcess.mockResolvedValue({
      success: false,
      isNewUser: false,
      redirectUrl: '/',
      error: 'DB connection failed',
    })

    const req = makeRequest({
      userId: UUID_1,
      userEmail: 'test@example.com',
    })
    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(500)
    expect(data.success).toBe(false)
    expect(data.error).toBe('DB connection failed')
  })

  test('processAuthCallback lanza excepcion → 500 con mensaje', async () => {
    authSuccess()
    mockProcess.mockRejectedValue(new Error('Unexpected error'))

    const req = makeRequest({
      userId: UUID_1,
      userEmail: 'test@example.com',
    })
    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(500)
    expect(data.success).toBe(false)
    expect(data.error).toBe('Unexpected error')
  })

  test('excepcion no-Error → "Error desconocido"', async () => {
    authSuccess()
    mockProcess.mockRejectedValue('string error')

    const req = makeRequest({
      userId: UUID_1,
      userEmail: 'test@example.com',
    })
    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(500)
    expect(data.error).toBe('Error desconocido')
  })
})

// ============================================
// PASAJE DE request A processAuthCallback
// ============================================

describe('request passthrough', () => {
  test('el NextRequest original se pasa a processAuthCallback', async () => {
    authSuccess()
    mockProcess.mockResolvedValue({
      success: true, isNewUser: false, redirectUrl: '/',
    })

    const req = makeRequest({
      userId: UUID_1,
      userEmail: 'test@example.com',
    })
    await POST(req)

    // 2do argumento debe ser el request original
    const passedRequest = mockProcess.mock.calls[0][1]
    expect(passedRequest).toBeInstanceOf(NextRequest)
  })
})

// ============================================
// IDEMPOTENCIA
// ============================================

describe('idempotencia', () => {
  test('dos llamadas identicas producen dos calls a processAuthCallback', async () => {
    authSuccess()
    mockProcess.mockResolvedValue({
      success: true, isNewUser: false, redirectUrl: '/',
    })

    const body = { userId: UUID_1, userEmail: 'test@example.com' }

    await POST(makeRequest(body))
    await POST(makeRequest(body))

    expect(mockProcess).toHaveBeenCalledTimes(2)
  })
})
