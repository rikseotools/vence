/** @jest-environment node */
// __tests__/api/admin/deleteUserAuthOutcome.test.ts
//
// Regresión (bug 09/07/2026): tras el flip a Auth.js, los usuarios NUEVOS no
// tienen fila en el store de auth legacy (Supabase GoTrue). El endpoint gateaba
// el ÉXITO y el email RGPD (Art. 12.3) por el borrado en Supabase → todo usuario
// post-flip reportaba 500 "incompleta" y NUNCA recibía el email legal, aunque el
// borrado de datos (SSOT = user_profiles en RDS) SÍ se había completado.
//
// INVARIANTE que fijan estos tests:
//   - El éxito se ancla al SSOT (user_profiles ya no existe), NO al store legacy.
//   - "not_present" en el store legacy es ESPERADO (post-flip), no un error.
//   - El email RGPD se envía cuando la CUENTA está borrada, sea cual sea el
//     desenlace del store legacy.
//   - Un fallo REAL del store legacy sí marca 500 (loose end a revisar), pero el
//     email igualmente se envía (los datos del usuario ya no existen).

const mockRequireAdmin = jest.fn()
const mockDeleteUserData = jest.fn()
const mockSendEmail = jest.fn()
const mockAuthDelete = jest.fn()

let selectCall = 0
let afterRows: Array<{ id: string }> = []
const chain: Record<string, unknown> = {
  select: () => chain,
  from: () => chain,
  where: () => chain,
  limit: () => {
    selectCall++
    // 1ª lectura: pre-delete (email/nombre). 2ª: post-delete (profileStillExists).
    if (selectCall === 1) return Promise.resolve([{ email: 'arel@x.c', full_name: 'Arelis Morales' }])
    return Promise.resolve(afterRows)
  },
}

jest.mock('@/lib/api/shared/auth', () => ({
  requireAdmin: (...a: unknown[]) => mockRequireAdmin(...a),
}))
jest.mock('@/lib/api/admin-delete-user', () => ({
  deleteUserData: (...a: unknown[]) => mockDeleteUserData(...a),
  sendDeletionConfirmationEmail: (...a: unknown[]) => mockSendEmail(...a),
}))
jest.mock('@/lib/auth/server', () => ({
  authAdmin: { deleteUser: (...a: unknown[]) => mockAuthDelete(...a) },
}))
jest.mock('@/db/client', () => ({ getAdminDb: () => chain }))
jest.mock('@/db/schema', () => ({ userProfiles: { id: 'id' } }))
jest.mock('@/lib/api/withErrorLogging', () => ({
  withErrorLogging: (_p: string, h: unknown) => h,
}))

import { DELETE } from '@/app/api/admin/delete-user/route'

function req(userId = '11111111-1111-4111-8111-111111111111') {
  return { headers: { get: () => null }, json: async () => ({ userId }) } as unknown as Request
}

beforeEach(() => {
  jest.clearAllMocks()
  selectCall = 0
  afterRows = [] // por defecto: perfil borrado (cuenta eliminada)
  mockRequireAdmin.mockResolvedValue({ ok: true, user: { id: 'admin', email: 'a@vencemitfg.es' } })
  mockDeleteUserData.mockResolvedValue([{ table: '_delete_user_account', status: 'deleted' }])
  mockSendEmail.mockResolvedValue({ sent: true, emailId: 'e1' })
})

test('post-flip (not_present) + perfil borrado → 200 success + email RGPD enviado', async () => {
  mockAuthDelete.mockResolvedValue({ outcome: 'not_present', error: null })
  const res = await DELETE(req())
  const body = await res.json()
  expect(res.status).toBe(200)
  expect(body.success).toBe(true)
  expect(body.authLegacy).toBe('not_present')
  expect(mockSendEmail).toHaveBeenCalledTimes(1) // ← el bug: antes NO se llamaba
})

test('pre-flip (deleted) + perfil borrado → 200 success + email enviado', async () => {
  mockAuthDelete.mockResolvedValue({ outcome: 'deleted', error: null })
  const res = await DELETE(req())
  const body = await res.json()
  expect(res.status).toBe(200)
  expect(body.success).toBe(true)
  expect(mockSendEmail).toHaveBeenCalledTimes(1)
})

test('fallo REAL del store legacy + perfil borrado → 500 pero email SÍ se envía', async () => {
  mockAuthDelete.mockResolvedValue({ outcome: 'error', error: new Error('network') })
  const res = await DELETE(req())
  const body = await res.json()
  expect(res.status).toBe(500) // loose end legacy a revisar
  expect(body.success).toBe(false)
  expect(mockSendEmail).toHaveBeenCalledTimes(1) // los datos del usuario ya no existen
})

test('perfil AÚN existe (borrado falló) → 500 y NO se envía email', async () => {
  afterRows = [{ id: '11111111-1111-4111-8111-111111111111' }]
  mockAuthDelete.mockResolvedValue({ outcome: 'not_present', error: null })
  const res = await DELETE(req())
  const body = await res.json()
  expect(res.status).toBe(500)
  expect(body.success).toBe(false)
  expect(mockSendEmail).not.toHaveBeenCalled()
})
