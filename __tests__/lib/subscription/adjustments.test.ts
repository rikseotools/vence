// __tests__/lib/subscription/adjustments.test.ts
// Tests del helper applySubscriptionAdjustment.
// Cubrimos: validación de inputs, time_extension happy path, Stripe error,
// BD INSERT failure (auditFailed), credit, discount, refund (out of scope).

const mockStripeUpdate = jest.fn()
const mockStripeRetrieve = jest.fn()
const mockStripeCustomerRetrieve = jest.fn()
const mockStripeCustomerUpdate = jest.fn()
const mockStripeCouponCreate = jest.fn()

jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    subscriptions: {
      retrieve: mockStripeRetrieve,
      update: mockStripeUpdate,
    },
    customers: {
      retrieve: mockStripeCustomerRetrieve,
      update: mockStripeCustomerUpdate,
    },
    coupons: {
      create: mockStripeCouponCreate,
    },
  }))
})

const mockDbExecute = jest.fn()
jest.mock('@/db/client', () => ({
  getDb: () => ({ execute: mockDbExecute }),
}))

// El helper hace DOS tipos de consulta: (1) leer la cuenta Stripe del usuario
// —`user_profiles.payment_account`, añadido el 29/07/2026 para no operar
// siempre contra la cuenta por defecto— y (2) el INSERT de auditoría. Se
// enrutan por el texto del SQL para que los tests sigan controlando SOLO la
// segunda, que es la que les importa.
function sqlText(query: unknown): string {
  const chunks = (query as { queryChunks?: unknown[] })?.queryChunks
  if (!Array.isArray(chunks)) return ''
  return chunks
    .map((c) => {
      if (typeof c === 'string') return c
      const v = (c as { value?: unknown })?.value
      return Array.isArray(v) ? v.join('') : typeof v === 'string' ? v : ''
    })
    .join('')
}

/** payment_account que devuelve la consulta de perfil (null = usuario inexistente) */
let profileAccount: string | null | undefined = 'manuel'
/** respuestas encoladas para las consultas de auditoría (valor o Error) */
const auditQueue: unknown[] = []
const queueAudit = (v: unknown) => auditQueue.push(v)
/** cuántas veces se ha intentado escribir la auditoría */
const auditCalls = () =>
  mockDbExecute.mock.calls.filter((c) => !/FROM user_profiles/i.test(sqlText(c[0]))).length

import { applySubscriptionAdjustment } from '@/lib/api/subscription/adjustments'

const VALID_PARAMS = {
  userId: '00000000-0000-0000-0000-000000000001',
  stripeSubscriptionId: 'sub_test123',
  adjustmentType: 'time_extension' as const,
  amountValue: 7,
  amountUnit: 'days' as const,
  reasonCode: 'incident_compensation' as const,
  appliedByUserId: '00000000-0000-0000-0000-000000000099',
}

describe('applySubscriptionAdjustment', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.STRIPE_SECRET_KEY = 'sk_test_fake'
    process.env.STRIPE_SECRET_KEY_NILA = 'sk_test_fake_nila'
    profileAccount = 'manuel'
    auditQueue.length = 0
    mockDbExecute.mockImplementation((q: unknown) => {
      if (/FROM user_profiles/i.test(sqlText(q))) {
        return Promise.resolve(
          profileAccount === undefined ? [] : [{ payment_account: profileAccount }],
        )
      }
      const next = auditQueue.shift()
      if (next instanceof Error) return Promise.reject(next)
      return Promise.resolve(next ?? { rows: [] })
    })
  })

  describe('validación de inputs', () => {
    it('rechaza adjustmentType inválido', async () => {
      const r = await applySubscriptionAdjustment({
        ...VALID_PARAMS,
        adjustmentType: 'unknown' as never,
      })
      expect(r.success).toBe(false)
      expect(r.error).toContain('adjustmentType inválido')
    })

    it('rechaza amountValue 0', async () => {
      const r = await applySubscriptionAdjustment({ ...VALID_PARAMS, amountValue: 0 })
      expect(r.success).toBe(false)
      expect(r.error).toContain('amountValue')
    })

    it('rechaza amountValue negativo', async () => {
      const r = await applySubscriptionAdjustment({ ...VALID_PARAMS, amountValue: -5 })
      expect(r.success).toBe(false)
    })

    it('time_extension requiere amountUnit=days', async () => {
      const r = await applySubscriptionAdjustment({
        ...VALID_PARAMS,
        amountUnit: 'eur' as never,
      })
      expect(r.success).toBe(false)
      expect(r.error).toContain('time_extension requiere amountUnit=days')
    })
  })

  describe('time_extension happy path', () => {
    it('llama Stripe con trial_end correcto y INSERT en BD', async () => {
      const currentPeriodEnd = 1717545600  // 2024-06-05
      const expectedTrialEnd = currentPeriodEnd + 7 * 24 * 3600
      mockStripeRetrieve.mockResolvedValueOnce({
        items: { data: [{ current_period_end: currentPeriodEnd }] },
      })
      mockStripeUpdate.mockResolvedValueOnce({ id: 'sub_test123' })
      queueAudit({ rows: [{ id: 'adj-uuid-1' }] })

      const r = await applySubscriptionAdjustment(VALID_PARAMS)

      expect(r.success).toBe(true)
      expect(r.adjustmentId).toBe('adj-uuid-1')
      expect(r.stripeEventId).toBe('sub_test123')
      expect(r.auditFailed).toBeFalsy()

      // Verifica que el call a Stripe usa trial_end correcto y proration none
      expect(mockStripeUpdate).toHaveBeenCalledWith('sub_test123', expect.objectContaining({
        trial_end: expectedTrialEnd,
        proration_behavior: 'none',
      }))
    })

    it('Stripe falla → NO INSERT en BD, return error', async () => {
      mockStripeRetrieve.mockRejectedValueOnce(new Error('No such subscription'))

      const r = await applySubscriptionAdjustment(VALID_PARAMS)

      expect(r.success).toBe(false)
      expect(r.error).toContain('Stripe error')
      expect(r.error).toContain('No such subscription')
      expect(auditCalls()).toBe(0) // no se audita lo que Stripe no aplicó
    })

    it('Stripe OK pero BD INSERT falla → auditFailed=true, success=true (Stripe no se revierte)', async () => {
      mockStripeRetrieve.mockResolvedValueOnce({
        items: { data: [{ current_period_end: 1717545600 }] },
      })
      mockStripeUpdate.mockResolvedValueOnce({ id: 'sub_test123' })
      queueAudit(new Error('connection refused'))

      const r = await applySubscriptionAdjustment(VALID_PARAMS)

      expect(r.success).toBe(true)
      expect(r.auditFailed).toBe(true)
      expect(r.adjustmentId).toBeNull()
      expect(r.stripeEventId).toBe('sub_test123')
      expect(r.error).toContain('BD audit INSERT falló')
    })

    it('falla si current_period_end no se puede obtener', async () => {
      mockStripeRetrieve.mockResolvedValueOnce({
        items: { data: [{}] },  // sin current_period_end
      })

      const r = await applySubscriptionAdjustment(VALID_PARAMS)
      expect(r.success).toBe(false)
      expect(r.error).toContain('current_period_end')
      expect(mockStripeUpdate).not.toHaveBeenCalled()
    })

    it('soporta SDK antiguo con current_period_end en root', async () => {
      const periodEnd = 1717545600
      mockStripeRetrieve.mockResolvedValueOnce({
        current_period_end: periodEnd,  // SDK <2024 lo tiene aquí
        items: { data: [{}] },
      })
      mockStripeUpdate.mockResolvedValueOnce({ id: 'sub_test123' })
      queueAudit({ rows: [{ id: 'adj-uuid-2' }] })

      const r = await applySubscriptionAdjustment(VALID_PARAMS)
      expect(r.success).toBe(true)
      expect(mockStripeUpdate).toHaveBeenCalledWith('sub_test123', expect.objectContaining({
        trial_end: periodEnd + 7 * 24 * 3600,
      }))
    })
  })

  describe('credit', () => {
    it('credit requiere amountUnit=eur', async () => {
      const r = await applySubscriptionAdjustment({
        ...VALID_PARAMS,
        adjustmentType: 'credit',
        amountUnit: 'days',
      })
      expect(r.success).toBe(false)
      expect(r.error).toContain('credit requiere amountUnit=eur')
    })

    it('aplica balance negativo en céntimos', async () => {
      mockStripeRetrieve.mockResolvedValueOnce({ customer: 'cus_X' })
      mockStripeCustomerRetrieve.mockResolvedValueOnce({ deleted: false, balance: 0 })
      mockStripeCustomerUpdate.mockResolvedValueOnce({ id: 'cus_X' })
      queueAudit({ rows: [{ id: 'adj-uuid-3' }] })

      const r = await applySubscriptionAdjustment({
        ...VALID_PARAMS,
        adjustmentType: 'credit',
        amountValue: 5.99,
        amountUnit: 'eur',
      })
      expect(r.success).toBe(true)
      expect(mockStripeCustomerUpdate).toHaveBeenCalledWith('cus_X', { balance: -599 })
    })
  })

  describe('refund', () => {
    it('refund out of scope → error explicit', async () => {
      const r = await applySubscriptionAdjustment({
        ...VALID_PARAMS,
        adjustmentType: 'refund',
        amountUnit: 'eur',
      })
      expect(r.success).toBe(false)
      expect(r.error).toContain('refund no implementado')
    })
  })

  describe('discount', () => {
    it('discount requiere amountUnit=percent', async () => {
      const r = await applySubscriptionAdjustment({
        ...VALID_PARAMS,
        adjustmentType: 'discount',
        amountUnit: 'days',
      })
      expect(r.success).toBe(false)
      expect(r.error).toContain('discount requiere amountUnit=percent')
    })

    it('crea coupon y lo aplica', async () => {
      mockStripeCouponCreate.mockResolvedValueOnce({ id: 'coup_123' })
      mockStripeUpdate.mockResolvedValueOnce({ id: 'sub_test123' })
      queueAudit({ rows: [{ id: 'adj-uuid-4' }] })

      const r = await applySubscriptionAdjustment({
        ...VALID_PARAMS,
        adjustmentType: 'discount',
        amountValue: 20,
        amountUnit: 'percent',
      })
      expect(r.success).toBe(true)
      expect(mockStripeCouponCreate).toHaveBeenCalledWith(expect.objectContaining({
        percent_off: 20,
        duration: 'once',
      }))
      expect(mockStripeUpdate).toHaveBeenCalledWith('sub_test123', { discounts: [{ coupon: 'coup_123' }] })
    })
  })

  describe('cuenta Stripe del usuario (multi-cuenta, 29/07/2026)', () => {
    it('opera contra la cuenta del usuario, no contra la de por defecto', async () => {
      // Antes usaba STRIPE_SECRET_KEY siempre: un ajuste sobre un usuario de
      // Nila (o sea, cualquier alta desde el flip) iba a la cuenta equivocada.
      profileAccount = 'nila'
      const Stripe = jest.requireMock('stripe') as jest.Mock
      Stripe.mockClear()
      mockStripeRetrieve.mockResolvedValue({
        id: 'sub_test123',
        current_period_end: 1_700_000_000,
        items: { data: [{ current_period_end: 1_700_000_000 }] },
      })
      mockStripeUpdate.mockResolvedValue({ id: 'sub_test123' })
      queueAudit({ rows: [{ id: 'adj-uuid-nila' }] })

      const r = await applySubscriptionAdjustment(VALID_PARAMS)

      expect(r.success).toBe(true)
      // La instancia se construyó con la secret key de Nila.
      const keysUsed = Stripe.mock.calls.map((c) => c[0] as string)
      expect(keysUsed).toContain('sk_test_fake_nila')
    })

    it('falla explícitamente si el usuario no existe (no cae a la cuenta por defecto)', async () => {
      profileAccount = undefined // sin fila en user_profiles

      const r = await applySubscriptionAdjustment(VALID_PARAMS)

      expect(r.success).toBe(false)
      expect(r.error).toContain('cuenta Stripe')
      expect(auditCalls()).toBe(0)
    })
  })
})
