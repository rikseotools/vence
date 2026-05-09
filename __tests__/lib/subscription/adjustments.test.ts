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
      mockDbExecute.mockResolvedValueOnce({ rows: [{ id: 'adj-uuid-1' }] })

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
      expect(mockDbExecute).not.toHaveBeenCalled()
    })

    it('Stripe OK pero BD INSERT falla → auditFailed=true, success=true (Stripe no se revierte)', async () => {
      mockStripeRetrieve.mockResolvedValueOnce({
        items: { data: [{ current_period_end: 1717545600 }] },
      })
      mockStripeUpdate.mockResolvedValueOnce({ id: 'sub_test123' })
      mockDbExecute.mockRejectedValueOnce(new Error('connection refused'))

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
      mockDbExecute.mockResolvedValueOnce({ rows: [{ id: 'adj-uuid-2' }] })

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
      mockDbExecute.mockResolvedValueOnce({ rows: [{ id: 'adj-uuid-3' }] })

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
      mockDbExecute.mockResolvedValueOnce({ rows: [{ id: 'adj-uuid-4' }] })

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
})
