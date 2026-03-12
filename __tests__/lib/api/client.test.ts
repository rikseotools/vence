// __tests__/lib/api/client.test.ts
// Tests exhaustivos para el fetch wrapper centralizado con timeout, retry y Zod

import { z } from 'zod'
import {
  apiFetch,
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
  jest.spyOn(console, 'warn').mockImplementation(() => {})
})

afterAll(() => {
  global.fetch = originalFetch
})

// Helpers
function mockOk(data: unknown) {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve(data)
  })
}

function mockHttpError(status: number) {
  return Promise.resolve({
    ok: false,
    status,
    json: () => Promise.resolve({ error: 'Error' })
  })
}

// ============================================
// TESTS: ÉXITO BÁSICO
// ============================================

describe('apiFetch — success', () => {
  it('makes a POST request with JSON body', async () => {
    const payload = { questionId: '123', userAnswer: 1 }
    const responseData = { success: true, isCorrect: true }
    mockFetch.mockReturnValueOnce(mockOk(responseData))

    const result = await apiFetch('/api/answer', payload)

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [url, opts] = mockFetch.mock.calls[0]
    expect(url).toBe('/api/answer')
    expect(opts.method).toBe('POST')
    expect(opts.headers['Content-Type']).toBe('application/json')
    expect(JSON.parse(opts.body)).toEqual(payload)
    expect(result).toEqual(responseData)
  })

  it('returns parsed JSON data', async () => {
    const data = { success: true, value: 42 }
    mockFetch.mockReturnValueOnce(mockOk(data))

    const result = await apiFetch('/api/test', {})
    expect(result).toEqual(data)
  })

  it('serializes complex nested body correctly', async () => {
    const body = {
      answers: [{ questionId: 'q1', userAnswer: 'a' }, { questionId: 'q2', userAnswer: null }],
      metadata: { nested: { deep: true } }
    }
    mockFetch.mockReturnValueOnce(mockOk({ ok: true }))

    await apiFetch('/api/exam/validate', body)

    const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(sentBody.answers).toHaveLength(2)
    expect(sentBody.answers[1].userAnswer).toBeNull()
    expect(sentBody.metadata.nested.deep).toBe(true)
  })

  it('attaches AbortSignal for timeout control', async () => {
    mockFetch.mockReturnValueOnce(mockOk({ ok: true }))

    await apiFetch('/api/test', {})

    const opts = mockFetch.mock.calls[0][1]
    expect(opts.signal).toBeInstanceOf(AbortSignal)
  })
})

// ============================================
// TESTS: TIMEOUT
// ============================================

describe('apiFetch — timeout', () => {
  it('aborts after timeoutMs', async () => {
    mockFetch.mockImplementation((_url: string, opts: RequestInit) => {
      return new Promise((_resolve, reject) => {
        opts.signal?.addEventListener('abort', () => {
          reject(new DOMException('The operation was aborted.', 'AbortError'))
        })
      })
    })

    await expect(
      apiFetch('/api/slow', {}, { timeoutMs: 50, retries: 1, retryDelayMs: 10 })
    ).rejects.toThrow(ApiTimeoutError)
  })

  it('retries on timeout and succeeds on second attempt', async () => {
    mockFetch.mockImplementationOnce((_url: string, opts: RequestInit) => {
      return new Promise((_resolve, reject) => {
        opts.signal?.addEventListener('abort', () => {
          reject(new DOMException('The operation was aborted.', 'AbortError'))
        })
      })
    })
    mockFetch.mockReturnValueOnce(mockOk({ success: true }))

    const result = await apiFetch('/api/answer', {}, {
      timeoutMs: 50,
      retries: 2,
      retryDelayMs: 10
    })

    expect(result).toEqual({ success: true })
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it('throws ApiTimeoutError after all retries exhausted', async () => {
    mockFetch.mockImplementation((_url: string, opts: RequestInit) => {
      return new Promise((_resolve, reject) => {
        opts.signal?.addEventListener('abort', () => {
          reject(new DOMException('The operation was aborted.', 'AbortError'))
        })
      })
    })

    await expect(
      apiFetch('/api/slow', {}, { timeoutMs: 50, retries: 2, retryDelayMs: 10 })
    ).rejects.toThrow(ApiTimeoutError)
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it('ApiTimeoutError message includes URL and timeout value', async () => {
    mockFetch.mockImplementation((_url: string, opts: RequestInit) => {
      return new Promise((_resolve, reject) => {
        opts.signal?.addEventListener('abort', () => {
          reject(new DOMException('The operation was aborted.', 'AbortError'))
        })
      })
    })

    try {
      await apiFetch('/api/answer', {}, { timeoutMs: 50, retries: 1, retryDelayMs: 10 })
      fail('Should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(ApiTimeoutError)
      expect((err as Error).message).toContain('/api/answer')
      expect((err as Error).message).toContain('50ms')
    }
  })
})

// ============================================
// TESTS: RETRY
// ============================================

describe('apiFetch — retry', () => {
  it('retries on 500 and succeeds on second attempt', async () => {
    mockFetch.mockReturnValueOnce(mockHttpError(500))
    mockFetch.mockReturnValueOnce(mockOk({ success: true }))

    const result = await apiFetch('/api/answer', {}, { retryDelayMs: 10 })

    expect(result).toEqual({ success: true })
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it('retries on 502/503 (server errors)', async () => {
    mockFetch.mockReturnValueOnce(mockHttpError(502))
    mockFetch.mockReturnValueOnce(mockHttpError(503))

    await expect(
      apiFetch('/api/answer', {}, { retries: 2, retryDelayMs: 10 })
    ).rejects.toThrow(ApiHttpError)
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it('does NOT retry on 400', async () => {
    mockFetch.mockReturnValueOnce(mockHttpError(400))

    await expect(
      apiFetch('/api/answer', {}, { retries: 2, retryDelayMs: 10 })
    ).rejects.toThrow(ApiHttpError)
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('does NOT retry on 401 (unauthorized)', async () => {
    mockFetch.mockReturnValueOnce(mockHttpError(401))

    await expect(
      apiFetch('/api/answer', {}, { retries: 2, retryDelayMs: 10 })
    ).rejects.toThrow(ApiHttpError)
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('does NOT retry on 403 (forbidden)', async () => {
    mockFetch.mockReturnValueOnce(mockHttpError(403))

    await expect(
      apiFetch('/api/answer', {}, { retries: 2, retryDelayMs: 10 })
    ).rejects.toThrow(ApiHttpError)
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('does NOT retry on 404', async () => {
    mockFetch.mockReturnValueOnce(mockHttpError(404))

    await expect(
      apiFetch('/api/answer', {}, { retries: 2, retryDelayMs: 10 })
    ).rejects.toThrow(ApiHttpError)
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('does NOT retry on 422', async () => {
    mockFetch.mockReturnValueOnce(mockHttpError(422))

    await expect(
      apiFetch('/api/answer', {}, { retries: 2, retryDelayMs: 10 })
    ).rejects.toThrow(ApiHttpError)
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('retries on network error (TypeError: Failed to fetch)', async () => {
    mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    mockFetch.mockReturnValueOnce(mockOk({ ok: true }))

    const result = await apiFetch('/api/answer', {}, { retries: 2, retryDelayMs: 10 })
    expect(result).toEqual({ ok: true })
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it('retries on generic Error (unexpected network failure)', async () => {
    mockFetch.mockRejectedValueOnce(new Error('ERR_CONNECTION_RESET'))
    mockFetch.mockReturnValueOnce(mockOk({ ok: true }))

    const result = await apiFetch('/api/answer', {}, { retries: 2, retryDelayMs: 10 })
    expect(result).toEqual({ ok: true })
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it('throws ApiNetworkError when all retries fail with network error', async () => {
    mockFetch.mockRejectedValue(new TypeError('Failed to fetch'))

    await expect(
      apiFetch('/api/answer', {}, { retries: 2, retryDelayMs: 10 })
    ).rejects.toThrow(ApiNetworkError)
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it('respects retries=1 (no retry)', async () => {
    mockFetch.mockReturnValueOnce(mockHttpError(500))

    await expect(
      apiFetch('/api/answer', {}, { retries: 1, retryDelayMs: 10 })
    ).rejects.toThrow(ApiHttpError)
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('retries exactly N times with retries=3', async () => {
    mockFetch.mockReturnValue(mockHttpError(500))

    await expect(
      apiFetch('/api/answer', {}, { retries: 3, retryDelayMs: 10 })
    ).rejects.toThrow(ApiHttpError)
    expect(mockFetch).toHaveBeenCalledTimes(3)
  })

  it('recovers after 500 then 500 then success (3 retries)', async () => {
    mockFetch.mockReturnValueOnce(mockHttpError(500))
    mockFetch.mockReturnValueOnce(mockHttpError(502))
    mockFetch.mockReturnValueOnce(mockOk({ recovered: true }))

    const result = await apiFetch('/api/test', {}, { retries: 3, retryDelayMs: 10 })
    expect(result).toEqual({ recovered: true })
    expect(mockFetch).toHaveBeenCalledTimes(3)
  })

  it('HttpError after exhausted retries has correct status from last attempt', async () => {
    mockFetch.mockReturnValueOnce(mockHttpError(500))
    mockFetch.mockReturnValueOnce(mockHttpError(503))

    try {
      await apiFetch('/api/test', {}, { retries: 2, retryDelayMs: 10 })
      fail('Should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(ApiHttpError)
      expect((err as ApiHttpError).status).toBe(503) // last error
    }
  })
})

// ============================================
// TESTS: ZOD VALIDATION
// ============================================

describe('apiFetch — Zod validation', () => {
  const schema = z.object({
    success: z.boolean(),
    value: z.number()
  })

  it('parses response with Zod schema', async () => {
    mockFetch.mockReturnValueOnce(mockOk({ success: true, value: 42 }))

    const result = await apiFetch('/api/test', {}, { responseSchema: schema })
    expect(result).toEqual({ success: true, value: 42 })
  })

  it('strips extra fields when using Zod schema', async () => {
    mockFetch.mockReturnValueOnce(mockOk({ success: true, value: 42, extra: 'field' }))

    const result = await apiFetch('/api/test', {}, { responseSchema: schema })
    expect(result).toEqual({ success: true, value: 42 })
    expect((result as Record<string, unknown>).extra).toBeUndefined()
  })

  it('throws ApiValidationError if response does not match schema', async () => {
    mockFetch.mockReturnValueOnce(mockOk({ wrong: 'shape' }))

    await expect(
      apiFetch('/api/test', {}, { responseSchema: schema, retries: 1 })
    ).rejects.toThrow(ApiValidationError)
  })

  it('does NOT retry on Zod validation errors', async () => {
    mockFetch.mockReturnValue(mockOk({ wrong: 'shape' }))

    await expect(
      apiFetch('/api/test', {}, { responseSchema: schema, retries: 3, retryDelayMs: 10 })
    ).rejects.toThrow(ApiValidationError)
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('validates with complex nested schema', async () => {
    const nestedSchema = z.object({
      results: z.array(z.object({
        questionId: z.string(),
        isCorrect: z.boolean()
      })),
      summary: z.object({
        total: z.number(),
        correct: z.number()
      })
    })

    mockFetch.mockReturnValueOnce(mockOk({
      results: [{ questionId: 'q1', isCorrect: true }],
      summary: { total: 1, correct: 1 }
    }))

    const result = await apiFetch('/api/exam', {}, { responseSchema: nestedSchema })
    expect(result.results[0].isCorrect).toBe(true)
    expect(result.summary.correct).toBe(1)
  })

  it('rejects when nested schema field is wrong type', async () => {
    const nestedSchema = z.object({
      results: z.array(z.object({
        questionId: z.string(),
        isCorrect: z.boolean()
      }))
    })

    mockFetch.mockReturnValueOnce(mockOk({
      results: [{ questionId: 'q1', isCorrect: 'not-a-boolean' }]
    }))

    await expect(
      apiFetch('/api/exam', {}, { responseSchema: nestedSchema, retries: 1 })
    ).rejects.toThrow(ApiValidationError)
  })
})

// ============================================
// TESTS: TYPED ERRORS
// ============================================

describe('apiFetch — typed errors', () => {
  it('ApiTimeoutError has correct name and message', () => {
    const err = new ApiTimeoutError('/api/answer', 10000)
    expect(err.name).toBe('ApiTimeoutError')
    expect(err.message).toContain('10000ms')
    expect(err.message).toContain('/api/answer')
    expect(err).toBeInstanceOf(Error)
  })

  it('ApiHttpError has status and correct name', () => {
    const err = new ApiHttpError('/api/answer', 503)
    expect(err.name).toBe('ApiHttpError')
    expect(err.status).toBe(503)
    expect(err.message).toContain('503')
    expect(err).toBeInstanceOf(Error)
  })

  it('ApiNetworkError wraps cause message', () => {
    const err = new ApiNetworkError('/api/answer', new TypeError('Failed to fetch'))
    expect(err.name).toBe('ApiNetworkError')
    expect(err.message).toContain('Failed to fetch')
    expect(err).toBeInstanceOf(Error)
  })

  it('ApiNetworkError handles non-Error cause', () => {
    const err = new ApiNetworkError('/api/answer', 'string-error')
    expect(err.message).toContain('string-error')
  })

  it('ApiValidationError has correct name', () => {
    const err = new ApiValidationError('/api/answer', 'missing field')
    expect(err.name).toBe('ApiValidationError')
    expect(err.message).toContain('missing field')
    expect(err).toBeInstanceOf(Error)
  })

  it('errors can be caught with instanceof', async () => {
    mockFetch.mockReturnValueOnce(mockHttpError(400))

    try {
      await apiFetch('/api/test', {}, { retries: 1 })
      fail('Should have thrown')
    } catch (err) {
      expect(err instanceof ApiHttpError).toBe(true)
      expect(err instanceof ApiTimeoutError).toBe(false)
      expect(err instanceof ApiNetworkError).toBe(false)
    }
  })
})

// ============================================
// TESTS: DEFAULTS
// ============================================

describe('apiFetch — defaults', () => {
  it('uses default options when none provided', async () => {
    mockFetch.mockReturnValueOnce(mockOk({ ok: true }))

    const result = await apiFetch('/api/test', { a: 1 })
    expect(result).toEqual({ ok: true })
    const opts = mockFetch.mock.calls[0][1]
    expect(opts.signal).toBeInstanceOf(AbortSignal)
  })

  it('retries default 2 times on server error', async () => {
    mockFetch.mockReturnValue(mockHttpError(500))

    await expect(
      apiFetch('/api/test', {}, { retryDelayMs: 10 })
    ).rejects.toThrow(ApiHttpError)
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })
})

// ============================================
// TESTS: EDGE CASES
// ============================================

describe('apiFetch — edge cases', () => {
  it('handles empty response body gracefully', async () => {
    mockFetch.mockReturnValueOnce(Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve(null)
    }))

    const result = await apiFetch('/api/test', {})
    expect(result).toBeNull()
  })

  it('handles response with undefined fields', async () => {
    mockFetch.mockReturnValueOnce(mockOk({
      success: true,
      isCorrect: true,
      correctAnswer: 2,
      explanation: null,
      articleNumber: undefined
    }))

    const schema = z.object({
      success: z.boolean(),
      isCorrect: z.boolean(),
      correctAnswer: z.number(),
      explanation: z.string().nullable(),
      articleNumber: z.string().nullable().optional()
    })

    const result = await apiFetch('/api/answer', {}, { responseSchema: schema })
    expect(result.success).toBe(true)
    expect(result.explanation).toBeNull()
  })

  it('clearTimeout is always called (no timer leak on success)', async () => {
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout')
    mockFetch.mockReturnValueOnce(mockOk({ ok: true }))

    await apiFetch('/api/test', {}, { retries: 1 })

    expect(clearTimeoutSpy).toHaveBeenCalled()
    clearTimeoutSpy.mockRestore()
  })

  it('clearTimeout is called on error too (no timer leak on failure)', async () => {
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout')
    mockFetch.mockRejectedValueOnce(new TypeError('network'))

    await expect(
      apiFetch('/api/test', {}, { retries: 1, retryDelayMs: 10 })
    ).rejects.toThrow()

    expect(clearTimeoutSpy).toHaveBeenCalled()
    clearTimeoutSpy.mockRestore()
  })

  it('sends body as stringified JSON even if empty object', async () => {
    mockFetch.mockReturnValueOnce(mockOk({ ok: true }))

    await apiFetch('/api/test', {})

    const sentBody = mockFetch.mock.calls[0][1].body
    expect(sentBody).toBe('{}')
  })
})
