// lib/api/checkout-sync/queries.ts
//
// Activación SÍNCRONA de premium post-checkout. NO depende del webhook
// (que sigue activo como defensa idempotente). Patrón estándar de la
// industria (Vercel, Linear, Notion, Stripe propio).
//
// Por qué existe este archivo:
//   - Pre-27/05/2026: /premium/success solo llamaba refreshUser() y
//     dependía 100% del webhook. Bug del 27/05 (signature failed) hizo
//     que usuarios (Rocío, Mercedes) pagaran y se bloquearan a las 25
//     preguntas. Webhook ≠ source of truth para UX inmediata.
//   - Post-27/05/2026: success_url → POST /api/stripe/checkout-sync →
//     lee Stripe directo + INSERT idempotente con onConflict='user_id'
//     (compatible con webhook si llega después).
//
// Telemetría: 5 eventTypes en observable_events para que las alertas
// sepan distinguir "sync funcionó", "webhook llegó primero", "user no
// autorizado", "3DS pending", "error Stripe".

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import Stripe from 'stripe'
import { emit } from '@/lib/observability/emit'
import {
  determinePlanType,
  type Subscription,
} from '@/lib/stripe-webhook-handlers'
import type {
  SyncCheckoutRequest,
  SyncCheckoutResponse,
  SyncCheckoutError,
} from './schemas'

// ────────────────────────────────────────────────────────────────
// HELPERS
// ────────────────────────────────────────────────────────────────

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('STRIPE_SECRET_KEY no configurada')
  return new Stripe(key, { apiVersion: '2024-06-20' as Stripe.LatestApiVersion })
}

function getServiceSupabase(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

// Extracción defensiva de current_period_end / current_period_start.
// Stripe SDK v18+ puede no exponerlos directamente; usar items[0] como fallback.
// Mismo patrón que lib/api/subscription/queries.ts y stripe-webhook-handlers.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractPeriodTs(sub: any): { start: number | null; end: number | null } {
  const item = sub.items?.data?.[0]
  const start = sub.current_period_start ?? item?.current_period_start ?? sub.created ?? null
  const end = sub.current_period_end ?? item?.current_period_end ?? null
  return { start, end }
}

// ────────────────────────────────────────────────────────────────
// FUNCIÓN PRINCIPAL
// ────────────────────────────────────────────────────────────────

/**
 * Sincroniza el estado de premium tras un Stripe Checkout exitoso.
 *
 * Flujo:
 *   1. Cargar perfil del user (necesitamos su stripe_customer_id para
 *      validar que la session pertenece a este user — anti-manipulación).
 *   2. retrieve Checkout Session de Stripe con expand subscription.
 *   3. Validar que session.customer === user.stripe_customer_id (sin esto,
 *      un user podría activar premium con session_id de otro user).
 *   4. Validar payment_status. Si 'unpaid' → 3DS pending, devolver
 *      pending_payment para que el frontend muestre UI específica.
 *   5. Extraer subscription, upsert user_subscriptions con onConflict='user_id'
 *      (idéntico al webhook handleSubscriptionCreated → idempotente entre los dos).
 *   6. UPDATE user_profiles.plan_type='premium' + invalidate cache profile.
 *   7. Emit telemetría a observable_events.
 *
 * @returns SyncCheckoutResponse o SyncCheckoutError
 */
export async function syncCheckoutSession(
  userId: string,
  params: SyncCheckoutRequest,
): Promise<SyncCheckoutResponse | SyncCheckoutError> {
  const startedAt = Date.now()
  const supabase = getServiceSupabase()

  try {
    // ─── 1. Perfil del user (anti-manipulación + customer match) ───
    const { data: profile, error: profileErr } = await supabase
      .from('user_profiles')
      .select('id, email, stripe_customer_id, plan_type')
      .eq('id', userId)
      .single()

    if (profileErr || !profile) {
      await emitSyncEvent('error', 'checkout_sync_error', userId, params.sessionId, {
        phase: 'profile_load',
        errorMessage: profileErr?.message ?? 'profile not found',
      }, startedAt)
      return {
        success: false,
        code: 'db_error',
        error: 'No se pudo cargar el perfil del usuario',
      }
    }

    // ─── 2. retrieve Checkout Session de Stripe ───
    const stripe = getStripe()
    let session: Stripe.Checkout.Session
    try {
      session = await stripe.checkout.sessions.retrieve(params.sessionId, {
        expand: ['subscription'],
      })
    } catch (stripeErr) {
      const msg = stripeErr instanceof Error ? stripeErr.message : String(stripeErr)
      await emitSyncEvent('error', 'checkout_sync_error', userId, params.sessionId, {
        phase: 'stripe_retrieve',
        errorMessage: msg,
      }, startedAt)
      // Distinguir 404 (sesión inexistente) de errores genéricos.
      const isNotFound = msg.includes('No such checkout.session') || msg.includes('does not exist')
      return {
        success: false,
        code: isNotFound ? 'session_not_found' : 'stripe_error',
        error: msg,
      }
    }

    // ─── 3. Validar customer match (anti-manipulación session_id) ───
    //
    // Casos:
    //   a) profile.stripe_customer_id === session.customer → match directo (renewal)
    //   b) profile.stripe_customer_id === null → PRIMER PAGO. El webhook
    //      checkout.session.completed normalmente rellena este campo, pero
    //      si el sync llega antes que el webhook (latencia signature/red),
    //      bloquear aquí dejaría al user sin activar pese a haber pagado.
    //      Auto-rellenamos profile.stripe_customer_id, PERO solo si el
    //      session.customer no está ya tomado por OTRO user en BD (defensa
    //      contra ataque de takeover: alguien pega un session_id legítimo
    //      desde otra cuenta nueva).
    //   c) profile.stripe_customer_id existe Y NO coincide → manipulación
    //      real → unauthorized.
    const sessionCustomer = typeof session.customer === 'string'
      ? session.customer
      : session.customer?.id ?? null

    if (!sessionCustomer) {
      // Una checkout session de subscription debe tener customer.
      await emitSyncEvent('warn', 'checkout_sync_unauthorized', userId, params.sessionId, {
        reason: 'session_without_customer',
      }, startedAt)
      return {
        success: false,
        code: 'unauthorized',
        error: 'La sesión de pago no tiene customer asociado',
      }
    }

    let firstTimePayer = false
    if (profile.stripe_customer_id === null) {
      // Caso b — primer pago. Verificar que el customer NO está ya tomado.
      const { data: ownerOfCustomer } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('stripe_customer_id', sessionCustomer)
        .maybeSingle()

      if (ownerOfCustomer && ownerOfCustomer.id !== userId) {
        // Anti-takeover: el customer ya pertenece a otro user (probable que
        // alguien intente activar premium en su cuenta con session_id de
        // otra cuenta legítima). Rechazar.
        await emitSyncEvent('error', 'checkout_sync_unauthorized', userId, params.sessionId, {
          reason: 'customer_owned_by_other_user',
          sessionCustomer,
          actualOwnerUserId: ownerOfCustomer.id,
        }, startedAt)
        return {
          success: false,
          code: 'unauthorized',
          error: 'Esta sesión de pago pertenece a otra cuenta',
        }
      }

      // Customer libre — auto-vincular a este user. El webhook normalmente
      // habría hecho lo mismo, simplemente nos adelantamos para no depender
      // de él en el path crítico.
      firstTimePayer = true
    } else if (sessionCustomer !== profile.stripe_customer_id) {
      // Caso c — manipulación real.
      await emitSyncEvent('warn', 'checkout_sync_unauthorized', userId, params.sessionId, {
        reason: 'customer_mismatch',
        sessionCustomer,
        profileCustomer: profile.stripe_customer_id,
      }, startedAt)
      return {
        success: false,
        code: 'unauthorized',
        error: 'Esta sesión de pago no pertenece a tu cuenta',
      }
    }

    // ─── 4. Validar payment_status ───
    // Posibles valores: 'paid' | 'unpaid' | 'no_payment_required'
    if (session.payment_status === 'unpaid') {
      // 3DS pending, transferencia bancaria en proceso, etc. El frontend
      // debe mostrar "Tu pago está procesándose, te avisaremos por email".
      // El webhook (invoice.paid o checkout.session.async_payment_succeeded)
      // se encargará de activar cuando confirme.
      await emitSyncEvent('info', 'checkout_sync_pending_payment', userId, params.sessionId, {
        paymentStatus: session.payment_status,
        sessionStatus: session.status,
      }, startedAt)
      return {
        success: true,
        status: 'pending_payment',
        paymentStatus: session.payment_status,
        activatedBySync: false,
      }
    }

    // ─── 5. Subscription presente? ───
    // mode='subscription' garantiza subscription presente; mode='payment'
    // (one-time) no la tiene → reportar para tracking.
    const subscription = (typeof session.subscription === 'object' && session.subscription !== null)
      ? session.subscription as Stripe.Subscription
      : null

    if (!subscription) {
      // Checkout era one-time payment, no recurring. Vence solo usa subs,
      // así que esto sería un caso de configuración rara. No activamos premium
      // (no hay sub que tracking). Webhook checkout.session.completed maneja
      // el caso si aplica.
      await emitSyncEvent('warn', 'checkout_sync_no_subscription', userId, params.sessionId, {
        mode: session.mode,
        paymentStatus: session.payment_status,
      }, startedAt)
      return {
        success: false,
        code: 'no_subscription',
        error: 'El checkout no contiene una suscripción recurrente',
      }
    }

    // ─── 6. Comprobar si ya está sincronizada (webhook llegó primero) ───
    const { data: existing } = await supabase
      .from('user_subscriptions')
      .select('id, status')
      .eq('stripe_subscription_id', subscription.id)
      .maybeSingle()

    const { start: periodStartTs, end: periodEndTs } = extractPeriodTs(subscription)
    const periodStartIso = periodStartTs ? new Date(periodStartTs * 1000).toISOString() : null
    const periodEndIso = periodEndTs ? new Date(periodEndTs * 1000).toISOString() : null

    if (existing) {
      // Webhook llegó primero. NO hace falta upsert, pero SÍ aseguramos que
      // user_profiles.plan_type='premium' (puede haber drift entre webhook
      // y profile si un trigger falló — defense in depth).
      if (profile.plan_type !== 'premium') {
        await supabase
          .from('user_profiles')
          .update({ plan_type: 'premium', requires_payment: false })
          .eq('id', userId)
        await invalidateProfileCacheSafe()
      }
      await emitSyncEvent('info', 'checkout_sync_already_synced_by_webhook', userId, params.sessionId, {
        subscriptionId: subscription.id,
        existingStatus: existing.status,
        profilePlanTypeBefore: profile.plan_type,
      }, startedAt)
      return {
        success: true,
        status: 'already_active',
        subscriptionId: subscription.id,
        planType: determinePlanType(subscription as unknown as Subscription),
        currentPeriodEnd: periodEndIso,
        paymentStatus: session.payment_status,
        activatedBySync: false,
      }
    }

    // ─── 7. UPSERT user_subscriptions (idéntico al webhook) ───
    // onConflict: 'user_id' replica el patrón del webhook
    // (handleSubscriptionCreated en app/api/stripe/webhook/route.ts) para que
    // si el webhook llega justo después, no falle por duplicate (haría UPDATE).
    const planType = determinePlanType(subscription as unknown as Subscription)

    const { error: upsertErr } = await supabase
      .from('user_subscriptions')
      .upsert({
        user_id: userId,
        stripe_customer_id: sessionCustomer,
        stripe_subscription_id: subscription.id,
        status: subscription.status,
        plan_type: planType,
        trial_start: subscription.trial_start
          ? new Date(subscription.trial_start * 1000).toISOString()
          : null,
        trial_end: subscription.trial_end
          ? new Date(subscription.trial_end * 1000).toISOString()
          : null,
        current_period_start: periodStartIso,
        current_period_end: periodEndIso,
      }, {
        onConflict: 'user_id',
        ignoreDuplicates: false,
      })

    if (upsertErr) {
      await emitSyncEvent('error', 'checkout_sync_error', userId, params.sessionId, {
        phase: 'upsert_subscription',
        errorMessage: upsertErr.message,
        subscriptionId: subscription.id,
      }, startedAt)
      return {
        success: false,
        code: 'db_error',
        error: `Error guardando suscripción: ${upsertErr.message}`,
      }
    }

    // ─── 8. UPDATE user_profiles.plan_type=premium ───
    // Si firstTimePayer, también auto-vinculamos stripe_customer_id que
    // antes era null (caso primer pago — el sync llegó antes que el
    // webhook checkout.session.completed que normalmente lo rellenaba).
    const profileUpdate: Record<string, unknown> = {
      plan_type: 'premium',
      requires_payment: false,
    }
    if (firstTimePayer) {
      profileUpdate.stripe_customer_id = sessionCustomer
    }
    const { error: updateErr } = await supabase
      .from('user_profiles')
      .update(profileUpdate)
      .eq('id', userId)

    if (updateErr) {
      // El upsert ya pasó, pero el profile no se actualizó. La reconciliation
      // cron lo va a coger en ≤1h. Aún así, lo reportamos como warning para
      // que la alerta vea inconsistencia parcial.
      await emitSyncEvent('warn', 'checkout_sync_profile_update_failed', userId, params.sessionId, {
        errorMessage: updateErr.message,
        subscriptionId: subscription.id,
      }, startedAt)
      // No devolvemos error al user — la sub está creada, premium se activará
      // en el próximo refresh (cache profile invalidate abajo).
    }

    await invalidateProfileCacheSafe()

    // ─── 9. Telemetría éxito ───
    await emitSyncEvent('info', 'checkout_sync_activated', userId, params.sessionId, {
      subscriptionId: subscription.id,
      planType,
      currentPeriodEnd: periodEndIso,
      paymentStatus: session.payment_status,
      stripeCustomerId: sessionCustomer,
      firstTimePayer,
    }, startedAt)

    return {
      success: true,
      status: 'activated',
      subscriptionId: subscription.id,
      planType,
      currentPeriodEnd: periodEndIso,
      paymentStatus: session.payment_status,
      activatedBySync: true,
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    await emitSyncEvent('error', 'checkout_sync_error', userId, params.sessionId, {
      phase: 'unknown',
      errorMessage: msg,
    }, startedAt)
    return {
      success: false,
      code: 'stripe_error',
      error: msg,
    }
  }
}

// ────────────────────────────────────────────────────────────────
// SPRINT B — Auto-sync silencioso en GET /api/profile
// ────────────────────────────────────────────────────────────────

/**
 * Reconcilia el estado premium de un usuario contra Stripe directamente,
 * sin requerir un sessionId. Se llama desde GET /api/profile via after()
 * cuando detecta drift potencial (user tiene stripe_customer_id pero
 * plan_type='free'). También se puede llamar como endpoint manual.
 *
 * Cubre el caso: usuario paga desde móvil, entra al día siguiente desde
 * el portátil sin pasar por success_url. Sin esto, el cron de
 * reconciliation tarda hasta 1h en arreglarlo. Con esto, el próximo
 * refresh del perfil (instantáneo) ya activa premium.
 *
 * Idempotente: si la sub ya está en BD o el user no tiene sub active,
 * no hace nada destructivo.
 *
 * @returns { drift: boolean, fixed: boolean, reason?: string }
 */
export async function reconcileUserPremium(userId: string): Promise<{
  drift: boolean
  fixed: boolean
  reason?: string
}> {
  const startedAt = Date.now()
  const supabase = getServiceSupabase()

  try {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('id, stripe_customer_id, plan_type')
      .eq('id', userId)
      .single()

    if (!profile?.stripe_customer_id) {
      // No es un user de pago, nada que reconciliar.
      return { drift: false, fixed: false, reason: 'no_stripe_customer' }
    }
    if (profile.plan_type === 'premium') {
      // Ya está premium, no hay drift.
      return { drift: false, fixed: false, reason: 'already_premium' }
    }

    // Drift potencial: tiene customer pero plan free. Consultar Stripe.
    const stripe = getStripe()
    const subs = await stripe.subscriptions.list({
      customer: profile.stripe_customer_id,
      status: 'active',
      limit: 5,
    })

    // Aceptamos también trialing como acceso premium
    const subsAll = await stripe.subscriptions.list({
      customer: profile.stripe_customer_id,
      status: 'trialing',
      limit: 5,
    })
    const candidates = [...subs.data, ...subsAll.data]

    if (candidates.length === 0) {
      // No hay subs reales — el plan_type=free está bien (no es drift).
      // Posiblemente el user canceló y la BD aún no se actualizó vía webhook,
      // o tiene customer porque intentó pagar pero falló.
      return { drift: false, fixed: false, reason: 'no_active_sub_in_stripe' }
    }

    // Drift confirmado: Stripe dice premium, BD dice free.
    const sub = candidates[0]
    const { start: periodStartTs, end: periodEndTs } = extractPeriodTs(sub)
    const planType = determinePlanType(sub as unknown as Subscription)

    const { error: upsertErr } = await supabase
      .from('user_subscriptions')
      .upsert({
        user_id: userId,
        stripe_customer_id: profile.stripe_customer_id,
        stripe_subscription_id: sub.id,
        status: sub.status,
        plan_type: planType,
        trial_start: sub.trial_start ? new Date(sub.trial_start * 1000).toISOString() : null,
        trial_end: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
        current_period_start: periodStartTs ? new Date(periodStartTs * 1000).toISOString() : null,
        current_period_end: periodEndTs ? new Date(periodEndTs * 1000).toISOString() : null,
      }, { onConflict: 'user_id', ignoreDuplicates: false })

    if (upsertErr) {
      await emit({
        source: 'fargate',
        severity: 'error',
        eventType: 'profile_reconcile_error',
        endpoint: '/api/profile (auto-reconcile)',
        userId,
        durationMs: Date.now() - startedAt,
        errorMessage: upsertErr.message,
        metadata: { phase: 'upsert_subscription' },
      })
      return { drift: true, fixed: false, reason: upsertErr.message }
    }

    await supabase
      .from('user_profiles')
      .update({ plan_type: 'premium', requires_payment: false })
      .eq('id', userId)

    await invalidateProfileCacheSafe()

    await emit({
      source: 'fargate',
      severity: 'warn', // warn porque significa que el webhook NO sincronizó cuando debió
      eventType: 'profile_reconcile_fixed',
      endpoint: '/api/profile (auto-reconcile)',
      userId,
      durationMs: Date.now() - startedAt,
      metadata: {
        stripeCustomerId: profile.stripe_customer_id,
        subscriptionId: sub.id,
        previousPlanType: profile.plan_type,
      },
    })

    return { drift: true, fixed: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    await emit({
      source: 'fargate',
      severity: 'error',
      eventType: 'profile_reconcile_error',
      endpoint: '/api/profile (auto-reconcile)',
      userId,
      durationMs: Date.now() - startedAt,
      errorMessage: msg,
      metadata: { phase: 'unknown' },
    })
    return { drift: false, fixed: false, reason: msg }
  }
}

// ────────────────────────────────────────────────────────────────
// HELPERS PRIVADOS
// ────────────────────────────────────────────────────────────────

async function invalidateProfileCacheSafe(): Promise<void> {
  try {
    const { invalidateProfileCache } = await import('@/lib/api/profile')
    invalidateProfileCache()
  } catch {
    // Cache no disponible (entorno test, etc.) — no crítico.
  }
}

async function emitSyncEvent(
  severity: 'info' | 'warn' | 'error',
  eventType: string,
  userId: string,
  sessionId: string,
  metadata: Record<string, unknown>,
  startedAt: number,
): Promise<void> {
  try {
    await emit({
      source: 'fargate',
      severity,
      eventType,
      endpoint: '/api/stripe/checkout-sync',
      userId,
      durationMs: Date.now() - startedAt,
      metadata: {
        sessionId,
        ...metadata,
      },
    })
  } catch {
    // emit no debe romper el flujo principal.
  }
}
