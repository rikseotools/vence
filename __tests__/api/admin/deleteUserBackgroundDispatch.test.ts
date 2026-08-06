/** @jest-environment node */
// __tests__/api/admin/deleteUserBackgroundDispatch.test.ts
//
// T-215 (06/08/2026) — el borrado RGPD expiraba con los usuarios ACTIVOS: el borrado real
// puede tardar hasta ~190 s (medido con el usuario más activo), muy por encima de lo que
// aguanta cualquier ALB/CloudFront delante de la app. La petición HTTP moría (504) aunque la
// transacción de BD seguía y comiteaba — "no se borró" era en realidad "no me enteré".
//
// Arreglo: la ruta responde 202 AL INSTANTE para un borrado real y ejecuta el trabajo pesado
// en `after()` (Next.js, corre tras enviar la respuesta, mismo proceso). Estos tests fijan el
// CONTRATO de despacho en sí — que la respuesta no espera al borrado, que el reintento sigue
// síncrono, y que una excepción no controlada dentro del background deja rastro en vez de
// morir en silencio — no vuelven a probar la lógica de completeDeletion() en detalle (eso ya
// lo cubren deleteUserAuthOutcome.test.ts y deleteUserRgpdExactlyOnce.test.ts).

const mockRequireAdmin = jest.fn()
const mockDeleteUserData = jest.fn()
const mockSendEmail = jest.fn()
const mockAuthDelete = jest.fn()
const mockEnsureLog = jest.fn()
const mockMarkCompleted = jest.fn()
const mockEmit = jest.fn()

let selectCall = 0
let preReadRows: Array<{ email: string; full_name: string }> = []
let postDeleteRows: Array<{ id: string }> = []
let execRows: Array<Record<string, unknown>> = []

const chain: Record<string, unknown> = {
  select: () => chain,
  from: () => chain,
  where: () => chain,
  limit: () => {
    selectCall++
    if (selectCall === 1) return Promise.resolve(preReadRows)
    return Promise.resolve(postDeleteRows)
  },
  execute: () => Promise.resolve(execRows),
}

let capturedAfter: (() => Promise<void>) | null = null
jest.mock('next/server', () => {
  const actual = jest.requireActual('next/server')
  return { ...actual, after: (fn: () => Promise<void>) => { capturedAfter = fn } }
})

jest.mock('@/lib/api/shared/auth', () => ({ requireAdmin: (...a: unknown[]) => mockRequireAdmin(...a) }))
jest.mock('@/lib/api/admin-delete-user', () => ({
  deleteUserData: (...a: unknown[]) => mockDeleteUserData(...a),
  sendDeletionConfirmationEmail: (...a: unknown[]) => mockSendEmail(...a),
  ensureDeletionLogRow: (...a: unknown[]) => mockEnsureLog(...a),
  markDeletionCompleted: (...a: unknown[]) => mockMarkCompleted(...a),
}))
jest.mock('@/lib/auth/server', () => ({ authAdmin: { deleteUser: (...a: unknown[]) => mockAuthDelete(...a) } }))
jest.mock('@/db/client', () => ({ getAdminDb: () => chain }))
jest.mock('@/db/schema', () => ({ userProfiles: { id: 'id' } }))
jest.mock('@/lib/api/withErrorLogging', () => ({ withErrorLogging: (_p: string, h: unknown) => h }))
jest.mock('@/lib/observability/emit', () => ({ emit: (...a: unknown[]) => mockEmit(...a) }))

import { DELETE } from '@/app/api/admin/delete-user/route'

const req = (userId = '11111111-1111-4111-8111-111111111111') =>
  ({ headers: { get: () => null }, json: async () => ({ userId }) }) as unknown as Request

beforeEach(() => {
  jest.clearAllMocks()
  selectCall = 0
  preReadRows = [{ email: 'user@x.c', full_name: 'Usuario' }] // perfil presente → borrado REAL
  postDeleteRows = [] // perfil borrado tras el DELETE (accountDeleted=true)
  execRows = []
  capturedAfter = null
  mockRequireAdmin.mockResolvedValue({ ok: true, user: { id: 'admin', email: 'a@vencemitfg.es' } })
  mockDeleteUserData.mockResolvedValue([{ table: '_delete_user_account', status: 'deleted' }])
  mockSendEmail.mockResolvedValue({ sent: true, emailId: 'e1' })
  mockAuthDelete.mockResolvedValue({ outcome: 'not_present', error: null })
  mockEnsureLog.mockResolvedValue({ inserted: true, existed: false })
  mockMarkCompleted.mockResolvedValue(undefined)
  mockEmit.mockResolvedValue(undefined)
})

test('un borrado REAL responde 202 SIN esperar a deleteUserData — el trabajo pesado no corre hasta invocar after()', async () => {
  // Cuelga deleteUserData a propósito (nunca resuelve dentro de este test): si la ruta lo
  // esperase antes de responder, este test colgaría hasta el timeout de Jest. Que termine
  // rápido y en 202 demuestra que la respuesta NO depende de que el borrado haya corrido.
  let resolveDeleteUserData: (() => void) | null = null
  mockDeleteUserData.mockImplementation(
    () => new Promise((resolve) => { resolveDeleteUserData = () => resolve([{ table: '_delete_user_account', status: 'deleted' }]) }),
  )

  const res = await DELETE(req())
  const body = await res.json()

  expect(res.status).toBe(202)
  expect(body.pending).toBe(true)
  expect(body.userId).toBe('11111111-1111-4111-8111-111111111111')
  expect(mockDeleteUserData).not.toHaveBeenCalled() // agendado en after(), no ejecutado aún

  // Limpieza: liberar la promesa colgada para no dejar un handle abierto en Jest.
  expect(capturedAfter).toBeInstanceOf(Function)
  const pending = capturedAfter!()
  resolveDeleteUserData!()
  await pending
  expect(mockDeleteUserData).toHaveBeenCalledTimes(1) // y SÍ corre, una vez invocado after()
})

test('el mensaje 202 dice explícitamente que NO hay que reintentar a ciegas', async () => {
  const res = await DELETE(req())
  const body = await res.json()
  expect(res.status).toBe(202)
  expect(body.message).toMatch(/no reintentes a ciegas/i)
  expect(body.message).toMatch(/deletion_completed_at|user_profiles/i)
})

test('el reintento (cuenta ya borrada) NO usa after(): sigue síncrono, 200 al instante', async () => {
  preReadRows = [] // perfil ausente → alreadyDeleted
  execRows = [{ email: 'durable@x.c', full_name: 'Durable' }] // fila de auditoría previa
  const res = await DELETE(req())
  expect(res.status).toBe(200)
  expect(capturedAfter).toBeNull()
})

test('una excepción NO controlada dentro del background (p.ej. deleteUserData rechaza) NO revienta el proceso: se captura y deja rastro', async () => {
  mockDeleteUserData.mockRejectedValue(new Error('boom: fallo inesperado no cubierto por el try/catch interno'))

  const res = await DELETE(req())
  expect(res.status).toBe(202)

  expect(capturedAfter).toBeInstanceOf(Function)
  await expect(capturedAfter!()).resolves.toBeUndefined() // no propaga: el wrapper la atrapa

  expect(mockEmit).toHaveBeenCalledWith(expect.objectContaining({
    eventType: 'admin_delete_user_background',
    severity: 'critical',
    errorMessage: expect.stringContaining('boom'),
  }))
  expect(mockMarkCompleted).not.toHaveBeenCalled()
})

test('el evento de background lleva userId, endpoint y durationMs para poder alertar/monitorizar', async () => {
  const res = await DELETE(req())
  expect(res.status).toBe(202)
  await capturedAfter!()

  expect(mockEmit).toHaveBeenCalledWith(expect.objectContaining({
    source: 'fargate',
    eventType: 'admin_delete_user_background',
    endpoint: '/api/admin/delete-user',
    userId: '11111111-1111-4111-8111-111111111111',
    durationMs: expect.any(Number),
  }))
})
