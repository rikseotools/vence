/**
 * T-456 — El recordatorio de renovación pasa por el carril completo de envío.
 *
 * Antes hablaba con Resend en crudo: sin comprobar preferencias, sin token de baja y sin dejar
 * rastro en `email_events`. Medido el 01/08 antes de tocar nada: **424 recordatorios en
 * `email_logs` y UNO solo en `email_events`** — un correo que avisa de un COBRO a gente que paga,
 * invisible para observabilidad y analítica. Es el tipo de envío cuya desaparición no nota nadie.
 *
 * Lo que fija este fichero es el CONTRATO del camino, no el HTML (eso lo cubre
 * `templateDispatch.test.ts` con los templates reales):
 *   1. se envía por `sendEmailV2` y nunca por Resend directamente;
 *   2. bloqueado por preferencias ≠ fallido (es la comprobación que antes no existía);
 *   3. no se duplica la fila de `email_logs`, que es la que sostiene el dedup de 5 días;
 *   4. la clave de idempotencia no cambia sola entre dos intentos del mismo día.
 */

const mockDbSelect = jest.fn()
const mockDbInsert = jest.fn()
jest.mock('@/db/client', () => ({
  getDb: jest.fn(() => ({ select: mockDbSelect, insert: mockDbInsert })),
}))

jest.mock('@/db/schema', () => ({
  userSubscriptions: {},
  userProfiles: {},
  emailLogs: { id: 'id', userId: 'user_id', emailType: 'email_type', sentAt: 'sent_at' },
}))

jest.mock('drizzle-orm', () => ({
  eq: jest.fn((...args) => ({ type: 'eq', args })),
  and: jest.fn((...args) => ({ type: 'and', args })),
  gte: jest.fn((...args) => ({ type: 'gte', args })),
  lte: jest.fn((...args) => ({ type: 'lte', args })),
  sql: jest.fn(),
}))

jest.mock('@/lib/stripe', () => ({
  getStripeFor: () => ({ invoices: { createPreview: jest.fn() } }),
  resolveAccount: (v: string | null | undefined) => v || 'manuel',
}))

// El testigo que prueba que NO se usa Resend en crudo desde este módulo.
const mockResendSend = jest.fn()
jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({ emails: { send: mockResendSend } })),
}))

const mockSendEmailV2 = jest.fn()
jest.mock('@/lib/api/emails', () => ({
  sendEmailV2: (...args: unknown[]) => mockSendEmailV2(...args),
}))

import {
  sendRenewalReminder,
  renewalReminderIdempotencyKey,
} from '@/lib/api/renewal-reminders/queries'

function paramsBase() {
  return {
    userId: '11111111-1111-4111-8111-111111111111',
    email: 'paga@example.com',
    fullName: 'Persona Que Paga',
    daysUntilRenewal: 7,
    renewalDate: '2026-09-15T10:00:00.000Z',
    planAmount: 47,
    baseAmount: 59,
    discountPercent: 20,
  }
}

beforeEach(() => {
  jest.clearAllMocks()
  mockSendEmailV2.mockResolvedValue({ success: true, emailId: 'email-abc' })
  // `checkReminderAlreadySent` → no hay recordatorio previo
  mockDbSelect.mockReturnValue({
    from: jest.fn().mockReturnValue({
      where: jest.fn().mockReturnValue({ limit: jest.fn().mockResolvedValue([]) }),
    }),
  })
  mockDbInsert.mockReturnValue({ values: jest.fn().mockResolvedValue(undefined) })
})

describe('T-456 · el recordatorio va por el carril con preferencias y rastro', () => {
  it('envía por sendEmailV2 y NO por Resend en crudo', async () => {
    const result = await sendRenewalReminder(paramsBase())

    expect(result.success).toBe(true)
    expect(result.emailId).toBe('email-abc')
    expect(mockSendEmailV2).toHaveBeenCalledTimes(1)
    expect(mockResendSend).not.toHaveBeenCalled()
  })

  it('manda el tipo de email correcto y una clave de idempotencia', async () => {
    await sendRenewalReminder(paramsBase())

    const arg = mockSendEmailV2.mock.calls[0][0]
    expect(arg.emailType).toBe('recordatorio_renovacion')
    expect(arg.idempotencyKey).toContain('renewal:')
    expect(arg.customData.to).toBe('paga@example.com')
  })

  it('NO vuelve a escribir en email_logs: esa fila la pone sendEmailV2', async () => {
    // Una segunda fila descuadraría el dedup de 5 días, que lee justo esa tabla.
    await sendRenewalReminder(paramsBase())

    expect(mockDbInsert).not.toHaveBeenCalled()
  })

  it('bloqueado por preferencias cuenta como OMITIDO, no como fallido', async () => {
    // La comprobación que este camino no tenía: quien apagó los emails de soporte no debe
    // recibirlo. Y omitido ≠ fallido: si se contara como fallo, el guardarraíl de «ticó y
    // envió 0» gritaría por gente que decidió no recibirlo.
    mockSendEmailV2.mockResolvedValue({ success: false, cancelled: true, reason: 'soporte_disabled' })

    const result = await sendRenewalReminder(paramsBase())

    expect(result.success).toBe(false)
    expect(result.skipped).toBe(true)
    expect(result.skipReason).toBe('soporte_disabled')
    expect(result.error).toBeUndefined()
  })

  it('un fallo real del proveedor sigue siendo fallo (no se disfraza de omitido)', async () => {
    mockSendEmailV2.mockResolvedValue({ success: false, error: 'Resend caído' })

    const result = await sendRenewalReminder(paramsBase())

    expect(result.success).toBe(false)
    expect(result.skipped).toBeFalsy()
    expect(result.error).toBe('Resend caído')
  })

  it('si ya se envió en los últimos 5 días, ni siquiera llama al carril', async () => {
    mockDbSelect.mockReturnValue({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue([{ id: 'log-1', sentAt: '2026-09-10' }]),
        }),
      }),
    })

    const result = await sendRenewalReminder(paramsBase())

    expect(result.skipped).toBe(true)
    expect(result.skipReason).toBe('already_sent')
    expect(mockSendEmailV2).not.toHaveBeenCalled()
  })
})

describe('T-456 · clave de idempotencia (pura)', () => {
  const user = 'user-1'
  const periodo = '2026-09-15T23:30:00.000Z'

  it('es la misma en dos intentos del mismo día', async () => {
    const a = renewalReminderIdempotencyKey(user, periodo, new Date('2026-09-08T07:00:00Z'))
    const b = renewalReminderIdempotencyKey(user, periodo, new Date('2026-09-08T19:45:00Z'))
    expect(a).toBe(b)
  })

  it('cambia al día siguiente, para que el aviso de 1 día no lo dedupliquen con el de 7', () => {
    const siete = renewalReminderIdempotencyKey(user, periodo, new Date('2026-09-08T07:00:00Z'))
    const uno = renewalReminderIdempotencyKey(user, periodo, new Date('2026-09-14T07:00:00Z'))
    expect(siete).not.toBe(uno)
  })

  it('distingue personas y periodos de renovación', () => {
    const base = renewalReminderIdempotencyKey(user, periodo, new Date('2026-09-08T07:00:00Z'))
    expect(renewalReminderIdempotencyKey('user-2', periodo, new Date('2026-09-08T07:00:00Z'))).not.toBe(base)
    expect(renewalReminderIdempotencyKey(user, '2026-10-15T23:30:00.000Z', new Date('2026-09-08T07:00:00Z'))).not.toBe(base)
  })

  it('NO depende de daysUntilRenewal, que oscila entre 7 y 8 el mismo día', () => {
    // `daysUntilRenewal` sale de un Math.ceil sobre `now`: por la mañana da 8 y por la tarde 7
    // para la misma renovación. Si entrara en la clave, dos intentos del mismo día tendrían
    // claves distintas y la idempotencia no protegería de nada.
    const manana = renewalReminderIdempotencyKey(user, periodo, new Date('2026-09-08T06:00:00Z'))
    const tarde = renewalReminderIdempotencyKey(user, periodo, new Date('2026-09-08T22:00:00Z'))
    expect(manana).toBe(tarde)
    expect(manana).toBe('renewal:user-1:2026-09-15:2026-09-08')
  })
})
