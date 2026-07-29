/** @jest-environment node */
// __tests__/api/v2/answerAndSaveCobroCupo.test.ts
//
// INTEGRACIÓN del cobro de cupo en POST /api/v2/answer-and-save.
//
// Fija el comportamiento que corrige el incidente del 29/07/2026 (caso Sergio):
//   · una respuesta guardada por primera vez  → cobra 1
//   · un reintento de la cola (already_saved)  → NO cobra (idempotencia por el índice
//     único `unique_test_question`, sin contador ni tabla auxiliar)
//   · guardado fallido                         → NO cobra
//   · premium                                  → NO cobra
//
// Antes del arreglo, el cobro lo hacía el cliente y ninguno de estos casos se cumplía:
// se consumía cupo por respuestas que no llegaban a `test_questions` y por eventos
// repetidos. Medido en 14 días: 41 usuarios free toparon en 25 con ~13 respuestas.
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'mock-anon-key'

const mockValidateAndSave = jest.fn()
const mockIncrement = jest.fn()
const mockGetDailyLimitStatus = jest.fn()

jest.mock('@/lib/api/v2/answer-and-save', () => ({
  safeParseAnswerAndSaveRequest: (data: unknown) => ({ success: true, data }),
  validateAndSaveAnswer: (...a: unknown[]) => mockValidateAndSave(...a),
  markActiveStudentIfFirst: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('@/lib/api/dailyLimit', () => {
  const real = jest.requireActual('@/lib/api/dailyLimit')
  return {
    // La POLÍTICA se usa de verdad (es la pieza que decide): no se mockea.
    debeConsumirCupo: real.debeConsumirCupo,
    incrementDailyCount: (...a: unknown[]) => mockIncrement(...a),
    getDailyLimitStatus: (...a: unknown[]) => mockGetDailyLimitStatus(...a),
    checkDeviceDailyUsage: jest.fn().mockResolvedValue({ allowed: true, deviceTotal: 0 }),
  }
})

jest.mock('@/lib/api/deviceLimit', () => ({
  registerAndCheckDevice: jest.fn().mockResolvedValue({ allowed: true, deviceCount: 1, maxDevices: 3 }),
  getDeviceIdFromRequest: () => 'device-test',
  getHwFingerprintFromRequest: () => 'hw-test',
}))

jest.mock('@/lib/api/auth/verifyAuth', () => ({
  verifyAuth: jest.fn().mockResolvedValue({ success: true, userId: 'user-free-1', email: 'free@test.es' }),
}))

jest.mock('@/lib/api/backend-router', () => ({
  shouldRouteToBackend: () => false,
  backendUrlFor: (p: string) => `https://api.test/${p}`,
}))

jest.mock('next/server', () => {
  const actual = jest.requireActual('next/server')
  return { ...actual, after: (fn: () => unknown) => { void fn } }
})

import { NextRequest } from 'next/server'

function peticion(): NextRequest {
  return new NextRequest('https://www.vence.es/api/v2/answer-and-save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', authorization: 'Bearer tok' },
    body: JSON.stringify({ questionId: 'q1', questionIndex: 0, tema: 1 }),
  })
}

const RESPUESTA_BASE = {
  isCorrect: true,
  correctAnswer: 0,
  explanation: null,
  articleNumber: null,
  lawShortName: null,
  lawName: null,
  newScore: 1,
}

describe('answer-and-save — cobro del cupo diario (server-side)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetDailyLimitStatus.mockResolvedValue({
      allowed: true, questionsToday: 3, questionsRemaining: 22,
      dailyLimit: 25, isPremium: false, isGraduated: false, tierLabel: null,
    })
    mockIncrement.mockResolvedValue(undefined)
  })

  it('cobra UNA vez cuando la respuesta se guarda por primera vez', async () => {
    mockValidateAndSave.mockResolvedValue({ ...RESPUESTA_BASE, success: true, saveAction: 'saved_new' })
    const { POST } = await import('@/app/api/v2/answer-and-save/route')

    const res = await POST(peticion())

    expect(res.status).toBe(200)
    expect(mockIncrement).toHaveBeenCalledTimes(1)
    expect(mockIncrement).toHaveBeenCalledWith('user-free-1')
  })

  it('NO cobra si la fila ya existía (reintento de la cola / doble evento)', async () => {
    mockValidateAndSave.mockResolvedValue({ ...RESPUESTA_BASE, success: true, saveAction: 'already_saved' })
    const { POST } = await import('@/app/api/v2/answer-and-save/route')

    const res = await POST(peticion())

    expect(res.status).toBe(200)
    expect(mockIncrement).not.toHaveBeenCalled()
  })

  it('NO cobra si el guardado falló', async () => {
    mockValidateAndSave.mockResolvedValue({ ...RESPUESTA_BASE, success: false, saveAction: 'save_failed' })
    const { POST } = await import('@/app/api/v2/answer-and-save/route')

    await POST(peticion())

    expect(mockIncrement).not.toHaveBeenCalled()
  })

  it('NO cobra a un usuario premium', async () => {
    mockGetDailyLimitStatus.mockResolvedValue({
      allowed: true, questionsToday: 0, questionsRemaining: 999,
      dailyLimit: 999, isPremium: true, isGraduated: false, tierLabel: null,
    })
    mockValidateAndSave.mockResolvedValue({ ...RESPUESTA_BASE, success: true, saveAction: 'saved_new' })
    const { POST } = await import('@/app/api/v2/answer-and-save/route')

    await POST(peticion())

    expect(mockIncrement).not.toHaveBeenCalled()
  })

  it('un fallo del contador no rompe la respuesta al usuario', async () => {
    // incrementDailyCount es fail-silent por dentro; aquí se comprueba que aunque
    // rechazara, el usuario recibe su respuesta validada (nunca un 5xx por el cupo).
    mockIncrement.mockRejectedValue(new Error('BD caída'))
    mockValidateAndSave.mockResolvedValue({ ...RESPUESTA_BASE, success: true, saveAction: 'saved_new' })
    const { POST } = await import('@/app/api/v2/answer-and-save/route')

    const res = await POST(peticion())

    // El usuario recibe su respuesta con 200: el cobro del cupo nunca degrada el
    // resultado (ni excepción propagada ni 500).
    expect(res.status).toBe(200)
  })
})
