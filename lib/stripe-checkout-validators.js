// lib/stripe-checkout-validators.js
// Validadores para el endpoint de crear checkout

/**
 * Valida los parámetros de creación de checkout
 * @param {Object} params - { priceId, userId, mode }
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateCheckoutParams(params) {
  const errors = []

  if (!params?.priceId) {
    errors.push('Price ID is required')
  } else if (typeof params.priceId !== 'string') {
    errors.push('Price ID must be a string')
  } else if (!params.priceId.startsWith('price_')) {
    errors.push('Invalid Price ID format')
  }

  if (!params?.userId) {
    errors.push('User ID is required')
  } else if (typeof params.userId !== 'string') {
    errors.push('User ID must be a string')
  }

  const validModes = ['normal', 'trial']
  if (params?.mode && !validModes.includes(params.mode)) {
    errors.push(`Invalid mode. Must be one of: ${validModes.join(', ')}`)
  }

  return {
    valid: errors.length === 0,
    errors
  }
}

/**
 * Valida que un usuario puede hacer checkout
 * @param {Object} user - { plan_type, email }
 * @returns {{ canCheckout: boolean, reason: string | null }}
 */
export function validateUserCanCheckout(user) {
  if (!user) {
    return { canCheckout: false, reason: 'User not found' }
  }

  if (!user.email) {
    return { canCheckout: false, reason: 'User has no email' }
  }

  if (user.plan_type === 'legacy_free') {
    return { canCheckout: false, reason: 'Legacy users do not need to pay' }
  }

  if (user.plan_type === 'premium') {
    return { canCheckout: false, reason: 'User is already premium' }
  }

  return { canCheckout: true, reason: null }
}

/**
 * Construye el objeto metadata para el customer de Stripe
 * @param {string} userId
 * @param {Object} user
 * @returns {Object}
 */
export function buildCustomerMetadata(userId, user) {
  return {
    supabase_user_id: userId,
    registration_source: user?.registration_source || 'unknown',
    plan_type: user?.plan_type || 'free'
  }
}

/**
 * Construye el objeto metadata para la subscription
 * @param {string} userId
 * @param {Object} user
 * @returns {Object}
 */
export function buildSubscriptionMetadata(userId, user) {
  return {
    supabase_user_id: userId,
    registration_source: user?.registration_source || 'unknown',
    plan_type: user?.plan_type || 'free'
  }
}

/**
 * Construye la URL de success para el checkout
 * @param {string} baseUrl
 * @returns {string}
 */
export function buildSuccessUrl(baseUrl) {
  return `${baseUrl}/premium/success?session_id={CHECKOUT_SESSION_ID}`
}

/**
 * Construye la URL de cancel para el checkout
 * @param {string} baseUrl
 * @returns {string}
 */
export function buildCancelUrl(baseUrl) {
  return `${baseUrl}/premium?cancelled=true`
}

/**
 * Valida un Stripe customer ID
 * @param {string} customerId
 * @returns {boolean}
 */
export function isValidStripeCustomerId(customerId) {
  return typeof customerId === 'string' && customerId.startsWith('cus_')
}

/**
 * Valida un Stripe price ID
 * @param {string} priceId
 * @returns {boolean}
 */
export function isValidStripePriceId(priceId) {
  return typeof priceId === 'string' && priceId.startsWith('price_')
}

/**
 * Valida un Stripe subscription ID
 * @param {string} subscriptionId
 * @returns {boolean}
 */
export function isValidStripeSubscriptionId(subscriptionId) {
  return typeof subscriptionId === 'string' && subscriptionId.startsWith('sub_')
}

/**
 * Valida un Stripe checkout session ID
 * @param {string} sessionId
 * @returns {boolean}
 */
export function isValidStripeSessionId(sessionId) {
  return typeof sessionId === 'string' && sessionId.startsWith('cs_')
}
