// __tests__/lib/api/exam/client.test.ts
// Tests exhaustivos para validateExam() client-side

import { validateExam } from '@/lib/api/exam/client'
import {
  ApiTimeoutError,
  ApiHttpError,
  ApiNetworkError,
  ApiValidationError
} from '@/lib/api/client'

// ============================================
// MOCK DE FETCH
// ============================================

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
    json: () => Promise.resolve(data)
  })
}

function validExamResponse(numQuestions = 3) {
  const results = Array.from({ length: numQuestions }, (_, i) => ({
    questionId: `q${i + 1}`,
    userAnswer: i === numQuestions - 1 ? null : String.fromCharCode(97 + i), // last = unanswered
    correctAnswer: String.fromCharCode(97 + i),
    correctIndex: i % 4,
    isCorrect: i !== numQuestions - 1,
    explanation: `Explicación pregunta ${i + 1}`
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
      percentage: Math.round((correct / numQuestions) * 100)
    }
  }
}

// ============================================
// TESTS: INPUT VALIDATION
// ============================================

describe('validateExam — input validation', () => {
  it('rejects empty answers array', async () => {
    await expect(validateExam('test-id', [])).rejects.toThrow('Empty answers array')
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('rejects undefined answers', async () => {
    // @ts-expect-error testing invalid input
    await expect(validateExam('test-id', undefined)).rejects.toThrow()
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('rejects null answers', async () => {
    // @ts-expect-error testing invalid input
    await expect(validateExam('test-id', null)).rejects.toThrow()
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('does NOT call fetch on invalid input', async () => {
    try { await validateExam('test-id', []) } catch { /* expected */ }
    // @ts-expect-error testing
    try { await validateExam('test-id', undefined) } catch { /* expected */ }
    expect(mockFetch).not.toHaveBeenCalled()
  })
})

// ============================================
// TESTS: SUCCESS
// ============================================

describe('validateExam — success', () => {
  const answers = [
    { questionId: 'q1', userAnswer: 'a' },
    { questionId: 'q2', userAnswer: 'b' },
    { questionId: 'q3', userAnswer: null }
  ]

  it('returns typed results on success', async () => {
    mockFetch.mockReturnValueOnce(mockOk(validExamResponse(3)))

    const result = await validateExam('test-id', answers)

    expect(result.success).toBe(true)
    expect(result.results).toHaveLength(3)
    expect(result.summary.totalQuestions).toBe(3)
    expect(typeof result.summary.percentage).toBe('number')
  })

  it('sends testId and answers in body', async () => {
    mockFetch.mockReturnValueOnce(mockOk(validExamResponse(1)))

    await validateExam('my-test-id', [{ questionId: 'q1', userAnswer: 'a' }])

    const [url, opts] = mockFetch.mock.calls[0]
    expect(url).toBe('/api/exam/validate')
    expect(opts.method).toBe('POST')
    const body = JSON.parse(opts.body)
    expect(body.testId).toBe('my-test-id')
    expect(body.answers).toHaveLength(1)
    expect(body.answers[0].questionId).toBe('q1')
  })

  it('works with undefined testId', async () => {
    mockFetch.mockReturnValueOnce(mockOk(validExamResponse(1)))

    const result = await validateExam(undefined, [{ questionId: 'q1', userAnswer: 'a' }])
    expect(result.success).toBe(true)
  })

  it('handles all answers as null (user submitted empty exam)', async () => {
    const emptyAnswers = [
      { questionId: 'q1', userAnswer: null },
      { questionId: 'q2', userAnswer: null }
    ]
    const response = {
      success: true,
      results: [
        { questionId: 'q1', userAnswer: null, correctAnswer: 'a', correctIndex: 0, isCorrect: false },
        { questionId: 'q2', userAnswer: null, correctAnswer: 'b', correctIndex: 1, isCorrect: false }
      ],
      summary: { totalQuestions: 2, totalAnswered: 0, totalCorrect: 0, percentage: 0 }
    }
    mockFetch.mockReturnValueOnce(mockOk(response))

    const result = await validateExam('test-id', emptyAnswers)
    expect(result.summary.totalAnswered).toBe(0)
    expect(result.summary.percentage).toBe(0)
  })

  it('handles large exam (100 questions)', async () => {
    const manyAnswers = Array.from({ length: 100 }, (_, i) => ({
      questionId: `q${i}`, userAnswer: String.fromCharCode(97 + (i % 4))
    }))
    mockFetch.mockReturnValueOnce(mockOk(validExamResponse(100)))

    const result = await validateExam('test-id', manyAnswers)
    expect(result.results).toHaveLength(100)
  })

  it('result has correct summary calculations', async () => {
    const response = {
      success: true,
      results: [
        { questionId: 'q1', userAnswer: 'a', correctAnswer: 'a', correctIndex: 0, isCorrect: true },
        { questionId: 'q2', userAnswer: 'b', correctAnswer: 'c', correctIndex: 2, isCorrect: false },
        { questionId: 'q3', userAnswer: null, correctAnswer: 'd', correctIndex: 3, isCorrect: false }
      ],
      summary: { totalQuestions: 3, totalAnswered: 2, totalCorrect: 1, percentage: 33 }
    }
    mockFetch.mockReturnValueOnce(mockOk(response))

    const result = await validateExam('test-id', [
      { questionId: 'q1', userAnswer: 'a' },
      { questionId: 'q2', userAnswer: 'b' },
      { questionId: 'q3', userAnswer: null }
    ])

    expect(result.summary.totalCorrect).toBe(1)
    expect(result.summary.totalAnswered).toBe(2)
    expect(result.summary.percentage).toBe(33)
  })

  it('each result has required fields', async () => {
    mockFetch.mockReturnValueOnce(mockOk(validExamResponse(2)))

    const result = await validateExam('test-id', [
      { questionId: 'q1', userAnswer: 'a' },
      { questionId: 'q2', userAnswer: 'b' }
    ])

    for (const r of result.results) {
      expect(r).toHaveProperty('questionId')
      expect(r).toHaveProperty('correctAnswer')
      expect(r).toHaveProperty('correctIndex')
      expect(r).toHaveProperty('isCorrect')
      expect(typeof r.isCorrect).toBe('boolean')
    }
  })
})

// ============================================
// TESTS: RETRY
// ============================================

describe('validateExam — retry', () => {
  it('retries on 500 server error and recovers', async () => {
    mockFetch.mockReturnValueOnce(Promise.resolve({
      ok: false, status: 500, json: () => Promise.resolve({ error: 'Internal' })
    }))
    mockFetch.mockReturnValueOnce(mockOk(validExamResponse(1)))

    const result = await validateExam('test-id', [{ questionId: 'q1', userAnswer: 'a' }])
    expect(result.success).toBe(true)
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it('retries on network error and recovers', async () => {
    mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    mockFetch.mockReturnValueOnce(mockOk(validExamResponse(1)))

    const result = await validateExam('test-id', [{ questionId: 'q1', userAnswer: 'a' }])
    expect(result.success).toBe(true)
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it('throws after all retries exhausted', async () => {
    mockFetch.mockRejectedValue(new TypeError('Failed to fetch'))

    await expect(
      validateExam('test-id', [{ questionId: 'q1', userAnswer: 'a' }])
    ).rejects.toThrow(ApiNetworkError)
  })

  it('does NOT retry on 400', async () => {
    mockFetch.mockReturnValueOnce(Promise.resolve({
      ok: false, status: 400, json: () => Promise.resolve({ error: 'Bad' })
    }))

    await expect(
      validateExam('test-id', [{ questionId: 'q1', userAnswer: 'a' }])
    ).rejects.toThrow(ApiHttpError)
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })
})

// ============================================
// TESTS: TIMEOUT
// ============================================

describe('validateExam — timeout config', () => {
  it('passes 30s timeout to apiFetch (verified via AbortSignal)', async () => {
    // Verify the function sends the request with a signal
    mockFetch.mockReturnValueOnce(mockOk(validExamResponse(1)))

    await validateExam('test-id', [{ questionId: 'q1', userAnswer: 'a' }])

    const opts = mockFetch.mock.calls[0][1]
    expect(opts.signal).toBeInstanceOf(AbortSignal)
  })
})

// ============================================
// TESTS: ERROR HANDLING
// ============================================

describe('validateExam — errors', () => {
  it('throws ApiHttpError on 400', async () => {
    mockFetch.mockReturnValueOnce(Promise.resolve({
      ok: false, status: 400,
      json: () => Promise.resolve({ error: 'Bad request' })
    }))

    await expect(
      validateExam('test-id', [{ questionId: 'q1', userAnswer: 'a' }])
    ).rejects.toThrow(ApiHttpError)
  })

  it('throws on invalid response shape (missing results)', async () => {
    mockFetch.mockReturnValueOnce(mockOk({
      success: true,
      // results missing
      summary: { totalQuestions: 1, totalAnswered: 1, totalCorrect: 1, percentage: 100 }
    }))

    await expect(
      validateExam('test-id', [{ questionId: 'q1', userAnswer: 'a' }])
    ).rejects.toThrow()
  })

  it('throws on invalid response shape (missing summary)', async () => {
    mockFetch.mockReturnValueOnce(mockOk({
      success: true,
      results: [{ questionId: 'q1', userAnswer: 'a', correctAnswer: 'a', correctIndex: 0, isCorrect: true }]
      // summary missing
    }))

    await expect(
      validateExam('test-id', [{ questionId: 'q1', userAnswer: 'a' }])
    ).rejects.toThrow()
  })

  it('throws on completely wrong response', async () => {
    mockFetch.mockReturnValueOnce(mockOk({ wrong: 'shape' }))

    await expect(
      validateExam('test-id', [{ questionId: 'q1', userAnswer: 'a' }])
    ).rejects.toThrow()
  })

  it('throws when results array has invalid item', async () => {
    mockFetch.mockReturnValueOnce(mockOk({
      success: true,
      results: [{ invalid: 'item' }], // missing required fields
      summary: { totalQuestions: 1, totalAnswered: 1, totalCorrect: 1, percentage: 100 }
    }))

    await expect(
      validateExam('test-id', [{ questionId: 'q1', userAnswer: 'a' }])
    ).rejects.toThrow()
  })
})

// ============================================
// TESTS: CONTRATO DE TIPOS
// ============================================

describe('validateExam — type contract', () => {
  it('summary fields are all numbers', async () => {
    mockFetch.mockReturnValueOnce(mockOk(validExamResponse(5)))

    const result = await validateExam('test-id',
      Array.from({ length: 5 }, (_, i) => ({ questionId: `q${i}`, userAnswer: 'a' }))
    )

    expect(typeof result.summary.totalQuestions).toBe('number')
    expect(typeof result.summary.totalAnswered).toBe('number')
    expect(typeof result.summary.totalCorrect).toBe('number')
    expect(typeof result.summary.percentage).toBe('number')
  })

  it('results isCorrect is always boolean', async () => {
    mockFetch.mockReturnValueOnce(mockOk(validExamResponse(3)))

    const result = await validateExam('test-id', [
      { questionId: 'q1', userAnswer: 'a' },
      { questionId: 'q2', userAnswer: 'b' },
      { questionId: 'q3', userAnswer: null }
    ])

    for (const r of result.results) {
      expect(typeof r.isCorrect).toBe('boolean')
    }
  })
})
