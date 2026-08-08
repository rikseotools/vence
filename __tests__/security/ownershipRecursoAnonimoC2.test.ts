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

  test('recurso con dueño + caller anónimo → DENIEGA (antes: pasaba si el body no traía userId)', async () => {
    // La propiedad de seguridad que compró [T-565] —esto NO pasa— se conserva intacta y es
    // lo primero que se comprueba aquí.
    mockVerifyAuthOptional.mockResolvedValue(null)
    const r = await requireDuenoDelRecurso(req(), ENDPOINT, DUENO)
    expect(r.ok).toBe(false)

    // ⚠️ CAMBIO DELIBERADO ([T-671], 08/08/2026): el código pasa de 403 a **401**, y el evento
    // de `auth_identidad_ajena_rechazada` a `auth_sin_identidad_en_recurso`. No se ha
    // ablandado nada: sigue denegando. Lo que se corrige es la ETIQUETA.
    //
    // Con la de antes, «no sé quién eres» y «no eres el dueño» salían idénticas, y eso costó
    // caro: en el incidente del 07/08 hubo **195 rechazos por «recurso ajeno» de los que los
    // 195 llegaron sin identidad** —ni uno era de otra persona—, así que (a) la señal de
    // seguridad quedó inservible durante el pico, (b) la investigación descartó esa pista
    // por «no encaja» cuando era el rastro exacto del fallo, y (c) al opositor se le decía
    // «no tienes acceso a este recurso» sobre SU PROPIO examen, sin ofrecerle volver a
    // entrar, que era lo único que lo arreglaba.
    if (!r.ok) expect(r.response.status).toBe(401)
    expect(mockEmit).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'auth_sin_identidad_en_recurso' })
    )
    // Y NO se contamina la señal de acceso ajeno, que es la que vigila el abuso de verdad.
    expect(mockEmit).not.toHaveBeenCalledWith(
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
    // Éste —y solo éste— es acceso a lo ajeno, así que es el único que puede encender esa
    // señal. Si vuelve a dispararse con llamantes sin identidad, la vigilancia de abuso se
    // queda otra vez ciega en cuanto haya una caída de sesión.
    expect(mockEmit).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'auth_identidad_ajena_rechazada' })
    )
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
