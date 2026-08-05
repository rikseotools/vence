/** @jest-environment node */
// __tests__/security/reviewOwnershipIdentity.test.ts
//
// Regresión de seguridad de [T-482]: los endpoints del REPASO de un test no autenticaban.
//
// Lo que se podía hacer antes de este arreglo, comprobado con `curl` contra producción:
//   · `GET /api/tests/<uuid>/review` sin sesión → **200 con el examen entero**: enunciados,
//     LAS RESPUESTAS de esa persona, sus aciertos y sus tiempos. El UUID viaja en la URL del
//     navegador (`/revisar/<testId>`), o sea en historiales, capturas y enlaces compartidos.
//   · `GET /api/psychometric/review?sessionId=<uuid>` — el GEMELO, con el mismo agujero. La
//     pantalla de repaso elige entre los dos según `?type=psychometric`, así que arreglar uno
//     solo deja la puerta abierta por el otro lado. La ficha original solo nombraba dos
//     endpoints; este apareció al seguir al cliente.
//   · `POST /api/tests/recover` — el peor: **ESCRITURA** con el `userId` del CUERPO y sin
//     token. Se le creaba a cualquiera un test con sus respuestas y se le tocaba el
//     `user_profiles`: contamina su historial y sus estadísticas, y es munición para el
//     antifraude (aciertos que esa persona no hizo).
//
// INVARIANTE que fijan estos tests: la identidad sale SIEMPRE del token; el recurso es de su
// DUEÑO; y en `recover` el `userId` del cuerpo no es identidad, solo un dato que se contrasta.
//
// Es el gemelo por-endpoint de `crossUserIsolationC3`, que cubre la familia que consulta con
// `sql``` mientras estas rutas usan el QUERY BUILDER de Drizzle — la misma zona ciega por la
// que estos tres endpoints pasaron años sin que ningún guardarraíl los viera.

import { NextRequest } from 'next/server'

const DUENO = '11111111-1111-4111-8111-111111111111'
const OTRO = '22222222-2222-4222-8222-222222222222'
const TEST_ID = '33333333-3333-4333-8333-333333333333'

const mockVerifyAuth = jest.fn()
const mockGetTestReview = jest.fn()
const mockRecoverTest = jest.fn()
const mockEmit = jest.fn()

jest.mock('@/lib/api/auth/verifyAuth', () => ({
  verifyAuth: (...a: unknown[]) => mockVerifyAuth(...a),
}))
jest.mock('@/lib/api/withErrorLogging', () => ({
  withErrorLogging: (_p: string, h: unknown) => h,
}))
jest.mock('@/lib/observability/emit', () => ({
  emitFireAndForget: (...a: unknown[]) => mockEmit(...a),
}))
jest.mock('@/lib/api/test-review/queries', () => ({
  getTestReview: (...a: unknown[]) => mockGetTestReview(...a),
}))
jest.mock('@/lib/api/tests', () => {
  const actual = jest.requireActual('@/lib/api/tests')
  return { ...actual, recoverTest: (...a: unknown[]) => mockRecoverTest(...a) }
})
// El gemelo psicotécnico consulta con el builder DENTRO de la ruta. Aquí solo hace falta
// saber si llegó a tocar la BD: la comprobación de dueño contra datos reales va en
// `__tests__/integration/reviewOwnership.integration.test.ts`.
const mockSelect = jest.fn()
jest.mock('@/db/client', () => ({
  getDb: () => ({ select: (...a: unknown[]) => mockSelect(...a) }),
  getPoolerDb: () => ({ select: (...a: unknown[]) => mockSelect(...a) }),
}))

import { GET as REVIEW } from '@/app/api/tests/[testId]/review/route'
import { POST as RECOVER } from '@/app/api/tests/recover/route'
import { GET as PSICO_REVIEW } from '@/app/api/psychometric/review/route'

function req(body?: unknown): NextRequest {
  return {
    headers: { get: () => null },
    url: 'https://x',
    json: async () => body ?? {},
  } as unknown as NextRequest
}
const params = { params: Promise.resolve({ testId: TEST_ID }) }

// Cuerpo VÁLIDO para el Zod real (no se mockea el esquema a propósito: un 400 de validación
// escondería el 401/403 que estos tests quieren demostrar).
const pendingTest = {
  tema: 1,
  currentQuestion: 1,
  score: 1,
  savedAt: 1_700_000_000_000,
  startTime: 1_699_999_000_000,
  answeredQuestions: [
    { question: 0, selectedAnswer: 1, correct: true, timestamp: '2026-08-05T09:00:00.000Z' },
  ],
  detailedAnswers: [],
}

beforeEach(() => {
  jest.clearAllMocks()
  mockGetTestReview.mockResolvedValue({ success: true, questions: [] })
  mockRecoverTest.mockResolvedValue({ success: true, testId: TEST_ID })
})

describe('GET /api/tests/[testId]/review — el repaso es de quien hizo el test', () => {
  test('401 sin token (antes: 200 con el examen ajeno entero)', async () => {
    mockVerifyAuth.mockResolvedValue({ success: false, status: 401, reason: 'no_bearer_token' })
    const res = await REVIEW(req(), params)
    expect(res.status).toBe(401)
    // Lo que de verdad importa: no se llegó a consultar nada.
    expect(mockGetTestReview).not.toHaveBeenCalled()
  })

  test('con token, pregunta con el id del TOKEN — nunca con uno de la petición', async () => {
    mockVerifyAuth.mockResolvedValue({ success: true, userId: DUENO, email: null })
    const res = await REVIEW(req(), params)
    expect(res.status).toBe(200)
    expect(mockGetTestReview).toHaveBeenCalledWith({ testId: TEST_ID, requesterId: DUENO })
  })

  test('403 cuando el test existe pero es de otra persona', async () => {
    mockVerifyAuth.mockResolvedValue({ success: true, userId: OTRO, email: null })
    mockGetTestReview.mockResolvedValue({
      success: false,
      error: 'Este test no es tuyo',
      errorCode: 'not_owner',
    })
    const res = await REVIEW(req(), params)
    expect(res.status).toBe(403)
  })

  test('404 sigue siendo 404, y no lo decide el TEXTO del mensaje', async () => {
    mockVerifyAuth.mockResolvedValue({ success: true, userId: DUENO, email: null })
    mockGetTestReview.mockResolvedValue({
      success: false,
      error: 'Otro texto cualquiera',
      errorCode: 'not_found',
    })
    const res = await REVIEW(req(), params)
    expect(res.status).toBe(404)
  })

  test('403 también con sesión de SOLO LECTURA (suplantación)', async () => {
    mockVerifyAuth.mockResolvedValue({ success: false, status: 403, reason: 'impersonation_readonly' })
    const res = await REVIEW(req(), params)
    expect(res.status).toBe(403)
    expect(mockGetTestReview).not.toHaveBeenCalled()
  })
})

describe('POST /api/tests/recover — escribir en la cuenta de otro', () => {
  test('401 sin token (antes: creaba el test en la cuenta que le dijeras)', async () => {
    mockVerifyAuth.mockResolvedValue({ success: false, status: 401, reason: 'no_bearer_token' })
    const res = await RECOVER(req({ userId: OTRO, pendingTest }))
    expect(res.status).toBe(401)
    expect(mockRecoverTest).not.toHaveBeenCalled()
  })

  test('el `userId` del CUERPO no es identidad: se escribe con el del token', async () => {
    mockVerifyAuth.mockResolvedValue({ success: true, userId: DUENO, email: null })
    const res = await RECOVER(req({ userId: OTRO, pendingTest }))
    expect(res.status).toBe(200)
    expect(mockRecoverTest).toHaveBeenCalledTimes(1)
    expect(mockRecoverTest.mock.calls[0][0].userId).toBe(DUENO)
    // El id ajeno no llega a la escritura por ninguna vía.
    expect(JSON.stringify(mockRecoverTest.mock.calls[0][0])).not.toContain(OTRO)
  })

  test('la discrepancia queda registrada aunque se siga adelante', async () => {
    mockVerifyAuth.mockResolvedValue({ success: true, userId: DUENO, email: null })
    await RECOVER(req({ userId: OTRO, pendingTest }))
    const tipos = mockEmit.mock.calls.map((c) => (c[0] as { eventType: string }).eventType)
    expect(tipos).toContain('auth_identidad_ajena_rechazada')
  })

  test('el caso legítimo (el cuerpo trae TU id) pasa sin ruido', async () => {
    mockVerifyAuth.mockResolvedValue({ success: true, userId: DUENO, email: null })
    const res = await RECOVER(req({ userId: DUENO, pendingTest }))
    expect(res.status).toBe(200)
    expect(mockEmit).not.toHaveBeenCalled()
  })
})

describe('GET /api/psychometric/review — el gemelo que la ficha no nombraba', () => {
  function psicoReq(): NextRequest {
    return {
      headers: { get: () => null },
      url: `https://x/api/psychometric/review?sessionId=${TEST_ID}`,
    } as unknown as NextRequest
  }

  test('401 sin token, y sin llegar a consultar la sesión de nadie', async () => {
    mockVerifyAuth.mockResolvedValue({ success: false, status: 401, reason: 'no_bearer_token' })
    const res = await PSICO_REVIEW(psicoReq())
    expect(res.status).toBe(401)
    expect(mockSelect).not.toHaveBeenCalled()
  })

  test('403 con sesión de solo lectura, tampoco consulta', async () => {
    mockVerifyAuth.mockResolvedValue({ success: false, status: 403, reason: 'impersonation_readonly' })
    const res = await PSICO_REVIEW(psicoReq())
    expect(res.status).toBe(403)
    expect(mockSelect).not.toHaveBeenCalled()
  })
})
