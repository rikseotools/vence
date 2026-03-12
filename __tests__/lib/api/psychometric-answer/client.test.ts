// __tests__/lib/api/psychometric-answer/client.test.ts
// Tests exhaustivos para validatePsychometricAnswer() client-side

import { validatePsychometricAnswer } from '@/lib/api/psychometric-answer/client'
import type { PsychometricSaveParams } from '@/lib/api/psychometric-answer/client'
import {
  ApiTimeoutError,
  ApiNetworkError,
  ApiHttpError,
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

const VALID_UUID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'

function validResponse(overrides?: Record<string, unknown>) {
  return {
    success: true,
    isCorrect: true,
    correctAnswer: 2,
    explanation: 'La serie sigue el patrón +3',
    solutionSteps: 'Paso 1: observar incrementos',
    saved: false,
    sessionProgress: null,
    ...overrides
  }
}

const SAVE_PARAMS: PsychometricSaveParams = {
  sessionId: '11111111-2222-3333-4444-555555555555',
  userId: '66666666-7777-8888-9999-aaaaaaaaaaaa',
  questionOrder: 5,
  timeSpentSeconds: 30,
  questionSubtype: 'sequence_numeric',
  totalQuestions: 10
}

// ============================================
// TESTS: INPUT VALIDATION
// ============================================

describe('validatePsychometricAnswer — input validation', () => {
  it('rejects empty questionId', async () => {
    await expect(validatePsychometricAnswer('', 0)).rejects.toThrow('Invalid questionId')
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('rejects short questionId (< 10 chars)', async () => {
    await expect(validatePsychometricAnswer('short', 0)).rejects.toThrow('Invalid questionId')
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('rejects null questionId', async () => {
    // @ts-expect-error testing invalid input
    await expect(validatePsychometricAnswer(null, 0)).rejects.toThrow('Invalid questionId')
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('rejects undefined questionId', async () => {
    // @ts-expect-error testing invalid input
    await expect(validatePsychometricAnswer(undefined, 0)).rejects.toThrow('Invalid questionId')
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('accepts questionId with exactly 10 chars', async () => {
    mockFetch.mockReturnValueOnce(mockOk(validResponse()))
    await expect(validatePsychometricAnswer('1234567890', 0)).resolves.toBeDefined()
  })

  it('does NOT call fetch on any invalid input', async () => {
    try { await validatePsychometricAnswer('', 0) } catch { /* expected */ }
    try { await validatePsychometricAnswer('short', 1) } catch { /* expected */ }
    // @ts-expect-error
    try { await validatePsychometricAnswer(null, 2) } catch { /* expected */ }
    expect(mockFetch).not.toHaveBeenCalled()
  })
})

// ============================================
// TESTS: SUCCESS (sin saveParams - guest mode)
// ============================================

describe('validatePsychometricAnswer — success (guest)', () => {
  it('returns typed response on success', async () => {
    mockFetch.mockReturnValueOnce(mockOk(validResponse()))

    const result = await validatePsychometricAnswer(VALID_UUID, 2)

    expect(result.isCorrect).toBe(true)
    expect(result.correctAnswer).toBe(2)
    expect(result.explanation).toBe('La serie sigue el patrón +3')
    expect(result.solutionSteps).toBe('Paso 1: observar incrementos')
    expect(result.saved).toBe(false)
    expect(result.sessionProgress).toBeNull()
  })

  it('calls /api/answer/psychometric with correct payload', async () => {
    mockFetch.mockReturnValueOnce(mockOk(validResponse()))

    await validatePsychometricAnswer(VALID_UUID, 3)

    const [url, opts] = mockFetch.mock.calls[0]
    expect(url).toBe('/api/answer/psychometric')
    expect(opts.method).toBe('POST')
    const body = JSON.parse(opts.body)
    expect(body.questionId).toBe(VALID_UUID)
    expect(body.userAnswer).toBe(3)
  })

  it('does NOT include session fields when no saveParams', async () => {
    mockFetch.mockReturnValueOnce(mockOk(validResponse()))

    await validatePsychometricAnswer(VALID_UUID, 1)

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.sessionId).toBeUndefined()
    expect(body.userId).toBeUndefined()
    expect(body.questionOrder).toBeUndefined()
  })

  it('does NOT include session fields when saveParams is null', async () => {
    mockFetch.mockReturnValueOnce(mockOk(validResponse()))

    await validatePsychometricAnswer(VALID_UUID, 1, null)

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.sessionId).toBeUndefined()
    expect(body.userId).toBeUndefined()
  })

  it('handles incorrect answer', async () => {
    mockFetch.mockReturnValueOnce(mockOk(validResponse({
      isCorrect: false,
      correctAnswer: 3,
      explanation: 'La respuesta correcta es D'
    })))

    const result = await validatePsychometricAnswer(VALID_UUID, 1)
    expect(result.isCorrect).toBe(false)
    expect(result.correctAnswer).toBe(3)
  })

  it('handles null explanation and solutionSteps', async () => {
    mockFetch.mockReturnValueOnce(mockOk(validResponse({
      explanation: null,
      solutionSteps: null
    })))

    const result = await validatePsychometricAnswer(VALID_UUID, 0)
    expect(result.explanation).toBeNull()
    expect(result.solutionSteps).toBeNull()
  })

  it('handles all 4 answer indices (0-3)', async () => {
    for (let i = 0; i <= 3; i++) {
      mockFetch.mockReturnValueOnce(mockOk(validResponse({ correctAnswer: i })))
      const result = await validatePsychometricAnswer(VALID_UUID, i)
      expect(result.correctAnswer).toBe(i)
    }
    expect(mockFetch).toHaveBeenCalledTimes(4)
  })
})

// ============================================
// TESTS: SUCCESS (con saveParams - usuario logueado)
// ============================================

describe('validatePsychometricAnswer — success (logged in)', () => {
  it('includes all saveParams in payload', async () => {
    mockFetch.mockReturnValueOnce(mockOk(validResponse({ saved: true })))

    await validatePsychometricAnswer(VALID_UUID, 0, SAVE_PARAMS)

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.sessionId).toBe(SAVE_PARAMS.sessionId)
    expect(body.userId).toBe(SAVE_PARAMS.userId)
    expect(body.questionOrder).toBe(5)
    expect(body.timeSpentSeconds).toBe(30)
    expect(body.questionSubtype).toBe('sequence_numeric')
    expect(body.totalQuestions).toBe(10)
    // Also has the base fields
    expect(body.questionId).toBe(VALID_UUID)
    expect(body.userAnswer).toBe(0)
  })

  it('returns saved=true and sessionProgress when saved', async () => {
    mockFetch.mockReturnValueOnce(mockOk(validResponse({
      saved: true,
      sessionProgress: {
        questionsAnswered: 5,
        correctAnswers: 3,
        accuracyPercentage: 60
      }
    })))

    const result = await validatePsychometricAnswer(VALID_UUID, 0, SAVE_PARAMS)

    expect(result.saved).toBe(true)
    expect(result.sessionProgress).toBeDefined()
    expect(result.sessionProgress!.questionsAnswered).toBe(5)
    expect(result.sessionProgress!.correctAnswers).toBe(3)
    expect(result.sessionProgress!.accuracyPercentage).toBe(60)
  })

  it('handles saveParams with null questionSubtype', async () => {
    mockFetch.mockReturnValueOnce(mockOk(validResponse({ saved: true })))

    await validatePsychometricAnswer(VALID_UUID, 0, {
      ...SAVE_PARAMS,
      questionSubtype: null
    })

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.questionSubtype).toBeNull()
  })
})

// ============================================
// TESTS: RETRY
// ============================================

describe('validatePsychometricAnswer — retry', () => {
  it('retries on network error and succeeds', async () => {
    mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    mockFetch.mockReturnValueOnce(mockOk(validResponse()))

    const result = await validatePsychometricAnswer(VALID_UUID, 0)
    expect(result.isCorrect).toBe(true)
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it('throws ApiNetworkError after all retries fail', async () => {
    mockFetch.mockRejectedValue(new TypeError('Failed to fetch'))

    await expect(
      validatePsychometricAnswer(VALID_UUID, 0)
    ).rejects.toThrow(ApiNetworkError)
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it('retries on 500 server error and recovers', async () => {
    mockFetch.mockReturnValueOnce(Promise.resolve({
      ok: false, status: 500, json: () => Promise.resolve({ error: 'Internal' })
    }))
    mockFetch.mockReturnValueOnce(mockOk(validResponse()))

    const result = await validatePsychometricAnswer(VALID_UUID, 1)
    expect(result.isCorrect).toBe(true)
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it('does NOT retry on 400', async () => {
    mockFetch.mockReturnValueOnce(Promise.resolve({
      ok: false, status: 400, json: () => Promise.resolve({ error: 'Bad' })
    }))

    await expect(
      validatePsychometricAnswer(VALID_UUID, 0)
    ).rejects.toThrow(ApiHttpError)
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('retries preserve saveParams on retry', async () => {
    mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    mockFetch.mockReturnValueOnce(mockOk(validResponse({ saved: true })))

    await validatePsychometricAnswer(VALID_UUID, 0, SAVE_PARAMS)

    // Check second call (retry) still has saveParams
    const body = JSON.parse(mockFetch.mock.calls[1][1].body)
    expect(body.sessionId).toBe(SAVE_PARAMS.sessionId)
    expect(body.userId).toBe(SAVE_PARAMS.userId)
  })
})

// ============================================
// TESTS: ERROR HANDLING
// ============================================

describe('validatePsychometricAnswer — errors', () => {
  it('throws ApiHttpError on 400', async () => {
    mockFetch.mockReturnValueOnce(Promise.resolve({
      ok: false, status: 400,
      json: () => Promise.resolve({ error: 'Bad request' })
    }))

    await expect(validatePsychometricAnswer(VALID_UUID, 0)).rejects.toThrow(ApiHttpError)
  })

  it('throws ApiHttpError on 401', async () => {
    mockFetch.mockReturnValueOnce(Promise.resolve({
      ok: false, status: 401,
      json: () => Promise.resolve({ error: 'Unauthorized' })
    }))

    await expect(validatePsychometricAnswer(VALID_UUID, 0)).rejects.toThrow(ApiHttpError)
  })

  it('throws on invalid response shape (missing correctAnswer)', async () => {
    mockFetch.mockReturnValueOnce(mockOk({
      success: true,
      isCorrect: true,
      // correctAnswer missing
      explanation: null,
      solutionSteps: null,
      saved: false
    }))

    await expect(validatePsychometricAnswer(VALID_UUID, 0)).rejects.toThrow()
  })

  it('throws on invalid response shape (wrong success type)', async () => {
    mockFetch.mockReturnValueOnce(mockOk({
      success: false, // schema expects literal true
      isCorrect: true,
      correctAnswer: 0,
      explanation: null,
      solutionSteps: null,
      saved: false
    }))

    await expect(validatePsychometricAnswer(VALID_UUID, 0)).rejects.toThrow()
  })

  it('throws on completely wrong response', async () => {
    mockFetch.mockReturnValueOnce(mockOk({ wrong: 'shape' }))

    await expect(validatePsychometricAnswer(VALID_UUID, 0)).rejects.toThrow()
  })

  it('throws when correctAnswer is out of range', async () => {
    mockFetch.mockReturnValueOnce(mockOk(validResponse({ correctAnswer: 5 })))

    await expect(validatePsychometricAnswer(VALID_UUID, 0)).rejects.toThrow()
  })

  it('error types are distinguishable via instanceof', async () => {
    mockFetch.mockReturnValueOnce(Promise.resolve({
      ok: false, status: 404, json: () => Promise.resolve({})
    }))

    try {
      await validatePsychometricAnswer(VALID_UUID, 0)
    } catch (err) {
      expect(err instanceof ApiHttpError).toBe(true)
      expect(err instanceof ApiTimeoutError).toBe(false)
      expect(err instanceof ApiNetworkError).toBe(false)
    }
  })
})

// ============================================
// TESTS: CONTRATO DE TIPOS
// ============================================

describe('validatePsychometricAnswer — type contract', () => {
  it('isCorrect is always boolean', async () => {
    mockFetch.mockReturnValueOnce(mockOk(validResponse({ isCorrect: true })))
    const r1 = await validatePsychometricAnswer(VALID_UUID, 0)
    expect(typeof r1.isCorrect).toBe('boolean')

    mockFetch.mockReturnValueOnce(mockOk(validResponse({ isCorrect: false })))
    const r2 = await validatePsychometricAnswer(VALID_UUID, 0)
    expect(typeof r2.isCorrect).toBe('boolean')
  })

  it('correctAnswer is always number 0-3', async () => {
    for (let i = 0; i <= 3; i++) {
      mockFetch.mockReturnValueOnce(mockOk(validResponse({ correctAnswer: i })))
      const result = await validatePsychometricAnswer(VALID_UUID, 0)
      expect(result.correctAnswer).toBeGreaterThanOrEqual(0)
      expect(result.correctAnswer).toBeLessThanOrEqual(3)
    }
  })

  it('saved is always boolean', async () => {
    mockFetch.mockReturnValueOnce(mockOk(validResponse({ saved: false })))
    const r1 = await validatePsychometricAnswer(VALID_UUID, 0)
    expect(typeof r1.saved).toBe('boolean')

    mockFetch.mockReturnValueOnce(mockOk(validResponse({ saved: true })))
    const r2 = await validatePsychometricAnswer(VALID_UUID, 0, SAVE_PARAMS)
    expect(typeof r2.saved).toBe('boolean')
  })

  it('explanation is string or null', async () => {
    mockFetch.mockReturnValueOnce(mockOk(validResponse({ explanation: 'Texto' })))
    const r1 = await validatePsychometricAnswer(VALID_UUID, 0)
    expect(typeof r1.explanation === 'string' || r1.explanation === null).toBe(true)

    mockFetch.mockReturnValueOnce(mockOk(validResponse({ explanation: null })))
    const r2 = await validatePsychometricAnswer(VALID_UUID, 0)
    expect(r2.explanation).toBeNull()
  })
})
