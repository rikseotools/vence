/** @jest-environment node */
// Tests del endpoint /api/v2/auto-assign-target.
// Verifica la lógica idempotente: solo asigna si target es NULL y slug es válido.

import { NextRequest } from 'next/server'

// Mocks
const mockGetAuthenticatedUser = jest.fn()
const mockGetAdminDb = jest.fn()

jest.mock('@/lib/api/shared/auth', () => ({
  getAuthenticatedUser: (req: NextRequest) => mockGetAuthenticatedUser(req),
}))

// El route fue migrado de Supabase (getServiceClient) a Drizzle (getAdminDb).
// Mockeamos en la frontera @/db/client siguiendo el patrón del resto de tests
// Drizzle del repo (ver __tests__/lib/laws/lawSlugParity.test.ts).
jest.mock('@/db/client', () => ({
  getAdminDb: () => mockGetAdminDb(),
}))

jest.mock('@/lib/api/withErrorLogging', () => ({
  withErrorLogging: (_path: string, handler: any) => handler,
}))

// Mock de invalidateProfileCache para verificar el contrato de invalidación
// del cache 'profile' tras un UPDATE exitoso de target_oposicion.
jest.mock('@/lib/api/profile', () => ({
  invalidateProfileCache: jest.fn(),
}))

import { POST } from '@/app/api/v2/auto-assign-target/route'
import { invalidateProfileCache } from '@/lib/api/profile'

const mockInvalidate = invalidateProfileCache as jest.Mock

function mockReq(body: any) {
  return {
    headers: { get: () => 'Bearer t' },
    json: async () => body,
  } as unknown as NextRequest
}

// Mock del cliente Drizzle (getAdminDb). El route hace:
//   - SELECT: db.select(cols).from(userProfiles).where(eq).limit(1) -> [row]
//   - UPDATE: db.update(userProfiles).set({...}).where(eq)  (await, throw on error)
// `target === undefined` simula "perfil no encontrado" ([] vacío).
function mockDrizzleDb(target: string | null | undefined, updateThrows: any = null) {
  const rows = target === undefined ? [] : [{ target_oposicion: target }]
  const limit = jest.fn().mockResolvedValue(rows)
  const selectWhere = jest.fn(() => ({ limit }))
  const select = jest.fn(() => ({ from: jest.fn(() => ({ where: selectWhere })) }))

  const updateWhere = updateThrows
    ? jest.fn().mockRejectedValue(updateThrows)
    : jest.fn().mockResolvedValue(undefined)
  const set = jest.fn(() => ({ where: updateWhere }))
  const update = jest.fn(() => ({ set }))

  return { select, update, _set: set }
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
    const mockDb = mockDrizzleDb('auxiliar_administrativo_madrid')
    mockGetAdminDb.mockReturnValue(mockDb)

    const res = await POST(mockReq({ slug: 'auxiliar-administrativo-estado' }))
    const body = await res.json()
    expect(body.assigned).toBe(false)
    expect(body.reason).toBe('already_assigned')
    expect(mockDb._set).not.toHaveBeenCalled()
  })

  test('assigned:true cuando target es NULL y slug válido', async () => {
    mockGetAuthenticatedUser.mockResolvedValue({ ok: true, user: { id: 'u1' } })
    const mockDb = mockDrizzleDb(null)
    mockGetAdminDb.mockReturnValue(mockDb)

    const res = await POST(mockReq({ slug: 'auxiliar-administrativo-estado' }))
    const body = await res.json()
    expect(body.assigned).toBe(true)
    expect(body.positionType).toBe('auxiliar_administrativo_estado')
    expect(mockDb._set).toHaveBeenCalledWith(
      expect.objectContaining({ targetOposicion: 'auxiliar_administrativo_estado' })
    )
  })

  test('500 si error de update', async () => {
    mockGetAuthenticatedUser.mockResolvedValue({ ok: true, user: { id: 'u1' } })
    const mockDb = mockDrizzleDb(null, new Error('db error'))
    mockGetAdminDb.mockReturnValue(mockDb)

    const res = await POST(mockReq({ slug: 'auxiliar-administrativo-estado' }))
    expect(res.status).toBe(500)
  })

  // ============================================
  // Cache invalidation contract (Fase 0.2)
  // ============================================

  test('invalida cache profile tras UPDATE exitoso', async () => {
    mockGetAuthenticatedUser.mockResolvedValue({ ok: true, user: { id: 'u1' } })
    const mockDb = mockDrizzleDb(null)
    mockGetAdminDb.mockReturnValue(mockDb)

    await POST(mockReq({ slug: 'auxiliar-administrativo-estado' }))

    expect(mockInvalidate).toHaveBeenCalledTimes(1)
  })

  test('NO invalida cache si target ya estaba asignado (no hubo UPDATE)', async () => {
    mockGetAuthenticatedUser.mockResolvedValue({ ok: true, user: { id: 'u1' } })
    const mockDb = mockDrizzleDb('auxiliar_administrativo_madrid')
    mockGetAdminDb.mockReturnValue(mockDb)

    await POST(mockReq({ slug: 'auxiliar-administrativo-estado' }))

    expect(mockInvalidate).not.toHaveBeenCalled()
  })

  test('NO invalida cache si UPDATE falla', async () => {
    mockGetAuthenticatedUser.mockResolvedValue({ ok: true, user: { id: 'u1' } })
    const mockDb = mockDrizzleDb(null, new Error('db error'))
    mockGetAdminDb.mockReturnValue(mockDb)

    await POST(mockReq({ slug: 'auxiliar-administrativo-estado' }))

    expect(mockInvalidate).not.toHaveBeenCalled()
  })

  test('NO invalida cache si slug es desconocido (no hubo UPDATE)', async () => {
    mockGetAuthenticatedUser.mockResolvedValue({ ok: true, user: { id: 'u1' } })

    await POST(mockReq({ slug: 'oposicion-inventada-xyz' }))

    expect(mockInvalidate).not.toHaveBeenCalled()
  })
})
