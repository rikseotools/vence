// __tests__/lib/api/v2/complete-test/client.test.ts
// Tests para completeTestOnServer() client-side

import type { CompleteTestRequest } from '@/lib/api/v2/complete-test/schemas'

// ============================================
// MOCK DE SUPABASE
// ============================================

const mockRefreshSession = jest.fn()
const mockGetSession = jest.fn()

jest.mock('@/lib/supabase', () => ({
  getSupabaseClient: () => ({
    auth: {
      refreshSession: mockRefreshSession,
      getSession: mockGetSession,
    },
  }),
}))

// ============================================
// MOCK DE FETCH
// ============================================

const mockFetch = jest.fn()
const originalFetch = global.fetch

beforeEach(() => {
  jest.clearAllMocks()
  global.fetch = mockFetch
  jest.spyOn(console, 'warn').mockImplementation(() => {})

  // Default: auth returns a valid token
  mockRefreshSession.mockResolvedValue({
    data: { session: { access_token: 'test-token-123' } },
  })
  mockGetSession.mockResolvedValue({
    data: { session: { access_token: 'fallback-token' } },
  })
})

afterAll(() => {
  global.fetch = originalFetch
})

// ============================================
// HELPERS
// ============================================

function mockOk(data: unknown) {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve(data),
  })
}

const VALID_UUID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'

function validRequest(overrides?: Partial<CompleteTestRequest>): CompleteTestRequest {
  return {
    sessionId: VALID_UUID,
    finalScore: 8,
    totalQuestions: 10,
    detailedAnswers: [
      {
        questionIndex: 0,
        selectedAnswer: 2,
        isCorrect: true,
        timeSpent: 5,
        confidence: 'sure',
        interactions: 1,
      },
    ],
    startTime: Date.now() - 60000,
    interactionEvents: [],
    ...overrides,
  }
}

function validResponse(overrides?: Record<string, unknown>) {
  return {
    success: true,
    status: 'saved' as const,
    savedQuestionsCount: 10,
    ...overrides,
  }
}

// Import after mocks are set up
import { completeTestOnServer } from '@/lib/api/v2/complete-test/client'

// ============================================
// TESTS: LLAMADA EXITOSA
// ============================================

describe('completeTestOnServer — success', () => {
  it('sends POST with Authorization header, correct body, and parses response', async () => {
    mockFetch.mockReturnValueOnce(mockOk(validResponse()))

    const params = validRequest()
    const result = await completeTestOnServer(params)

    // Verify fetch was called correctly
    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [url, opts] = mockFetch.mock.calls[0]
    expect(url).toBe('/api/v2/complete-test')
    expect(opts.method).toBe('POST')
    expect(opts.headers['Content-Type']).toBe('application/json')
    expect(opts.headers['Authorization']).toBe('Bearer test-token-123')

    // Verify body
    const body = JSON.parse(opts.body)
    expect(body.sessionId).toBe(VALID_UUID)
    expect(body.finalScore).toBe(8)
    expect(body.totalQuestions).toBe(10)
    expect(body.detailedAnswers).toHaveLength(1)

    // Verify parsed response
    expect(result.success).toBe(true)
    expect(result.status).toBe('saved')
    expect(result.savedQuestionsCount).toBe(10)
  })

  it('uses refreshSession token preferentially', async () => {
    mockFetch.mockReturnValueOnce(mockOk(validResponse()))

    await completeTestOnServer(validRequest())

    const opts = mockFetch.mock.calls[0][1]
    expect(opts.headers['Authorization']).toBe('Bearer test-token-123')
    // getSession should NOT have been called since refreshSession succeeded
    expect(mockGetSession).not.toHaveBeenCalled()
  })

  it('falls back to getSession when refreshSession returns no token', async () => {
    mockRefreshSession.mockResolvedValue({ data: { session: null } })
    mockFetch.mockReturnValueOnce(mockOk(validResponse()))

    await completeTestOnServer(validRequest())

    expect(mockGetSession).toHaveBeenCalledTimes(1)
    const opts = mockFetch.mock.calls[0][1]
    expect(opts.headers['Authorization']).toBe('Bearer fallback-token')
  })

  it('falls back to getSession when refreshSession throws', async () => {
    mockRefreshSession.mockRejectedValue(new Error('refresh failed'))
    mockFetch.mockReturnValueOnce(mockOk(validResponse()))

    await completeTestOnServer(validRequest())

    expect(mockGetSession).toHaveBeenCalledTimes(1)
    const opts = mockFetch.mock.calls[0][1]
    expect(opts.headers['Authorization']).toBe('Bearer fallback-token')
  })

  it('sends AbortSignal for timeout control', async () => {
    mockFetch.mockReturnValueOnce(mockOk(validResponse()))

    await completeTestOnServer(validRequest())

    const opts = mockFetch.mock.calls[0][1]
    expect(opts.signal).toBeInstanceOf(AbortSignal)
  })

  it('handles response without optional savedQuestionsCount', async () => {
    mockFetch.mockReturnValueOnce(
      mockOk({ success: true, status: 'saved' })
    )

    const result = await completeTestOnServer(validRequest())
    expect(result.success).toBe(true)
    expect(result.status).toBe('saved')
  })
})

// ============================================
// TESTS: SESSION_EXPIRED (sin token)
// ============================================

describe('completeTestOnServer — SESSION_EXPIRED (no token)', () => {
  it('throws SESSION_EXPIRED when both auth methods return no token', async () => {
    mockRefreshSession.mockResolvedValue({ data: { session: null } })
    mockGetSession.mockResolvedValue({ data: { session: null } })

    await expect(completeTestOnServer(validRequest())).rejects.toThrow('SESSION_EXPIRED')
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('throws SESSION_EXPIRED when refreshSession throws and getSession has no token', async () => {
    mockRefreshSession.mockRejectedValue(new Error('network error'))
    mockGetSession.mockResolvedValue({ data: { session: null } })

    await expect(completeTestOnServer(validRequest())).rejects.toThrow('SESSION_EXPIRED')
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('throws SESSION_EXPIRED when session exists but access_token is undefined', async () => {
    mockRefreshSession.mockResolvedValue({
      data: { session: { access_token: undefined } },
    })
    mockGetSession.mockResolvedValue({
      data: { session: { access_token: undefined } },
    })

    await expect(completeTestOnServer(validRequest())).rejects.toThrow('SESSION_EXPIRED')
    expect(mockFetch).not.toHaveBeenCalled()
  })
})

// ============================================
// TESTS: 401 DEL SERVIDOR
// ============================================

describe('completeTestOnServer — 401 from server', () => {
  it('throws SESSION_EXPIRED on 401 response', async () => {
    mockFetch.mockReturnValueOnce(
      Promise.resolve({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ error: 'Unauthorized' }),
      })
    )

    await expect(completeTestOnServer(validRequest())).rejects.toThrow('SESSION_EXPIRED')
  })
})

// ============================================
// TESTS: ERROR HTTP 500
// ============================================

describe('completeTestOnServer — HTTP errors', () => {
  it('throws on 500 server error', async () => {
    mockFetch.mockReturnValueOnce(
      Promise.resolve({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: 'Internal Server Error' }),
      })
    )

    await expect(completeTestOnServer(validRequest())).rejects.toThrow('HTTP 500')
  })

  it('throws on 400 bad request', async () => {
    mockFetch.mockReturnValueOnce(
      Promise.resolve({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ error: 'Bad request' }),
      })
    )

    await expect(completeTestOnServer(validRequest())).rejects.toThrow('HTTP 400')
  })

  it('throws on 403 forbidden', async () => {
    mockFetch.mockReturnValueOnce(
      Promise.resolve({
        ok: false,
        status: 403,
        json: () => Promise.resolve({ error: 'Forbidden' }),
      })
    )

    await expect(completeTestOnServer(validRequest())).rejects.toThrow('HTTP 403')
  })
})

// ============================================
// TESTS: TIMEOUT (15s)
// ============================================

describe('completeTestOnServer — timeout', () => {
  it('throws timeout error when AbortError is raised', async () => {
    // Simulate what happens when AbortController.abort() fires:
    // fetch rejects with a DOMException AbortError
    mockFetch.mockRejectedValueOnce(
      new DOMException('The operation was aborted.', 'AbortError')
    )

    await expect(completeTestOnServer(validRequest())).rejects.toThrow(
      'Timeout after 15000ms'
    )
  })

  it('passes AbortSignal to fetch for timeout control', async () => {
    mockFetch.mockReturnValueOnce(mockOk(validResponse()))

    await completeTestOnServer(validRequest())

    const opts = mockFetch.mock.calls[0][1]
    expect(opts.signal).toBeInstanceOf(AbortSignal)
  })
})

// ============================================
// TESTS: JSON INVALIDO EN RESPUESTA (fallback)
// ============================================

describe('completeTestOnServer — invalid JSON / schema mismatch', () => {
  it('uses fallback when response does not match schema', async () => {
    mockFetch.mockReturnValueOnce(
      mockOk({ unexpected: 'shape', success: true })
    )

    const result = await completeTestOnServer(validRequest())

    // Fallback: { success: !!data?.success, status: data?.status || 'error' }
    expect(result.success).toBe(true)
    expect(result.status).toBe('error') // no status in response, defaults to 'error'
  })

  it('uses fallback with success=false when data.success is falsy', async () => {
    mockFetch.mockReturnValueOnce(mockOk({ random: 'data' }))

    const result = await completeTestOnServer(validRequest())

    expect(result.success).toBe(false)
    expect(result.status).toBe('error')
  })

  it('uses fallback preserving status from response when present', async () => {
    mockFetch.mockReturnValueOnce(
      mockOk({ success: false, status: 'error', extra: 'field' })
    )

    const result = await completeTestOnServer(validRequest())

    expect(result.success).toBe(false)
    expect(result.status).toBe('error')
  })

  it('logs warning when schema parse fails', async () => {
    const warnSpy = jest.spyOn(console, 'warn')
    mockFetch.mockReturnValueOnce(mockOk({ wrong: 'data' }))

    await completeTestOnServer(validRequest())

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('[complete-test client]'),
      expect.anything()
    )
  })

  it('handles json() throwing an error', async () => {
    mockFetch.mockReturnValueOnce(
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.reject(new SyntaxError('Unexpected token')),
      })
    )

    await expect(completeTestOnServer(validRequest())).rejects.toThrow()
  })
})

// ============================================
// TESTS: clearTimeout (no memory leak)
// ============================================

describe('completeTestOnServer — clearTimeout (no memory leak)', () => {
  it('calls clearTimeout on successful response', async () => {
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout')
    mockFetch.mockReturnValueOnce(mockOk(validResponse()))

    await completeTestOnServer(validRequest())

    // clearTimeout should be called at least once (in the try block)
    expect(clearTimeoutSpy).toHaveBeenCalled()
    clearTimeoutSpy.mockRestore()
  })

  it('calls clearTimeout on HTTP error', async () => {
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout')
    mockFetch.mockReturnValueOnce(
      Promise.resolve({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: 'fail' }),
      })
    )

    await expect(completeTestOnServer(validRequest())).rejects.toThrow()

    // clearTimeout called in the catch block
    expect(clearTimeoutSpy).toHaveBeenCalled()
    clearTimeoutSpy.mockRestore()
  })

  it('calls clearTimeout on network error', async () => {
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout')
    mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'))

    await expect(completeTestOnServer(validRequest())).rejects.toThrow()

    expect(clearTimeoutSpy).toHaveBeenCalled()
    clearTimeoutSpy.mockRestore()
  })

  it('calls clearTimeout on 401 error', async () => {
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout')
    mockFetch.mockReturnValueOnce(
      Promise.resolve({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ error: 'Unauthorized' }),
      })
    )

    await expect(completeTestOnServer(validRequest())).rejects.toThrow('SESSION_EXPIRED')

    expect(clearTimeoutSpy).toHaveBeenCalled()
    clearTimeoutSpy.mockRestore()
  })
})
