/**
 * Tests para verificar que los emails de recordatorio de renovación
 * muestran el precio correcto, incluyendo descuentos de fidelidad.
 *
 * Bug original: PLAN_PRICES tenía premium_monthly=12 (debería ser 20)
 * y faltaba premium_quarterly (caía al default de 59 en vez de 35).
 * Además no se mostraba el descuento de fidelidad en el email.
 */

// ============================================
// MOCKS (antes de imports)
// ============================================

// Mock Stripe
const mockRetrieveUpcoming = jest.fn()
jest.mock('@/lib/stripe', () => ({
  stripe: () => ({
    invoices: {
      retrieveUpcoming: mockRetrieveUpcoming,
    },
  }),
}))

// Mock DB
const mockDbSelect = jest.fn()
const mockDbInsert = jest.fn()
jest.mock('@/db/client', () => ({
  getDb: jest.fn(() => ({
    select: mockDbSelect,
    insert: mockDbInsert,
  })),
}))

jest.mock('@/db/schema', () => ({
  userSubscriptions: {
    id: 'id', stripeSubscriptionId: 'stripe_subscription_id',
    stripeCustomerId: 'stripe_customer_id', userId: 'user_id',
    status: 'status', planType: 'plan_type',
    currentPeriodEnd: 'current_period_end', cancelAtPeriodEnd: 'cancel_at_period_end',
  },
  userProfiles: { id: 'id', email: 'email', fullName: 'full_name' },
  emailLogs: { id: 'id', userId: 'user_id', emailType: 'email_type', sentAt: 'sent_at' },
}))

jest.mock('drizzle-orm', () => ({
  eq: jest.fn((...args) => ({ type: 'eq', args })),
  and: jest.fn((...args) => ({ type: 'and', args })),
  gte: jest.fn((...args) => ({ type: 'gte', args })),
  lte: jest.fn((...args) => ({ type: 'lte', args })),
  sql: jest.fn(),
}))

jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: {
      send: jest.fn().mockResolvedValue({ data: { id: 'resend-test-id' }, error: null }),
    },
  })),
}))

jest.mock('@/lib/api/emails', () => ({
  generateUnsubscribeToken: jest.fn().mockResolvedValue('test-token'),
  getUnsubscribeUrl: jest.fn().mockReturnValue('https://vence.es/unsub/test-token'),
}))

jest.mock('@/lib/emails/templates', () => ({
  emailTemplates: {
    recordatorio_renovacion: {
      subject: jest.fn().mockReturnValue('Test subject'),
      html: jest.fn().mockReturnValue('<html>test</html>'),
    },
  },
}))

process.env.RESEND_API_KEY = 'test-resend-key'

import { getSubscriptionsForReminder, sendRenewalReminder, checkReminderAlreadySent } from '@/lib/api/renewal-reminders/queries'
import { emailTemplates } from '@/lib/emails/templates'

// ============================================
// HELPERS
// ============================================

function futureDate(daysFromNow: number): string {
  const d = new Date()
  d.setDate(d.getDate() + daysFromNow)
  return d.toISOString()
}

function buildDbChain(results: unknown[]) {
  return jest.fn().mockReturnValue({
    from: jest.fn().mockReturnValue({
      innerJoin: jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue(results),
      }),
      where: jest.fn().mockReturnValue({
        limit: jest.fn().mockResolvedValue(results),
      }),
    }),
  })
}

// ============================================
// TESTS: getSubscriptionsForReminder
// ============================================

describe('getSubscriptionsForReminder', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('devuelve suscripciones con precio de Stripe cuando está disponible', async () => {
    const periodEnd = futureDate(7)
    mockDbSelect.mockReturnValue({
      from: jest.fn().mockReturnValue({
        innerJoin: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([{
            id: 'sub-1', stripeSubscriptionId: 'sub_123',
            stripeCustomerId: 'cus_123', userId: 'user-1',
            status: 'active', planType: 'premium_monthly',
            currentPeriodEnd: periodEnd, cancelAtPeriodEnd: false,
            email: 'test@test.com', fullName: 'Test User',
          }]),
        }),
      }),
    })

    mockRetrieveUpcoming.mockResolvedValue({
      amount_due: 1800, // 18€ en céntimos
      subtotal: 2000,   // 20€ base
      total_discount_amounts: [{ amount: 200 }],
      discount: { coupon: { percent_off: 10 } },
    })

    const result = await getSubscriptionsForReminder(7)

    expect(result.success).toBe(true)
    expect(result.subscriptions).toHaveLength(1)
    expect(result.subscriptions![0].planAmount).toBe(18)
    expect(result.subscriptions![0].baseAmount).toBe(20)
    expect(result.subscriptions![0].discountPercent).toBe(10)
  })

  it('usa fallback PLAN_PRICES cuando Stripe falla', async () => {
    const periodEnd = futureDate(7)
    mockDbSelect.mockReturnValue({
      from: jest.fn().mockReturnValue({
        innerJoin: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([{
            id: 'sub-1', stripeSubscriptionId: 'sub_123',
            stripeCustomerId: 'cus_123', userId: 'user-1',
            status: 'active', planType: 'premium_monthly',
            currentPeriodEnd: periodEnd, cancelAtPeriodEnd: false,
            email: 'test@test.com', fullName: 'Test User',
          }]),
        }),
      }),
    })

    mockRetrieveUpcoming.mockRejectedValue(new Error('Stripe error'))

    const result = await getSubscriptionsForReminder(7)

    expect(result.success).toBe(true)
    expect(result.subscriptions![0].planAmount).toBe(20) // fallback mensual
    expect(result.subscriptions![0].baseAmount).toBe(20)
    expect(result.subscriptions![0].discountPercent).toBe(0)
  })

  it('fallback premium_quarterly es 35€, no 59€', async () => {
    const periodEnd = futureDate(7)
    mockDbSelect.mockReturnValue({
      from: jest.fn().mockReturnValue({
        innerJoin: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([{
            id: 'sub-1', stripeSubscriptionId: 'sub_123',
            stripeCustomerId: 'cus_123', userId: 'user-1',
            status: 'active', planType: 'premium_quarterly',
            currentPeriodEnd: periodEnd, cancelAtPeriodEnd: false,
            email: 'test@test.com', fullName: 'Test User',
          }]),
        }),
      }),
    })

    mockRetrieveUpcoming.mockRejectedValue(new Error('Stripe error'))

    const result = await getSubscriptionsForReminder(7)

    expect(result.subscriptions![0].planAmount).toBe(35)
    expect(result.subscriptions![0].planAmount).not.toBe(59)
  })

  it('fallback premium_monthly es 20€, no 12€', async () => {
    const periodEnd = futureDate(7)
    mockDbSelect.mockReturnValue({
      from: jest.fn().mockReturnValue({
        innerJoin: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([{
            id: 'sub-1', stripeSubscriptionId: 'sub_123',
            stripeCustomerId: 'cus_123', userId: 'user-1',
            status: 'active', planType: 'premium_monthly',
            currentPeriodEnd: periodEnd, cancelAtPeriodEnd: false,
            email: 'test@test.com', fullName: 'Test User',
          }]),
        }),
      }),
    })

    mockRetrieveUpcoming.mockRejectedValue(new Error('Stripe error'))

    const result = await getSubscriptionsForReminder(7)

    expect(result.subscriptions![0].planAmount).toBe(20)
    expect(result.subscriptions![0].planAmount).not.toBe(12)
  })

  it('devuelve lista vacía si no hay suscripciones próximas', async () => {
    mockDbSelect.mockReturnValue({
      from: jest.fn().mockReturnValue({
        innerJoin: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([]),
        }),
      }),
    })

    const result = await getSubscriptionsForReminder(7)

    expect(result.success).toBe(true)
    expect(result.subscriptions).toHaveLength(0)
  })

  it('calcula daysUntilRenewal correctamente', async () => {
    const periodEnd = futureDate(7)
    mockDbSelect.mockReturnValue({
      from: jest.fn().mockReturnValue({
        innerJoin: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([{
            id: 'sub-1', stripeSubscriptionId: 'sub_123',
            stripeCustomerId: 'cus_123', userId: 'user-1',
            status: 'active', planType: 'premium_monthly',
            currentPeriodEnd: periodEnd, cancelAtPeriodEnd: false,
            email: 'test@test.com', fullName: 'Test User',
          }]),
        }),
      }),
    })

    mockRetrieveUpcoming.mockRejectedValue(new Error('Stripe error'))

    const result = await getSubscriptionsForReminder(7)

    // daysUntilRenewal debe ser ~7 (puede variar por hora del día)
    expect(result.subscriptions![0].daysUntilRenewal).toBeGreaterThanOrEqual(6)
    expect(result.subscriptions![0].daysUntilRenewal).toBeLessThanOrEqual(8)
  })
})

// ============================================
// TESTS: sendRenewalReminder
// ============================================

describe('sendRenewalReminder', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Mock checkReminderAlreadySent → no enviado
    mockDbSelect.mockReturnValue({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue([]),
        }),
      }),
    })
    mockDbInsert.mockReturnValue({
      values: jest.fn().mockResolvedValue(undefined),
    })
  })

  it('pasa baseAmount y discountPercent al template', async () => {
    const result = await sendRenewalReminder({
      userId: 'user-1',
      email: 'test@test.com',
      fullName: 'Test User',
      daysUntilRenewal: 7,
      renewalDate: futureDate(7),
      planAmount: 18,
      baseAmount: 20,
      discountPercent: 10,
    })

    expect(result.success).toBe(true)
    expect(emailTemplates.recordatorio_renovacion.html).toHaveBeenCalledWith(
      'Test User', 7, expect.any(String), 18,
      expect.stringContaining('perfil'), expect.any(String),
      20, 10
    )
  })

  it('pasa baseAmount=null y discountPercent=null cuando no hay descuento', async () => {
    await sendRenewalReminder({
      userId: 'user-1',
      email: 'test@test.com',
      fullName: 'Test User',
      daysUntilRenewal: 7,
      renewalDate: futureDate(7),
      planAmount: 20,
      baseAmount: null,
      discountPercent: null,
    })

    expect(emailTemplates.recordatorio_renovacion.html).toHaveBeenCalledWith(
      'Test User', 7, expect.any(String), 20,
      expect.stringContaining('perfil'), expect.any(String),
      null, null
    )
  })

  it('no envía si ya se envió recordatorio para este período', async () => {
    // Mock: ya existe un recordatorio enviado
    mockDbSelect.mockReturnValue({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue([{ id: 'existing-log', sentAt: '2026-04-01' }]),
        }),
      }),
    })

    const result = await sendRenewalReminder({
      userId: 'user-1',
      email: 'test@test.com',
      fullName: 'Test User',
      daysUntilRenewal: 7,
      renewalDate: futureDate(7),
      planAmount: 20,
      baseAmount: 20,
      discountPercent: 0,
    })

    expect(result.success).toBe(false)
    expect(result.skipped).toBe(true)
    expect(result.skipReason).toBe('already_sent')
  })

  it('formatea la fecha en español', async () => {
    const renewalDate = '2026-05-15T10:00:00Z'

    await sendRenewalReminder({
      userId: 'user-1',
      email: 'test@test.com',
      fullName: 'Test User',
      daysUntilRenewal: 7,
      renewalDate,
      planAmount: 20,
      baseAmount: 20,
      discountPercent: 0,
    })

    const htmlCall = (emailTemplates.recordatorio_renovacion.html as jest.Mock).mock.calls[0]
    const formattedDate = htmlCall[2]
    // Debe ser formato español: "15 de mayo de 2026"
    expect(formattedDate).toMatch(/\d+ de \w+ de 2026/)
  })

  it('usa "Usuario" si fullName es null', async () => {
    await sendRenewalReminder({
      userId: 'user-1',
      email: 'test@test.com',
      fullName: null,
      daysUntilRenewal: 7,
      renewalDate: futureDate(7),
      planAmount: 20,
      baseAmount: 20,
      discountPercent: 0,
    })

    const htmlCall = (emailTemplates.recordatorio_renovacion.html as jest.Mock).mock.calls[0]
    expect(htmlCall[0]).toBe('Usuario')
  })
})

// ============================================
// TESTS: checkReminderAlreadySent
// ============================================

describe('checkReminderAlreadySent', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('devuelve alreadySent=false si no hay registros', async () => {
    mockDbSelect.mockReturnValue({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue([]),
        }),
      }),
    })

    const result = await checkReminderAlreadySent('user-1', futureDate(7))
    expect(result.alreadySent).toBe(false)
  })

  it('devuelve alreadySent=true si ya existe registro', async () => {
    mockDbSelect.mockReturnValue({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue([{ id: 'log-1', sentAt: '2026-04-01' }]),
        }),
      }),
    })

    const result = await checkReminderAlreadySent('user-1', futureDate(7))
    expect(result.alreadySent).toBe(true)
    expect(result.sentAt).toBe('2026-04-01')
  })

  it('devuelve alreadySent=false si hay error de BD (no bloquea envío)', async () => {
    mockDbSelect.mockReturnValue({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockImplementation(() => {
          throw new Error('DB error')
        }),
      }),
    })

    const result = await checkReminderAlreadySent('user-1', futureDate(7))
    expect(result.alreadySent).toBe(false)
  })
})

// ============================================
// TESTS: Template (sin mocks, usa el real)
// ============================================

describe('Email recordatorio_renovacion - Template real', () => {
  // Import the REAL templates (unmocked)
  const realTemplates = jest.requireActual('@/lib/emails/templates').emailTemplates
  const template = realTemplates['recordatorio_renovacion']

  it('template existe con subject y html', () => {
    expect(template).toBeDefined()
    expect(template.subject).toBeDefined()
    expect(template.html).toBeDefined()
  })

  // --- Precios sin descuento ---

  describe('Sin descuento de fidelidad', () => {
    it.each([
      ['premium_monthly', 20],
      ['premium_quarterly', 35],
      ['premium_semester', 59],
    ])('%s muestra %i€ sin mención de descuento', (_plan, precio) => {
      const html = template.html(
        'Test User', 7, '4 de abril de 2026', precio,
        'https://vence.es/perfil', 'https://vence.es/unsub',
        precio, 0
      )
      expect(html).toContain(`${precio}€`)
      expect(html).not.toContain('descuento de fidelidad')
    })

    it('sin parámetros de descuento no muestra descuento', () => {
      const html = template.html(
        'Test User', 7, '4 de abril de 2026', 20,
        'https://vence.es/perfil', 'https://vence.es/unsub'
      )
      expect(html).toContain('20€')
      expect(html).not.toContain('descuento de fidelidad')
    })

    it('con discountPercent=null no muestra descuento', () => {
      const html = template.html(
        'Test User', 7, '4 de abril de 2026', 20,
        'https://vence.es/perfil', 'https://vence.es/unsub',
        20, null
      )
      expect(html).toContain('20€')
      expect(html).not.toContain('descuento de fidelidad')
    })
  })

  // --- Con descuento tier 1 (10%) ---

  describe('Con descuento tier 1 (10%)', () => {
    it('mensual: muestra 18€ con descuento 10% y precio base 20€', () => {
      const html = template.html(
        'Test User', 7, '4 de abril de 2026', 18,
        'https://vence.es/perfil', 'https://vence.es/unsub',
        20, 10
      )
      expect(html).toContain('18€')
      expect(html).toContain('precio base 20€')
      expect(html).toContain('10% de descuento de fidelidad')
    })

    it('trimestral: muestra 32€ con descuento 10% y precio base 35€', () => {
      const html = template.html(
        'Test User', 7, '4 de abril de 2026', 32,
        'https://vence.es/perfil', 'https://vence.es/unsub',
        35, 10
      )
      expect(html).toContain('32€')
      expect(html).toContain('precio base 35€')
      expect(html).toContain('10% de descuento de fidelidad')
    })

    it('semestral: muestra 53€ con descuento 10% y precio base 59€', () => {
      const html = template.html(
        'Test User', 7, '4 de abril de 2026', 53,
        'https://vence.es/perfil', 'https://vence.es/unsub',
        59, 10
      )
      expect(html).toContain('53€')
      expect(html).toContain('precio base 59€')
      expect(html).toContain('10% de descuento de fidelidad')
    })
  })

  // --- Con descuento tier 2 (20%) ---

  describe('Con descuento tier 2 (20%)', () => {
    it('mensual: muestra 16€ con descuento 20% y precio base 20€', () => {
      const html = template.html(
        'Test User', 7, '4 de abril de 2026', 16,
        'https://vence.es/perfil', 'https://vence.es/unsub',
        20, 20
      )
      expect(html).toContain('16€')
      expect(html).toContain('precio base 20€')
      expect(html).toContain('20% de descuento de fidelidad')
    })
  })

  // --- Regresiones ---

  describe('Regresiones de precios incorrectos', () => {
    it('mensual NUNCA debe mostrar 12€ (bug original)', () => {
      const html = template.html(
        'Test User', 7, '4 de abril de 2026', 20,
        'https://vence.es/perfil', 'https://vence.es/unsub',
        20, 0
      )
      expect(html).toContain('20€')
      expect(html).not.toMatch(/\b12€/)
    })

    it('trimestral NUNCA debe mostrar 59€ como precio base (bug: plan faltante)', () => {
      const html = template.html(
        'Test User', 7, '4 de abril de 2026', 35,
        'https://vence.es/perfil', 'https://vence.es/unsub',
        35, 0
      )
      expect(html).toContain('35€')
      expect(html).not.toMatch(/\b59€/)
    })
  })

  // --- Estructura ---

  describe('Estructura del email', () => {
    it('incluye nombre del usuario', () => {
      const html = template.html(
        'María García', 7, '4 de abril de 2026', 18,
        'https://vence.es/perfil', 'https://vence.es/unsub', 20, 10
      )
      expect(html).toContain('Hola María García')
    })

    it('incluye fecha de renovación en negrita', () => {
      const html = template.html(
        'Test', 7, '15 de mayo de 2026', 20,
        'https://vence.es/perfil', 'https://vence.es/unsub', 20, 0
      )
      expect(html).toContain('<strong>15 de mayo de 2026</strong>')
    })

    it('incluye enlace de gestión con texto', () => {
      const html = template.html(
        'Test', 7, '4 de abril de 2026', 20,
        'https://vence.es/perfil?tab=suscripcion', 'https://vence.es/unsub', 20, 0
      )
      expect(html).toContain('https://vence.es/perfil?tab=suscripcion')
      expect(html).toContain('Gestionar mi suscripción')
    })

    it('incluye enlace de unsubscribe', () => {
      const html = template.html(
        'Test', 7, '4 de abril de 2026', 20,
        'https://vence.es/perfil', 'https://vence.es/unsub-token', 20, 0
      )
      expect(html).toContain('https://vence.es/unsub-token')
    })

    it('incluye "Si deseas seguir, no tienes que hacer nada"', () => {
      const html = template.html(
        'Test', 7, '4 de abril de 2026', 20,
        'https://vence.es/perfil', 'https://vence.es/unsub', 20, 0
      )
      expect(html).toContain('Si deseas seguir, no tienes que hacer nada')
    })

    it('incluye "Equipo Vence"', () => {
      const html = template.html(
        'Test', 7, '4 de abril de 2026', 20,
        'https://vence.es/perfil', 'https://vence.es/unsub', 20, 0
      )
      expect(html).toContain('Equipo Vence')
    })

    it('subject correcto para 7 días', () => {
      const subject = template.subject('Test', 7)
      expect(subject).toContain('7 días')
    })

    it('subject correcto para 1 día (singular)', () => {
      const subject = template.subject('Test', 1)
      expect(subject).toContain('1 día')
      expect(subject).not.toContain('1 días')
    })

    it('subject incluye "Vence"', () => {
      const subject = template.subject('Test', 7)
      expect(subject).toContain('Vence')
    })
  })
})
