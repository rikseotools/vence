/**
 * Tests para /api/exam/resume route
 * Verifica validación, auth y flujo de resume
 */

// Mock de módulos antes de imports
jest.mock('@/lib/api/exam', () => ({
  safeParseResumeExamRequest: jest.fn(),
  getResumedExamData: jest.fn(),
  getTestOwnerId: jest.fn(),
}))

// [T-565]: la propiedad se comprueba con `requireDuenoDelRecurso` (dueño real de BD,
// vía `getTestOwnerId` arriba, contra la identidad del TOKEN — nunca contra un userId
// que mande el cliente). Se mockea para controlar el veredicto por test.
jest.mock('@/lib/api/shared/auth', () => ({
  requireDuenoDelRecurso: jest.fn(),
}))

// El route fue migrado a Drizzle: getAdminDb().select({...}).from(questions)
//   .leftJoin(articles).leftJoin(laws).where(inArray(ids)) -> filas planas.
// La fila trae art_*/law_* aplanados (art_id=null -> articles:null al mapear).
jest.mock('@/db/client', () => ({
  getAdminDb: jest.fn(() => ({
    select: jest.fn(() => ({
      from: jest.fn(() => ({
        leftJoin: jest.fn(() => ({
          leftJoin: jest.fn(() => ({
            where: jest.fn().mockResolvedValue([
              {
                id: 'aaaa0001-0001-0001-0001-000000000001',
                question_text: 'P1',
                option_a: 'A', option_b: 'B', option_c: 'C', option_d: 'D',
                difficulty: 'medium',
                is_official_exam: false,
                primary_article_id: null,
                image_url: null,
                content_data: null,
                art_id: null, art_number: null, art_title: null, art_content: null,
                law_short_name: null, law_name: null,
              },
            ]),
          })),
        })),
      })),
    })),
  })),
}))

// Mock next/server
jest.mock('next/server', () => {
  class MockHeaders {
    private _headers: Record<string, string> = {}
    constructor(init?: Record<string, string>) {
      if (init) {
        for (const [k, v] of Object.entries(init)) this._headers[k.toLowerCase()] = v
      }
    }
    get(name: string) { return this._headers[name.toLowerCase()] || null }
  }

  class MockNextRequest {
    url: string
    method: string
    headers: MockHeaders
    constructor(url: string, init?: { method?: string; headers?: Record<string, string> }) {
      this.url = url
      this.method = init?.method || 'GET'
      this.headers = new MockHeaders(init?.headers)
    }
  }

  class MockNextResponse {
    private _body: string
    status: number
    headers: MockHeaders
    constructor(body: string, init?: { status?: number }) {
      this._body = body
      this.status = init?.status || 200
      this.headers = new MockHeaders({ 'content-type': 'application/json' })
    }
    async json() { return JSON.parse(this._body) }
    clone() { return new MockNextResponse(this._body, { status: this.status }) }
    static json(data: unknown, init?: { status?: number }) {
      return new MockNextResponse(JSON.stringify(data), init)
    }
  }

  return { NextRequest: MockNextRequest, NextResponse: MockNextResponse, after: jest.fn() }
})

import { GET } from '@/app/api/exam/resume/route'
import {
  safeParseResumeExamRequest,
  getResumedExamData,
  getTestOwnerId,
} from '@/lib/api/exam'
import { requireDuenoDelRecurso } from '@/lib/api/shared/auth'
import type { NextRequest } from 'next/server'

const TEST_ID = '11111111-1111-1111-1111-111111111111'
const USER_ID = '22222222-2222-2222-2222-222222222222'
const Q1_ID = 'aaaa0001-0001-0001-0001-000000000001'

function createRequest(params: Record<string, string>): NextRequest {
  const url = new URL('http://localhost/api/exam/resume')
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v)
  }
  const { NextRequest: MockNextRequest } = jest.requireMock('next/server')
  return new MockNextRequest(url.toString()) as unknown as NextRequest
}

describe('/api/exam/resume', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Por defecto, dueño → identidad ok. Los tests de Auth lo sobrescriben.
    ;(getTestOwnerId as jest.Mock).mockResolvedValue(null)
    ;(requireDuenoDelRecurso as jest.Mock).mockResolvedValue({ ok: true, callerUserId: null })
  })

  describe('Validación', () => {
    it('sin testId retorna 400', async () => {
      ;(safeParseResumeExamRequest as jest.Mock).mockReturnValue({
        success: false,
        error: { issues: [{ message: 'ID de test inválido' }] },
      })

      const res = await GET(createRequest({}))
      const data = await res.json()

      expect(res.status).toBe(400)
      expect(data.success).toBe(false)
    })

    it('UUID inválido retorna 400', async () => {
      ;(safeParseResumeExamRequest as jest.Mock).mockReturnValue({
        success: false,
        error: { issues: [{ message: 'ID de test inválido' }] },
      })

      const res = await GET(createRequest({ testId: 'not-a-uuid' }))
      const data = await res.json()

      expect(res.status).toBe(400)
      expect(data.success).toBe(false)
    })

    it('UUID válido continúa procesando', async () => {
      ;(safeParseResumeExamRequest as jest.Mock).mockReturnValue({
        success: true,
        data: { testId: TEST_ID },
      })
      ;(getResumedExamData as jest.Mock).mockResolvedValue({
        success: true,
        testId: TEST_ID,
        temaNumber: 1,
        totalQuestions: 1,
        answeredCount: 0,
        questions: [
          { questionOrder: 1, questionId: Q1_ID, userAnswer: null, correctAnswer: '', questionText: '' },
        ],
      })

      const res = await GET(createRequest({ testId: TEST_ID }))
      const data = await res.json()

      expect(data.success).toBe(true)
    })
  })

  describe('Auth', () => {
    it('quien no es el dueño del test recibe 403', async () => {
      ;(safeParseResumeExamRequest as jest.Mock).mockReturnValue({
        success: true,
        data: { testId: TEST_ID },
      })
      ;(getTestOwnerId as jest.Mock).mockResolvedValue(USER_ID)
      ;(requireDuenoDelRecurso as jest.Mock).mockResolvedValue({
        ok: false,
        response: { status: 403, json: async () => ({ success: false, error: 'No tienes acceso a este recurso' }) },
      })

      const res = await GET(createRequest({ testId: TEST_ID }))
      const data = await res.json()

      expect(res.status).toBe(403)
      expect(data.success).toBe(false)
    })

    // [T-565] — regresión del agujero real: hasta el arreglo, `resume` solo comprobaba
    // propiedad si la QUERY traía `userId`, y su único llamante real (TestExamenPage)
    // nunca lo manda — la comprobación no corría NUNCA en producción. Aquí se simula
    // exactamente eso: sin userId en la query, con un test que SÍ tiene dueño real, y
    // `requireDuenoDelRecurso` (que ya no depende de la query) sigue cortando.
    it('sin userId en la query, un test con dueño sigue exigiendo identidad', async () => {
      ;(safeParseResumeExamRequest as jest.Mock).mockReturnValue({
        success: true,
        data: { testId: TEST_ID },
      })
      ;(getTestOwnerId as jest.Mock).mockResolvedValue(USER_ID)
      ;(requireDuenoDelRecurso as jest.Mock).mockResolvedValue({
        ok: false,
        response: { status: 403, json: async () => ({ success: false, error: 'No tienes acceso a este recurso' }) },
      })

      const res = await GET(createRequest({ testId: TEST_ID }))

      expect(res.status).toBe(403)
      expect(getTestOwnerId).toHaveBeenCalledWith(TEST_ID)
      expect(requireDuenoDelRecurso).toHaveBeenCalledWith(expect.anything(), '/api/exam/resume', USER_ID)
    })

    it('el dueño tiene acceso', async () => {
      ;(safeParseResumeExamRequest as jest.Mock).mockReturnValue({
        success: true,
        data: { testId: TEST_ID },
      })
      ;(getTestOwnerId as jest.Mock).mockResolvedValue(USER_ID)
      ;(requireDuenoDelRecurso as jest.Mock).mockResolvedValue({ ok: true, callerUserId: USER_ID })
      ;(getResumedExamData as jest.Mock).mockResolvedValue({
        success: true,
        testId: TEST_ID,
        temaNumber: 1,
        totalQuestions: 1,
        answeredCount: 0,
        questions: [
          { questionOrder: 1, questionId: Q1_ID, userAnswer: null, correctAnswer: '', questionText: '' },
        ],
      })

      const res = await GET(createRequest({ testId: TEST_ID }))
      const data = await res.json()

      expect(data.success).toBe(true)
    })

    it('un examen anónimo (sin dueño) se puede reanudar sin sesión', async () => {
      ;(safeParseResumeExamRequest as jest.Mock).mockReturnValue({
        success: true,
        data: { testId: TEST_ID },
      })
      ;(getTestOwnerId as jest.Mock).mockResolvedValue(null)
      ;(requireDuenoDelRecurso as jest.Mock).mockResolvedValue({ ok: true, callerUserId: null })
      ;(getResumedExamData as jest.Mock).mockResolvedValue({
        success: true,
        testId: TEST_ID,
        temaNumber: 1,
        totalQuestions: 1,
        answeredCount: 0,
        questions: [
          { questionOrder: 1, questionId: Q1_ID, userAnswer: null, correctAnswer: '', questionText: '' },
        ],
      })

      const res = await GET(createRequest({ testId: TEST_ID }))
      const data = await res.json()

      expect(data.success).toBe(true)
    })
  })

  describe('Flujo', () => {
    it('resume con respuestas parciales incluye savedAnswers', async () => {
      ;(safeParseResumeExamRequest as jest.Mock).mockReturnValue({
        success: true,
        data: { testId: TEST_ID },
      })
      ;(getResumedExamData as jest.Mock).mockResolvedValue({
        success: true,
        testId: TEST_ID,
        temaNumber: 1,
        totalQuestions: 1,
        answeredCount: 1,
        questions: [
          { questionOrder: 1, questionId: Q1_ID, userAnswer: 'b', correctAnswer: 'b', questionText: 'P1' },
        ],
      })

      const res = await GET(createRequest({ testId: TEST_ID }))
      const data = await res.json()

      expect(data.success).toBe(true)
      expect(data.savedAnswers).toBeDefined()
      expect(data.savedAnswers['0']).toBe('b')
    })

    it('resume sin respuestas devuelve savedAnswers vacío', async () => {
      ;(safeParseResumeExamRequest as jest.Mock).mockReturnValue({
        success: true,
        data: { testId: TEST_ID },
      })
      ;(getResumedExamData as jest.Mock).mockResolvedValue({
        success: true,
        testId: TEST_ID,
        temaNumber: 1,
        totalQuestions: 1,
        answeredCount: 0,
        questions: [
          { questionOrder: 1, questionId: Q1_ID, userAnswer: null, correctAnswer: '', questionText: '' },
        ],
      })

      const res = await GET(createRequest({ testId: TEST_ID }))
      const data = await res.json()

      expect(data.success).toBe(true)
      expect(Object.keys(data.savedAnswers)).toHaveLength(0)
    })

    it('examen completado retorna error', async () => {
      ;(safeParseResumeExamRequest as jest.Mock).mockReturnValue({
        success: true,
        data: { testId: TEST_ID },
      })
      ;(getResumedExamData as jest.Mock).mockResolvedValue({
        success: false,
        error: 'Este examen ya está completado',
      })

      const res = await GET(createRequest({ testId: TEST_ID }))
      const data = await res.json()

      expect(res.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error).toContain('completado')
    })
  })
})
