// lib/stripe-webhook-handlers.ts
// Handlers extraídos para testabilidad

import type Stripe from 'stripe'

// Types
export interface SubscriptionMetadata {
  supabase_user_id?: string
}

export interface CheckoutSession {
  id: string
  customer: string
  customer_email?: string
  subscription?: string
  metadata?: SubscriptionMetadata
  amount_total?: number
  currency?: string
}

export interface SubscriptionItem {
  price?: {
    recurring?: {
      interval?: string
      interval_count?: number
    }
  }
}

export interface Subscription {
  id: string
  customer: string
  status: string
  metadata?: SubscriptionMetadata
  items?: {
    data: SubscriptionItem[]
  }
  current_period_start?: number
  current_period_end?: number
  trial_start?: number | null
  trial_end?: number | null
  cancel_at_period_end?: boolean
  cancellation_details?: {
    reason?: string
  }
}

export interface UserProfile {
  id: string
  email?: string
  full_name?: string
}

export interface ValidationResult {
  valid: boolean
  errors: string[]
}

export interface SubscriptionRecord {
  user_id: string
  stripe_customer_id: string
  stripe_subscription_id: string
  status: string
  plan_type: string
  trial_start: string | null
  trial_end: string | null
  current_period_start: string
  current_period_end: string
}

export interface AdminEmailData {
  userEmail: string | undefined
  userName: string
  amount: number
  currency: string
  stripeCustomerId: string | undefined
  userId: string | undefined
}

export type PlanType = 'premium_monthly' | 'premium_semester'
export type SubscriptionStatus = 'active' | 'trialing' | 'canceled' | 'past_due' | 'unpaid' | 'incomplete'

/**
 * Determina el plan_type basado en el intervalo de facturación
 */
export function determinePlanType(subscription: Subscription | null | undefined): PlanType {
  const interval = subscription?.items?.data?.[0]?.price?.recurring?.interval
  return interval === 'month' ? 'premium_monthly' : 'premium_semester'
}

/**
 * Extrae userId de diferentes fuentes
 */
export async function extractUserId(
  session: CheckoutSession | null,
  subscription: Subscription | null,
  findUserByCustomerId: (customerId: string) => Promise<string | null>
): Promise<string | null> {
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
 */
export function validateSubscriptionData(subscription: Subscription | null | undefined): ValidationResult {
  const errors: string[] = []

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
 */
export function validateCheckoutSession(session: CheckoutSession | null | undefined): ValidationResult {
  const errors: string[] = []

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
 */
export function buildSubscriptionRecord(userId: string, subscription: Subscription): SubscriptionRecord {
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
    current_period_start: new Date(subscription.current_period_start! * 1000).toISOString(),
    current_period_end: new Date(subscription.current_period_end! * 1000).toISOString()
  }
}

/**
 * Determina si un status de subscription indica que el usuario debe ser premium
 */
export function isPremiumStatus(status: string | null | undefined): boolean {
  return ['active', 'trialing'].includes(status as string)
}

/**
 * Determina si un status de subscription indica que se debe degradar al usuario
 */
export function shouldDegradePlan(status: string | null | undefined): boolean {
  return ['canceled', 'unpaid', 'past_due'].includes(status as string)
}

/**
 * Determina si se debe degradar AHORA basándose en current_period_end
 * Stripe envía 'deleted' cuando el período termina, pero verificamos por seguridad
 */
export function shouldDowngradeNow(
  periodEndTimestamp: number | null | undefined,
  nowTimestamp: number | null = null
): boolean {
  if (!periodEndTimestamp) return true // Si no hay fecha, degradar
  const now = nowTimestamp ?? Math.floor(Date.now() / 1000)
  return periodEndTimestamp <= now
}

/**
 * Formatea fecha de período para logs y emails
 */
export function formatPeriodEnd(timestamp: number | null | undefined): string {
  if (!timestamp) return 'No disponible'
  return new Date(timestamp * 1000).toLocaleString('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

/**
 * Construye los datos para el email de admin
 */
export function buildAdminEmailData(
  session: Partial<CheckoutSession>,
  userProfile: UserProfile | null | undefined
): AdminEmailData {
  return {
    userEmail: userProfile?.email || session?.customer_email,
    userName: userProfile?.full_name || 'Sin nombre',
    amount: (session?.amount_total || 0) / 100,
    currency: session?.currency?.toUpperCase() || 'EUR',
    stripeCustomerId: session?.customer,
    userId: userProfile?.id
  }
}
