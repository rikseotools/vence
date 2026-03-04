/**
 * Tests para /api/exam/resume route
 * Verifica validación, auth y flujo de resume
 */

// Mock de módulos antes de imports
jest.mock('@/lib/api/exam', () => ({
  safeParseResumeExamRequest: jest.fn(),
  getResumedExamData: jest.fn(),
  verifyTestOwnership: jest.fn(),
}))

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        in: jest.fn(() => ({
          data: [
            {
              id: 'aaaa0001-0001-0001-0001-000000000001',
              question_text: 'P1',
              option_a: 'A', option_b: 'B', option_c: 'C', option_d: 'D',
              difficulty: 'medium',
              is_official_exam: false,
              primary_article_id: null,
              articles: null,
            },
          ],
          error: null,
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
    static json(data: unknown, init?: { status?: number }) {
      return new MockNextResponse(JSON.stringify(data), init)
    }
  }

  return { NextRequest: MockNextRequest, NextResponse: MockNextResponse }
})

import { GET } from '@/app/api/exam/resume/route'
import {
  safeParseResumeExamRequest,
  getResumedExamData,
  verifyTestOwnership,
} from '@/lib/api/exam'
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
    it('userId que no es owner retorna 403', async () => {
      ;(safeParseResumeExamRequest as jest.Mock).mockReturnValue({
        success: true,
        data: { testId: TEST_ID, userId: USER_ID },
      })
      ;(verifyTestOwnership as jest.Mock).mockResolvedValue(false)

      const res = await GET(createRequest({ testId: TEST_ID, userId: USER_ID }))
      const data = await res.json()

      expect(res.status).toBe(403)
      expect(data.success).toBe(false)
    })

    it('owner tiene acceso', async () => {
      ;(safeParseResumeExamRequest as jest.Mock).mockReturnValue({
        success: true,
        data: { testId: TEST_ID, userId: USER_ID },
      })
      ;(verifyTestOwnership as jest.Mock).mockResolvedValue(true)
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

      const res = await GET(createRequest({ testId: TEST_ID, userId: USER_ID }))
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
