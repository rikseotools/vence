/**
 * Tests for canSendEmailType() wrapper in emailService.server.ts.
 * Core logic is tested in v2/canSendEmail.test.ts — these tests verify
 * the delegation layer (boolean conversion from CanSendResult).
 */

// Set env vars BEFORE any imports
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key'
process.env.RESEND_API_KEY = 'test-resend-key'

jest.mock('@/lib/api/emails', () => ({
  canSendEmail: jest.fn(),
  getEmailPreferencesV2: jest.fn(),
  sendEmailV2: jest.fn(),
  generateUnsubscribeToken: jest.fn(),
  getUnsubscribeUrl: jest.fn(() => 'https://www.vence.es/unsubscribe?token=test'),
}))

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({ from: jest.fn() })),
}))

jest.mock('server-only', () => ({}))

import { canSendEmailType, getEmailPreferences } from '@/lib/emails/emailService.server'
import { canSendEmail, getEmailPreferencesV2 } from '@/lib/api/emails'

const mockCanSendEmail = canSendEmail as jest.Mock
const mockGetEmailPreferencesV2 = getEmailPreferencesV2 as jest.Mock

describe('canSendEmailType', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  // =============================================
  // SOPORTE (Transactional)
  // =============================================
  describe('Soporte category (transactional)', () => {
    test.each(['impugnacion_respuesta', 'soporte_respuesta'])(
      '%s: returns true with all defaults',
      async (emailType) => {
        mockCanSendEmail.mockResolvedValue({ canSend: true })
        const result = await canSendEmailType('user-123', emailType)
        expect(result).toBe(true)
      }
    )

    test.each(['impugnacion_respuesta', 'soporte_respuesta'])(
      '%s: returns false when email_soporte_disabled is true',
      async (emailType) => {
        mockCanSendEmail.mockResolvedValue({ canSend: false, reason: 'soporte_disabled' })
        const result = await canSendEmailType('user-123', emailType)
        expect(result).toBe(false)
      }
    )

    test.each(['impugnacion_respuesta', 'soporte_respuesta'])(
      '%s: returns true even when unsubscribed_all is true (transactional)',
      async (emailType) => {
        mockCanSendEmail.mockResolvedValue({ canSend: true })
        const result = await canSendEmailType('user-123', emailType)
        expect(result).toBe(true)
      }
    )

    test.each(['impugnacion_respuesta', 'soporte_respuesta'])(
      '%s: returns true when email_soporte_disabled is null/undefined (defaults to enabled)',
      async (emailType) => {
        mockCanSendEmail.mockResolvedValue({ canSend: true })
        const result = await canSendEmailType('user-123', emailType)
        expect(result).toBe(true)
      }
    )
  })

  // =============================================
  // NEWSLETTER
  // =============================================
  describe('Newsletter category', () => {
    test.each(['newsletter', 'newsletter_oposicion'])(
      '%s: returns true with all defaults',
      async (emailType) => {
        mockCanSendEmail.mockResolvedValue({ canSend: true })
        const result = await canSendEmailType('user-123', emailType)
        expect(result).toBe(true)
      }
    )

    test.each(['newsletter', 'newsletter_oposicion'])(
      '%s: returns false when unsubscribed_all is true',
      async (emailType) => {
        mockCanSendEmail.mockResolvedValue({ canSend: false, reason: 'unsubscribed_all' })
        const result = await canSendEmailType('user-123', emailType)
        expect(result).toBe(false)
      }
    )

    test.each(['newsletter', 'newsletter_oposicion'])(
      '%s: returns false when email_newsletter_disabled is true',
      async (emailType) => {
        mockCanSendEmail.mockResolvedValue({ canSend: false, reason: 'newsletter_disabled' })
        const result = await canSendEmailType('user-123', emailType)
        expect(result).toBe(false)
      }
    )

    test.each(['newsletter', 'newsletter_oposicion'])(
      '%s: returns true when email_newsletter_disabled is null/undefined',
      async (emailType) => {
        mockCanSendEmail.mockResolvedValue({ canSend: true })
        const result = await canSendEmailType('user-123', emailType)
        expect(result).toBe(true)
      }
    )
  })

  // =============================================
  // MARKETING/ENGAGEMENT
  // =============================================
  describe('Marketing/Engagement category', () => {
    test('reactivacion: returns true with all defaults', async () => {
      mockCanSendEmail.mockResolvedValue({ canSend: true })
      expect(await canSendEmailType('user-123', 'reactivacion')).toBe(true)
    })

    test('reactivacion: returns false when unsubscribed_all', async () => {
      mockCanSendEmail.mockResolvedValue({ canSend: false, reason: 'unsubscribed_all' })
      expect(await canSendEmailType('user-123', 'reactivacion')).toBe(false)
    })

    test('reactivacion: returns false when email_reactivacion is false', async () => {
      mockCanSendEmail.mockResolvedValue({ canSend: false, reason: 'reactivacion_disabled' })
      expect(await canSendEmailType('user-123', 'reactivacion')).toBe(false)
    })

    test('urgente: returns true with all defaults', async () => {
      mockCanSendEmail.mockResolvedValue({ canSend: true })
      expect(await canSendEmailType('user-123', 'urgente')).toBe(true)
    })

    test('urgente: returns false when email_urgente is false', async () => {
      mockCanSendEmail.mockResolvedValue({ canSend: false, reason: 'urgente_disabled' })
      expect(await canSendEmailType('user-123', 'urgente')).toBe(false)
    })

    test('bienvenida_motivacional: returns true with all defaults', async () => {
      mockCanSendEmail.mockResolvedValue({ canSend: true })
      expect(await canSendEmailType('user-123', 'bienvenida_motivacional')).toBe(true)
    })

    test('bienvenida_motivacional: returns false when toggled off', async () => {
      mockCanSendEmail.mockResolvedValue({ canSend: false, reason: 'bienvenida_motivacional_disabled' })
      expect(await canSendEmailType('user-123', 'bienvenida_motivacional')).toBe(false)
    })

    test('bienvenida_inmediato: returns false when toggled off', async () => {
      mockCanSendEmail.mockResolvedValue({ canSend: false, reason: 'bienvenida_inmediato_disabled' })
      const result = await canSendEmailType('user-123', 'bienvenida_inmediato')
      expect(result).toBe(false)
    })

    test('resumen_semanal: returns false when toggled off', async () => {
      mockCanSendEmail.mockResolvedValue({ canSend: false, reason: 'resumen_semanal_disabled' })
      const result = await canSendEmailType('user-123', 'resumen_semanal')
      expect(result).toBe(false)
    })

    test('bienvenida_inmediato: returns false when unsubscribed_all', async () => {
      mockCanSendEmail.mockResolvedValue({ canSend: false, reason: 'unsubscribed_all' })
      expect(await canSendEmailType('user-123', 'bienvenida_inmediato')).toBe(false)
    })

    test('resumen_semanal: returns false when unsubscribed_all', async () => {
      mockCanSendEmail.mockResolvedValue({ canSend: false, reason: 'unsubscribed_all' })
      expect(await canSendEmailType('user-123', 'resumen_semanal')).toBe(false)
    })
  })

  // =============================================
  // UNKNOWN TYPES
  // =============================================
  describe('Unknown email types', () => {
    test('returns false for unknown email type', async () => {
      mockCanSendEmail.mockResolvedValue({ canSend: false, reason: 'Unknown email type: unknown_type' })
      expect(await canSendEmailType('user-123', 'unknown_type')).toBe(false)
    })
  })

  // =============================================
  // DELEGATION
  // =============================================
  describe('Delegation to v2', () => {
    test('passes userId and emailType to canSendEmail', async () => {
      mockCanSendEmail.mockResolvedValue({ canSend: true })
      await canSendEmailType('user-abc', 'reactivacion')
      expect(mockCanSendEmail).toHaveBeenCalledWith('user-abc', 'reactivacion')
    })

    test('extracts canSend boolean from CanSendResult', async () => {
      mockCanSendEmail.mockResolvedValue({ canSend: true, reason: undefined })
      expect(await canSendEmailType('u1', 'urgente')).toBe(true)

      mockCanSendEmail.mockResolvedValue({ canSend: false, reason: 'urgente_disabled' })
      expect(await canSendEmailType('u1', 'urgente')).toBe(false)
    })
  })
})

describe('getEmailPreferences', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('returns preferences when user has them', async () => {
    const mockPrefs = {
      email_reactivacion: true,
      email_urgente: false,
      email_bienvenida_motivacional: true,
      email_bienvenida_inmediato: false,
      email_resumen_semanal: true,
      unsubscribed_all: false,
      email_soporte_disabled: false,
      email_newsletter_disabled: true,
    }
    mockGetEmailPreferencesV2.mockResolvedValue(mockPrefs)

    const prefs = await getEmailPreferences('user-123')
    expect(prefs).toEqual(mockPrefs)
    expect(prefs.email_reactivacion).toBe(true)
    expect(prefs.email_urgente).toBe(false)
    expect(prefs.unsubscribed_all).toBe(false)
    expect(prefs.email_soporte_disabled).toBe(false)
    expect(prefs.email_newsletter_disabled).toBe(true)
  })

  test('email_bienvenida_inmediato with false from DB returns false', async () => {
    mockGetEmailPreferencesV2.mockResolvedValue({
      email_reactivacion: true,
      email_urgente: true,
      email_bienvenida_motivacional: true,
      email_bienvenida_inmediato: false,
      email_resumen_semanal: true,
      unsubscribed_all: false,
      email_soporte_disabled: false,
      email_newsletter_disabled: false,
    })

    const prefs = await getEmailPreferences('user-123')
    expect(prefs.email_bienvenida_inmediato).toBe(false)
  })

  test('creates defaults when user has no preferences (handled by v2)', async () => {
    mockGetEmailPreferencesV2.mockResolvedValue({
      email_reactivacion: true,
      email_urgente: true,
      email_bienvenida_motivacional: true,
      email_bienvenida_inmediato: true,
      email_resumen_semanal: true,
      unsubscribed_all: false,
      email_soporte_disabled: false,
      email_newsletter_disabled: false,
    })

    const prefs = await getEmailPreferences('user-123')
    expect(prefs.email_reactivacion).toBe(true)
    expect(prefs.unsubscribed_all).toBe(false)
  })

  test('returns error fallback (all disabled) on general DB error', async () => {
    mockGetEmailPreferencesV2.mockResolvedValue({
      email_reactivacion: false,
      email_urgente: false,
      email_bienvenida_motivacional: false,
      email_bienvenida_inmediato: false,
      email_resumen_semanal: false,
      unsubscribed_all: true,
      email_soporte_disabled: false,
      email_newsletter_disabled: true,
    })

    const prefs = await getEmailPreferences('user-123')
    expect(prefs.email_reactivacion).toBe(false)
    expect(prefs.unsubscribed_all).toBe(true)
  })

  test('delegates to getEmailPreferencesV2 with correct userId', async () => {
    mockGetEmailPreferencesV2.mockResolvedValue({
      email_reactivacion: true,
      email_urgente: true,
      email_bienvenida_motivacional: true,
      email_bienvenida_inmediato: true,
      email_resumen_semanal: true,
      unsubscribed_all: false,
      email_soporte_disabled: false,
      email_newsletter_disabled: false,
    })

    await getEmailPreferences('user-xyz')
    expect(mockGetEmailPreferencesV2).toHaveBeenCalledWith('user-xyz')
  })
})
