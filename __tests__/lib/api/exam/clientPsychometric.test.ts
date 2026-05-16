// __tests__/lib/api/exam/clientPsychometric.test.ts
// Tests para validateExamPsychometric() client-side
//
// El test crítico aquí es que `userAnswer: null` (pregunta dejada en blanco
// en un simulacro/examen oficial) NO es rechazado por el schema, y se devuelve
// la respuesta correcta + explicación igual que para una pregunta respondida.
// Esto arregla el bug de simulacros donde las psicotécnicas en blanco no
// mostraban la solución tras corregir.

import { validateExamPsychometric } from '@/lib/api/exam/client'
import { ApiHttpError, ApiNetworkError } from '@/lib/api/client'

const mockFetch = jest.fn()
const originalFetch = global.fetch

beforeEach(() => {
  jest.clearAllMocks()
  global.fetch = mockFetch
  jest.spyOn(console, 'log').mockImplementation(() => {})
})

afterAll(() => {
  global.fetch = originalFetch
})

function mockOk(data: unknown) {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve(data),
  })
}

function validResponse(numQuestions = 3) {
  const results = Array.from({ length: numQuestions }, (_, i) => ({
    questionId: `q${i + 1}`,
    userAnswer: i === numQuestions - 1 ? null : i % 4, // last left blank
    correctAnswer: String.fromCharCode(97 + (i % 4)),
    correctIndex: i % 4,
    isCorrect: i !== numQuestions - 1,
    explanation: `Explicación ${i + 1}`,
  }))

  const answered = results.filter(r => r.userAnswer !== null).length
  const correct = results.filter(r => r.isCorrect).length

  return {
    success: true,
    results,
    summary: {
      totalQuestions: numQuestions,
      totalAnswered: answered,
      totalCorrect: correct,
      percentage: Math.round((correct / numQuestions) * 100),
    },
  }
}

describe('validateExamPsychometric — input validation', () => {
  it('rejects empty answers array', async () => {
    await expect(validateExamPsychometric([])).rejects.toThrow('Empty answers array')
    expect(mockFetch).not.toHaveBeenCalled()
  })
})

describe('validateExamPsychometric — null answers (the bug fix)', () => {
  it('accepts userAnswer: null and forwards it to the API', async () => {
    mockFetch.mockReturnValueOnce(mockOk(validResponse(2)))

    await validateExamPsychometric([
      { questionId: 'q1', userAnswer: 2 },
      { questionId: 'q2', userAnswer: null },
    ])

    const [url, opts] = mockFetch.mock.calls[0]
    expect(url).toBe('/api/exam/validate/psychometric')
    expect(opts.method).toBe('POST')
    const body = JSON.parse(opts.body)
    expect(body.answers).toHaveLength(2)
    expect(body.answers[1].userAnswer).toBeNull()
  })

  it('handles ALL answers null (exam submitted blank)', async () => {
    const response = {
      success: true,
      results: [
        { questionId: 'q1', userAnswer: null, correctAnswer: 'a', correctIndex: 0, isCorrect: false, explanation: 'expl1' },
        { questionId: 'q2', userAnswer: null, correctAnswer: 'c', correctIndex: 2, isCorrect: false, explanation: 'expl2' },
      ],
      summary: { totalQuestions: 2, totalAnswered: 0, totalCorrect: 0, percentage: 0 },
    }
    mockFetch.mockReturnValueOnce(mockOk(response))

    const result = await validateExamPsychometric([
      { questionId: 'q1', userAnswer: null },
      { questionId: 'q2', userAnswer: null },
    ])

    // Crítico: el cliente DEBE recibir correctAnswer y explanation aunque
    // todas las respuestas fueran null (es decir: el usuario dejó el
    // examen en blanco y debe poder revisar las soluciones).
    expect(result.summary.totalAnswered).toBe(0)
    expect(result.results[0].correctAnswer).toBe('a')
    expect(result.results[0].correctIndex).toBe(0)
    expect(result.results[0].explanation).toBe('expl1')
    expect(result.results[1].correctAnswer).toBe('c')
  })
})

describe('validateExamPsychometric — success', () => {
  it('returns typed results on success', async () => {
    mockFetch.mockReturnValueOnce(mockOk(validResponse(3)))

    const result = await validateExamPsychometric([
      { questionId: 'q1', userAnswer: 0 },
      { questionId: 'q2', userAnswer: 1 },
      { questionId: 'q3', userAnswer: null },
    ])

    expect(result.success).toBe(true)
    expect(result.results).toHaveLength(3)
    expect(result.summary.totalQuestions).toBe(3)
  })

  it('handles large batch (30 psicotécnicas — simulacro estándar)', async () => {
    const many = Array.from({ length: 30 }, (_, i) => ({
      questionId: `q${i}`,
      userAnswer: (i % 5) as number, // mix de 0-4
    }))
    mockFetch.mockReturnValueOnce(mockOk(validResponse(30)))

    const result = await validateExamPsychometric(many)
    expect(result.results).toHaveLength(30)
  })
})

describe('validateExamPsychometric — errors', () => {
  it('throws ApiHttpError on 400', async () => {
    mockFetch.mockReturnValueOnce(
      Promise.resolve({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ error: 'Bad request' }),
      }),
    )

    await expect(
      validateExamPsychometric([{ questionId: 'q1', userAnswer: 0 }]),
    ).rejects.toThrow(ApiHttpError)
  })

  it('retries on network error and recovers', async () => {
    mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    mockFetch.mockReturnValueOnce(mockOk(validResponse(1)))

    const result = await validateExamPsychometric([{ questionId: 'q1', userAnswer: 0 }])
    expect(result.success).toBe(true)
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it('throws after retries exhausted on persistent network error', async () => {
    mockFetch.mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(
      validateExamPsychometric([{ questionId: 'q1', userAnswer: 0 }]),
    ).rejects.toThrow(ApiNetworkError)
  })

  it('throws on invalid response shape', async () => {
    mockFetch.mockReturnValueOnce(mockOk({ wrong: 'shape' }))
    await expect(
      validateExamPsychometric([{ questionId: 'q1', userAnswer: 0 }]),
    ).rejects.toThrow()
  })
})
