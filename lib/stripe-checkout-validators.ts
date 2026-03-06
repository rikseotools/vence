// lib/stripe-checkout-validators.ts
// Validadores para el endpoint de crear checkout

interface CheckoutParams {
  priceId?: string
  userId?: string
  mode?: string
}

interface CheckoutUser {
  email?: string | null
  plan_type?: string | null
  registration_source?: string | null
}

interface StripeMetadata {
  supabase_user_id: string
  registration_source: string
  plan_type: string
}

export function validateCheckoutParams(params: CheckoutParams | null | undefined): { valid: boolean; errors: string[] } {
  const errors: string[] = []

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

export function validateUserCanCheckout(user: CheckoutUser | null | undefined): { canCheckout: boolean; reason: string | null } {
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

export function buildCustomerMetadata(userId: string, user: CheckoutUser | null | undefined): StripeMetadata {
  return {
    supabase_user_id: userId,
    registration_source: user?.registration_source || 'unknown',
    plan_type: user?.plan_type || 'free'
  }
}

export function buildSubscriptionMetadata(userId: string, user: CheckoutUser | null | undefined): StripeMetadata {
  return {
    supabase_user_id: userId,
    registration_source: user?.registration_source || 'unknown',
    plan_type: user?.plan_type || 'free'
  }
}

export function buildSuccessUrl(baseUrl: string): string {
  return `${baseUrl}/premium/success?session_id={CHECKOUT_SESSION_ID}`
}

export function buildCancelUrl(baseUrl: string): string {
  return `${baseUrl}/premium?cancelled=true`
}

export function isValidStripeCustomerId(customerId: string): boolean {
  return typeof customerId === 'string' && customerId.startsWith('cus_')
}

export function isValidStripePriceId(priceId: string): boolean {
  return typeof priceId === 'string' && priceId.startsWith('price_')
}

export function isValidStripeSubscriptionId(subscriptionId: string): boolean {
  return typeof subscriptionId === 'string' && subscriptionId.startsWith('sub_')
}

export function isValidStripeSessionId(sessionId: string): boolean {
  return typeof sessionId === 'string' && sessionId.startsWith('cs_')
}
