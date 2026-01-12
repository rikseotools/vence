// lib/stripe-webhook-handlers.js
// Handlers extraídos para testabilidad

/**
 * Determina el plan_type basado en el intervalo de facturación
 * @param {Object} subscription - Subscription de Stripe
 * @returns {string} - 'premium_monthly' | 'premium_semester'
 */
export function determinePlanType(subscription) {
  const interval = subscription?.items?.data?.[0]?.price?.recurring?.interval
  return interval === 'month' ? 'premium_monthly' : 'premium_semester'
}

/**
 * Extrae userId de diferentes fuentes
 * @param {Object} session - Checkout session
 * @param {Object} subscription - Subscription (opcional)
 * @param {Function} findUserByCustomerId - Función para buscar usuario
 * @returns {Promise<string|null>}
 */
export async function extractUserId(session, subscription, findUserByCustomerId) {
  // 1. Intentar desde subscription metadata
  if (subscription?.metadata?.supabase_user_id) {
    return subscription.metadata.supabase_user_id
  }

  // 2. Intentar desde session metadata
  if (session?.metadata?.supabase_user_id) {
    return session.metadata.supabase_user_id
  }

  // 3. Buscar por stripe_customer_id
  if (session?.customer && findUserByCustomerId) {
    return await findUserByCustomerId(session.customer)
  }

  return null
}

/**
 * Valida que una subscription tiene los datos mínimos necesarios
 * @param {Object} subscription
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateSubscriptionData(subscription) {
  const errors = []

  if (!subscription?.id) {
    errors.push('Missing subscription ID')
  }

  if (!subscription?.customer) {
    errors.push('Missing customer ID')
  }

  if (!subscription?.status) {
    errors.push('Missing subscription status')
  }

  if (!subscription?.current_period_start) {
    errors.push('Missing current_period_start')
  }

  if (!subscription?.current_period_end) {
    errors.push('Missing current_period_end')
  }

  return {
    valid: errors.length === 0,
    errors
  }
}

/**
 * Valida un checkout session
 * @param {Object} session
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateCheckoutSession(session) {
  const errors = []

  if (!session?.id) {
    errors.push('Missing session ID')
  }

  if (!session?.customer) {
    errors.push('Missing customer ID')
  }

  return {
    valid: errors.length === 0,
    errors
  }
}

/**
 * Construye el objeto para insertar/actualizar en user_subscriptions
 * @param {string} userId
 * @param {Object} subscription
 * @returns {Object}
 */
export function buildSubscriptionRecord(userId, subscription) {
  const planType = determinePlanType(subscription)

  return {
    user_id: userId,
    stripe_customer_id: subscription.customer,
    stripe_subscription_id: subscription.id,
    status: subscription.status,
    plan_type: planType,
    trial_start: subscription.trial_start
      ? new Date(subscription.trial_start * 1000).toISOString()
      : null,
    trial_end: subscription.trial_end
      ? new Date(subscription.trial_end * 1000).toISOString()
      : null,
    current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
    current_period_end: new Date(subscription.current_period_end * 1000).toISOString()
  }
}

/**
 * Determina si un status de subscription indica que el usuario debe ser premium
 * @param {string} status
 * @returns {boolean}
 */
export function isPremiumStatus(status) {
  return ['active', 'trialing'].includes(status)
}

/**
 * Determina si un status de subscription indica que se debe degradar al usuario
 * @param {string} status
 * @returns {boolean}
 */
export function shouldDegradePlan(status) {
  return ['canceled', 'unpaid', 'past_due'].includes(status)
}

/**
 * Construye los datos para el email de admin
 * @param {Object} session - Checkout session
 * @param {Object} userProfile - Perfil del usuario
 * @returns {Object}
 */
export function buildAdminEmailData(session, userProfile) {
  return {
    userEmail: userProfile?.email || session?.customer_email,
    userName: userProfile?.full_name || 'Sin nombre',
    amount: (session?.amount_total || 0) / 100,
    currency: session?.currency?.toUpperCase() || 'EUR',
    stripeCustomerId: session?.customer,
    userId: userProfile?.id
  }
}
