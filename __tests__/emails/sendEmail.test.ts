/**
 * Tests for sendEmail() wrapper in emailService.server.ts.
 * Core logic is tested in v2 — these tests verify delegation to sendEmailV2.
 */

// Set env vars BEFORE any imports
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key'
process.env.RESEND_API_KEY = 'test-resend-key'
process.env.EMAIL_FROM_NAME = 'Vence'
process.env.EMAIL_FROM_ADDRESS = 'info@vence.es'

jest.mock('@/lib/api/emails', () => ({
  sendEmailV2: jest.fn(),
  canSendEmail: jest.fn(),
  getEmailPreferencesV2: jest.fn(),
  generateUnsubscribeToken: jest.fn(),
  getUnsubscribeUrl: jest.fn(() => 'https://www.vence.es/unsubscribe?token=test'),
}))

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({ from: jest.fn() })),
}))

jest.mock('server-only', () => ({}))

import { sendEmail } from '@/lib/emails/emailService.server'
import { sendEmailV2 } from '@/lib/api/emails'

const mockSendEmailV2 = sendEmailV2 as jest.Mock

describe('sendEmail', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('returns cancelled when canSendEmailType returns false', async () => {
    mockSendEmailV2.mockResolvedValue({
      success: false,
      cancelled: true,
      reason: 'user_unsubscribed',
      message: 'Email reactivacion blocked: user_unsubscribed',
    })

    const result = await sendEmail('user-123', 'reactivacion', {})

    expect(result.success).toBe(false)
    expect(result.cancelled).toBe(true)
    expect(result.reason).toBe('user_unsubscribed')
    expect(mockSendEmailV2).toHaveBeenCalledTimes(1)
  })

  test('returns success with emailId when Resend succeeds', async () => {
    mockSendEmailV2.mockResolvedValue({
      success: true,
      emailId: 'resend-email-123',
    })

    const result = await sendEmail('user-123', 'reactivacion', {
      daysInactive: 7
    })

    expect(result.success).toBe(true)
    expect(result.emailId).toBe('resend-email-123')
    expect(mockSendEmailV2).toHaveBeenCalledTimes(1)
  })

  test('returns error when Resend returns an error', async () => {
    mockSendEmailV2.mockResolvedValue({
      success: false,
      error: 'Rate limit exceeded',
    })

    const result = await sendEmail('user-123', 'reactivacion', {})

    expect(result.success).toBe(false)
    expect(result.error).toContain('Rate limit')
  })

  test('returns error when user not found', async () => {
    mockSendEmailV2.mockResolvedValue({
      success: false,
      error: 'Usuario no encontrado o sin email: nonexistent-user',
    })

    const result = await sendEmail('nonexistent-user', 'reactivacion', {})

    expect(result.success).toBe(false)
    expect(result.error).toContain('no encontrado')
  })

  test('delegates with correct parameters to sendEmailV2', async () => {
    mockSendEmailV2.mockResolvedValue({
      success: true,
      emailId: 'resend-123',
    })

    await sendEmail('user-123', 'reactivacion', { daysInactive: 5 })

    expect(mockSendEmailV2).toHaveBeenCalledWith({
      userId: 'user-123',
      emailType: 'reactivacion',
      customData: { daysInactive: 5 },
    })
  })

  test('soporte_respuesta: sends even with unsubscribed_all (handled by v2)', async () => {
    mockSendEmailV2.mockResolvedValue({
      success: true,
      emailId: 'resend-soporte-123',
    })

    const result = await sendEmail('user-123', 'soporte_respuesta', {
      adminMessage: 'Hello',
      chatUrl: 'https://vence.es/soporte',
    })

    expect(result.success).toBe(true)
    expect(mockSendEmailV2).toHaveBeenCalledWith({
      userId: 'user-123',
      emailType: 'soporte_respuesta',
      customData: {
        adminMessage: 'Hello',
        chatUrl: 'https://vence.es/soporte',
      },
    })
  })

  test('impugnacion_respuesta: delegates custom dispute data', async () => {
    mockSendEmailV2.mockResolvedValue({
      success: true,
      emailId: 'resend-dispute-123',
    })

    await sendEmail('user-123', 'impugnacion_respuesta', {
      status: 'accepted',
      adminResponse: 'Correcto',
      questionText: 'Test question',
      disputeUrl: 'https://vence.es/dispute/123',
    })

    expect(mockSendEmailV2).toHaveBeenCalledWith({
      userId: 'user-123',
      emailType: 'impugnacion_respuesta',
      customData: {
        status: 'accepted',
        adminResponse: 'Correcto',
        questionText: 'Test question',
        disputeUrl: 'https://vence.es/dispute/123',
      },
    })
  })
})
