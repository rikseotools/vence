/**
 * Tests del proxy condicional al backend NestJS (Bloque 3 KEYSTONE).
 *
 * @jest-environment node
 */

// Mock next/server.after — en tests Jest no hay "request scope" del runtime
// Next.js, así que ejecutamos el callback sin async tracking.
jest.mock('next/server', () => {
  const actual = jest.requireActual('next/server')
  return {
    ...actual,
    after: jest.fn((fn) => {
      try {
        const result = fn()
        if (result instanceof Promise) result.catch(() => {})
      } catch {
        // ignorar — el path local del Vercel SÍ usa after() y nosotros no
        // queremos que tirar ahí afecte al test del proxy
      }
    }),
  }
})

jest.mock('../../../../lib/api/v2/answer-and-save', () => ({
  safeParseAnswerAndSaveRequest: jest.fn(),
  validateAndSaveAnswer: jest.fn(),
  markActiveStudentIfFirst: jest.fn(),
}))

jest.mock('../../../../lib/db/timeout', () => ({
  withDbTimeout: jest.fn((fn) => fn()),
  isDbTimeoutError: jest.fn(() => false),
}))

// [T-635] Sin mockear, `emit()` intenta un INSERT real contra `getAdminDb()` — resiliente (nunca
// tira, ver sink.ts), pero deja una conexión pg abierta que Jest se queja de no poder cerrar
// ("did not exit one second after..."). Mockearlo aquí también es lo que permite comprobar POR
// VALOR qué se emite en el momento exacto del abort/fallo del proxy.
const mockEmit = jest.fn().mockResolvedValue(undefined)
jest.mock('../../../../lib/observability/emit', () => ({
  emit: (...args: unknown[]) => mockEmit(...args),
  // [T-735] `emitFireAndForget` lo estrenó T-312 en esta MISMA ruta (desglose de fases
  // auth+antifraude) mientras T-635 vivía en su rama. Cada una pasaba sus tests por separado;
  // al juntarlas, el mock parcial dejaba la función sin definir y la ruta moría con un
  // TypeError que el catch traducía a 500 — el test de presupuesto veía un 500 donde esperaba
  // un 200 y parecía que el arreglo de T-635 no funcionaba. Un mock de módulo tiene que
  // declarar TODO lo que la ruta importe, o envejece en cuanto otra rama toca el fichero.
  emitFireAndForget: (...args: unknown[]) => mockEmit(...args),
}))

jest.mock('../../../../lib/api/dailyLimit', () => ({
  getDailyLimitStatus: jest.fn().mockResolvedValue({
    allowed: true,
    questionsToday: 0,
    questionsRemaining: 25,
    dailyLimit: 25,
    isPremium: false,
    isGraduated: false,
    tierLabel: null,
  }),
  // Desde el 29/07/2026 el route cobra el cupo tras guardar (T-260). Se usa la
  // política REAL — es una función pura y mockearla ocultaría el contrato.
  debeConsumirCupo: jest.requireActual('../../../../lib/api/dailyLimit').debeConsumirCupo,
  incrementDailyCount: jest.fn().mockResolvedValue(undefined),
  checkDeviceDailyUsage: jest.fn().mockResolvedValue({ allowed: true, deviceTotal: 0 }),
}))

jest.mock('../../../../lib/api/deviceLimit', () => ({
  registerAndCheckDevice: jest.fn().mockResolvedValue({
    allowed: true,
    deviceCount: 1,
    maxDevices: 2,
    isNewDevice: false,
    isPremium: false,
    existingDevices: '',
  }),
  getDeviceIdFromRequest: jest.fn(() => 'device-test'),
  getHwFingerprintFromRequest: jest.fn(() => 'fp-test'),
}))

jest.mock('../../../../lib/api/auth/verifyAuth', () => ({
  verifyAuth: jest.fn().mockResolvedValue({
    success: true,
    userId: '3260627f-2018-4a5e-8234-e6f07015abb9',
    email: 'test@example.com',
  }),
}))

const mockShouldRoute = jest.fn()
jest.mock('../../../../lib/api/backend-router', () => ({
  shouldRouteToBackend: (...args: unknown[]) => mockShouldRoute(...args),
  backendUrlFor: (path: string) =>
    `https://api.vence.es/${path.replace(/^\/+/, '')}`,
}))

import { POST } from '../../../../app/api/v2/answer-and-save/route'
import { safeParseAnswerAndSaveRequest, validateAndSaveAnswer } from '../../../../lib/api/v2/answer-and-save'
import { NextRequest } from 'next/server'

const USER_ID = '3260627f-2018-4a5e-8234-e6f07015abb9'
const QUESTION_ID = '11111111-1111-1111-1111-111111111111'
const SESSION_ID = '22222222-2222-2222-2222-222222222222'

const VALID_BODY = {
  questionId: QUESTION_ID,
  userAnswer: 1,
  sessionId: SESSION_ID,
  questionIndex: 0,
  questionText: 'test',
  options: ['a', 'b', 'c', 'd'],
  tema: 1,
  currentScore: 0,
}

function makeReq(body: unknown = VALID_BODY): NextRequest {
  return new NextRequest('http://localhost/api/v2/answer-and-save', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json',
      authorization: 'Bearer fake-token',
      'x-device-id': 'device-test-abc',
      'x-hw-fingerprint': 'fp-xyz',
      'user-agent': 'Mozilla/5.0 Chrome/120',
    },
  })
}

describe('POST /api/v2/answer-and-save — proxy canary al backend', () => {
  let fetchSpy: jest.SpyInstance

  beforeEach(() => {
    jest.clearAllMocks()
    ;(safeParseAnswerAndSaveRequest as jest.Mock).mockReturnValue({
      success: true,
      data: VALID_BODY,
    })
    ;(validateAndSaveAnswer as jest.Mock).mockResolvedValue({
      success: true,
      isCorrect: true,
      correctAnswer: 1,
      newScore: 1,
      saveAction: 'saved_new',
    })
    fetchSpy = jest.spyOn(global, 'fetch')
  })

  afterEach(() => {
    fetchSpy.mockRestore()
  })

  describe('flag OFF (estado inicial)', () => {
    beforeEach(() => {
      mockShouldRoute.mockReturnValue(false)
    })

    it('NO llama al backend canary — ejecuta path Vercel local', async () => {
      const res = await POST(makeReq())
      expect(fetchSpy).not.toHaveBeenCalled()
      expect(validateAndSaveAnswer).toHaveBeenCalledWith(VALID_BODY, USER_ID)
      expect(res.status).toBe(200)
    })
  })

  describe('flag ON (canary activo)', () => {
    beforeEach(() => {
      mockShouldRoute.mockReturnValue(true)
    })

    it('proxiea al backend con body, reenvía headers críticos, devuelve response tal cual', async () => {
      const backendBody = JSON.stringify({
        success: true,
        isCorrect: true,
        correctAnswer: 1,
        newScore: 1,
        saveAction: 'saved_new',
      })
      fetchSpy.mockResolvedValue(
        new Response(backendBody, {
          status: 200,
          headers: {
            'content-type': 'application/json',
            'x-served-by': 'vence-backend',
          },
        }),
      )

      const res = await POST(makeReq())

      expect(fetchSpy).toHaveBeenCalledTimes(1)
      const [url, opts] = fetchSpy.mock.calls[0]
      expect(url).toBe('https://api.vence.es/api/v2/answer-and-save')
      expect(opts.method).toBe('POST')
      // Body reenviado
      expect(opts.body).toBe(JSON.stringify(VALID_BODY))
      // Headers críticos reenviados
      expect(opts.headers.authorization).toBe('Bearer fake-token')
      expect(opts.headers['x-device-id']).toBe('device-test-abc')
      expect(opts.headers['x-hw-fingerprint']).toBe('fp-xyz')
      expect(opts.headers['user-agent']).toBe('Mozilla/5.0 Chrome/120')

      expect(res.status).toBe(200)
      expect(res.headers.get('x-served-by')).toBe('vence-backend')
      // No tocó path local (proxy OK)
      expect(validateAndSaveAnswer).not.toHaveBeenCalled()
    })

    it('proxiea status non-200 (403 forbidden) tal cual', async () => {
      fetchSpy.mockResolvedValue(
        new Response(
          JSON.stringify({
            success: false,
            error: 'Device limit',
            deviceLimitReached: true,
          }),
          { status: 403, headers: { 'content-type': 'application/json' } },
        ),
      )

      const res = await POST(makeReq())
      expect(res.status).toBe(403)
      expect(validateAndSaveAnswer).not.toHaveBeenCalled()
    })

    it('proxiea 503 + reenvía Retry-After header', async () => {
      fetchSpy.mockResolvedValue(
        new Response(
          JSON.stringify({ success: false, error: 'saturado' }),
          {
            status: 503,
            headers: {
              'content-type': 'application/json',
              'retry-after': '300',
            },
          },
        ),
      )

      const res = await POST(makeReq())
      expect(res.status).toBe(503)
      expect(res.headers.get('Retry-After')).toBe('300')
    })

    it('si backend falla (ECONNREFUSED) → fallback graceful al path Vercel local', async () => {
      fetchSpy.mockRejectedValue(new Error('ECONNREFUSED'))

      const res = await POST(makeReq())

      expect(fetchSpy).toHaveBeenCalledTimes(1)
      // Path local ejecutado como fallback
      expect(validateAndSaveAnswer).toHaveBeenCalledWith(VALID_BODY, USER_ID)
      expect(res.status).toBe(200)
    })

    // [T-635] El rastro que faltaba: antes de este fix, un fallo del proxy solo dejaba un
    // console.warn — invisible si el fallback que sigue se lleva por delante el maxDuration=30
    // del endpoint (Vercel mata la función sin lanzar ninguna excepción de JS que capturar).
    it('[T-635] un fallo de red del proxy deja rastro en observable_events ANTES de intentar el fallback', async () => {
      fetchSpy.mockRejectedValue(new Error('ECONNREFUSED'))

      await POST(makeReq())

      expect(mockEmit).toHaveBeenCalledWith(
        expect.objectContaining({
          source: 'vercel',
          severity: 'warn',
          eventType: 'answer_save_backend_proxy_fallback',
          endpoint: '/api/v2/answer-and-save',
          userId: USER_ID,
          errorMessage: 'ECONNREFUSED',
          metadata: { motivo: 'network_error' },
        }),
      )
    })

    it('[T-635] un abort por timeout se distingue del resto de errores de red (motivo: timeout_abort_25s)', async () => {
      const abortError = new Error('The operation was aborted')
      abortError.name = 'AbortError'
      fetchSpy.mockRejectedValue(abortError)

      await POST(makeReq())

      expect(mockEmit).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'answer_save_backend_proxy_fallback',
          metadata: { motivo: 'timeout_abort_25s' },
        }),
      )
    })

    it('[T-635] si el proxy ya consumió casi todo el presupuesto, el fallback local NO recibe otros 25s completos', async () => {
      // Simula que el intento al backend tardó 24.5s antes de fallar: cuando el fallback llega
      // al primer withDbTimeout (antifraude), presupuestoRestanteMs() tiene que reflejarlo — si
      // en vez de eso se le siguen dando los 25000ms completos de ANTIFRAUD_TIMEOUT_MS, la suma
      // (24500 + 25000) vuelve a superar el maxDuration=30 y reproduce el fallo que esto arregla.
      let now = Date.now()
      const nowSpy = jest.spyOn(Date, 'now').mockImplementation(() => now)
      fetchSpy.mockImplementation(async () => {
        now += 24500
        throw new Error('ECONNREFUSED')
      })

      const { withDbTimeout } = require('../../../../lib/db/timeout')
      const res = await POST(makeReq())

      expect(res.status).toBe(200)
      expect((withDbTimeout as jest.Mock).mock.calls.length).toBeGreaterThanOrEqual(1)
      const [, primerTimeoutMs] = (withDbTimeout as jest.Mock).mock.calls[0]
      // Muy por debajo del ANTIFRAUD_TIMEOUT_MS de 25000 sin recortar.
      expect(primerTimeoutMs).toBeLessThan(10000)
      // Y nunca 0 ni negativo: withDbTimeout(fn, 0) no tiene sentido — que corte
      // cuanto antes, no que no llegue a intentarlo.
      expect(primerTimeoutMs).toBeGreaterThanOrEqual(1000)

      nowSpy.mockRestore()
    })

    it('[T-635] presupuestoRestanteMs() nunca baja de 1000ms aunque se haya agotado todo el margen', async () => {
      let now = Date.now()
      const nowSpy = jest.spyOn(Date, 'now').mockImplementation(() => now)
      fetchSpy.mockImplementation(async () => {
        now += 30000 // más que SAFE_TOTAL_BUDGET_MS entero
        throw new Error('ECONNREFUSED')
      })

      const { withDbTimeout } = require('../../../../lib/db/timeout')
      await POST(makeReq())

      const [, primerTimeoutMs] = (withDbTimeout as jest.Mock).mock.calls[0]
      expect(primerTimeoutMs).toBe(1000)

      nowSpy.mockRestore()
    })
  })

  describe('validación pre-proxy', () => {
    it('si body inválido (Zod fail), devuelve 400 ANTES de tocar backend', async () => {
      mockShouldRoute.mockReturnValue(true)
      ;(safeParseAnswerAndSaveRequest as jest.Mock).mockReturnValue({
        success: false,
        error: {
          issues: [{ path: ['questionId'], message: 'Required' }],
        },
      })

      const res = await POST(makeReq({}))

      expect(res.status).toBe(400)
      expect(fetchSpy).not.toHaveBeenCalled()
      expect(validateAndSaveAnswer).not.toHaveBeenCalled()
    })
  })
})
