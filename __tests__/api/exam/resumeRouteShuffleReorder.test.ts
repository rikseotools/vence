/**
 * __tests__/api/exam/resumeRouteShuffleReorder.test.ts — T-277
 *
 * Ejercita el ROUTE real (app/api/exam/resume/route.ts) para comprobar que, cuando
 * `getResumedExamData` devuelve `optionOrders` (el orden grabado al SERVIR el examen),
 * el route reconstruye `option_a..d` en ESE orden — no en el natural de la BD — y traduce
 * `savedAnswers` de coordenadas ORIGINALES (como vive en test_questions) a MOSTRADAS.
 *
 * Mismo patrón de mock que __tests__/api/exam/resumeRoute.test.ts (mismo route): la BD
 * devuelve la pregunta en orden NATURAL fijo (A,B,C,D) y `getResumedExamData` se mockea
 * directamente — así el test es sobre el ROUTE, no reimplementa `getResumedExamData`.
 */
jest.mock('@/lib/api/exam', () => ({
  safeParseResumeExamRequest: jest.fn(),
  getResumedExamData: jest.fn(),
  verifyTestOwnership: jest.fn(),
  getTestOwnerId: jest.fn(),
}))

// [T-565] La ruta comprueba la propiedad con `requireDuenoDelRecurso` (dueño real de BD contra la
// identidad del TOKEN, nunca contra un userId que mande el cliente). Este test es de T-277 y es
// ANTERIOR a esa comprobación, así que no la simulaba y la ruta devolvía «no eres el dueño» antes
// de llegar al reordenado — se vio al MERGEAR las dos, no en ninguna de las dos por separado.
// Mismo mock que el fichero hermano `resumeRoute.test.ts`, que ejercita esta misma ruta.
jest.mock('@/lib/api/shared/auth', () => ({
  requireDuenoDelRecurso: jest.fn(),
}))

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
                // Orden NATURAL en BD: A, B, C, D
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

jest.mock('next/server', () => {
  class MockHeaders {
    private _headers: Record<string, string> = {}
    get(name: string) { return this._headers[name.toLowerCase()] || null }
  }
  class MockNextRequest {
    url: string
    constructor(url: string) { this.url = url }
  }
  class MockNextResponse {
    private _body: string
    status: number
    headers = new MockHeaders()
    constructor(body: string, init?: { status?: number }) {
      this._body = body
      this.status = init?.status ?? 200
    }
    async json() { return JSON.parse(this._body) }
    static json(data: unknown, init?: { status?: number }) {
      return new MockNextResponse(JSON.stringify(data), init)
    }
  }
  return { NextRequest: MockNextRequest, NextResponse: MockNextResponse }
})

jest.mock('@/lib/api/withErrorLogging', () => ({
  withErrorLogging: (_name: string, handler: (...a: unknown[]) => unknown) => handler,
}))

import { GET } from '@/app/api/exam/resume/route'
import { safeParseResumeExamRequest, getResumedExamData, getTestOwnerId } from '@/lib/api/exam'
import { requireDuenoDelRecurso } from '@/lib/api/shared/auth'
import type { NextRequest } from 'next/server'

const TEST_ID = '11111111-1111-1111-1111-111111111111'
const Q1_ID = 'aaaa0001-0001-0001-0001-000000000001'

function createRequest(params: Record<string, string>): NextRequest {
  const url = new URL('http://localhost/api/exam/resume')
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const { NextRequest: MockNextRequest } = jest.requireMock('next/server')
  return new MockNextRequest(url.toString()) as unknown as NextRequest
}

beforeEach(() => {
  jest.clearAllMocks()
  ;(safeParseResumeExamRequest as jest.Mock).mockReturnValue({ success: true, data: { testId: TEST_ID } })
  // El dueño legítimo reanuda SU examen: es el único caso que estos tests describen. Lo que
  // comprueban es el reordenado, no la propiedad — esa tiene sus propios tests en [T-565].
  ;(getTestOwnerId as jest.Mock).mockResolvedValue('user-1')
  ;(requireDuenoDelRecurso as jest.Mock).mockResolvedValue({ ok: true, callerUserId: 'user-1' })
})

describe('/api/exam/resume — reconstruye el orden BARAJADO al reanudar (T-277)', () => {
  it('reordena option_a..d según optionOrders, y traduce savedAnswers de original a mostrada', async () => {
    // order=[2,0,1,3]: BD natural A,B,C,D → mostrado: posición0=C, posición1=A, posición2=B, posición3=D
    ;(getResumedExamData as jest.Mock).mockResolvedValue({
      success: true,
      testId: TEST_ID,
      temaNumber: 1,
      totalQuestions: 1,
      answeredCount: 1,
      questions: [
        // userAnswer='a' en BD = coordenadas ORIGINALES = la opción A del banco
        { questionOrder: 1, questionId: Q1_ID, userAnswer: 'a', correctAnswer: 'a', questionText: 'P1' },
      ],
      optionOrders: { [Q1_ID]: [2, 0, 1, 3] },
    })

    const res = await GET(createRequest({ testId: TEST_ID }))
    const data = await res.json()

    expect(data.success).toBe(true)
    // Reordenado: posición0=C(orig 2), posición1=A(orig 0), posición2=B(orig 1), posición3=D(orig 3)
    expect(data.questions[0].option_a).toBe('C')
    expect(data.questions[0].option_b).toBe('A')
    expect(data.questions[0].option_c).toBe('B')
    expect(data.questions[0].option_d).toBe('D')
    // La opción original 'A' (índice 0) ahora está en la posición 1 → savedAnswers debe decir 'b'
    expect(data.savedAnswers['0']).toBe('b')
  })

  it('pregunta SIN orden en el mapa (no se barajó): sirve natural y savedAnswers sin traducir — cero regresión', async () => {
    ;(getResumedExamData as jest.Mock).mockResolvedValue({
      success: true,
      testId: TEST_ID,
      temaNumber: 1,
      totalQuestions: 1,
      answeredCount: 1,
      questions: [
        { questionOrder: 1, questionId: Q1_ID, userAnswer: 'b', correctAnswer: 'b', questionText: 'P1' },
      ],
      // sin optionOrders en absoluto (examen histórico / sin shuffle)
    })

    const res = await GET(createRequest({ testId: TEST_ID }))
    const data = await res.json()

    expect(data.questions[0].option_a).toBe('A')
    expect(data.questions[0].option_b).toBe('B')
    expect(data.questions[0].option_c).toBe('C')
    expect(data.questions[0].option_d).toBe('D')
    expect(data.savedAnswers['0']).toBe('b')
  })

  it('un examen REANUDADO DOS VECES ve el MISMO orden las dos veces (no se regenera)', async () => {
    const mockedData = {
      success: true,
      testId: TEST_ID,
      temaNumber: 1,
      totalQuestions: 1,
      answeredCount: 0,
      questions: [
        { questionOrder: 1, questionId: Q1_ID, userAnswer: null, correctAnswer: 'a', questionText: 'P1' },
      ],
      optionOrders: { [Q1_ID]: [3, 1, 2, 0] },
    }
    ;(getResumedExamData as jest.Mock).mockResolvedValue(mockedData)

    const res1 = await GET(createRequest({ testId: TEST_ID }))
    const data1 = await res1.json()
    const res2 = await GET(createRequest({ testId: TEST_ID }))
    const data2 = await res2.json()

    expect(data1.questions[0]).toEqual(data2.questions[0])
  })
})
