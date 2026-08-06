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
//
// [T-215, 06/08/2026] Un borrado REAL (no un reintento de cuenta ya borrada) ya no
// se resuelve DENTRO de la petición: la ruta responde 202 al instante y ejecuta
// completeDeletion() en `after()`. Estos tests capturan el callback de `after()` y
// lo invocan a mano para seguir comprobando el MISMO comportamiento (email exacto,
// auth legacy, verificación fail-closed) — solo cambia DÓNDE se observa: ya no en
// `res.status`/`body`, sino tras invocar el callback, vía los mocks y el evento
// emitido a `observable_events`.

const mockRequireAdmin = jest.fn()
const mockDeleteUserData = jest.fn()
const mockSendEmail = jest.fn()
const mockAuthDelete = jest.fn()
const mockEnsureLog = jest.fn()
const mockMarkCompleted = jest.fn()
const mockEmit = jest.fn()

let selectCall = 0
let preReadRows: Array<{ email: string; full_name: string }> = [{ email: 'arel@x.c', full_name: 'Arelis Morales' }]
let afterRows: Array<{ id: string }> = []
let afterThrows = false // simula un blip transitorio en la verificación post-delete
let logRow: { email: string; full_name: string | null } | null = null // deleted_users_log durable (F3)
const chain: Record<string, unknown> = {
  select: () => chain,
  from: () => chain,
  where: () => chain,
  limit: () => {
    selectCall++
    // 1ª lectura: pre-delete (email/nombre). 2ª: post-delete (profileStillExists).
    if (selectCall === 1) return Promise.resolve(preReadRows)
    if (afterThrows) return Promise.reject(new Error('db blip (pool/timeout)'))
    return Promise.resolve(afterRows)
  },
  // F3: lectura durable del email desde deleted_users_log (getAdminDb().execute(sql`...`)).
  execute: () => Promise.resolve(logRow ? [logRow] : []),
}

// Captura el callback de `after()` en vez de dejar que corra el `after()` REAL de
// Next.js (que exige un contexto de petición inexistente fuera del server real y
// lanzaría fuera de ese contexto). `NextResponse` se conserva REAL: construye la
// respuesta 202/200/500 igual que en producción.
let capturedAfter: (() => Promise<void>) | null = null
jest.mock('next/server', () => {
  const actual = jest.requireActual('next/server')
  return { ...actual, after: (fn: () => Promise<void>) => { capturedAfter = fn } }
})

jest.mock('@/lib/api/shared/auth', () => ({
  requireAdmin: (...a: unknown[]) => mockRequireAdmin(...a),
}))
jest.mock('@/lib/api/admin-delete-user', () => ({
  deleteUserData: (...a: unknown[]) => mockDeleteUserData(...a),
  sendDeletionConfirmationEmail: (...a: unknown[]) => mockSendEmail(...a),
  ensureDeletionLogRow: (...a: unknown[]) => mockEnsureLog(...a),
  markDeletionCompleted: (...a: unknown[]) => mockMarkCompleted(...a),
}))
jest.mock('@/lib/auth/server', () => ({
  authAdmin: { deleteUser: (...a: unknown[]) => mockAuthDelete(...a) },
}))
jest.mock('@/db/client', () => ({ getAdminDb: () => chain }))
jest.mock('@/db/schema', () => ({ userProfiles: { id: 'id' } }))
jest.mock('@/lib/api/withErrorLogging', () => ({
  withErrorLogging: (_p: string, h: unknown) => h,
}))
jest.mock('@/lib/observability/emit', () => ({ emit: (...a: unknown[]) => mockEmit(...a) }))

import { DELETE } from '@/app/api/admin/delete-user/route'

function req(userId = '11111111-1111-4111-8111-111111111111') {
  return { headers: { get: () => null }, json: async () => ({ userId }) } as unknown as Request
}

/** Dispara la petición (202 + `after()` capturado) y ejecuta el background a mano. */
async function runBackground(userId?: string) {
  const res = await DELETE(req(userId))
  const body = await res.json()
  expect(res.status).toBe(202)
  expect(body.pending).toBe(true)
  expect(capturedAfter).toBeInstanceOf(Function)
  await capturedAfter!()
  return body
}

beforeEach(() => {
  jest.clearAllMocks()
  selectCall = 0
  preReadRows = [{ email: 'arel@x.c', full_name: 'Arelis Morales' }]
  afterRows = [] // por defecto: perfil borrado (cuenta eliminada)
  afterThrows = false
  logRow = null
  capturedAfter = null
  mockRequireAdmin.mockResolvedValue({ ok: true, user: { id: 'admin', email: 'a@vencemitfg.es' } })
  mockDeleteUserData.mockResolvedValue([{ table: '_delete_user_account', status: 'deleted' }])
  mockSendEmail.mockResolvedValue({ sent: true, emailId: 'e1' })
  mockMarkCompleted.mockResolvedValue(undefined)
  mockEmit.mockResolvedValue(undefined)
  // Con perfil presente, la fila de auditoría se inserta OK antes del borrado.
  mockEnsureLog.mockResolvedValue({ inserted: true, existed: false })
})

test('post-flip (not_present) + perfil borrado → 202 al instante, y el background manda email RGPD + evento OK', async () => {
  mockAuthDelete.mockResolvedValue({ outcome: 'not_present', error: null })
  await runBackground()
  expect(mockSendEmail).toHaveBeenCalledTimes(1) // ← el bug: antes NO se llamaba
  expect(mockMarkCompleted).toHaveBeenCalledTimes(1) // éxito → se marca la traza durable
  expect(mockEmit).toHaveBeenCalledWith(expect.objectContaining({
    eventType: 'admin_delete_user_background',
    severity: 'info',
    httpStatus: 200,
  }))
})

test('pre-flip (deleted) + perfil borrado → background OK + email enviado', async () => {
  mockAuthDelete.mockResolvedValue({ outcome: 'deleted', error: null })
  await runBackground()
  expect(mockSendEmail).toHaveBeenCalledTimes(1)
  expect(mockEmit).toHaveBeenCalledWith(expect.objectContaining({ severity: 'info' }))
})

test('fallo REAL del store legacy + perfil borrado → background reporta CRÍTICO pero el email SÍ se envía', async () => {
  mockAuthDelete.mockResolvedValue({ outcome: 'error', error: new Error('network') })
  await runBackground()
  expect(mockSendEmail).toHaveBeenCalledTimes(1) // los datos del usuario ya no existen
  expect(mockMarkCompleted).not.toHaveBeenCalled() // NO es éxito (criticalErrors=1) → sin traza de completado
  expect(mockEmit).toHaveBeenCalledWith(expect.objectContaining({
    severity: 'critical',
    httpStatus: 500,
  }))
})

test('perfil AÚN existe (borrado falló) → background NO envía email y reporta CRÍTICO', async () => {
  afterRows = [{ id: '11111111-1111-4111-8111-111111111111' }]
  mockAuthDelete.mockResolvedValue({ outcome: 'not_present', error: null })
  await runBackground()
  expect(mockSendEmail).not.toHaveBeenCalled()
  expect(mockMarkCompleted).not.toHaveBeenCalled()
  expect(mockEmit).toHaveBeenCalledWith(expect.objectContaining({
    severity: 'critical',
    httpStatus: 500,
    metadata: expect.objectContaining({ accountDeleted: false }),
  }))
})

test('F3: reintento (perfil ya borrado) NO re-invoca delete_user_account, reenvía email durable y da 200 SÍNCRONO', async () => {
  // Escenario de reintento tras un fallo previo: user_profiles ya no existe → el pre-read
  // viene vacío pero la fila de auditoría sigue. delete_user_account() LANZARÍA `no_data_found`
  // (exige user_profiles) → la ruta DEBE saltarse el borrado, no re-invocarlo. Para blindarlo,
  // mockeamos deleteUserData como si lanzara: si se llamara, el test fallaría por 500; como se
  // salta, el resultado es 200 + email durable reenviado.
  //
  // Es el ÚNICO camino que sigue SÍNCRONO tras T-215 (no hay DELETE masivo que esperar), así
  // que aquí SÍ se comprueba `res.status` directamente — no pasa por `after()`.
  preReadRows = [] // user_profiles ya borrado
  logRow = { email: 'durable@x.c', full_name: 'Durable Name' }
  afterRows = [] // perfil borrado (cuenta eliminada)
  mockDeleteUserData.mockResolvedValue([{ table: '_delete_user_account', status: 'error', error: 'user_profiles not found' }])
  mockAuthDelete.mockResolvedValue({ outcome: 'not_present', error: null })
  const res = await DELETE(req())
  const body = await res.json()
  expect(res.status).toBe(200)
  expect(body.success).toBe(true)
  expect(capturedAfter).toBeNull() // el camino síncrono NO agenda after()
  expect(mockDeleteUserData).not.toHaveBeenCalled() // ← clave: NO se re-borra en el reintento
  expect(mockSendEmail).toHaveBeenCalledWith({ email: 'durable@x.c', fullName: 'Durable Name' })
  expect(mockMarkCompleted).toHaveBeenCalledTimes(1) // también se marca en el camino síncrono
})

test('sin perfil Y sin fila de auditoría previa → 409 y NO se borra (aborta pre-delete)', async () => {
  // Con el fix RGPD: sin email de perfil (perfil ausente) Y sin fila en
  // deleted_users_log, no hay ni a quién notificar ni registro de auditoría → se
  // ABORTA antes del borrado (409), no se borra "a ciegas". Así el estado
  // "cuenta borrada sin email para el correo RGPD" es INALCANZABLE por construcción.
  preReadRows = []
  logRow = null // deleted_users_log tampoco tiene fila
  afterRows = []
  mockAuthDelete.mockResolvedValue({ outcome: 'not_present', error: null })
  const res = await DELETE(req())
  expect(res.status).toBe(409)
  expect(capturedAfter).toBeNull()
  expect(mockDeleteUserData).not.toHaveBeenCalled() // no se llegó a borrar
  expect(mockSendEmail).not.toHaveBeenCalled()
})

test('perfil presente pero el insert de auditoría FALLA → 500 fail-closed, NO se borra', async () => {
  // La fila deleted_users_log es requisito de delete_user_account y fuente del
  // email RGPD durable. Si su insert falla, NO se puede borrar de forma segura →
  // fail-closed 500 ANTES de tocar los datos del usuario (síncrono: nunca llega a agendar after()).
  mockEnsureLog.mockRejectedValue(new Error('insert audit row falló'))
  mockAuthDelete.mockResolvedValue({ outcome: 'not_present', error: null })
  const res = await DELETE(req())
  const body = await res.json()
  expect(res.status).toBe(500)
  expect(body.success).toBe(false)
  expect(capturedAfter).toBeNull()
  expect(mockDeleteUserData).not.toHaveBeenCalled() // nunca se borró
  expect(mockSendEmail).not.toHaveBeenCalled()
})

test('F2: la verificación post-delete LANZA → el background falla CERRADO (crítico, sin email)', async () => {
  // Blip transitorio (pool/timeout) al leer user_profiles tras el borrado. NO se
  // puede confirmar la eliminación → NO reportar éxito ni mandar el email RGPD.
  afterThrows = true
  mockAuthDelete.mockResolvedValue({ outcome: 'not_present', error: null })
  await runBackground()
  expect(mockSendEmail).not.toHaveBeenCalled() // ← el bug F2: antes fallaba abierto y mandaba el email
  expect(mockMarkCompleted).not.toHaveBeenCalled()
  expect(mockEmit).toHaveBeenCalledWith(expect.objectContaining({ severity: 'critical' }))
})
