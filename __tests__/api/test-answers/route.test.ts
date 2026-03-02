/**
 * Tests para la API route POST /api/test/save-answer
 * Verifica auth, validacion y insert paths
 */

// Set env vars BEFORE any imports
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'

// Mock Supabase before imports
const mockGetUser = jest.fn()
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    auth: {
      getUser: mockGetUser,
    },
  })),
}))

// Mock insert
const mockInsertTestAnswer = jest.fn()
jest.mock('@/lib/api/test-answers', () => ({
  safeParseSaveAnswerRequest: jest.requireActual('@/lib/api/test-answers/schemas').safeParseSaveAnswerRequest,
  insertTestAnswer: (...args: unknown[]) => mockInsertTestAnswer(...args),
}))

// Mock next/server with proper NextRequest/NextResponse
jest.mock('next/server', () => {
  class MockHeaders {
    private _headers: Record<string, string> = {}
    constructor(init?: Record<string, string> | [string, string][]) {
      if (init) {
        if (Array.isArray(init)) {
          for (const [k, v] of init) this._headers[k.toLowerCase()] = v
        } else {
          for (const [k, v] of Object.entries(init)) this._headers[k.toLowerCase()] = v
        }
      }
    }
    get(name: string) { return this._headers[name.toLowerCase()] || null }
    set(name: string, value: string) { this._headers[name.toLowerCase()] = value }
    has(name: string) { return name.toLowerCase() in this._headers }
  }

  class MockNextRequest {
    method: string
    headers: MockHeaders
    private _body: string | null

    constructor(url: string, init?: { method?: string; headers?: Record<string, string>; body?: string }) {
      this.method = init?.method || 'GET'
      this.headers = new MockHeaders(init?.headers)
      this._body = init?.body ?? null
    }

    async json() {
      if (!this._body) throw new Error('No body')
      return JSON.parse(this._body)
    }
  }

  class MockNextResponse {
    private _body: string
    status: number
    headers: MockHeaders

    constructor(body: string, init?: { status?: number; headers?: Record<string, string> }) {
      this._body = body
      this.status = init?.status || 200
      this.headers = new MockHeaders({ 'content-type': 'application/json', ...init?.headers })
    }

    async json() { return JSON.parse(this._body) }

    static json(data: unknown, init?: { status?: number }) {
      return new MockNextResponse(JSON.stringify(data), init)
    }
  }

  return { NextRequest: MockNextRequest, NextResponse: MockNextResponse }
})

import { POST, GET } from '@/app/api/test/save-answer/route'
import { NextRequest } from 'next/server'

// ============================================
// HELPERS
// ============================================

function makeRequest(
  body: unknown,
  headers: Record<string, string> = {},
): NextRequest {
  return new NextRequest('http://localhost:3000/api/test/save-answer', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(body),
  })
}

const validBody = {
  sessionId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  questionData: {
    question: 'Test question',
    options: ['A', 'B', 'C', 'D'],
  },
  answerData: {
    questionIndex: 0,
    selectedAnswer: 1,
    correctAnswer: 1,
    isCorrect: true,
    timeSpent: 10,
  },
}

const validUser = { id: 'user-123', email: 'test@test.com' }

// ============================================
// TESTS
// ============================================

describe('POST /api/test/save-answer', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: validUser }, error: null })
    mockInsertTestAnswer.mockResolvedValue({
      success: true,
      question_id: 'q1',
      action: 'saved_new',
    })
  })

  // --- Auth ---

  it('debe retornar 401 sin header Authorization', async () => {
    const req = makeRequest(validBody)
    const res = await POST(req)
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.success).toBe(false)
    expect(json.error).toContain('No autorizado')
  })

  it('debe retornar 401 con Bearer invalido', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: { message: 'invalid' } })
    const req = makeRequest(validBody, { authorization: 'Bearer invalid-token' })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('debe retornar 401 con token expirado', async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: null },
      error: { message: 'Token expired' },
    })
    const req = makeRequest(validBody, { authorization: 'Bearer expired-token' })
    const res = await POST(req)
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.error).toContain('no autenticado')
  })

  it('debe continuar con token valido', async () => {
    const req = makeRequest(validBody, { authorization: 'Bearer valid-token' })
    const res = await POST(req)
    expect(res.status).toBe(200)
  })

  it('debe incluir mensaje de error apropiado en 401', async () => {
    const req = makeRequest(validBody)
    const res = await POST(req)
    const json = await res.json()
    expect(json.action).toBe('error')
  })

  // --- Validacion ---

  it('debe retornar 400 con body invalido', async () => {
    const req = makeRequest({ sessionId: 'not-uuid' }, { authorization: 'Bearer valid-token' })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.success).toBe(false)
  })

  it('debe retornar error con JSON invalido', async () => {
    const req = new NextRequest('http://localhost:3000/api/test/save-answer', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer valid-token',
      },
      body: 'not json{{{',
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toContain('JSON invalido')
  })

  it('debe pasar body valido al insert', async () => {
    const req = makeRequest(validBody, { authorization: 'Bearer valid-token' })
    await POST(req)
    expect(mockInsertTestAnswer).toHaveBeenCalledTimes(1)
    expect(mockInsertTestAnswer).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: validBody.sessionId }),
      validUser.id,
    )
  })

  it('debe incluir mensaje descriptivo en error de validacion', async () => {
    const req = makeRequest(
      { sessionId: 'bad', questionData: {}, answerData: {} },
      { authorization: 'Bearer valid-token' },
    )
    const res = await POST(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toContain('Validacion')
  })

  // --- Insert paths ---

  it('debe retornar 200 para saved_new', async () => {
    const req = makeRequest(validBody, { authorization: 'Bearer valid-token' })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.action).toBe('saved_new')
  })

  it('debe retornar 200 para already_saved', async () => {
    mockInsertTestAnswer.mockResolvedValueOnce({
      success: true,
      question_id: 'q1',
      action: 'already_saved',
    })
    const req = makeRequest(validBody, { authorization: 'Bearer valid-token' })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.action).toBe('already_saved')
  })

  it('debe retornar 500 para action error', async () => {
    mockInsertTestAnswer.mockResolvedValueOnce({
      success: false,
      action: 'error',
      error: 'DB down',
    })
    const req = makeRequest(validBody, { authorization: 'Bearer valid-token' })
    const res = await POST(req)
    expect(res.status).toBe(500)
  })

  it('debe incluir question_id en response', async () => {
    const req = makeRequest(validBody, { authorization: 'Bearer valid-token' })
    const res = await POST(req)
    const json = await res.json()
    expect(json.question_id).toBe('q1')
  })

  // --- Edge cases ---

  it('GET debe retornar 405', async () => {
    const res = await GET()
    expect(res.status).toBe(405)
    const json = await res.json()
    expect(json.error).toContain('no permitido')
  })

  it('debe retornar 500 si insertTestAnswer lanza excepcion', async () => {
    mockInsertTestAnswer.mockRejectedValueOnce(new Error('Unexpected'))
    const req = makeRequest(validBody, { authorization: 'Bearer valid-token' })
    const res = await POST(req)
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.success).toBe(false)
    expect(json.error).toContain('Error interno')
  })

  it('debe manejar arrays vacios en body', async () => {
    const req = makeRequest(
      { ...validBody, interactionEvents: [], mouseEvents: [], scrollEvents: [] },
      { authorization: 'Bearer valid-token' },
    )
    const res = await POST(req)
    expect(res.status).toBe(200)
  })

  it('debe retornar Content-Type application/json', async () => {
    const req = makeRequest(validBody, { authorization: 'Bearer valid-token' })
    const res = await POST(req)
    expect(res.headers.get('content-type')).toContain('application/json')
  })
})
