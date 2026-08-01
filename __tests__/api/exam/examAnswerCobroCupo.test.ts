/** @jest-environment node */
// __tests__/api/exam/examAnswerCobroCupo.test.ts
//
// INTEGRACIÓN del cobro de cupo en POST /api/exam/answer — el gemelo de
// `answerAndSaveCobroCupo` para el MODO EXAMEN.
//
// ## Por qué existe (T-450, segunda vuelta, 01/08/2026)
//
// El 29/07 el cobro del cupo se movió del cliente al servidor. El examen no pasa por
// `answer-and-save`, así que se quedó sin nadie que cobre: 10.181 respuestas de examen
// en 7 días sin llegar al contador, y un usuario free con 489 respuestas en 4 días
// mientras su contador marcaba ~65.
//
// El primer arreglo cobró en `/api/exam/validate` (persistencia en bloque al terminar) y
// **se desplegó sin servir de nada**: cuando `validate` corre, este endpoint ya ha escrito
// cada respuesta durante el examen, así que `validate` no estrena ninguna y cobra 0.
// Verificado en producción con el primer examen posterior a ese deploy: 10 respuestas
// escritas entre las 09:00:42 y las 09:04:30, `validate` a las 09:04:32, y `daily_question_usage`
// sin una sola fila para ese usuario.
//
// La lección que fija este fichero: **el cobro va donde la respuesta se PERSISTE de verdad**,
// y eso, en el examen, es aquí y no al final. Ningún test que mire el código puede ver que
// una condición correcta nunca se cumple — hace falta fijar el comportamiento.
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'mock-anon-key'

const mockSaveAnswer = jest.fn()
const mockIncrement = jest.fn()
const mockGetDailyLimitStatus = jest.fn()

jest.mock('@/lib/api/exam', () => ({
  safeParseSaveAnswerRequest: (data: unknown) => ({ success: true, data }),
  saveAnswer: (...a: unknown[]) => mockSaveAnswer(...a),
  verifyTestOwnership: jest.fn().mockResolvedValue(true),
}))

jest.mock('@/lib/api/dailyLimit', () => {
  const real = jest.requireActual('@/lib/api/dailyLimit')
  return {
    // La POLÍTICA se usa de verdad: es la pieza que decide, y es la MISMA que la de
    // answer-and-save a propósito. Dos criterios sobre el mismo cobro se contradicen.
    debeConsumirCupo: real.debeConsumirCupo,
    incrementDailyCount: (...a: unknown[]) => mockIncrement(...a),
    getDailyLimitStatus: (...a: unknown[]) => mockGetDailyLimitStatus(...a),
    checkDeviceDailyUsage: jest.fn().mockResolvedValue({ allowed: true, deviceTotal: 0 }),
    getUserIdFromToken: jest.fn().mockResolvedValue('user-free-1'),
  }
})

jest.mock('@/lib/api/deviceLimit', () => ({
  registerAndCheckDevice: jest.fn().mockResolvedValue({ allowed: true, deviceCount: 1, maxDevices: 3 }),
  getDeviceIdFromRequest: () => 'device-test',
  getHwFingerprintFromRequest: () => 'hw-test',
}))

import { NextRequest } from 'next/server'

function peticion(): NextRequest {
  return new NextRequest('https://www.vence.es/api/exam/answer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', authorization: 'Bearer tok' },
    body: JSON.stringify({ testId: 'test-1', questionOrder: 1, userAnswer: 'a' }),
  })
}

describe('/api/exam/answer — cobro del cupo diario (server-side)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetDailyLimitStatus.mockResolvedValue({
      allowed: true, questionsToday: 3, questionsRemaining: 22,
      dailyLimit: 25, isPremium: false, isGraduated: false, degraded: false,
      tierLabel: null,
    })
    mockIncrement.mockResolvedValue(undefined)
  })

  it('cobra UNA vez cuando la respuesta del examen se estrena', async () => {
    mockSaveAnswer.mockResolvedValue({ success: true, answerId: 'a1', isCorrect: true, saveAction: 'saved_new' })
    const { POST } = await import('@/app/api/exam/answer/route')

    const res = await POST(peticion())

    expect(res.status).toBe(200)
    expect(mockIncrement).toHaveBeenCalledTimes(1)
    expect(mockIncrement).toHaveBeenCalledWith('user-free-1')
  })

  it('NO cobra si la fila ya tenía respuesta (el usuario cambia de opción)', async () => {
    // En un examen se puede volver atrás y rectificar tantas veces como se quiera antes
    // de entregar. Cada rectificación es un save más, y cobrarlas todas convertiría el
    // tope de 25 preguntas en un tope de 25 clics.
    mockSaveAnswer.mockResolvedValue({ success: true, answerId: 'a1', isCorrect: false, saveAction: 'already_saved' })
    const { POST } = await import('@/app/api/exam/answer/route')

    const res = await POST(peticion())

    expect(res.status).toBe(200)
    expect(mockIncrement).not.toHaveBeenCalled()
  })

  it('NO cobra si el guardado falló', async () => {
    // Misma regla que `save_failed`: nunca se le cobra cupo a nadie por respuestas que
    // no han quedado guardadas.
    mockSaveAnswer.mockResolvedValue({ success: false, error: 'boom' })
    const { POST } = await import('@/app/api/exam/answer/route')

    await POST(peticion())

    expect(mockIncrement).not.toHaveBeenCalled()
  })

  it('NO cobra a un usuario premium', async () => {
    mockGetDailyLimitStatus.mockResolvedValue({
      allowed: true, questionsToday: 0, questionsRemaining: 999,
      dailyLimit: 999, isPremium: true, isGraduated: false, degraded: false, tierLabel: null,
    })
    mockSaveAnswer.mockResolvedValue({ success: true, answerId: 'a1', isCorrect: true, saveAction: 'saved_new' })
    const { POST } = await import('@/app/api/exam/answer/route')

    await POST(peticion())

    expect(mockIncrement).not.toHaveBeenCalled()
  })

  it('un fallo del contador no rompe el guardado de la respuesta', async () => {
    // El cobro del cupo NUNCA puede tumbar una respuesta que el usuario ya ha dado:
    // en el peor caso se lleva la pregunta gratis.
    mockIncrement.mockRejectedValue(new Error('BD caída'))
    mockSaveAnswer.mockResolvedValue({ success: true, answerId: 'a1', isCorrect: true, saveAction: 'saved_new' })
    const { POST } = await import('@/app/api/exam/answer/route')

    const res = await POST(peticion())

    expect(res.status).toBe(200)
  })
})
