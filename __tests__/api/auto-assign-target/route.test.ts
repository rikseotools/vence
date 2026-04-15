/** @jest-environment node */
// Tests del endpoint /api/v2/auto-assign-target.
// Verifica la lógica idempotente: solo asigna si target es NULL y slug es válido.

import { NextRequest } from 'next/server'

// Mocks
const mockGetAuthenticatedUser = jest.fn()
const mockGetServiceClient = jest.fn()

jest.mock('@/lib/api/shared/auth', () => ({
  getAuthenticatedUser: (req: NextRequest) => mockGetAuthenticatedUser(req),
  getServiceClient: () => mockGetServiceClient(),
}))

jest.mock('@/lib/api/withErrorLogging', () => ({
  withErrorLogging: (_path: string, handler: any) => handler,
}))

import { POST } from '@/app/api/v2/auto-assign-target/route'

function mockReq(body: any) {
  return {
    headers: { get: () => 'Bearer t' },
    json: async () => body,
  } as unknown as NextRequest
}

function mockProfileChain(target: string | null, updateErr: any = null) {
  const profileSingle = jest.fn().mockResolvedValue({ data: { target_oposicion: target }, error: null })
  const profileEq = jest.fn(() => ({ single: profileSingle }))
  const profileSelect = jest.fn(() => ({ eq: profileEq }))
  const updateEq = jest.fn().mockResolvedValue({ error: updateErr })
  const updateSet = jest.fn(() => ({ eq: updateEq }))
  return {
    from: jest.fn(() => ({
      select: profileSelect,
      update: updateSet,
    })),
    _updateSet: updateSet,
  }
}

describe('POST /api/v2/auto-assign-target', () => {
  beforeEach(() => jest.clearAllMocks())

  test('401 si no autenticado', async () => {
    mockGetAuthenticatedUser.mockResolvedValue({
      ok: false,
      response: new Response('no auth', { status: 401 }) as any,
    })
    const res = await POST(mockReq({ slug: 'auxiliar-administrativo-estado' }))
    expect(res.status).toBe(401)
  })

  test('400 si slug ausente', async () => {
    mockGetAuthenticatedUser.mockResolvedValue({ ok: true, user: { id: 'u1' } })
    const res = await POST(mockReq({}))
    expect(res.status).toBe(400)
  })

  test('assigned:false si slug no mapea a oposicion conocida', async () => {
    mockGetAuthenticatedUser.mockResolvedValue({ ok: true, user: { id: 'u1' } })
    const res = await POST(mockReq({ slug: 'oposicion-inventada-xyz' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.assigned).toBe(false)
    expect(body.reason).toBe('unknown_slug')
  })

  test('assigned:false si ya tiene target (idempotente)', async () => {
    mockGetAuthenticatedUser.mockResolvedValue({ ok: true, user: { id: 'u1' } })
    const mockDb = mockProfileChain('auxiliar_administrativo_madrid')
    mockGetServiceClient.mockReturnValue(mockDb)

    const res = await POST(mockReq({ slug: 'auxiliar-administrativo-estado' }))
    const body = await res.json()
    expect(body.assigned).toBe(false)
    expect(body.reason).toBe('already_assigned')
    expect(mockDb._updateSet).not.toHaveBeenCalled()
  })

  test('assigned:true cuando target es NULL y slug válido', async () => {
    mockGetAuthenticatedUser.mockResolvedValue({ ok: true, user: { id: 'u1' } })
    const mockDb = mockProfileChain(null)
    mockGetServiceClient.mockReturnValue(mockDb)

    const res = await POST(mockReq({ slug: 'auxiliar-administrativo-estado' }))
    const body = await res.json()
    expect(body.assigned).toBe(true)
    expect(body.positionType).toBe('auxiliar_administrativo_estado')
    expect(mockDb._updateSet).toHaveBeenCalledWith(
      expect.objectContaining({ target_oposicion: 'auxiliar_administrativo_estado' })
    )
  })

  test('500 si error de update', async () => {
    mockGetAuthenticatedUser.mockResolvedValue({ ok: true, user: { id: 'u1' } })
    const mockDb = mockProfileChain(null, { message: 'db error' })
    mockGetServiceClient.mockReturnValue(mockDb)

    const res = await POST(mockReq({ slug: 'auxiliar-administrativo-estado' }))
    expect(res.status).toBe(500)
  })
})
