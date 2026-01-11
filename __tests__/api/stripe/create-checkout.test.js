/**
 * Tests para el endpoint de crear checkout de Stripe
 *
 * Valida:
 * - Parámetros de entrada
 * - Validación de usuarios
 * - Construcción de metadata
 * - Formatos de IDs de Stripe
 */

import {
  validateCheckoutParams,
  validateUserCanCheckout,
  buildCustomerMetadata,
  buildSubscriptionMetadata,
  buildSuccessUrl,
  buildCancelUrl,
  isValidStripeCustomerId,
  isValidStripePriceId,
  isValidStripeSubscriptionId,
  isValidStripeSessionId
} from '@/lib/stripe-checkout-validators'

describe('Stripe Create Checkout Validators', () => {
  // ============================================
  // validateCheckoutParams
  // ============================================
  describe('validateCheckoutParams', () => {
    it('valida params correctos', () => {
      const params = {
        priceId: 'price_123',
        userId: 'user-123',
        mode: 'normal'
      }

      const result = validateCheckoutParams(params)

      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('acepta params sin mode (usa default)', () => {
      const params = {
        priceId: 'price_123',
        userId: 'user-123'
      }

      const result = validateCheckoutParams(params)

      expect(result.valid).toBe(true)
    })

    it('rechaza priceId faltante', () => {
      const params = { userId: 'user-123' }

      const result = validateCheckoutParams(params)

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Price ID is required')
    })

    it('rechaza userId faltante', () => {
      const params = { priceId: 'price_123' }

      const result = validateCheckoutParams(params)

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('User ID is required')
    })

    it('rechaza priceId con formato inválido', () => {
      const params = {
        priceId: 'invalid-price-id',
        userId: 'user-123'
      }

      const result = validateCheckoutParams(params)

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Invalid Price ID format')
    })

    it('rechaza mode inválido', () => {
      const params = {
        priceId: 'price_123',
        userId: 'user-123',
        mode: 'invalid'
      }

      const result = validateCheckoutParams(params)

      expect(result.valid).toBe(false)
      expect(result.errors[0]).toContain('Invalid mode')
    })

    it('detecta múltiples errores', () => {
      const params = {}

      const result = validateCheckoutParams(params)

      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(1)
    })

    it('rechaza priceId que no es string', () => {
      const params = {
        priceId: 123,
        userId: 'user-123'
      }

      const result = validateCheckoutParams(params)

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Price ID must be a string')
    })

    it('maneja params null', () => {
      const result = validateCheckoutParams(null)

      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
    })
  })

  // ============================================
  // validateUserCanCheckout
  // ============================================
  describe('validateUserCanCheckout', () => {
    it('permite checkout para usuario free normal', () => {
      const user = {
        email: 'user@example.com',
        plan_type: 'free'
      }

      const result = validateUserCanCheckout(user)

      expect(result.canCheckout).toBe(true)
      expect(result.reason).toBeNull()
    })

    it('rechaza usuario null', () => {
      const result = validateUserCanCheckout(null)

      expect(result.canCheckout).toBe(false)
      expect(result.reason).toBe('User not found')
    })

    it('rechaza usuario sin email', () => {
      const user = { plan_type: 'free' }

      const result = validateUserCanCheckout(user)

      expect(result.canCheckout).toBe(false)
      expect(result.reason).toBe('User has no email')
    })

    it('rechaza usuario legacy_free', () => {
      const user = {
        email: 'legacy@example.com',
        plan_type: 'legacy_free'
      }

      const result = validateUserCanCheckout(user)

      expect(result.canCheckout).toBe(false)
      expect(result.reason).toBe('Legacy users do not need to pay')
    })

    it('rechaza usuario ya premium', () => {
      const user = {
        email: 'premium@example.com',
        plan_type: 'premium'
      }

      const result = validateUserCanCheckout(user)

      expect(result.canCheckout).toBe(false)
      expect(result.reason).toBe('User is already premium')
    })

    it('permite usuario con trial que quiere upgrade', () => {
      const user = {
        email: 'trial@example.com',
        plan_type: 'trial'
      }

      const result = validateUserCanCheckout(user)

      expect(result.canCheckout).toBe(true)
    })
  })

  // ============================================
  // buildCustomerMetadata
  // ============================================
  describe('buildCustomerMetadata', () => {
    it('construye metadata completa', () => {
      const user = {
        registration_source: 'google',
        plan_type: 'free'
      }

      const result = buildCustomerMetadata('user-123', user)

      expect(result).toEqual({
        supabase_user_id: 'user-123',
        registration_source: 'google',
        plan_type: 'free'
      })
    })

    it('usa defaults para campos faltantes', () => {
      const result = buildCustomerMetadata('user-123', {})

      expect(result.registration_source).toBe('unknown')
      expect(result.plan_type).toBe('free')
    })

    it('maneja user null', () => {
      const result = buildCustomerMetadata('user-123', null)

      expect(result.supabase_user_id).toBe('user-123')
      expect(result.registration_source).toBe('unknown')
    })
  })

  // ============================================
  // buildSubscriptionMetadata
  // ============================================
  describe('buildSubscriptionMetadata', () => {
    it('construye metadata igual que customer', () => {
      const user = {
        registration_source: 'email',
        plan_type: 'trial'
      }

      const customerMeta = buildCustomerMetadata('user-123', user)
      const subMeta = buildSubscriptionMetadata('user-123', user)

      expect(customerMeta).toEqual(subMeta)
    })
  })

  // ============================================
  // URLs
  // ============================================
  describe('buildSuccessUrl', () => {
    it('incluye CHECKOUT_SESSION_ID placeholder', () => {
      const url = buildSuccessUrl('https://vence.es')

      expect(url).toBe('https://vence.es/premium/success?session_id={CHECKOUT_SESSION_ID}')
      expect(url).toContain('{CHECKOUT_SESSION_ID}')
    })
  })

  describe('buildCancelUrl', () => {
    it('incluye query param cancelled', () => {
      const url = buildCancelUrl('https://vence.es')

      expect(url).toBe('https://vence.es/premium?cancelled=true')
    })
  })

  // ============================================
  // Stripe ID Validators
  // ============================================
  describe('isValidStripeCustomerId', () => {
    it.each([
      ['cus_123456789', true],
      ['cus_abc', true],
      ['customer_123', false],
      ['123', false],
      ['', false],
      [null, false],
      [undefined, false],
      [123, false]
    ])('"%s" devuelve %s', (id, expected) => {
      expect(isValidStripeCustomerId(id)).toBe(expected)
    })
  })

  describe('isValidStripePriceId', () => {
    it.each([
      ['price_123456789', true],
      ['price_abc', true],
      ['prod_123', false],
      ['123', false],
      ['', false],
      [null, false]
    ])('"%s" devuelve %s', (id, expected) => {
      expect(isValidStripePriceId(id)).toBe(expected)
    })
  })

  describe('isValidStripeSubscriptionId', () => {
    it.each([
      ['sub_123456789', true],
      ['sub_abc', true],
      ['subscription_123', false],
      ['123', false],
      ['', false],
      [null, false]
    ])('"%s" devuelve %s', (id, expected) => {
      expect(isValidStripeSubscriptionId(id)).toBe(expected)
    })
  })

  describe('isValidStripeSessionId', () => {
    it.each([
      ['cs_123456789', true],
      ['cs_test_abc', true],
      ['cs_live_xyz', true],
      ['checkout_123', false],
      ['123', false],
      ['', false],
      [null, false]
    ])('"%s" devuelve %s', (id, expected) => {
      expect(isValidStripeSessionId(id)).toBe(expected)
    })
  })
})

// ============================================
// Tests de Integración / Flujos
// ============================================
describe('Stripe Create Checkout - Flujos', () => {
  describe('Flujo completo de validación', () => {
    it('usuario nuevo con todos los datos correctos', () => {
      const params = {
        priceId: 'price_semester_59',
        userId: 'user-uuid-123'
      }
      const user = {
        email: 'nuevo@example.com',
        plan_type: 'free',
        registration_source: 'google'
      }

      // 1. Validar params
      const paramsValid = validateCheckoutParams(params)
      expect(paramsValid.valid).toBe(true)

      // 2. Validar usuario
      const userValid = validateUserCanCheckout(user)
      expect(userValid.canCheckout).toBe(true)

      // 3. Construir metadata
      const customerMeta = buildCustomerMetadata(params.userId, user)
      expect(customerMeta.supabase_user_id).toBe('user-uuid-123')

      const subMeta = buildSubscriptionMetadata(params.userId, user)
      expect(subMeta.supabase_user_id).toBe('user-uuid-123')
    })

    it('rechaza checkout si usuario ya es premium', () => {
      const params = {
        priceId: 'price_123',
        userId: 'premium-user'
      }
      const user = {
        email: 'premium@example.com',
        plan_type: 'premium'
      }

      const paramsValid = validateCheckoutParams(params)
      expect(paramsValid.valid).toBe(true)

      const userValid = validateUserCanCheckout(user)
      expect(userValid.canCheckout).toBe(false)
      expect(userValid.reason).toContain('premium')
    })
  })

  describe('Casos de error comunes', () => {
    it('priceId vacío', () => {
      const result = validateCheckoutParams({ priceId: '', userId: 'user-123' })
      expect(result.valid).toBe(false)
    })

    it('userId como número', () => {
      const result = validateCheckoutParams({ priceId: 'price_123', userId: 12345 })
      expect(result.valid).toBe(false)
    })

    it('usuario con email vacío', () => {
      const result = validateUserCanCheckout({ email: '', plan_type: 'free' })
      expect(result.canCheckout).toBe(false)
    })
  })
})

// ============================================
// Tests de Seguridad
// ============================================
describe('Stripe Create Checkout - Seguridad', () => {
  describe('Validación de entrada', () => {
    it('no acepta objetos maliciosos en priceId', () => {
      const malicious = {
        priceId: { $gt: '' },
        userId: 'user-123'
      }

      const result = validateCheckoutParams(malicious)

      expect(result.valid).toBe(false)
    })

    it('no acepta arrays', () => {
      const result = validateCheckoutParams({
        priceId: ['price_1', 'price_2'],
        userId: 'user-123'
      })

      expect(result.valid).toBe(false)
    })
  })
})
