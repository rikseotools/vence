/**
 * Tests for canSendEmail() in v2 module.
 * Tests the 3-category system with proper type → category mapping.
 */

// Mock Drizzle before imports
const mockSelect = jest.fn()
const mockFrom = jest.fn()
const mockWhere = jest.fn()
const mockLimit = jest.fn()

jest.mock('@/db/client', () => ({
  getDb: jest.fn(() => ({
    select: mockSelect,
    insert: jest.fn(() => ({
      values: jest.fn(() => ({
        onConflictDoUpdate: jest.fn(() => ({
          returning: jest.fn().mockResolvedValue([]),
        })),
      })),
    })),
  })),
}))

jest.mock('@/db/schema', () => ({
  emailPreferences: {
    emailReactivacion: 'email_reactivacion',
    emailUrgente: 'email_urgente',
    emailBienvenidaMotivacional: 'email_bienvenida_motivacional',
    emailBienvenidaInmediato: 'email_bienvenida_inmediato',
    emailResumenSemanal: 'email_resumen_semanal',
    unsubscribedAll: 'unsubscribed_all',
    emailSoporteDisabled: 'email_soporte_disabled',
    emailNewsletterDisabled: 'email_newsletter_disabled',
    userId: 'user_id',
    updatedAt: 'updated_at',
  },
  emailLogs: {},
  emailEvents: {},
  emailUnsubscribeTokens: {},
  userProfiles: {},
}))

jest.mock('drizzle-orm', () => ({
  eq: jest.fn(),
}))

jest.mock('resend', () => ({
  Resend: jest.fn(),
}))

jest.mock('@/lib/emails/templates', () => ({
  emailTemplates: {},
}))

import { canSendEmail } from '@/lib/api/emails/queries'
import type { EmailType } from '@/lib/api/emails/schemas'

describe('canSendEmail (v2)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  function mockPrefs(prefs: Record<string, unknown>) {
    const row = {
      email_reactivacion: true,
      email_urgente: true,
      email_bienvenida_motivacional: true,
      email_bienvenida_inmediato: true,
      email_resumen_semanal: true,
      unsubscribed_all: false,
      email_soporte_disabled: false,
      email_newsletter_disabled: false,
      ...prefs,
    }
    mockLimit.mockResolvedValue([row])
    mockWhere.mockReturnValue({ limit: mockLimit })
    mockFrom.mockReturnValue({ where: mockWhere })
    mockSelect.mockReturnValue({ from: mockFrom })
  }

  // =============================================
  // SOPORTE (Transactional)
  // =============================================
  describe('Soporte category (transactional)', () => {
    const soporteTypes: EmailType[] = ['impugnacion_respuesta', 'soporte_respuesta']

    test.each(soporteTypes)('%s: canSend with defaults', async (type) => {
      mockPrefs({})
      const result = await canSendEmail('u1', type)
      expect(result.canSend).toBe(true)
    })

    test.each(soporteTypes)('%s: canSend even with unsubscribed_all', async (type) => {
      mockPrefs({ unsubscribed_all: true })
      const result = await canSendEmail('u1', type)
      expect(result.canSend).toBe(true)
    })

    test.each(soporteTypes)('%s: blocked by email_soporte_disabled', async (type) => {
      mockPrefs({ email_soporte_disabled: true })
      const result = await canSendEmail('u1', type)
      expect(result.canSend).toBe(false)
      expect(result.reason).toBe('soporte_disabled')
    })
  })

  // =============================================
  // NEWSLETTER
  // =============================================
  describe('Newsletter category', () => {
    const newsletterTypes: EmailType[] = ['newsletter', 'newsletter_oposicion']

    test.each(newsletterTypes)('%s: canSend with defaults', async (type) => {
      mockPrefs({})
      const result = await canSendEmail('u1', type)
      expect(result.canSend).toBe(true)
    })

    test.each(newsletterTypes)('%s: blocked by unsubscribed_all', async (type) => {
      mockPrefs({ unsubscribed_all: true })
      const result = await canSendEmail('u1', type)
      expect(result.canSend).toBe(false)
      expect(result.reason).toBe('unsubscribed_all')
    })

    test.each(newsletterTypes)('%s: blocked by email_newsletter_disabled', async (type) => {
      mockPrefs({ email_newsletter_disabled: true })
      const result = await canSendEmail('u1', type)
      expect(result.canSend).toBe(false)
      expect(result.reason).toBe('newsletter_disabled')
    })
  })

  // =============================================
  // MARKETING
  // =============================================
  describe('Marketing category', () => {
    test('reactivacion: canSend with defaults', async () => {
      mockPrefs({})
      expect((await canSendEmail('u1', 'reactivacion')).canSend).toBe(true)
    })

    test('reactivacion: blocked by unsubscribed_all', async () => {
      mockPrefs({ unsubscribed_all: true })
      const result = await canSendEmail('u1', 'reactivacion')
      expect(result.canSend).toBe(false)
      expect(result.reason).toBe('unsubscribed_all')
    })

    test('reactivacion: blocked by individual toggle', async () => {
      mockPrefs({ email_reactivacion: false })
      const result = await canSendEmail('u1', 'reactivacion')
      expect(result.canSend).toBe(false)
      expect(result.reason).toBe('reactivacion_disabled')
    })

    test('bienvenida_inmediato: respects false toggle (no || true bug)', async () => {
      mockPrefs({ email_bienvenida_inmediato: false })
      const result = await canSendEmail('u1', 'bienvenida_inmediato')
      expect(result.canSend).toBe(false)
    })

    test('resumen_semanal: respects false toggle (no || true bug)', async () => {
      mockPrefs({ email_resumen_semanal: false })
      const result = await canSendEmail('u1', 'resumen_semanal')
      expect(result.canSend).toBe(false)
    })

    test('urgente: blocked by individual toggle', async () => {
      mockPrefs({ email_urgente: false })
      expect((await canSendEmail('u1', 'urgente')).canSend).toBe(false)
    })

    test('bienvenida_motivacional: blocked by individual toggle', async () => {
      mockPrefs({ email_bienvenida_motivacional: false })
      expect((await canSendEmail('u1', 'bienvenida_motivacional')).canSend).toBe(false)
    })
  })

  // =============================================
  // SOPORTE: recordatorio_renovacion (transactional)
  // =============================================
  describe('recordatorio_renovacion (soporte/transactional)', () => {
    test('canSend with defaults', async () => {
      mockPrefs({})
      const result = await canSendEmail('u1', 'recordatorio_renovacion')
      expect(result.canSend).toBe(true)
    })

    test('canSend even with unsubscribed_all (transactional)', async () => {
      mockPrefs({ unsubscribed_all: true })
      const result = await canSendEmail('u1', 'recordatorio_renovacion')
      expect(result.canSend).toBe(true)
    })

    test('blocked by email_soporte_disabled', async () => {
      mockPrefs({ email_soporte_disabled: true })
      const result = await canSendEmail('u1', 'recordatorio_renovacion')
      expect(result.canSend).toBe(false)
      expect(result.reason).toBe('soporte_disabled')
    })
  })

  // =============================================
  // MARKETING: lanzamiento_premium, mejoras_producto, modal_articulos_mejora
  // =============================================
  describe('Reclassified marketing types', () => {
    const marketingTypes: EmailType[] = ['lanzamiento_premium', 'mejoras_producto', 'modal_articulos_mejora']

    test.each(marketingTypes)('%s: canSend with defaults', async (type) => {
      mockPrefs({})
      const result = await canSendEmail('u1', type)
      expect(result.canSend).toBe(true)
    })

    test.each(marketingTypes)('%s: blocked by unsubscribed_all', async (type) => {
      mockPrefs({ unsubscribed_all: true })
      const result = await canSendEmail('u1', type)
      expect(result.canSend).toBe(false)
      expect(result.reason).toBe('unsubscribed_all')
    })
  })

  // =============================================
  // ADMIN (only admin_notification)
  // =============================================
  describe('Admin category', () => {
    test('admin_notification: always canSend (no preference check)', async () => {
      const result = await canSendEmail('u1', 'admin_notification')
      expect(result.canSend).toBe(true)
    })
  })
})
