// Tests del puerto de Auth servidor (Fase 4 — Fase A): authAdmin delega en
// getServiceClient().auth.admin.* y mapea a AdminAuthUser.

const mockAdmin = {
  getUserById: jest.fn(),
  deleteUser: jest.fn(),
}

jest.mock('@/lib/api/shared/auth', () => ({
  getServiceClient: () => ({ auth: { admin: mockAdmin } }),
  getAuthenticatedUser: jest.fn(),
  getAuthenticatedUserWithOposicion: jest.fn(),
  requireAdmin: jest.fn(),
  isAdminEmail: jest.fn(),
}))
jest.mock('@/lib/api/auth/verifyAuth', () => ({ verifyAuth: jest.fn() }))

import { authAdmin } from '@/lib/auth/server'

describe('lib/auth/server — authAdmin', () => {
  beforeEach(() => jest.clearAllMocks())

  test('getUserById() devuelve {id,email} cuando existe', async () => {
    mockAdmin.getUserById.mockResolvedValue({ data: { user: { id: 'u1', email: 'a@b.com' } }, error: null })
    expect(await authAdmin.getUserById('u1')).toEqual({ id: 'u1', email: 'a@b.com' })
    expect(mockAdmin.getUserById).toHaveBeenCalledWith('u1')
  })

  test('getUserById() devuelve null en error o sin usuario', async () => {
    mockAdmin.getUserById.mockResolvedValue({ data: { user: null }, error: new Error('x') })
    expect(await authAdmin.getUserById('u1')).toBeNull()
  })

  test('getUserById() mapea email ausente a null', async () => {
    mockAdmin.getUserById.mockResolvedValue({ data: { user: { id: 'u2' } }, error: null })
    expect(await authAdmin.getUserById('u2')).toEqual({ id: 'u2', email: null })
  })

  test('deleteUser() → outcome "deleted" cuando el store legacy lo borra', async () => {
    mockAdmin.deleteUser.mockResolvedValue({ error: null })
    expect(await authAdmin.deleteUser('u1')).toEqual({ outcome: 'deleted', error: null })
    expect(mockAdmin.deleteUser).toHaveBeenCalledWith('u1')
  })

  test('deleteUser() → outcome "not_present" para "User not found" (post-flip, no es fallo)', async () => {
    // Supabase devuelve el error con status 404 / message "User not found".
    mockAdmin.deleteUser.mockResolvedValue({ error: Object.assign(new Error('User not found'), { status: 404 }) })
    expect(await authAdmin.deleteUser('u1')).toEqual({ outcome: 'not_present', error: null })

    // También por code, sin status.
    mockAdmin.deleteUser.mockResolvedValue({ error: Object.assign(new Error('nope'), { code: 'user_not_found' }) })
    expect(await authAdmin.deleteUser('u1')).toEqual({ outcome: 'not_present', error: null })
  })

  test('deleteUser() → outcome "error" en fallo REAL (red/permisos)', async () => {
    const err = Object.assign(new Error('boom'), { status: 500 })
    mockAdmin.deleteUser.mockResolvedValue({ error: err })
    expect(await authAdmin.deleteUser('u1')).toEqual({ outcome: 'error', error: err })
  })
})
