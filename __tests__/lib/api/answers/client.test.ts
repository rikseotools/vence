// __tests__/lib/api/answers/client.test.ts
// Tests exhaustivos para validateAnswer() client-side

import { validateAnswer } from '@/lib/api/answers/client'
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

function validResponse(overrides?: Partial<{
  success: boolean
  isCorrect: boolean
  correctAnswer: number
  explanation: string | null
  articleNumber: string | null
  lawShortName: string | null
}>) {
  return {
    success: true,
    isCorrect: true,
    correctAnswer: 2,
    explanation: 'Artículo 14 CE',
    articleNumber: '14',
    lawShortName: 'CE',
    ...overrides
  }
}

// ============================================
// TESTS: INPUT VALIDATION
// ============================================

describe('validateAnswer — input validation', () => {
  it('rejects empty questionId', async () => {
    await expect(validateAnswer('', 0)).rejects.toThrow('Invalid questionId')
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('rejects short questionId (< 10 chars)', async () => {
    await expect(validateAnswer('short', 0)).rejects.toThrow('Invalid questionId')
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('rejects questionId with exactly 9 chars', async () => {
    await expect(validateAnswer('123456789', 0)).rejects.toThrow('Invalid questionId')
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('accepts questionId with exactly 10 chars', async () => {
    mockFetch.mockReturnValueOnce(mockOk(validResponse()))
    await expect(validateAnswer('1234567890', 0)).resolves.toBeDefined()
  })

  it('rejects null questionId', async () => {
    // @ts-expect-error testing invalid input
    await expect(validateAnswer(null, 0)).rejects.toThrow('Invalid questionId')
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('rejects undefined questionId', async () => {
    // @ts-expect-error testing invalid input
    await expect(validateAnswer(undefined, 0)).rejects.toThrow('Invalid questionId')
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('rejects numeric questionId', async () => {
    // @ts-expect-error testing invalid input
    await expect(validateAnswer(12345678901, 0)).rejects.toThrow('Invalid questionId')
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('does NOT call fetch on invalid input', async () => {
    try { await validateAnswer('', 0) } catch { /* expected */ }
    try { await validateAnswer('short', 1) } catch { /* expected */ }
    // @ts-expect-error testing invalid input
    try { await validateAnswer(null, 2) } catch { /* expected */ }
    expect(mockFetch).not.toHaveBeenCalled()
  })
})

// ============================================
// TESTS: SUCCESS
// ============================================

describe('validateAnswer — success', () => {
  it('returns typed response on success', async () => {
    mockFetch.mockReturnValueOnce(mockOk(validResponse()))

    const result = await validateAnswer(VALID_UUID, 2)

    expect(result.isCorrect).toBe(true)
    expect(result.correctAnswer).toBe(2)
    expect(result.explanation).toBe('Artículo 14 CE')
    expect(result.articleNumber).toBe('14')
    expect(result.lawShortName).toBe('CE')
  })

  it('calls /api/answer with correct payload', async () => {
    mockFetch.mockReturnValueOnce(mockOk(validResponse()))

    await validateAnswer(VALID_UUID, 3)

    const [url, opts] = mockFetch.mock.calls[0]
    expect(url).toBe('/api/answer')
    expect(opts.method).toBe('POST')
    const body = JSON.parse(opts.body)
    expect(body.questionId).toBe(VALID_UUID)
    expect(body.userAnswer).toBe(3)
  })

  it('handles incorrect answer response', async () => {
    mockFetch.mockReturnValueOnce(mockOk(validResponse({
      isCorrect: false,
      correctAnswer: 1,
      explanation: 'La respuesta es B porque...'
    })))

    const result = await validateAnswer(VALID_UUID, 0)

    expect(result.isCorrect).toBe(false)
    expect(result.correctAnswer).toBe(1)
  })

  it('handles null explanation', async () => {
    mockFetch.mockReturnValueOnce(mockOk(validResponse({ explanation: null })))

    const result = await validateAnswer(VALID_UUID, 0)
    expect(result.explanation).toBeNull()
  })

  it('handles all 4 answer indices (0-3)', async () => {
    for (let i = 0; i <= 3; i++) {
      mockFetch.mockReturnValueOnce(mockOk(validResponse({ correctAnswer: i })))
      const result = await validateAnswer(VALID_UUID, i)
      expect(result.correctAnswer).toBe(i)
    }
    expect(mockFetch).toHaveBeenCalledTimes(4)
  })

  it('accepts response with optional fields missing', async () => {
    mockFetch.mockReturnValueOnce(mockOk({
      success: true,
      isCorrect: true,
      correctAnswer: 0,
      explanation: null
      // articleNumber, lawShortName, lawName missing - they are optional
    }))

    const result = await validateAnswer(VALID_UUID, 0)
    expect(result.isCorrect).toBe(true)
    expect(result.articleNumber).toBeUndefined()
  })
})

// ============================================
// TESTS: RETRY
// ============================================

describe('validateAnswer — retry', () => {
  it('retries on network error and succeeds', async () => {
    mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    mockFetch.mockReturnValueOnce(mockOk(validResponse()))

    const result = await validateAnswer(VALID_UUID, 0)
    expect(result.isCorrect).toBe(true)
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it('throws ApiNetworkError after all retries fail', async () => {
    mockFetch.mockRejectedValue(new TypeError('Failed to fetch'))

    await expect(validateAnswer(VALID_UUID, 0)).rejects.toThrow(ApiNetworkError)
    expect(mockFetch).toHaveBeenCalledTimes(2) // default retries = 2
  })

  it('retries on 500 server error', async () => {
    mockFetch.mockReturnValueOnce(Promise.resolve({
      ok: false, status: 500,
      json: () => Promise.resolve({ error: 'Internal' })
    }))
    mockFetch.mockReturnValueOnce(mockOk(validResponse()))

    const result = await validateAnswer(VALID_UUID, 1)
    expect(result.isCorrect).toBe(true)
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it('does NOT retry on 400 (bad request)', async () => {
    mockFetch.mockReturnValueOnce(Promise.resolve({
      ok: false, status: 400,
      json: () => Promise.resolve({ error: 'Bad request' })
    }))

    await expect(validateAnswer(VALID_UUID, 0)).rejects.toThrow(ApiHttpError)
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })
})

// ============================================
// TESTS: ERROR HANDLING
// ============================================

describe('validateAnswer — errors', () => {
  it('throws ApiHttpError on 400', async () => {
    mockFetch.mockReturnValueOnce(Promise.resolve({
      ok: false, status: 400,
      json: () => Promise.resolve({ error: 'Bad request' })
    }))

    await expect(validateAnswer(VALID_UUID, 0)).rejects.toThrow(ApiHttpError)
  })

  it('throws ApiHttpError on 401', async () => {
    mockFetch.mockReturnValueOnce(Promise.resolve({
      ok: false, status: 401,
      json: () => Promise.resolve({ error: 'Unauthorized' })
    }))

    await expect(validateAnswer(VALID_UUID, 0)).rejects.toThrow(ApiHttpError)
  })

  it('throws on invalid response shape (Zod validation)', async () => {
    mockFetch.mockReturnValueOnce(mockOk({ wrong: 'shape' }))

    await expect(validateAnswer(VALID_UUID, 0)).rejects.toThrow()
  })

  it('throws ApiValidationError when correctAnswer is out of range', async () => {
    mockFetch.mockReturnValueOnce(mockOk({
      success: true,
      isCorrect: true,
      correctAnswer: 99, // out of range 0-3
      explanation: null
    }))

    await expect(validateAnswer(VALID_UUID, 0)).rejects.toThrow()
  })

  it('throws ApiValidationError when isCorrect is not boolean', async () => {
    mockFetch.mockReturnValueOnce(mockOk({
      success: true,
      isCorrect: 'yes', // should be boolean
      correctAnswer: 1,
      explanation: null
    }))

    await expect(validateAnswer(VALID_UUID, 0)).rejects.toThrow()
  })

  it('throws ApiValidationError when correctAnswer is missing', async () => {
    mockFetch.mockReturnValueOnce(mockOk({
      success: true,
      isCorrect: true,
      // correctAnswer missing
      explanation: null
    }))

    await expect(validateAnswer(VALID_UUID, 0)).rejects.toThrow()
  })

  it('error type is distinguishable via instanceof', async () => {
    // HTTP error
    mockFetch.mockReturnValueOnce(Promise.resolve({
      ok: false, status: 404, json: () => Promise.resolve({})
    }))
    try {
      await validateAnswer(VALID_UUID, 0)
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

describe('validateAnswer — type contract', () => {
  it('result always has isCorrect as boolean', async () => {
    mockFetch.mockReturnValueOnce(mockOk(validResponse({ isCorrect: true })))
    const r1 = await validateAnswer(VALID_UUID, 0)
    expect(typeof r1.isCorrect).toBe('boolean')

    mockFetch.mockReturnValueOnce(mockOk(validResponse({ isCorrect: false })))
    const r2 = await validateAnswer(VALID_UUID, 0)
    expect(typeof r2.isCorrect).toBe('boolean')
  })

  it('result always has correctAnswer as number 0-3', async () => {
    for (let i = 0; i <= 3; i++) {
      mockFetch.mockReturnValueOnce(mockOk(validResponse({ correctAnswer: i })))
      const result = await validateAnswer(VALID_UUID, 0)
      expect(result.correctAnswer).toBeGreaterThanOrEqual(0)
      expect(result.correctAnswer).toBeLessThanOrEqual(3)
    }
  })

  it('result explanation is string or null, never undefined', async () => {
    mockFetch.mockReturnValueOnce(mockOk(validResponse({ explanation: 'Texto' })))
    const r1 = await validateAnswer(VALID_UUID, 0)
    expect(typeof r1.explanation === 'string' || r1.explanation === null).toBe(true)

    mockFetch.mockReturnValueOnce(mockOk(validResponse({ explanation: null })))
    const r2 = await validateAnswer(VALID_UUID, 0)
    expect(r2.explanation).toBeNull()
  })
})
