/** @jest-environment node */
// __tests__/api/admin/deleteUserRgpdExactlyOnce.test.ts
//
// T-011 — el email RGPD de confirmación de borrado (Art. 12.3) es EXACTLY-ONCE.
//
// Caso raro (loose end del fix 4ef7a929): un 1er intento borró la cuenta y ENVIÓ el email pero
// devolvió 500 por otra causa (p.ej. store de auth legacy). Al REINTENTAR, user_profiles ya no
// existe → la ruta usa el email DURABLE de deleted_users_log y, ANTES de T-011, reenviaba el
// correo (duplicado). Ahora la fila lleva `rgpd_email_sent_at`: si está sellado, NO se reenvía.
//
// INVARIANTE que fija este test:
//   - Reintento con rgpd_email_sent_at SELLADO → email NO se reenvía (exactly-once), 200.
//   - 1er intento con el sello NULL → email SÍ se envía (una vez).

const mockRequireAdmin = jest.fn()
const mockDeleteUserData = jest.fn()
const mockSendEmail = jest.fn()
const mockAuthDelete = jest.fn()
const mockEnsureLog = jest.fn()

let selectCall = 0
let preReadRows: Array<{ email: string; full_name: string }> = []
// Filas que devuelve getAdminDb().execute(sql`...`) para TODAS las queries de deleted_users_log
// (hasLogRow SELECT 1, email durable, y el gate SELECT rgpd_email_sent_at). Un único objeto con
// todos los campos cubre las tres.
let execRows: Array<Record<string, unknown>> = []

const chain: Record<string, unknown> = {
  select: () => chain,
  from: () => chain,
  where: () => chain,
  limit: () => {
    selectCall++
    if (selectCall === 1) return Promise.resolve(preReadRows) // pre-delete (email)
    return Promise.resolve([]) // post-delete: perfil borrado (accountDeleted=true)
  },
  execute: () => Promise.resolve(execRows),
}

jest.mock('@/lib/api/shared/auth', () => ({ requireAdmin: (...a: unknown[]) => mockRequireAdmin(...a) }))
jest.mock('@/lib/api/admin-delete-user', () => ({
  deleteUserData: (...a: unknown[]) => mockDeleteUserData(...a),
  sendDeletionConfirmationEmail: (...a: unknown[]) => mockSendEmail(...a),
  ensureDeletionLogRow: (...a: unknown[]) => mockEnsureLog(...a),
}))
jest.mock('@/lib/auth/server', () => ({ authAdmin: { deleteUser: (...a: unknown[]) => mockAuthDelete(...a) } }))
jest.mock('@/db/client', () => ({ getAdminDb: () => chain }))
jest.mock('@/db/schema', () => ({ userProfiles: { id: 'id' } }))
jest.mock('@/lib/api/withErrorLogging', () => ({ withErrorLogging: (_p: string, h: unknown) => h }))

import { DELETE } from '@/app/api/admin/delete-user/route'

const req = (userId = '11111111-1111-4111-8111-111111111111') =>
  ({ headers: { get: () => null }, json: async () => ({ userId }) }) as unknown as Request

beforeEach(() => {
  jest.clearAllMocks()
  selectCall = 0
  preReadRows = []
  execRows = []
  mockRequireAdmin.mockResolvedValue({ ok: true, user: { id: 'admin', email: 'a@vencemitfg.es' } })
  mockDeleteUserData.mockResolvedValue([{ table: '_delete_user_account', status: 'deleted' }])
  mockSendEmail.mockResolvedValue({ sent: true, emailId: 'e1' })
  mockAuthDelete.mockResolvedValue({ outcome: 'not_present', error: null })
  mockEnsureLog.mockResolvedValue({ inserted: true, existed: false })
})

test('REINTENTO con rgpd_email_sent_at sellado → NO reenvía el email (exactly-once)', async () => {
  // Reintento: perfil ausente (preReadRows vacío) + fila durable con email Y sello puesto.
  preReadRows = []
  execRows = [{ email: 'borrado@x.c', full_name: 'Ya Borrado', rgpd_email_sent_at: '2026-07-20T10:00:00Z' }]

  const res = await DELETE(req())
  const body = await res.json()

  expect(res.status).toBe(200)
  expect(body.success).toBe(true)
  expect(mockSendEmail).not.toHaveBeenCalled() // ← el corazón de T-011
  const emailStep = body.details?.find?.((d: { table: string }) => d.table === '_deletion_email')
  expect(emailStep?.status).toBe('skipped')
})

test('1er intento con el sello NULL → envía el email una vez', async () => {
  // Fresh: perfil presente (pre-read con email), fila durable sin sello.
  preReadRows = [{ email: 'user@x.c', full_name: 'Usuario' }]
  execRows = [{ email: 'user@x.c', full_name: 'Usuario', rgpd_email_sent_at: null }]

  const res = await DELETE(req())
  const body = await res.json()

  expect(res.status).toBe(200)
  expect(body.success).toBe(true)
  expect(mockSendEmail).toHaveBeenCalledTimes(1)
})
