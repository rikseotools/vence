/**
 * Tests del TRAZO anti-cosecha de /api/exam/validate (auditoría 27/07/2026).
 *
 * Qué fija este fichero:
 *   1. Toda llamada deja un `exam_validate_served` en observabilidad — antes,
 *      una llamada sin `testId` no escribía absolutamente nada.
 *   2. La forma se clasifica bien (orphan vs exam) sobre el payload REAL.
 *   3. La corrección alimenta el contador de servidas del gate ya existente,
 *      en vez de un contador nuevo en paralelo.
 *   4. GUARDARRAÍL CRÍTICO: si la observabilidad falla, el opositor recibe su
 *      nota igual. Este endpoint es por donde se entrega la calificación y ya
 *      tiene tres incidentes de puntuación a sus espaldas (exámenes fantasma,
 *      bug 30/40 del 08/06, caso Isabel 0 vs 62). El trazo no puede añadir un
 *      cuarto.
 */

const mockEmit = jest.fn().mockResolvedValue(undefined)
const mockRecordServed = jest.fn().mockResolvedValue([])
const mockGateSubjects = jest.fn(() => [{ key: 'sujeto', threshold: 500 }])
const mockCaptchaEnabled = jest.fn(() => true)
const mockVerifyAuthOptional = jest.fn().mockResolvedValue({ userId: 'user-1' })

jest.mock('@/lib/observability/emit', () => ({ emit: (...a: unknown[]) => mockEmit(...a) }))
jest.mock('@/lib/observability/sink', () => ({
  getSink: () => ({ emit: jest.fn().mockResolvedValue(undefined) }),
}))
jest.mock('@/lib/security/challengePolicy/questionsServed', () => ({
  gateSubjects: (...a: unknown[]) => mockGateSubjects(...a),
  recordServedForSubjects: (...a: unknown[]) => mockRecordServed(...a),
}))
jest.mock('@/lib/security/captcha', () => ({ isCaptchaEnabled: () => mockCaptchaEnabled() }))
jest.mock('@/lib/api/auth/verifyAuth', () => ({
  verifyAuthOptional: (...a: unknown[]) => mockVerifyAuthOptional(...a),
}))
jest.mock('@/lib/api/rateLimit', () => ({ getClientIp: () => '203.0.113.7' }))
jest.mock('@/lib/api/deviceLimit', () => ({ getDeviceIdFromRequest: () => 'device-abc' }))
jest.mock('@/lib/api/syntheticRequest', () => ({ isSyntheticRequest: () => false }))
jest.mock('@/lib/api/withErrorLogging', () => ({
  withErrorLogging: (_e: string, h: unknown) => h,
}))

// getDb().select().from().where() -> filas de `questions`
jest.mock('@/db/client', () => ({
  getDb: jest.fn(() => ({
    select: jest.fn(() => ({
      from: jest.fn(() => ({
        where: jest.fn().mockResolvedValue([
          { id: 'aaaa0001-0001-0001-0001-000000000001', correctOption: 0, explanation: 'exp1', questionText: 'P1', difficulty: 'medium', primaryArticleId: null },
          { id: 'aaaa0002-0002-0002-0002-000000000002', correctOption: 2, explanation: 'exp2', questionText: 'P2', difficulty: 'medium', primaryArticleId: null },
        ]),
      })),
    })),
  })),
}))

jest.mock('next/server', () => {
  class MockHeaders {
    private _h: Record<string, string> = {}
    constructor(init?: Record<string, string>) {
      if (init) for (const [k, v] of Object.entries(init)) this._h[k.toLowerCase()] = v
    }
    get(n: string) { return this._h[n.toLowerCase()] || null }
  }
  class MockNextRequest {
    url: string; method: string; headers: MockHeaders; private _body: unknown
    constructor(url: string, init?: { method?: string; headers?: Record<string, string>; body?: unknown }) {
      this.url = url
      this.method = init?.method || 'POST'
      this.headers = new MockHeaders(init?.headers)
      this._body = init?.body
    }
    async json() { return this._body }
  }
  class MockNextResponse {
    private _b: string; status: number
    constructor(b: string, init?: { status?: number }) { this._b = b; this.status = init?.status || 200 }
    async json() { return JSON.parse(this._b) }
    static json(d: unknown, init?: { status?: number }) { return new MockNextResponse(JSON.stringify(d), init) }
  }
  return { NextRequest: MockNextRequest, NextResponse: MockNextResponse, after: jest.fn() }
})

const Q1 = 'aaaa0001-0001-0001-0001-000000000001'
const Q2 = 'aaaa0002-0002-0002-0002-000000000002'

import { POST } from '@/app/api/exam/validate/route'
import { MAX_QUESTIONS_PER_REQUEST } from '@/lib/api/filtered-questions/schemas'
import type { NextRequest } from 'next/server'

function req(body: unknown): NextRequest {
  const { NextRequest: R } = jest.requireMock('next/server')
  return new R('https://www.vence.es/api/exam/validate', { method: 'POST', body }) as NextRequest
}

const lastEmit = () => mockEmit.mock.calls.at(-1)?.[0]

beforeEach(() => {
  jest.clearAllMocks()
  mockEmit.mockResolvedValue(undefined)
  mockCaptchaEnabled.mockReturnValue(true)
  mockVerifyAuthOptional.mockResolvedValue({ userId: 'user-1' })
})

describe('/api/exam/validate — trazo anti-cosecha', () => {
  it('una llamada SIN testId deja rastro y se marca orphan/warn', async () => {
    // Es la forma que antes no escribía nada en ninguna tabla.
    const res = await POST(req({ answers: [{ questionId: Q1, userAnswer: null }] }))
    expect(res.status).toBe(200)

    expect(mockEmit).toHaveBeenCalledTimes(1)
    const ev = lastEmit()
    expect(ev.eventType).toBe('exam_validate_served')
    expect(ev.endpoint).toBe('/api/exam/validate')
    expect(ev.severity).toBe('warn')
    expect(ev.metadata.shape).toBe('orphan')
    expect(ev.metadata.reasons).toEqual(expect.arrayContaining(['sin_test_id', 'lote_sin_respuestas']))
  })

  it('el rastro identifica al sujeto (usuario, IP y dispositivo)', async () => {
    await POST(req({ answers: [{ questionId: Q1, userAnswer: 'a' }] }))
    const ev = lastEmit()
    expect(ev.userId).toBe('user-1')
    expect(ev.metadata.ip).toBe('203.0.113.7')
    expect(ev.metadata.deviceId).toBe('device-abc')
    expect(ev.metadata.authenticated).toBe(true)
  })

  it('un examen normal se traza como info/exam (no genera ruido)', async () => {
    const res = await POST(req({
      testId: '11111111-1111-1111-1111-111111111111',
      answers: [{ questionId: Q1, userAnswer: 'a' }, { questionId: Q2, userAnswer: 'c' }],
    }))
    // Sin testId real en BD el flujo de persistencia puede degradar; lo que
    // fijamos aquí es la CLASIFICACIÓN, que ocurre antes de tocar nada.
    expect(res).toBeDefined()
    const ev = lastEmit()
    expect(ev.severity).toBe('info')
    expect(ev.metadata.shape).toBe('exam')
    expect(ev.metadata.batchSize).toBe(2)
    expect(ev.metadata.answeredCount).toBe(2)
    expect(ev.metadata.hasTestId).toBe(true)
  })

  it('alimenta el contador de servidas del gate que YA existe (no uno nuevo)', async () => {
    await POST(req({ answers: [{ questionId: Q1, userAnswer: 'a' }, { questionId: Q2, userAnswer: 'b' }] }))
    expect(mockGateSubjects).toHaveBeenCalledWith('user-1', 'device-abc', '203.0.113.7')
    expect(mockRecordServed).toHaveBeenCalledWith([{ key: 'sujeto', threshold: 500 }], 2)
  })

  // CAMBIO 27/07/2026: antes esto NO contabilizaba con el flag apagado. Pero
  // CAPTCHA_ENABLED es la palanca de rollback del reto al usuario; si además
  // apaga la medición, un rollback de captcha deja la detección ciega en
  // silencio. Detección y enforcement no comparten interruptor.
  it('sigue midiendo aunque la capa de captcha esté apagada', async () => {
    mockCaptchaEnabled.mockReturnValue(false)
    await POST(req({ answers: [{ questionId: Q1, userAnswer: 'a' }] }))
    expect(mockRecordServed).toHaveBeenCalledTimes(1)
    expect(mockEmit).toHaveBeenCalledTimes(1)
  })

  describe('tope de lote', () => {
    // Antes solo había .min(1): una petición podía pedir la corrección de
    // decenas de miles de preguntas de golpe.
    it('rechaza un lote por encima del máximo que el producto puede generar', async () => {
      const answers = Array.from({ length: MAX_QUESTIONS_PER_REQUEST + 1 }, () => ({
        questionId: Q1, userAnswer: null,
      }))
      const res = await POST(req({ answers }))
      expect(res.status).toBe(400)
    })

    // Sin esto, la petición MÁS agresiva era la peor trazada: solo quedaba un
    // `request_completed` de severidad info, que además el panel trata como benigno.
    it('el lote rechazado deja su propio evento en severidad error', async () => {
      const answers = Array.from({ length: MAX_QUESTIONS_PER_REQUEST + 1 }, () => ({
        questionId: Q1, userAnswer: null,
      }))
      await POST(req({ answers }))
      const ev = lastEmit()
      expect(ev.eventType).toBe('exam_validate_rejected')
      expect(ev.severity).toBe('error')
      expect(ev.metadata.batchSize).toBe(MAX_QUESTIONS_PER_REQUEST + 1)
      expect(ev.metadata.ip).toBe('203.0.113.7')
    })

    // Un rechazo no sirvió NINGUNA pregunta. Contarlas inflaría el denominador
    // del ratio respondidas/servidas y envenenaría al detector de cosecha.
    it('un lote rechazado NO cuenta como preguntas servidas', async () => {
      const answers = Array.from({ length: MAX_QUESTIONS_PER_REQUEST + 1 }, () => ({
        questionId: Q1, userAnswer: null,
      }))
      await POST(req({ answers }))
      expect(mockRecordServed).not.toHaveBeenCalled()
    })

    it('un payload basura también deja rastro, sin romperse al medirlo', async () => {
      await POST(req({ answers: 'esto no es un array' }))
      const ev = lastEmit()
      expect(ev.eventType).toBe('exam_validate_rejected')
      expect(ev.metadata.batchSize).toBe(0)
    })

    // LO IMPORTANTE: el tope no puede dejar sin nota a nadie. Va atado a la misma
    // constante que el límite de generación, así que un examen del tamaño máximo
    // generable DEBE corregirse.
    it('acepta un examen del tamaño máximo generable', async () => {
      const answers = Array.from({ length: MAX_QUESTIONS_PER_REQUEST }, () => ({
        questionId: Q1, userAnswer: 'a',
      }))
      const res = await POST(req({ answers }))
      expect(res.status).toBe(200)
      expect((await res.json()).success).toBe(true)
    })
  })

  // ── GUARDARRAÍL ─────────────────────────────────────────────────────────
  it('si la observabilidad PETA, el opositor recibe su corrección igualmente', async () => {
    mockEmit.mockRejectedValue(new Error('sink caído'))
    const res = await POST(req({ answers: [{ questionId: Q1, userAnswer: 'a' }] }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.results[0].correctAnswer).toBe('a')
  })

  it('si la observabilidad se CUELGA, la nota no se queda esperando', async () => {
    // El sink corta a 5s; el trazo se acota aparte a TRACE_BUDGET_MS (1,5s) para
    // que el peor caso en el camino de la nota esté acotado por nosotros y no
    // heredado. Con timers falsos: el emit nunca resuelve y aun así hay respuesta.
    jest.useFakeTimers()
    try {
      mockEmit.mockReturnValue(new Promise(() => { /* nunca resuelve */ }))
      const promesa = POST(req({ answers: [{ questionId: Q1, userAnswer: 'a' }] }))
      await jest.advanceTimersByTimeAsync(1_600)
      const res = await promesa
      expect(res.status).toBe(200)
      expect((await res.json()).success).toBe(true)
    } finally {
      jest.useRealTimers()
    }
  })

  it('si la resolución de identidad PETA, el rastro se emite igual (anónimo)', async () => {
    mockVerifyAuthOptional.mockRejectedValue(new Error('JWKS timeout'))
    const res = await POST(req({ answers: [{ questionId: Q1, userAnswer: 'a' }] }))
    expect(res.status).toBe(200)
    expect(mockEmit).toHaveBeenCalledTimes(1)
    expect(lastEmit().metadata.authenticated).toBe(false)
  })
})
