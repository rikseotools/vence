/**
 * Tests that sendEmailV2's template dispatch produces valid HTML for ALL template types.
 * These tests use REAL templates (not mocked) to catch signature mismatches.
 * Resend and DB are mocked — only template rendering is real.
 */

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key'
process.env.RESEND_API_KEY = 'test-resend-key'

// Mock Drizzle DB
const mockInsertValues = jest.fn().mockReturnValue({
  onConflictDoUpdate: jest.fn().mockReturnValue({
    returning: jest.fn().mockResolvedValue([{
      email_reactivacion: true,
      email_urgente: true,
      email_bienvenida_motivacional: true,
      email_bienvenida_inmediato: true,
      email_resumen_semanal: true,
      unsubscribed_all: false,
      email_soporte_disabled: false,
      email_newsletter_disabled: false,
    }]),
  }),
})
const mockInsertToken = jest.fn().mockReturnValue({
  values: jest.fn().mockReturnValue({
    returning: jest.fn().mockResolvedValue([{ token: 'test-token-abc' }]),
  }),
})

jest.mock('@/db/client', () => ({
  getDb: jest.fn(() => ({
    select: jest.fn().mockReturnValue({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue([{
            email_reactivacion: true,
            email_urgente: true,
            email_bienvenida_motivacional: true,
            email_bienvenida_inmediato: true,
            email_resumen_semanal: true,
            unsubscribed_all: false,
            email_soporte_disabled: false,
            email_newsletter_disabled: false,
          }]),
        }),
      }),
    }),
    insert: jest.fn((table) => {
      // Return different mock chains depending on the table
      if (table === 'email_unsubscribe_tokens' || table?.token) {
        return mockInsertToken()
      }
      return { values: mockInsertValues }
    }),
  })),
}))

jest.mock('@/db/schema', () => ({
  emailPreferences: { userId: 'user_id' },
  emailLogs: {},
  emailEvents: {},
  emailUnsubscribeTokens: { token: 'token' },
  userProfiles: {},
}))

jest.mock('drizzle-orm', () => ({
  eq: jest.fn(),
  sql: jest.fn(),
}))

// Capture what Resend.send() receives
let lastResendCall: { subject: string; html: string; to: string } | null = null
jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: {
      send: jest.fn().mockImplementation((params) => {
        lastResendCall = { subject: params.subject, html: params.html, to: params.to }
        return Promise.resolve({ data: { id: 'resend-test-id' }, error: null })
      }),
    },
  })),
}))

// Use REAL templates — this is the whole point of the test
// (no jest.mock for @/lib/emails/templates)

import { sendEmailV2 } from '@/lib/api/emails/queries'

// Helper to mock user lookup in sendEmailV2
// sendEmailV2 calls getDb().select().from(userProfiles).where(...) for user lookup
// We need a more specific mock for this
beforeEach(() => {
  lastResendCall = null
  jest.clearAllMocks()

  // Re-setup the mock to handle both preferences and user lookup
  const { getDb } = require('@/db/client')
  getDb.mockReturnValue({
    select: jest.fn().mockReturnValue({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockImplementation(() => ({
          limit: jest.fn().mockResolvedValue([{
            // Preferences fields
            email_reactivacion: true,
            email_urgente: true,
            email_bienvenida_motivacional: true,
            email_bienvenida_inmediato: true,
            email_resumen_semanal: true,
            unsubscribed_all: false,
            email_soporte_disabled: false,
            email_newsletter_disabled: false,
            // User fields (for user lookup)
            id: 'user-123',
            email: 'test@example.com',
            fullName: 'Test User',
          }]),
        })),
      }),
    }),
    insert: jest.fn().mockReturnValue({
      values: jest.fn().mockReturnValue({
        onConflictDoUpdate: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([{
            email_reactivacion: true,
            email_urgente: true,
            email_bienvenida_motivacional: true,
            email_bienvenida_inmediato: true,
            email_resumen_semanal: true,
            unsubscribed_all: false,
            email_soporte_disabled: false,
            email_newsletter_disabled: false,
          }]),
        }),
        returning: jest.fn().mockResolvedValue([{ token: 'test-unsub-token' }]),
      }),
    }),
  })
})

describe('Template dispatch in sendEmailV2 — real templates, no mocks', () => {
  // ==============================
  // Generic 4-arg templates
  // ==============================
  test.each([
    'reactivacion',
    'urgente',
    'bienvenida_motivacional',
    'bienvenida_inmediato',
    'lanzamiento_premium',
    'modal_articulos_mejora',
  ] as const)('%s: subject and html contain no "undefined"', async (emailType) => {
    const result = await sendEmailV2({
      userId: 'user-123',
      emailType,
      customData: { daysInactive: 14, daysSince: 3 },
    })

    expect(result.success).toBe(true)
    expect(lastResendCall).not.toBeNull()
    expect(lastResendCall!.subject).not.toContain('undefined')
    expect(lastResendCall!.html).not.toContain('undefined')
    expect(lastResendCall!.html.length).toBeGreaterThan(100)
  })

  // ==============================
  // soporte_respuesta (custom signature)
  // ==============================
  test('soporte_respuesta: renders adminMessage in html', async () => {
    const result = await sendEmailV2({
      userId: 'user-123',
      emailType: 'soporte_respuesta',
      customData: {
        adminMessage: 'Tu problema ha sido resuelto',
        chatUrl: 'https://www.vence.es/soporte/chat/123',
      },
    })

    expect(result.success).toBe(true)
    expect(lastResendCall!.html).toContain('Tu problema ha sido resuelto')
    expect(lastResendCall!.html).not.toContain('undefined')
  })

  // ==============================
  // impugnacion_respuesta (custom signature)
  // ==============================
  test('impugnacion_respuesta: renders status and response in html', async () => {
    const result = await sendEmailV2({
      userId: 'user-123',
      emailType: 'impugnacion_respuesta',
      customData: {
        status: 'accepted',
        adminResponse: 'Tienes razón, la pregunta tenía un error',
        questionText: '¿Cuál es el artículo X?',
        disputeUrl: 'https://www.vence.es/impugnaciones/456',
      },
    })

    expect(result.success).toBe(true)
    expect(lastResendCall!.html).toContain('Tienes razón')
    expect(lastResendCall!.html).not.toContain('undefined')
  })

  // ==============================
  // recordatorio_renovacion (6 args — was broken before fix)
  // ==============================
  test('recordatorio_renovacion: renders fechaRenovacion and importe correctly', async () => {
    const result = await sendEmailV2({
      userId: 'user-123',
      emailType: 'recordatorio_renovacion',
      customData: {
        daysUntilRenewal: 5,
        fechaRenovacion: '15 de marzo de 2026',
        planAmount: 59,
        gestionarUrl: 'https://www.vence.es/perfil?tab=suscripcion',
      },
    })

    expect(result.success).toBe(true)
    expect(lastResendCall!.subject).toContain('5 días')
    expect(lastResendCall!.html).toContain('15 de marzo de 2026')
    expect(lastResendCall!.html).toContain('59')
    expect(lastResendCall!.html).not.toContain('undefined')
  })

  // ==============================
  // resumen_semanal (5 args — was broken before fix)
  // ==============================
  test('resumen_semanal: renders articles table from articlesData', async () => {
    const result = await sendEmailV2({
      userId: 'user-123',
      emailType: 'resumen_semanal',
      customData: {
        articlesData: [
          { article_id: 'a1', law_name: 'Constitución', article_number: '14', accuracy_percentage: 45, total_attempts: 10, recommendation: 'Repasar artículo' },
          { article_id: 'a2', law_name: 'TREBEP', article_number: '8', accuracy_percentage: 30, total_attempts: 8, recommendation: 'Practicar más' },
        ],
      },
    })

    expect(result.success).toBe(true)
    expect(lastResendCall!.subject).toContain('2 artículos')
    expect(lastResendCall!.html).toContain('Constitución')
    expect(lastResendCall!.html).toContain('Art. 14')
    expect(lastResendCall!.html).toContain('TREBEP')
    expect(lastResendCall!.html).not.toContain('undefined')
  })

  test('resumen_semanal: empty articlesData renders without error', async () => {
    const result = await sendEmailV2({
      userId: 'user-123',
      emailType: 'resumen_semanal',
      customData: { articlesData: [] },
    })

    expect(result.success).toBe(true)
    expect(lastResendCall!.subject).toContain('0 artículos')
    expect(lastResendCall!.html).not.toContain('undefined')
  })

  // ==============================
  // mejoras_producto (5 args — was broken before fix)
  // ==============================
  test('mejoras_producto: renders mejoraDatos fields correctly', async () => {
    const result = await sendEmailV2({
      userId: 'user-123',
      emailType: 'mejoras_producto',
      customData: {
        mejoraDatos: {
          titulo: 'Nuevo modo oscuro',
          descripcion: 'Ahora puedes estudiar sin cansar la vista',
          beneficios: ['Menos fatiga visual', 'Mejor concentración'],
          problema_anterior: 'Solo había modo claro',
          solucion: 'Hemos implementado un modo oscuro completo',
        },
      },
    })

    expect(result.success).toBe(true)
    expect(lastResendCall!.subject).toContain('Nuevo modo oscuro')
    expect(lastResendCall!.html).toContain('Nuevo modo oscuro')
    expect(lastResendCall!.html).toContain('Menos fatiga visual')
    expect(lastResendCall!.html).not.toContain('undefined')
  })

  test('mejoras_producto: without mejoraDatos does not crash', async () => {
    const result = await sendEmailV2({
      userId: 'user-123',
      emailType: 'mejoras_producto',
      customData: {},
    })

    // Should still send (empty mejoraDatos defaults to {})
    expect(result.success).toBe(true)
  })
})
