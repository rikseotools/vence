/**
 * Tests for email route handlers (dispute emails).
 * Tests the HTTP layer: request validation, response codes, and delegation to sendEmailV2.
 *
 * Note: We test the route handler logic by directly calling the POST function
 * with a mock Request object. We need to mock next/server since jsdom
 * doesn't have the full Web API.
 */

// Set env vars BEFORE any imports
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key'
process.env.RESEND_API_KEY = 'test-resend-key'

// All jest.mock factories are hoisted above const declarations,
// so we use jest.fn() directly inside factories and get references after import.

jest.mock('@/lib/api/emails', () => ({
  sendEmailV2: jest.fn(),
}))

jest.mock('server-only', () => ({}))

jest.mock('@supabase/supabase-js', () => {
  const single = jest.fn()
  return {
    createClient: jest.fn(() => ({
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single,
          }))
        }))
      }))
    })),
    __mockSingle: single,
  }
})

jest.mock('next/server', () => {
  class MockNextResponse {
    body: string
    status: number
    headers: Record<string, string>

    constructor(body: string, init?: { status?: number, headers?: Record<string, string> }) {
      this.body = body
      this.status = init?.status || 200
      this.headers = init?.headers || {}
    }

    async json() {
      return JSON.parse(this.body)
    }

    static json(data: unknown, init?: { status?: number }) {
      return new MockNextResponse(JSON.stringify(data), init)
    }
  }
  return { NextResponse: MockNextResponse }
})

import { POST } from '@/app/api/send-dispute-email/route'
import { sendEmailV2 } from '@/lib/api/emails'

// Get mock references after imports
const mockSendEmailV2 = sendEmailV2 as jest.Mock
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { __mockSingle: mockSupabaseSingle } = require('@supabase/supabase-js')

describe('send-dispute-email route', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  function createRequest(body: Record<string, unknown>) {
    return {
      json: async () => body
    } as unknown as Request
  }

  test('returns 400 when disputeId is missing', async () => {
    const request = createRequest({})

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.success).toBe(false)
    expect(data.error).toContain('disputeId')
  })

  test('returns 404 when dispute is not found', async () => {
    mockSupabaseSingle.mockResolvedValue({
      data: null,
      error: { message: 'not found' }
    })

    const response = await POST(createRequest({ disputeId: 'nonexistent-id' }))
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.success).toBe(false)
  })

  test('returns 200 without sending email when no admin_response', async () => {
    // Use status 'resolved' to avoid retry logic (pending triggers 3 retries)
    mockSupabaseSingle.mockResolvedValueOnce({
      data: {
        id: 'dispute-1',
        user_id: 'user-1',
        question_id: 'q-1',
        status: 'resolved',
        admin_response: null,
      },
      error: null
    })

    const response = await POST(createRequest({ disputeId: 'dispute-1' }))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.message).toContain('sin respuesta')
    expect(mockSendEmailV2).not.toHaveBeenCalled()
  })

  test('returns 200 with success when email sent successfully', async () => {
    mockSupabaseSingle
      // dispute data
      .mockResolvedValueOnce({
        data: {
          id: 'dispute-1',
          user_id: 'user-1',
          question_id: 'q-1',
          status: 'resolved',
          admin_response: 'Your question was correct.',
        },
        error: null
      })
      // user_profiles
      .mockResolvedValueOnce({
        data: { email: 'test@example.com', full_name: 'Test User' },
        error: null
      })
      // questions
      .mockResolvedValueOnce({
        data: { question_text: 'What is 2+2?' },
        error: null
      })

    mockSendEmailV2.mockResolvedValue({
      success: true,
      emailId: 'resend-123',
    })

    const response = await POST(createRequest({ disputeId: 'dispute-1' }))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.emailId).toBe('resend-123')
  })

  test('returns 200 with skipped when email cancelled by user preferences', async () => {
    mockSupabaseSingle
      .mockResolvedValueOnce({
        data: {
          id: 'dispute-1',
          user_id: 'user-1',
          question_id: 'q-1',
          status: 'resolved',
          admin_response: 'Response text',
        },
        error: null
      })
      .mockResolvedValueOnce({
        data: { email: 'test@example.com', full_name: 'Test User' },
        error: null
      })
      .mockResolvedValueOnce({
        data: { question_text: 'Test Q?' },
        error: null
      })

    mockSendEmailV2.mockResolvedValue({
      success: false,
      cancelled: true,
      reason: 'user_unsubscribed',
      message: 'User opted out',
    })

    const response = await POST(createRequest({ disputeId: 'dispute-1' }))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.skipped).toBe(true)
  })

  test('returns 500 when sendEmailV2 returns error', async () => {
    mockSupabaseSingle
      .mockResolvedValueOnce({
        data: {
          id: 'dispute-1',
          user_id: 'user-1',
          question_id: 'q-1',
          status: 'resolved',
          admin_response: 'Response text',
        },
        error: null
      })
      .mockResolvedValueOnce({
        data: { email: 'test@example.com', full_name: 'Test User' },
        error: null
      })
      .mockResolvedValueOnce({
        data: { question_text: 'Test Q?' },
        error: null
      })

    mockSendEmailV2.mockResolvedValue({
      success: false,
      error: 'Resend API error',
    })

    const response = await POST(createRequest({ disputeId: 'dispute-1' }))
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.success).toBe(false)
  })
})
