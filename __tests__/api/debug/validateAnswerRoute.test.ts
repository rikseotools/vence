/**
 * Tests del endpoint /api/debug/validate-answer/[id].
 *
 * Sustituye al deprecado /api/answer al que llamaba la página /debug/question/[id]
 * y devolvía 404, dejando "No hay explicación disponible".
 *
 * Verificamos:
 *  - Acepta userAnswer numérico (0..4) y letra (A..E).
 *  - Devuelve isCorrect comparando con questions.correct_option.
 *  - Devuelve la explanation actualizada de BD.
 *  - 400 si userAnswer falta / es inválido.
 *  - 404 si la pregunta no existe ni en questions ni en psychometric_questions.
 */

// Mock next/server
jest.mock('next/server', () => {
  class MockNextResponse {
    private _body: string
    status: number
    constructor(body: string, init?: { status?: number }) {
      this._body = body
      this.status = init?.status ?? 200
    }
    async json() {
      return JSON.parse(this._body)
    }
    static json(data: unknown, init?: { status?: number }) {
      return new MockNextResponse(JSON.stringify(data), init)
    }
  }
  return { NextResponse: MockNextResponse }
})

// Mock drizzle DB con factory parametrizable
const dbState: {
  legislativeRow: { correctOption: number; explanation: string } | null
  psychometricRow: { correctOption: number; explanation: string } | null
} = {
  legislativeRow: null,
  psychometricRow: null,
}

jest.mock('@/db/client', () => ({
  getDb: jest.fn(() => {
    let table = 'unknown'
    const chain = {
      select: jest.fn(() => chain),
      from: jest.fn((t: { _: { name?: string } } | string) => {
        // Drizzle pasa el objeto de la tabla; identificamos por nombre interno
        if (typeof t === 'object' && t && '_' in t && t._.name) {
          table = String(t._.name)
        } else if (typeof t === 'string') {
          table = t
        }
        return chain
      }),
      where: jest.fn(() => chain),
      limit: jest.fn(async () => {
        if (table === 'questions' && dbState.legislativeRow) {
          return [dbState.legislativeRow]
        }
        if (table === 'psychometric_questions' && dbState.psychometricRow) {
          return [dbState.psychometricRow]
        }
        return []
      }),
    }
    return chain
  }),
}))

jest.mock('@/db/schema', () => {
  const tableMarker = (name: string) => ({ _: { name } })
  return {
    questions: {
      ...tableMarker('questions'),
      id: 'questions.id',
      correctOption: 'questions.correctOption',
      explanation: 'questions.explanation',
    },
    psychometricQuestions: {
      ...tableMarker('psychometric_questions'),
      id: 'psychometric_questions.id',
      correctOption: 'psychometric_questions.correctOption',
      explanation: 'psychometric_questions.explanation',
    },
  }
})

jest.mock('drizzle-orm', () => ({
  eq: jest.fn(),
}))

jest.mock('@/lib/api/withErrorLogging', () => ({
  withErrorLogging: (_route: string, fn: unknown) => fn,
}))

import { POST } from '@/app/api/debug/validate-answer/[id]/route'

const QID = '07a87599-ffe5-4462-920e-dd4ef9b0ef3c'

function makeReq(body: unknown): Request {
  return {
    json: async () => body,
  } as unknown as Request
}

beforeEach(() => {
  dbState.legislativeRow = null
  dbState.psychometricRow = null
})

describe('/api/debug/validate-answer/[id]', () => {
  test('400 si userAnswer falta', async () => {
    const res = await POST(makeReq({}), { params: Promise.resolve({ id: QID }) })
    const data = await res.json()
    expect(res.status).toBe(400)
    expect(data.success).toBe(false)
  })

  test('400 si userAnswer es string no-letra', async () => {
    const res = await POST(makeReq({ userAnswer: 'foo' }), {
      params: Promise.resolve({ id: QID }),
    })
    expect(res.status).toBe(400)
  })

  test('400 si userAnswer es número fuera de rango', async () => {
    const res = await POST(makeReq({ userAnswer: 99 }), {
      params: Promise.resolve({ id: QID }),
    })
    expect(res.status).toBe(400)
  })

  test('200 + isCorrect=true cuando userAnswer numérico coincide (legislativa)', async () => {
    dbState.legislativeRow = { correctOption: 1, explanation: 'Resp. correcta es B.' }
    const res = await POST(makeReq({ userAnswer: 1 }), {
      params: Promise.resolve({ id: QID }),
    })
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.isCorrect).toBe(true)
    expect(data.correctAnswer).toBe(1)
    expect(data.explanation).toBe('Resp. correcta es B.')
  })

  test('200 + isCorrect=false cuando userAnswer no coincide', async () => {
    dbState.legislativeRow = { correctOption: 1, explanation: 'X' }
    const res = await POST(makeReq({ userAnswer: 2 }), {
      params: Promise.resolve({ id: QID }),
    })
    const data = await res.json()
    expect(data.isCorrect).toBe(false)
    expect(data.correctAnswer).toBe(1)
  })

  test('acepta letra (b → 1) (legislativa)', async () => {
    dbState.legislativeRow = { correctOption: 1, explanation: 'X' }
    const res = await POST(makeReq({ userAnswer: 'b' }), {
      params: Promise.resolve({ id: QID }),
    })
    const data = await res.json()
    expect(data.isCorrect).toBe(true)
  })

  test('cae a psychometric_questions si no existe en questions', async () => {
    dbState.legislativeRow = null
    dbState.psychometricRow = { correctOption: 0, explanation: 'Psy expl' }
    const res = await POST(makeReq({ userAnswer: 0 }), {
      params: Promise.resolve({ id: QID }),
    })
    const data = await res.json()
    expect(data.isCorrect).toBe(true)
    expect(data.explanation).toBe('Psy expl')
  })

  test('404 si la pregunta no existe en ninguna tabla', async () => {
    const res = await POST(makeReq({ userAnswer: 0 }), {
      params: Promise.resolve({ id: QID }),
    })
    expect(res.status).toBe(404)
  })
})
