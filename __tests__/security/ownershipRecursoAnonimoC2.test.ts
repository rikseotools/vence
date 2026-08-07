/** @jest-environment node */
// __tests__/security/ownershipRecursoAnonimoC2.test.ts
//
// [T-565] — Segunda ronda del guardarraíl C2-builder (T-482 lo estrenó con el REPASO).
// La familia `exam/*` y `psychometric/*` (7 + 6 = 13 rutas) comprobaba propiedad así:
//
//   if (body.userId) { isOwner = await verifyTestOwnership(testId, body.userId) }
//
// Dos fallos, no uno: (a) era OPCIONAL — bastaba con OMITIR `userId` para saltarla, y
// varios llamantes reales (`/exam/resume`, `/exam/progress`) YA lo omiten siempre, así
// que la comprobación nunca corría en producción; (b) el id contra el que se comparaba
// lo ponía el CLIENTE — poner el id de la VÍCTIMA (su propio UUID, no secreto) la hacía
// pasar igual. Con solo el UUID del test/sesión se leían las respuestas de otra persona,
// se completaba su examen, se le gastaba cupo o se le descartaba el intento.
//
// `requireDuenoDelRecurso` (lib/api/shared/auth.ts) es el arreglo compartido: la
// identidad sale SIEMPRE de `verifyAuthOptional` (el token, o `null` si de verdad no
// hay sesión — el examen admite tomarse sin cuenta), nunca de lo que afirme el cliente.

const mockVerifyAuthOptional = jest.fn()
const mockEmit = jest.fn()

jest.mock('@/lib/api/auth/verifyAuth', () => ({
  verifyAuth: jest.fn(),
  verifyAuthOptional: (...a: unknown[]) => mockVerifyAuthOptional(...a),
}))
jest.mock('@/lib/observability/emit', () => ({
  emitFireAndForget: (...a: unknown[]) => mockEmit(...a),
}))

import { NextRequest } from 'next/server'
import { requireDuenoDelRecurso } from '@/lib/api/shared/auth'

const DUENO = '11111111-1111-4111-8111-111111111111'
const OTRO = '22222222-2222-4222-8222-222222222222'
const ENDPOINT = '/api/exam/resume'

function req(): NextRequest {
  return { headers: { get: () => null }, url: 'https://x' } as unknown as NextRequest
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('requireDuenoDelRecurso — la identidad sale del token, nunca del cliente', () => {
  test('recurso anónimo (sin dueño) + caller anónimo → pasa', async () => {
    mockVerifyAuthOptional.mockResolvedValue(null)
    const r = await requireDuenoDelRecurso(req(), ENDPOINT, null)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.callerUserId).toBeNull()
  })

  test('recurso con dueño + caller anónimo → 403 (antes: pasaba si el body no traía userId)', async () => {
    mockVerifyAuthOptional.mockResolvedValue(null)
    const r = await requireDuenoDelRecurso(req(), ENDPOINT, DUENO)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.response.status).toBe(403)
    // La discrepancia deja rastro SIEMPRE, se corte o no.
    expect(mockEmit).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'auth_identidad_ajena_rechazada' })
    )
  })

  test('recurso con dueño + caller es OTRA persona autenticada → 403', async () => {
    // Este es el caso exacto del agujero: antes de [T-565] bastaba con mandar el UUID
    // del DUEÑO (no secreto) en el body para que la comprobación vieja diera "true".
    // Aquí la identidad no sale del body — sale del token, y el token es de OTRO.
    mockVerifyAuthOptional.mockResolvedValue({ userId: OTRO, email: null })
    const r = await requireDuenoDelRecurso(req(), ENDPOINT, DUENO)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.response.status).toBe(403)
  })

  test('recurso con dueño + caller ES el dueño → pasa', async () => {
    mockVerifyAuthOptional.mockResolvedValue({ userId: DUENO, email: null })
    const r = await requireDuenoDelRecurso(req(), ENDPOINT, DUENO)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.callerUserId).toBe(DUENO)
  })

  test('recurso anónimo + caller autenticado → pasa (puede reanudar un examen sin dueño)', async () => {
    mockVerifyAuthOptional.mockResolvedValue({ userId: OTRO, email: null })
    const r = await requireDuenoDelRecurso(req(), ENDPOINT, null)
    expect(r.ok).toBe(true)
  })
})
