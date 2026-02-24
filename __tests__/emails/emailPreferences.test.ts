/**
 * Tests for email preferences logic (delegation layer).
 * Core 3-category logic is tested in v2/canSendEmail.test.ts.
 * These tests verify the wrappers in emailService.server.ts work correctly.
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

import { getEmailPreferences, canSendEmailType } from '@/lib/emails/emailService.server'
import { getEmailPreferencesV2, canSendEmail } from '@/lib/api/emails'

const mockGetEmailPreferencesV2 = getEmailPreferencesV2 as jest.Mock
const mockCanSendEmail = canSendEmail as jest.Mock

describe('Email Preferences - 3 Category System', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Category 1: Soporte (transactional)', () => {
    test('soporte emails are independent from unsubscribed_all', async () => {
      mockCanSendEmail.mockResolvedValue({ canSend: true })
      expect(await canSendEmailType('u1', 'soporte_respuesta')).toBe(true)
      expect(await canSendEmailType('u1', 'impugnacion_respuesta')).toBe(true)
    })

    test('soporte emails can be disabled independently', async () => {
      mockCanSendEmail.mockResolvedValue({ canSend: false, reason: 'soporte_disabled' })
      expect(await canSendEmailType('u1', 'soporte_respuesta')).toBe(false)
      expect(await canSendEmailType('u1', 'impugnacion_respuesta')).toBe(false)
    })
  })

  describe('Category 2: Newsletter', () => {
    test('newsletter blocked by unsubscribed_all', async () => {
      mockCanSendEmail.mockResolvedValue({ canSend: false, reason: 'unsubscribed_all' })
      expect(await canSendEmailType('u1', 'newsletter')).toBe(false)
      expect(await canSendEmailType('u1', 'newsletter_oposicion')).toBe(false)
    })

    test('newsletter blocked by its own toggle', async () => {
      mockCanSendEmail.mockResolvedValue({ canSend: false, reason: 'newsletter_disabled' })
      expect(await canSendEmailType('u1', 'newsletter')).toBe(false)
    })

    test('newsletter allowed when both toggles are off', async () => {
      mockCanSendEmail.mockResolvedValue({ canSend: true })
      expect(await canSendEmailType('u1', 'newsletter')).toBe(true)
    })
  })

  describe('Category 3: Marketing/Engagement (master toggle)', () => {
    test('all marketing blocked by unsubscribed_all', async () => {
      const types = ['reactivacion', 'urgente', 'bienvenida_motivacional', 'bienvenida_inmediato', 'resumen_semanal']
      for (const type of types) {
        mockCanSendEmail.mockResolvedValue({ canSend: false, reason: 'unsubscribed_all' })
        expect(await canSendEmailType('u1', type)).toBe(false)
      }
    })

    test('individual toggles work for normal marketing types', async () => {
      mockCanSendEmail.mockResolvedValue({ canSend: false, reason: 'reactivacion_disabled' })
      expect(await canSendEmailType('u1', 'reactivacion')).toBe(false)

      mockCanSendEmail.mockResolvedValue({ canSend: false, reason: 'urgente_disabled' })
      expect(await canSendEmailType('u1', 'urgente')).toBe(false)

      mockCanSendEmail.mockResolvedValue({ canSend: false, reason: 'bienvenida_motivacional_disabled' })
      expect(await canSendEmailType('u1', 'bienvenida_motivacional')).toBe(false)
    })
  })

  describe('Default preferences creation', () => {
    test('creates defaults when no record exists (handled by v2)', async () => {
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

      const prefs = await getEmailPreferences('new-user')
      expect(prefs.email_reactivacion).toBe(true)
      expect(prefs.unsubscribed_all).toBe(false)
    })

    test('falls back to all-disabled on general error (handled by v2)', async () => {
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

      const prefs = await getEmailPreferences('user-error')
      expect(prefs.email_reactivacion).toBe(false)
      expect(prefs.unsubscribed_all).toBe(true)
    })
  })

  describe('Edge cases', () => {
    test('new columns (soporte/newsletter) default to enabled when null (handled by v2)', async () => {
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

      const prefs = await getEmailPreferences('old-user')
      expect(prefs.email_soporte_disabled).toBe(false)
      expect(prefs.email_newsletter_disabled).toBe(false)
    })
  })
})
