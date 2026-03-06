/**
 * Tests para la route POST /api/v2/auth/process-callback
 *
 * @jest-environment node
 */

// Mock de auth compartido
jest.mock('../../../lib/api/shared/auth', () => ({
  getAuthenticatedUser: jest.fn(),
}))

// Mock de queries
jest.mock('../../../lib/api/auth/queries', () => ({
  processAuthCallback: jest.fn(),
}))

import { NextRequest } from 'next/server'
import { getAuthenticatedUser } from '../../../lib/api/shared/auth'
import { processAuthCallback } from '../../../lib/api/auth/queries'
import { POST } from '../../../app/api/v2/auth/process-callback/route'

const mockGetAuthenticatedUser = getAuthenticatedUser as jest.MockedFunction<typeof getAuthenticatedUser>
const mockProcessAuthCallback = processAuthCallback as jest.MockedFunction<typeof processAuthCallback>

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000'

function createRequest(body: any, token = 'valid-token') {
  return new NextRequest('http://localhost:3000/api/v2/auth/process-callback', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('POST /api/v2/auth/process-callback', () => {
  test('sin auth retorna 401', async () => {
    const mockResponse = new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401 })
    mockGetAuthenticatedUser.mockResolvedValue({
      ok: false,
      response: mockResponse as any,
    })

    const request = createRequest({ userId: VALID_UUID, userEmail: 'test@example.com' })
    const response = await POST(request)
    const data = await response.json()

    expect(data.error).toBe('No autorizado')
  })

  test('body invalido retorna 400', async () => {
    mockGetAuthenticatedUser.mockResolvedValue({
      ok: true,
      user: { id: VALID_UUID, email: 'test@example.com' } as any,
      supabase: {} as any,
    })

    const request = createRequest({ userId: 'bad-uuid' })
    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.success).toBe(false)
    expect(data.error).toBe('Datos invalidos')
  })

  test('userId mismatch retorna 403', async () => {
    const OTHER_UUID = '660e8400-e29b-41d4-a716-446655440000'

    mockGetAuthenticatedUser.mockResolvedValue({
      ok: true,
      user: { id: OTHER_UUID, email: 'other@example.com' } as any,
      supabase: {} as any,
    })

    const request = createRequest({
      userId: VALID_UUID,
      userEmail: 'test@example.com',
    })
    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(403)
    expect(data.success).toBe(false)
    expect(data.error).toBe('userId no coincide con el token')
  })

  test('callback exitoso retorna resultado', async () => {
    mockGetAuthenticatedUser.mockResolvedValue({
      ok: true,
      user: { id: VALID_UUID, email: 'test@example.com' } as any,
      supabase: {} as any,
    })

    mockProcessAuthCallback.mockResolvedValue({
      success: true,
      isNewUser: true,
      redirectUrl: '/auxiliar-administrativo-estado',
    })

    const request = createRequest({
      userId: VALID_UUID,
      userEmail: 'test@example.com',
    })
    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.isNewUser).toBe(true)
    expect(data.redirectUrl).toBe('/auxiliar-administrativo-estado')
  })

  test('callback con error retorna 500', async () => {
    mockGetAuthenticatedUser.mockResolvedValue({
      ok: true,
      user: { id: VALID_UUID, email: 'test@example.com' } as any,
      supabase: {} as any,
    })

    mockProcessAuthCallback.mockResolvedValue({
      success: false,
      isNewUser: false,
      redirectUrl: '/auxiliar-administrativo-estado',
      error: 'DB error',
    })

    const request = createRequest({
      userId: VALID_UUID,
      userEmail: 'test@example.com',
    })
    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.success).toBe(false)
    expect(data.error).toBe('DB error')
  })

  test('request completo con todos los campos', async () => {
    mockGetAuthenticatedUser.mockResolvedValue({
      ok: true,
      user: { id: VALID_UUID, email: 'test@example.com' } as any,
      supabase: {} as any,
    })

    mockProcessAuthCallback.mockResolvedValue({
      success: true,
      isNewUser: false,
      redirectUrl: '/tramitacion-procesal',
    })

    const request = createRequest({
      userId: VALID_UUID,
      userEmail: 'test@example.com',
      fullName: 'Juan Garcia',
      avatarUrl: 'https://example.com/photo.jpg',
      returnUrl: '/tramitacion-procesal',
      oposicion: 'auxiliar_administrativo_estado',
      funnel: 'test',
      isGoogleAds: true,
      isGoogleAdsFromUrl: false,
      isMetaAds: false,
      googleParams: { gclid: 'abc', utm_source: 'google' },
      metaParams: null,
    })
    const response = await POST(request)
    const data = await response.json()

    expect(data.success).toBe(true)
    expect(mockProcessAuthCallback).toHaveBeenCalledTimes(1)

    // Verify the params passed to processAuthCallback
    const callArgs = mockProcessAuthCallback.mock.calls[0][0]
    expect(callArgs.userId).toBe(VALID_UUID)
    expect(callArgs.isGoogleAds).toBe(true)
    expect(callArgs.oposicion).toBe('auxiliar_administrativo_estado')
  })
})
