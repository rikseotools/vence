// app/api/stripe/webhook/route.ts
import { NextResponse, NextRequest } from 'next/server'
import { headers } from 'next/headers'
import { getWebhookAccounts, getStripeFor, type StripeAccount } from '@/lib/stripe'
import { Resend } from 'resend'
import type Stripe from 'stripe'
import { getAdminDb } from '@/db/client'
import { userProfiles, userSubscriptions, cancellationFeedback, paymentSettlements, userAcquisition } from '@/db/schema'
import { and, eq, desc, sql, or } from 'drizzle-orm'
import { recordConversion } from '@/lib/conversions/recordConversion'
import { emit } from '@/lib/observability/emit'
import { emitReferralEvent } from '@/lib/referrals/observability'
import { computeSettlementAfterRefund } from '@/lib/stripe-settlement-helpers'
import { hashEmail } from '@/lib/services/googleAds'
import { shouldDowngradeNow, formatPeriodEnd, determinePlanType } from '@/lib/stripe-webhook-handlers'
import { sendEmailV2 } from '@/lib/api/emails'
import { invalidateProfileCache } from '@/lib/api/profile'

import { withErrorLogging } from '@/lib/api/withErrorLogging'

// getAdminDb() = Drizzle/DATABASE_URL (bypass RLS, equivalente al service_role).
// Agnóstico de proveedor. Cada handler lo obtiene del singleton cacheado.
type Db = ReturnType<typeof getAdminDb>
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type StripeSubscription = any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type StripeInvoice = any
type StripeCheckoutSession = Stripe.Checkout.Session
type StripeCustomer = Stripe.Customer

// Helper to retrieve subscription (en la cuenta de la que vino el evento)
async function getSubscription(subscriptionId: string, sc: Stripe): Promise<StripeSubscription> {
  return await sc.subscriptions.retrieve(subscriptionId)
}

/**
 * Extrae current_period_start y current_period_end de una suscripción.
 * Stripe SDK v18+ eliminó estos campos del objeto subscription.
 * Fallback: calcular desde billing_cycle_anchor + interval, o usar cancel_at.
 */
function extractPeriodDates(subscription: StripeSubscription): { periodStart: string | null, periodEnd: string | null } {
  let periodStart: string | null = null
  let periodEnd: string | null = null

  // Intento 1: campos directos (SDKs antiguos o si Stripe los devuelve)
  if (subscription.current_period_start) {
    periodStart = new Date(subscription.current_period_start * 1000).toISOString()
  }
  if (subscription.current_period_end) {
    periodEnd = new Date(subscription.current_period_end * 1000).toISOString()
  }

  // Intento 2: SDK ≥18 (API 2025-06+) movió current_period_end al item.
  // Stripe sigue garantizando que el primer item tiene la verdad del período.
  if (!periodStart && subscription.items?.data?.[0]?.current_period_start) {
    periodStart = new Date(subscription.items.data[0].current_period_start * 1000).toISOString()
  }
  if (!periodEnd && subscription.items?.data?.[0]?.current_period_end) {
    periodEnd = new Date(subscription.items.data[0].current_period_end * 1000).toISOString()
    console.log('📅 [extractPeriodDates] Usando items[0].current_period_end (SDK ≥18):', periodEnd)
  }

  // Intento 3: usar cancel_at como period_end (cuando cancel_at_period_end=true, cancel_at = fin del periodo)
  if (!periodEnd && subscription.cancel_at) {
    periodEnd = new Date(subscription.cancel_at * 1000).toISOString()
    console.log('📅 [extractPeriodDates] Usando cancel_at como period_end:', periodEnd)
  }

  // Intento 4: calcular desde billing_cycle_anchor + interval (último fallback)
  if (!periodEnd && subscription.billing_cycle_anchor) {
    const anchor = subscription.billing_cycle_anchor * 1000
    const interval = subscription.items?.data?.[0]?.price?.recurring?.interval
    const intervalCount = subscription.items?.data?.[0]?.price?.recurring?.interval_count || 1
    const now = Date.now()

    if (interval) {
      let periodMs = 30 * 24 * 60 * 60 * 1000 // default: 1 mes
      if (interval === 'month') periodMs = intervalCount * 30 * 24 * 60 * 60 * 1000
      else if (interval === 'year') periodMs = intervalCount * 365 * 24 * 60 * 60 * 1000

      // Calcular el periodo actual avanzando desde el anchor
      let currentStart = anchor
      while (currentStart + periodMs <= now) {
        currentStart += periodMs
      }
      periodStart = periodStart || new Date(currentStart).toISOString()
      periodEnd = new Date(currentStart + periodMs).toISOString()
      console.log('📅 [extractPeriodDates] Calculado desde anchor:', periodStart, '→', periodEnd)
    }
  }

  return { periodStart, periodEnd }
}

// Mapear status de Stripe a valores permitidos en user_subscriptions_status_check
// Stripe puede enviar: active, past_due, unpaid, canceled, incomplete, incomplete_expired, trialing, paused
// Nuestro constraint permite: trialing, active, canceled, past_due, unpaid
const VALID_STATUSES = new Set(['trialing', 'active', 'canceled', 'past_due', 'unpaid'])

function normalizeStripeStatus(status: string): string {
  if (VALID_STATUSES.has(status)) return status
  // Mapear statuses no soportados
  if (status === 'incomplete' || status === 'incomplete_expired') return 'unpaid'
  if (status === 'paused') return 'active'
  console.warn(`⚠️ Stripe status desconocido: "${status}", mapeando a "active"`)
  return 'active'
}

const getResend = () => new Resend(process.env.RESEND_API_KEY)
const ADMIN_EMAIL = 'manueltrader@gmail.com'

// Types
interface PurchaseEmailData {
  userEmail: string
  userName: string
  amount: number
  currency: string
  stripeCustomerId: string
  userId: string
  targetOposicion?: string | null
  registrationSource?: string | null
  registrationUrl?: string | null
  registrationFunnel?: string | null
  registrationDate?: string | null
}

interface PaymentIssueEmailData {
  userEmail: string
  userName: string
  status: string
  subscriptionId: string
  invoiceId?: string
  amount?: number
  currency?: string
}


interface SettlementData {
  paymentIntentId: string | null
  chargeId: string | null
  invoiceId: string | null
  customerId: string
  userId: string
  userEmail: string
  amountGross: number
  currency: string
  paymentDate: string
  db: Db
  sc: Stripe
}

async function _POST(request: NextRequest) {
  try {
    const body = await request.text()
    const headersList = await headers()
    const signature = headersList.get('stripe-signature')

    if (!signature) {
      console.error('Missing signature')
      return NextResponse.json({ error: 'Webhook signature missing' }, { status: 400 })
    }

    // MULTI-CUENTA: el mismo endpoint recibe eventos de Manuel (renovaciones) y
    // de Nila (altas nuevas). Probamos la firma contra el secret de cada cuenta
    // configurada; la que valida determina de qué cuenta viene el evento, y con
    // ella resolvemos el cliente Stripe (sc) que se inyecta a los handlers para
    // cualquier retrieve/settlement/cupón posterior.
    const accounts = getWebhookAccounts()
    let event: Stripe.Event | null = null
    let account: StripeAccount | null = null
    for (const acc of accounts) {
      try {
        event = getStripeFor(acc.account).webhooks.constructEvent(body, signature, acc.secret)
        account = acc.account
        break
      } catch {
        // Firma no válida para esta cuenta — probar la siguiente.
      }
    }

    if (!event || !account) {
      console.error('Webhook signature verification failed for all accounts')
      return NextResponse.json({ error: 'Webhook signature verification failed' }, { status: 400 })
    }

    const sc = getStripeFor(account)
    const db = getAdminDb()
    console.log(`🪝 Webhook ${event.type} verificado en cuenta '${account}'`)

    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(event.data.object as StripeCheckoutSession, db, sc, account)
        break

      case 'customer.subscription.created':
        await handleSubscriptionCreated(event.data.object as StripeSubscription, db)
        break

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as StripeSubscription, db)
        break

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as StripeSubscription, db)
        break

      case 'invoice.created':
        await handleInvoiceCreated(event.data.object as StripeInvoice, sc)
        break

      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event.data.object as StripeInvoice, db, sc)
        break

      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object as StripeInvoice, db, sc)
        break

      case 'charge.refunded':
        await handleChargeRefunded(event.data.object as Stripe.Charge, db)
        break

      case 'charge.dispute.created':
        await handleChargeDisputeCreated(event.data.object as Stripe.Dispute, db)
        break

      case 'charge.dispute.closed':
        await handleChargeDisputeClosed(event.data.object as Stripe.Dispute, db)
        break

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    return NextResponse.json({ received: true })

  } catch (error) {
    const err = error as Error
    console.error('Webhook error:', err)

    try {
      await sendWebhookErrorEmail(err)
    } catch (emailErr) {
      console.error('Error enviando email de alerta:', emailErr)
    }

    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 })
  }
}

async function sendWebhookErrorEmail(error: Error): Promise<void> {
  const html = `
    <!DOCTYPE html>
    <html>
      <head><meta charset="utf-8"><title>Error en Webhook Stripe</title></head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; margin: 0; padding: 20px; background-color: #f5f5f5;">
        <div style="max-width: 600px; margin: 0 auto; background: white; padding: 20px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <div style="text-align: center; background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%); margin: -20px -20px 20px -20px; padding: 30px 20px; border-radius: 10px 10px 0 0; border-bottom: 4px solid #dc2626;">
            <h1 style="color: #b91c1c; margin: 0;">🚨 ERROR EN WEBHOOK STRIPE</h1>
            <p style="color: #dc2626; margin: 10px 0 0 0; font-size: 18px;">Un pago puede no haberse procesado</p>
          </div>
          <div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin-bottom: 20px; border: 2px solid #f59e0b;">
            <h3 style="color: #92400e; margin: 0 0 10px 0;">⚠️ Acción requerida:</h3>
            <p style="margin: 0; color: #78350f;">Revisa Stripe Dashboard > Webhooks para ver qué evento falló.</p>
          </div>
          <div style="background: #f9fafb; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
            <h3 style="color: #374151; margin: 0 0 15px 0;">🔍 Detalles del error:</h3>
            <p style="margin: 8px 0;"><strong>Mensaje:</strong> ${error.message || 'Sin mensaje'}</p>
            <p style="margin: 8px 0;"><strong>Tipo:</strong> ${error.name || 'Error'}</p>
            <p style="margin: 8px 0;"><strong>Fecha:</strong> ${new Date().toLocaleString('es-ES')}</p>
            <pre style="background: #1f2937; color: #f3f4f6; padding: 10px; border-radius: 4px; overflow-x: auto; font-size: 12px;">${error.stack || 'Sin stack trace'}</pre>
          </div>
          <div style="text-align: center; margin-top: 20px;">
            <a href="https://dashboard.stripe().com/webhooks" style="background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold; margin-right: 10px;">📊 Ver Webhooks en Stripe</a>
            <a href="https://www.vence.es/admin" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">🏠 Panel Admin</a>
          </div>
        </div>
      </body>
    </html>
  `

  await getResend().emails.send({
    from: process.env.FROM_EMAIL || 'info@vence.es',
    to: ADMIN_EMAIL,
    subject: `🚨 ERROR WEBHOOK STRIPE - ${new Date().toLocaleString('es-ES')}`,
    html
  })
}

// F1 trackeo-conversiones-ventas — encola la compra hacia Google Ads (OCI por
// click-ID guardado en user_acquisition + Enhanced Conversions por email
// hasheado). Se llama desde AMBOS caminos de checkout (metadata y búsqueda por
// email) para no perder ninguna venta. recordConversion encola en el outbox y
// nunca lanza; el cron /api/cron/conversion-outbox hace la subida real.
async function enqueueAdsPurchaseConversion(
  db: Db,
  userId: string,
  email: string,
  session: StripeCheckoutSession
): Promise<void> {
  try {
    const orderId = (session.invoice as string) || session.id
    const [acq] = await db
      .select({
        gclid: userAcquisition.gclid,
        lastGclid: userAcquisition.lastGclid,
        gbraid: userAcquisition.gbraid,
        wbraid: userAcquisition.wbraid,
        gaClientId: userAcquisition.gaClientId,
      })
      .from(userAcquisition)
      .where(eq(userAcquisition.userId, userId))
      .limit(1)
    await recordConversion({
      dedupId: `purchase:${orderId}`,
      type: 'purchase',
      userId,
      valueCents: session.amount_total || 0,
      currency: session.currency || 'eur',
      occurredAt: new Date((session.created || Math.floor(Date.now() / 1000)) * 1000).toISOString(),
      orderId,
      attribution: {
        gclid: acq?.lastGclid || acq?.gclid || null,
        gbraid: acq?.gbraid || null,
        wbraid: acq?.wbraid || null,
        emailSha256: email ? hashEmail(email) : null,
        gaClientId: acq?.gaClientId || null,
      },
    })
  } catch (convErr) {
    console.error('Error encolando conversión Ads:', convErr)
  }
}

async function handleCheckoutSessionCompleted(
  session: StripeCheckoutSession,
  db: Db,
  sc: Stripe,
  account: StripeAccount
): Promise<void> {
  console.log('🎯 Checkout completado:', session.id)

  let userId: string | null = null

  // Si hay subscription, recuperarla para obtener metadata
  if (session.subscription) {
    try {
      const subscription = await getSubscription(session.subscription as string, sc)
      userId = subscription.metadata?.supabase_user_id || null
      console.log('📋 userId desde subscription metadata:', userId)
    } catch (err) {
      console.error('Error retrieving subscription:', err)
    }
  }

  // Fallback: buscar en session metadata
  if (!userId) {
    userId = session.metadata?.supabase_user_id || null
    console.log('📋 userId desde session metadata:', userId)
  }

  // Fallback: buscar usuario por stripe_customer_id
  if (!userId && session.customer) {
    const [userByCustomer] = await db
      .select({ id: userProfiles.id })
      .from(userProfiles)
      .where(eq(userProfiles.stripeCustomerId, session.customer as string))
      .limit(1)

    userId = userByCustomer?.id || null
    console.log('📋 userId desde stripe_customer_id:', userId)
  }

  if (userId) {
    console.log('👤 Activando premium para usuario:', userId)

    const [beforeData] = await db
      .select({ plan_type: userProfiles.planType, updated_at: userProfiles.updatedAt })
      .from(userProfiles)
      .where(eq(userProfiles.id, userId))
      .limit(1)
    console.log('📊 ANTES del update:', beforeData)

    let data: Array<{
      email: string
      full_name: string | null
      target_oposicion: string | null
      registration_source: string | null
      registration_url: string | null
      registration_funnel: string | null
      created_at: string | null
    }> | null = null
    let error: unknown = null
    try {
      data = await db
        .update(userProfiles)
        .set({
          planType: 'premium',
          stripeCustomerId: session.customer as string,
          paymentAccount: account
        })
        .where(eq(userProfiles.id, userId))
        .returning({
          email: userProfiles.email,
          full_name: userProfiles.fullName,
          target_oposicion: userProfiles.targetOposicion,
          registration_source: userProfiles.registrationSource,
          registration_url: userProfiles.registrationUrl,
          registration_funnel: userProfiles.registrationFunnel,
          created_at: userProfiles.createdAt,
        })
    } catch (e) {
      error = e
    }

    if (error) {
      console.error('❌ Error actualizando usuario a premium:', error)
    } else {
      invalidateProfileCache()
      console.log(`✅ User ${userId} ahora es PREMIUM`, data)

      let planType = 'subscription'

      if (session.subscription) {
        try {
          const subscription = await getSubscription(session.subscription as string, sc)
          planType = determinePlanType(subscription)

          let subError: unknown = null
          try {
            const subValues = {
              userId,
              stripeCustomerId: session.customer as string,
              stripeSubscriptionId: subscription.id,
              status: normalizeStripeStatus(subscription.status),
              planType,
              currentPeriodStart: subscription.current_period_start
                ? new Date(subscription.current_period_start * 1000).toISOString()
                : null,
              currentPeriodEnd: subscription.current_period_end
                ? new Date(subscription.current_period_end * 1000).toISOString()
                : null
            }
            await db
              .insert(userSubscriptions)
              .values(subValues)
              .onConflictDoUpdate({ target: userSubscriptions.userId, set: subValues })
          } catch (e) {
            subError = e
          }

          if (subError) {
            console.error('⚠️ Error creando subscription record:', (subError as Error).message)
          } else {
            console.log('✅ Subscription record creado/actualizado')
          }

          // Aplicar cupón de fidelidad inicial para que la 1a renovación tenga descuento
          try {
            const { applyInitialLoyaltyCoupon } = await import('@/lib/api/loyalty')
            const loyaltyResult = await applyInitialLoyaltyCoupon(subscription.id, sc)
            if (loyaltyResult.applied) {
              console.log(`🎁 [Loyalty] Cupón inicial ${loyaltyResult.couponId} aplicado en checkout para ${subscription.id}`)
            }
          } catch (loyaltyErr) {
            console.error('⚠️ [Loyalty] Error aplicando cupón inicial:', loyaltyErr)
          }

          // Programa de embajadores: si este pagador venía de un referido pendiente, calificarlo
          // (paga en ≤10 días desde la atribución → qualified + hold). Best-effort: NO rompe el pago.
          // qualifyReferralOnPayment es no-op si no hay referido pendiente.
          try {
            const { qualifyReferralOnPayment } = await import('@/lib/referrals/queries')
            const q = await qualifyReferralOnPayment({
              referredUserId: userId,
              planType,
              paymentRef: subscription.id,
              paidAt: new Date().toISOString(),
            })
            if (q.qualified) {
              console.log(`🏅 [Referral] Referido ${userId} CALIFICADO — el embajador cobra tras el hold`)
              emitReferralEvent('referral_qualified', { userId, endpoint: '/api/stripe/webhook', metadata: { planType } })
              // Notifica al embajador (badge + email). Best-effort.
              const { notifyEarning } = await import('@/lib/referrals/notify')
              await notifyEarning(q.referrerUserId, { source: 'referido', amount: q.bounty ?? 10 })
            } else if (q.reason === 'outside_window') {
              console.log(`🏅 [Referral] Referido ${userId} pagó FUERA de la ventana → expired`)
              emitReferralEvent('referral_expired', { userId, endpoint: '/api/stripe/webhook', severity: 'warn', metadata: { planType } })
            }
          } catch (refErr) {
            console.error('⚠️ [Referral] Error calificando referido:', (refErr as Error).message)
            emitReferralEvent('referral_error', { userId, endpoint: '/api/stripe/webhook', severity: 'warn', metadata: { step: 'qualify', message: (refErr as Error).message } })
          }
        } catch (subErr) {
          const e = subErr as Error
          console.error('⚠️ Error procesando subscription:', e.message)
        }
      }

      // Trackear conversiones
      try {
        const eventData = {
          amount: (session.amount_total || 0) / 100,
          currency: session.currency,
          plan: planType,
          timestamp: new Date().toISOString()
        }
        await db.execute(sql`SELECT track_conversion_event(${userId}::uuid, ${'payment_completed'}::text, ${JSON.stringify(eventData)}::jsonb)`)
      } catch (trackErr) {
        console.error('Error tracking conversion:', trackErr)
      }

      // F1 — encolar la compra hacia Google Ads (camino principal).
      await enqueueAdsPurchaseConversion(db, userId, data?.[0]?.email || session.customer_email || '', session)

      try {
        await db.execute(sql`SELECT mark_upgrade_conversion(${userId}::uuid)`)
      } catch (abErr) {
        console.error('Error marking A/B conversion:', abErr)
      }

      // Email admin de nueva venta DESACTIVADO 04/07/2026 (a petición): no notificar
      // por email cada venta; el dinero de hoy se ve EN VIVO en /admin (card
      // "Usuarios Activos Hoy"). Fn sendAdminPurchaseEmail conservada por si se re-activa.

      // Settlement
      try {
        await recordPaymentSettlement({
          paymentIntentId: session.payment_intent as string | null,
          chargeId: null,
          invoiceId: session.invoice as string | null,
          customerId: session.customer as string,
          userId,
          userEmail: (data?.[0]?.email as string) || session.customer_email || '',
          amountGross: session.amount_total || 0,
          currency: session.currency || 'eur',
          paymentDate: new Date((session.created || 0) * 1000).toISOString(),
          db,
          sc
        })
      } catch (settlementErr) {
        console.error('Error registrando settlement:', settlementErr)
      }
    }

    const [afterData] = await db
      .select({ plan_type: userProfiles.planType, updated_at: userProfiles.updatedAt })
      .from(userProfiles)
      .where(eq(userProfiles.id, userId))
      .limit(1)
    console.log('📊 DESPUÉS del update:', afterData)

    if (afterData?.plan_type !== 'premium') {
      console.error('🚨 ALERTA: El plan_type NO se actualizó a premium!')
    }
    return
  }

  // CASO 2: Buscar por email
  console.log('🔍 Buscando usuario por email del customer...')
  try {
    const customer = await sc.customers.retrieve(session.customer as string) as StripeCustomer

    if (customer.email) {
      const [existingUser] = await db
        .select({
          id: userProfiles.id,
          full_name: userProfiles.fullName,
          target_oposicion: userProfiles.targetOposicion,
          registration_source: userProfiles.registrationSource,
          registration_url: userProfiles.registrationUrl,
          registration_funnel: userProfiles.registrationFunnel,
          created_at: userProfiles.createdAt,
        })
        .from(userProfiles)
        .where(eq(userProfiles.email, customer.email))
        .limit(1)

      if (existingUser) {
        console.log('📧 Actualizando usuario existente por email:', customer.email)

        // Verificar estado ANTES del update
        const [beforeData] = await db
          .select({ plan_type: userProfiles.planType, stripe_customer_id: userProfiles.stripeCustomerId })
          .from(userProfiles)
          .where(eq(userProfiles.id, existingUser.id))
          .limit(1)
        console.log('📊 ANTES del update (CASO 2):', beforeData)

        let updateData: Array<Record<string, unknown>> | null = null
        let updateError: unknown = null
        try {
          updateData = await db
            .update(userProfiles)
            .set({
              planType: 'premium',
              stripeCustomerId: session.customer as string
            })
            .where(eq(userProfiles.id, existingUser.id))
            .returning({ id: userProfiles.id })
        } catch (e) {
          updateError = e
        }

        if (updateError) {
          console.error('❌ Error actualizando usuario a premium (CASO 2):', updateError)
        } else {
          invalidateProfileCache()
          console.log(`✅ User ${existingUser.id} ahora es PREMIUM (encontrado por email)`, updateData)
        }

        // Verificar estado DESPUÉS del update
        const [afterData] = await db
          .select({ plan_type: userProfiles.planType, stripe_customer_id: userProfiles.stripeCustomerId })
          .from(userProfiles)
          .where(eq(userProfiles.id, existingUser.id))
          .limit(1)
        console.log('📊 DESPUÉS del update (CASO 2):', afterData)

        if (afterData?.plan_type !== 'premium') {
          console.error('🚨 ALERTA CRÍTICA: El plan_type NO se actualizó a premium (CASO 2)!')
          // Intentar una vez más
          console.log('🔄 Reintentando actualización...')
          let retryError: unknown = null
          try {
            await db
              .update(userProfiles)
              .set({ planType: 'premium' })
              .where(eq(userProfiles.id, existingUser.id))
          } catch (e) {
            retryError = e
          }

          if (retryError) {
            console.error('❌ Error en reintento:', retryError)
          } else {
            invalidateProfileCache()
            const [finalData] = await db
              .select({ plan_type: userProfiles.planType })
              .from(userProfiles)
              .where(eq(userProfiles.id, existingUser.id))
              .limit(1)
            console.log('📊 Después del reintento:', finalData)
          }
        }

        if (session.subscription) {
          try {
            const subscription = await getSubscription(session.subscription as string, sc)
            const planType = determinePlanType(subscription)

            const subValues = {
              userId: existingUser.id,
              stripeCustomerId: session.customer as string,
              stripeSubscriptionId: subscription.id,
              status: normalizeStripeStatus(subscription.status),
              planType,
              currentPeriodStart: subscription.current_period_start
                ? new Date(subscription.current_period_start * 1000).toISOString()
                : null,
              currentPeriodEnd: subscription.current_period_end
                ? new Date(subscription.current_period_end * 1000).toISOString()
                : null
            }
            await db
              .insert(userSubscriptions)
              .values(subValues)
              .onConflictDoUpdate({ target: userSubscriptions.userId, set: subValues })
          } catch (subErr) {
            const e = subErr as Error
            console.error('⚠️ Error creando subscription por email:', e.message)
          }
        }

        // Email admin de nueva venta DESACTIVADO 04/07/2026 (a petición) — ver CASO 1 arriba.

        try {
          await recordPaymentSettlement({
            paymentIntentId: session.payment_intent as string | null,
            chargeId: null,
            invoiceId: session.invoice as string | null,
            customerId: session.customer as string,
            userId: existingUser.id,
            userEmail: customer.email,
            amountGross: session.amount_total || 0,
            currency: session.currency || 'eur',
            paymentDate: new Date((session.created || 0) * 1000).toISOString(),
            db,
            sc
          })
        } catch (settlementErr) {
          console.error('Error registrando settlement (CASO 2):', settlementErr)
        }

        // F1 — misma cola de conversión Ads que el camino principal, para no
        // perder ventas resueltas por búsqueda de email (antes solo iba en el
        // camino con metadata).
        await enqueueAdsPurchaseConversion(db, existingUser.id, customer.email, session)
      } else {
        console.log('⚠️ No se encontró usuario con email:', customer.email)
      }
    }
  } catch (error) {
    console.error('Error manejando checkout:', error)
  }
}

async function handleSubscriptionCreated(
  subscription: StripeSubscription,
  db: Db
): Promise<void> {
  console.log('📋 handleSubscriptionCreated:', subscription.id)

  let userId = subscription.metadata?.supabase_user_id

  if (!userId) {
    const [user] = await db
      .select({ id: userProfiles.id })
      .from(userProfiles)
      .where(eq(userProfiles.stripeCustomerId, subscription.customer as string))
      .limit(1)

    userId = user?.id
    console.log('📋 userId encontrado por stripe_customer_id:', userId)
  }

  if (!userId) {
    console.log('⚠️ No user ID found for subscription:', subscription.id)
    return
  }

  const planType = determinePlanType(subscription)

  try {
    const subValues = {
      userId,
      stripeCustomerId: subscription.customer as string,
      stripeSubscriptionId: subscription.id,
      status: normalizeStripeStatus(subscription.status),
      planType,
      trialStart: subscription.trial_start
        ? new Date(subscription.trial_start * 1000).toISOString()
        : null,
      trialEnd: subscription.trial_end
        ? new Date(subscription.trial_end * 1000).toISOString()
        : null,
      currentPeriodStart: subscription.current_period_start
        ? new Date(subscription.current_period_start * 1000).toISOString()
        : null,
      currentPeriodEnd: subscription.current_period_end
        ? new Date(subscription.current_period_end * 1000).toISOString()
        : null
    }
    await db
      .insert(userSubscriptions)
      .values(subValues)
      .onConflictDoUpdate({ target: userSubscriptions.userId, set: subValues })
    console.log(`✅ Subscription created/updated for user ${userId}`)
  } catch (error) {
    console.error('Error creating subscription record:', error)
  }
}

async function handleSubscriptionUpdated(
  subscription: StripeSubscription,
  db: Db
): Promise<void> {
  try {
    const { periodStart, periodEnd } = extractPeriodDates(subscription)

    const updateData: Partial<typeof userSubscriptions.$inferInsert> = {
      status: normalizeStripeStatus(subscription.status),
      cancelAtPeriodEnd: subscription.cancel_at_period_end
    }

    if (periodStart) {
      updateData.currentPeriodStart = periodStart
    }
    if (periodEnd) {
      updateData.currentPeriodEnd = periodEnd
    }

    await db
      .update(userSubscriptions)
      .set(updateData)
      .where(eq(userSubscriptions.stripeSubscriptionId, subscription.id))

    console.log(`✅ Subscription ${subscription.id} updated to status: ${subscription.status}`, periodEnd ? `period_end: ${periodEnd}` : '')

    if (subscription.cancel_at_period_end && subscription.status === 'active') {
      console.log(`⏰ Subscription programada para cancelar. Premium hasta ${periodEnd || 'fecha desconocida'}`)
    }

    // Detectar reactivación: cancel_at_period_end cambió a false en una sub activa
    if (!subscription.cancel_at_period_end && subscription.status === 'active') {
      try {
        const subData = await db
          .select({ user_id: userSubscriptions.userId })
          .from(userSubscriptions)
          .where(eq(userSubscriptions.stripeSubscriptionId, subscription.id))
          .limit(1)

        if (subData?.[0]?.user_id) {
          const userId = subData[0].user_id!
          const lastFeedback = await db
            .select({ cancellation_type: cancellationFeedback.cancellationType })
            .from(cancellationFeedback)
            .where(eq(cancellationFeedback.userId, userId))
            .orderBy(desc(cancellationFeedback.createdAt))
            .limit(1)

          if (lastFeedback?.[0] && lastFeedback[0].cancellation_type !== 'reactivation') {
            await db.insert(cancellationFeedback).values({
              userId,
              subscriptionId: subscription.id,
              reason: 'reactivated',
              cancellationType: 'reactivation',
              periodEndAt: periodEnd,
            })
            console.log(`🟢 Reactivation detected and logged for user ${userId}`)
          }
        }
      } catch (reactivateErr) {
        console.warn('⚠️ Error logging reactivation:', reactivateErr)
      }
    }

    if (subscription.status === 'canceled') {
      const now = Math.floor(Date.now() / 1000)
      const periodEndTimestamp = subscription.current_period_end || subscription.cancel_at || 0
      const shouldDowngrade = shouldDowngradeNow(periodEndTimestamp, now)

      const subDataArray = await db
        .select({ user_id: userSubscriptions.userId })
        .from(userSubscriptions)
        .where(eq(userSubscriptions.stripeSubscriptionId, subscription.id))
        .limit(1)

      const subData = subDataArray?.[0]
      if (subData?.user_id) {
        if (shouldDowngrade) {
          await db
            .update(userProfiles)
            .set({ planType: 'free' })
            .where(eq(userProfiles.id, subData.user_id))
          invalidateProfileCache()
          console.log(`✅ User ${subData.user_id} degradado a FREE`)
        } else {
          const periodEnd = formatPeriodEnd(periodEndTimestamp)
          console.warn(`⚠️ Status canceled pero período termina en ${periodEnd}`)
        }
      }
    }

    if (['past_due', 'unpaid'].includes(subscription.status)) {
      console.log(`⚠️ Subscription ${subscription.id} tiene problemas de pago: ${subscription.status}`)

      const paymentSubData = await db
        .select({ user_id: userSubscriptions.userId })
        .from(userSubscriptions)
        .where(eq(userSubscriptions.stripeSubscriptionId, subscription.id))
        .limit(1)

      const paymentSub = paymentSubData?.[0]
      if (paymentSub?.user_id) {
        const profileData = await db
          .select({ email: userProfiles.email, full_name: userProfiles.fullName })
          .from(userProfiles)
          .where(eq(userProfiles.id, paymentSub.user_id))
          .limit(1)

        const userProfile = profileData?.[0]
        if (userProfile) {
          // Email admin de problema de pago DESACTIVADO 04/07/2026 (a petición):
          // no notificar por email los pagos atrasados/fallidos al admin.
        }
      }
    }
  } catch (error) {
    console.error('Error updating subscription:', error)
  }
}

async function handleSubscriptionDeleted(
  subscription: StripeSubscription,
  db: Db
): Promise<void> {
  try {
    const subDataArray = await db
      .select({ user_id: userSubscriptions.userId })
      .from(userSubscriptions)
      .where(eq(userSubscriptions.stripeSubscriptionId, subscription.id))
      .limit(1)

    const subData = subDataArray?.[0]

    if (!subData) {
      console.warn(`⚠️ Subscription ${subscription.id} no encontrada en BD`)
    }

    const { periodEnd } = extractPeriodDates(subscription)

    const updateData: Partial<typeof userSubscriptions.$inferInsert> = { status: 'canceled' }
    if (periodEnd) {
      updateData.currentPeriodEnd = periodEnd
    }

    await db
      .update(userSubscriptions)
      .set(updateData)
      .where(eq(userSubscriptions.stripeSubscriptionId, subscription.id))

    console.log(`✅ Subscription ${subscription.id} canceled in user_subscriptions`)

    const now = Math.floor(Date.now() / 1000)
    const periodEndTimestamp = subscription.current_period_end || subscription.cancel_at || 0
    const shouldDowngrade = shouldDowngradeNow(periodEndTimestamp, now)

    if (subData?.user_id) {
      if (shouldDowngrade) {
        let profileError: unknown = null
        try {
          await db
            .update(userProfiles)
            .set({ planType: 'free' })
            .where(eq(userProfiles.id, subData.user_id))
        } catch (e) {
          profileError = e
        }

        if (profileError) {
          console.error('❌ Error degradando usuario:', profileError)
        } else {
          invalidateProfileCache()
          console.log(`✅ User ${subData.user_id} degradado a FREE`)
        }
      } else {
        const endDate = formatPeriodEnd(periodEndTimestamp)
        console.warn(`⚠️ Evento deleted pero período termina en ${endDate}`)
      }

    }
  } catch (error) {
    console.error('Error canceling subscription:', error)
  }
}

// ============================================
// INVOICE CREATED (draft) - Descuentos de fidelidad
// ============================================

async function handleInvoiceCreated(invoice: StripeInvoice, sc: Stripe): Promise<void> {
  // Solo actuar en renovaciones (no en la factura inicial)
  if (invoice.billing_reason !== 'subscription_cycle') return
  // Solo modificar facturas en borrador
  if (invoice.status !== 'draft') return
  if (!invoice.subscription) return

  const subscriptionId = typeof invoice.subscription === 'string'
    ? invoice.subscription
    : invoice.subscription.id

  try {
    const { ensureLoyaltyCoupon } = await import('@/lib/api/loyalty')
    const result = await ensureLoyaltyCoupon(subscriptionId, sc)

    if (result.applied) {
      console.log(`🎁 [Loyalty] invoice.created: ${result.reason} para ${subscriptionId} (renovación #${result.renewalCount + 1}, tier: ${result.tier})`)
    } else {
      console.log(`🎯 [Loyalty] invoice.created: cupón correcto (${result.couponId}) para ${subscriptionId}`)
    }
  } catch (loyaltyErr) {
    console.error('⚠️ [Loyalty] Error en invoice.created:', loyaltyErr)
  }
}

// ============================================
// PAYMENT SUCCEEDED
// ============================================

async function handlePaymentSucceeded(
  invoice: StripeInvoice,
  db: Db,
  sc: Stripe
): Promise<void> {
  console.log('💳 handlePaymentSucceeded:', invoice.id, 'billing_reason:', invoice.billing_reason)

  if (invoice.subscription) {
    try {
      const subscription = await getSubscription(invoice.subscription as string, sc)

      let userId = subscription.metadata?.supabase_user_id
      let userEmail: string | null = null

      if (!userId) {
        const [user] = await db
          .select({ id: userProfiles.id, email: userProfiles.email })
          .from(userProfiles)
          .where(eq(userProfiles.stripeCustomerId, subscription.customer as string))
          .limit(1)

        userId = user?.id
        userEmail = user?.email ?? null
      }

      if (userId) {
        await db
          .update(userProfiles)
          .set({ planType: 'premium' })
          .where(eq(userProfiles.id, userId))
        invalidateProfileCache()

        // Actualizar periodo en user_subscriptions (renovación)
        const { periodStart, periodEnd } = extractPeriodDates(subscription)
        const periodUpdate: Partial<typeof userSubscriptions.$inferInsert> = { status: 'active' }
        if (periodStart) periodUpdate.currentPeriodStart = periodStart
        if (periodEnd) periodUpdate.currentPeriodEnd = periodEnd
        // También intentar desde la invoice (más fiable en renovaciones)
        if (!periodEnd && invoice.period_end) {
          periodUpdate.currentPeriodEnd = new Date(invoice.period_end * 1000).toISOString()
        }
        if (!periodStart && invoice.period_start) {
          periodUpdate.currentPeriodStart = new Date(invoice.period_start * 1000).toISOString()
        }

        await db
          .update(userSubscriptions)
          .set(periodUpdate)
          .where(eq(userSubscriptions.stripeSubscriptionId, subscription.id))

        console.log(`✅ Payment succeeded for user ${userId}`, periodUpdate.currentPeriodEnd ? `period_end: ${periodUpdate.currentPeriodEnd}` : '')

        // Nota: los descuentos de fidelidad se gestionan en handleInvoiceCreated (invoice.created)
        // y en handleCheckoutSessionCompleted (cupón inicial). No se aplican aquí post-cobro.

        try {
          await recordPaymentSettlement({
            paymentIntentId: invoice.payment_intent as string | null,
            chargeId: invoice.charge as string | null,
            invoiceId: invoice.id,
            customerId: invoice.customer as string,
            userId,
            userEmail: userEmail || invoice.customer_email || '',
            amountGross: invoice.amount_paid || 0,
            currency: invoice.currency || 'eur',
            paymentDate: new Date((invoice.created || 0) * 1000).toISOString(),
            db,
            sc
          })
        } catch (settlementErr) {
          console.error('Error registrando settlement:', settlementErr)
        }
      }
    } catch (error) {
      console.error('Error handling payment success:', error)
    }
  }
}

async function handlePaymentFailed(
  invoice: StripeInvoice,
  db: Db,
  sc: Stripe
): Promise<void> {
  console.log(`⚠️ Payment failed for invoice ${invoice.id}`)

  if (invoice.subscription) {
    try {
      const subscription = await getSubscription(invoice.subscription as string, sc)

      let userId = subscription.metadata?.supabase_user_id

      if (!userId) {
        const [user] = await db
          .select({ id: userProfiles.id })
          .from(userProfiles)
          .where(eq(userProfiles.stripeCustomerId, subscription.customer as string))
          .limit(1)

        userId = user?.id
      }

      if (userId) {
        const [userProfile] = await db
          .select({ email: userProfiles.email, full_name: userProfiles.fullName })
          .from(userProfiles)
          .where(eq(userProfiles.id, userId))
          .limit(1)

        if (userProfile) {
          // Email admin de pago fallido DESACTIVADO 04/07/2026 (a petición) — ver arriba.
          // (El email al USUARIO 'pago_fallido' de abajo SE MANTIENE.)

          // Email al usuario
          try {
            await sendEmailV2({
              userId,
              emailType: 'pago_fallido',
              customData: {}
            })
            console.log('📧 Email de pago fallido enviado al usuario')
          } catch (userEmailErr) {
            console.error('Error enviando email de pago fallido al usuario:', userEmailErr)
          }
        }
      }
    } catch (error) {
      console.error('Error handling payment failed:', error)
    }
  }
}

async function sendAdminPurchaseEmail(data: PurchaseEmailData): Promise<void> {
  const currencySymbol = data.currency === 'EUR' ? '€' : data.currency

  const html = `
    <!DOCTYPE html>
    <html>
      <head><meta charset="utf-8"><title>Nueva Compra Premium</title></head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; margin: 0; padding: 20px; background-color: #f5f5f5;">
        <div style="max-width: 600px; margin: 0 auto; background: white; padding: 20px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <div style="text-align: center; background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); margin: -20px -20px 20px -20px; padding: 30px 20px; border-radius: 10px 10px 0 0;">
            <h1 style="color: #92400e; margin: 0;">💰 ¡NUEVA VENTA!</h1>
            <p style="color: #b45309; margin: 10px 0 0 0; font-size: 18px;">Un usuario ha comprado Premium</p>
          </div>
          <div style="background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%); padding: 20px; border-radius: 12px; margin-bottom: 20px; text-align: center; border: 2px solid #10b981;">
            <div style="font-size: 48px; font-weight: bold; color: #059669;">${data.amount}${currencySymbol}</div>
          </div>
          <div style="background: #f0f9ff; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
            <h3 style="color: #0c4a6e; margin: 0 0 15px 0;">👤 Datos del Cliente:</h3>
            <p style="margin: 8px 0;"><strong>Email:</strong> ${data.userEmail}</p>
            <p style="margin: 8px 0;"><strong>Nombre:</strong> ${data.userName}</p>
            <p style="margin: 8px 0;"><strong>Oposicion:</strong> ${data.targetOposicion || 'Sin seleccionar'}</p>
            <p style="margin: 8px 0;"><strong>Fecha compra:</strong> ${new Date().toLocaleString('es-ES')}</p>
          </div>
          <div style="background: #faf5ff; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
            <h3 style="color: #6b21a8; margin: 0 0 15px 0;">📊 Captacion:</h3>
            <p style="margin: 8px 0;"><strong>Fuente:</strong> ${data.registrationSource || 'desconocida'}</p>
            <p style="margin: 8px 0;"><strong>Funnel:</strong> ${data.registrationFunnel || 'directo'}</p>
            <p style="margin: 8px 0;"><strong>URL registro:</strong> ${data.registrationUrl || 'N/A'}</p>
            <p style="margin: 8px 0;"><strong>Registrado:</strong> ${data.registrationDate ? new Date(data.registrationDate).toLocaleDateString('es-ES') : 'N/A'}</p>
          </div>
          <div style="text-align: center; margin-top: 20px;">
            <a href="https://www.vence.es/admin/conversiones" style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">📊 Ver Panel de Conversiones</a>
          </div>
        </div>
      </body>
    </html>
  `

  await getResend().emails.send({
    from: process.env.FROM_EMAIL || 'info@vence.es',
    to: ADMIN_EMAIL,
    subject: `💰 ¡Nueva Compra Premium! - ${data.userEmail} - ${data.amount}${currencySymbol}`,
    html
  })
}

async function sendAdminPaymentIssueEmail(data: PaymentIssueEmailData): Promise<void> {
  const statusLabels: Record<string, string> = {
    'past_due': '⏰ Pago Atrasado',
    'unpaid': '❌ No Pagado',
    'payment_failed': '💳 Pago Fallido'
  }

  const statusLabel = statusLabels[data.status] || data.status
  const currencySymbol = data.currency === 'EUR' ? '€' : (data.currency || '')

  const html = `
    <!DOCTYPE html>
    <html>
      <head><meta charset="utf-8"><title>Problema de Pago</title></head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; margin: 0; padding: 20px; background-color: #f5f5f5;">
        <div style="max-width: 600px; margin: 0 auto; background: white; padding: 20px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <div style="text-align: center; background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%); margin: -20px -20px 20px -20px; padding: 30px 20px; border-radius: 10px 10px 0 0;">
            <h1 style="color: #b91c1c; margin: 0;">⚠️ PROBLEMA DE PAGO</h1>
            <p style="color: #dc2626; margin: 10px 0 0 0; font-size: 18px;">${statusLabel}</p>
          </div>
          <div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin-bottom: 20px; border: 2px solid #f59e0b;">
            <h3 style="color: #92400e; margin: 0 0 15px 0;">👤 Datos del Cliente:</h3>
            <p style="margin: 8px 0;"><strong>Email:</strong> ${data.userEmail}</p>
            <p style="margin: 8px 0;"><strong>Nombre:</strong> ${data.userName || 'Sin nombre'}</p>
            <p style="margin: 8px 0;"><strong>Subscription ID:</strong> ${data.subscriptionId}</p>
            ${data.invoiceId ? `<p style="margin: 8px 0;"><strong>Invoice ID:</strong> ${data.invoiceId}</p>` : ''}
            ${data.amount ? `<p style="margin: 8px 0;"><strong>Monto:</strong> ${data.amount}${currencySymbol}</p>` : ''}
            <p style="margin: 8px 0;"><strong>Fecha:</strong> ${new Date().toLocaleString('es-ES')}</p>
          </div>
          <div style="text-align: center; margin-top: 20px;">
            <a href="https://dashboard.stripe().com/subscriptions/${data.subscriptionId}" style="background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">📊 Ver en Stripe</a>
          </div>
        </div>
      </body>
    </html>
  `

  await getResend().emails.send({
    from: process.env.FROM_EMAIL || 'info@vence.es',
    to: ADMIN_EMAIL,
    subject: `⚠️ ${statusLabel} - ${data.userEmail}`,
    html
  })
}

async function recordPaymentSettlement(data: SettlementData): Promise<void> {
  try {
    let stripeFee = 0
    let actualChargeId = data.chargeId

    if (!actualChargeId && data.paymentIntentId) {
      try {
        const paymentIntent = await data.sc.paymentIntents.retrieve(data.paymentIntentId)
        if (paymentIntent.latest_charge) {
          actualChargeId = paymentIntent.latest_charge as string
        }
      } catch (piErr) {
        const e = piErr as Error
        console.log('⚠️ No se pudo obtener payment_intent:', e.message)
      }
    }

    if (actualChargeId) {
      try {
        const charge = await data.sc.charges.retrieve(actualChargeId)
        if (charge.balance_transaction) {
          const balanceTransaction = await data.sc.balanceTransactions.retrieve(
            charge.balance_transaction as string
          )
          stripeFee = balanceTransaction.fee
        }
      } catch (chargeErr) {
        const e = chargeErr as Error
        console.log('⚠️ No se pudo obtener fee de Stripe:', e.message)
      }
    }

    const amountNet = data.amountGross - stripeFee
    const manuelAmount = Math.round(amountNet * 0.9)
    const armandoAmount = amountNet - manuelAmount

    console.log('💰 Settlement:', {
      gross: data.amountGross,
      stripeFee,
      net: amountNet,
      manuel: manuelAmount,
      armando: armandoAmount
    })

    const paymentDate = data.paymentDate || new Date().toISOString()

    // Idempotencia por stripe_invoice_id. Un alta nueva dispara DOS eventos para
    // el MISMO pago: checkout.session.completed (charge/payment_intent NULL — las
    // sesiones de suscripción no llevan PI) e invoice.payment_succeeded (con
    // charge). El unique por payment_intent NO deduplicaba (NULL no colisiona) →
    // filas duplicadas (bug 07/07, flip a cuenta Nila). El upsert por invoice
    // garantiza UNA sola fila y la ENRIQUECE con charge/fee/net cuando llega el
    // evento completo, sea cual sea el orden. Ver migración 20260718.
    if (data.invoiceId) {
      const res = await data.db.execute(sql`
        INSERT INTO payment_settlements (
          stripe_payment_intent_id, stripe_charge_id, stripe_invoice_id, stripe_customer_id,
          user_id, user_email, amount_gross, stripe_fee, amount_net, currency,
          manuel_amount, armando_amount, payment_date
        ) VALUES (
          ${data.paymentIntentId}, ${data.chargeId}, ${data.invoiceId}, ${data.customerId},
          ${data.userId}, ${data.userEmail}, ${data.amountGross}, ${stripeFee}, ${amountNet},
          ${data.currency || 'eur'}, ${manuelAmount}, ${armandoAmount}, ${paymentDate}
        )
        ON CONFLICT (stripe_invoice_id) WHERE stripe_invoice_id IS NOT NULL
        DO UPDATE SET
          stripe_payment_intent_id = COALESCE(payment_settlements.stripe_payment_intent_id, EXCLUDED.stripe_payment_intent_id),
          stripe_charge_id         = COALESCE(payment_settlements.stripe_charge_id, EXCLUDED.stripe_charge_id),
          stripe_customer_id       = COALESCE(payment_settlements.stripe_customer_id, EXCLUDED.stripe_customer_id),
          -- fee/net/reparto: quedarse con la versión que TIENE charge (la completa)
          stripe_fee     = CASE WHEN payment_settlements.stripe_charge_id IS NULL AND EXCLUDED.stripe_charge_id IS NOT NULL THEN EXCLUDED.stripe_fee     ELSE payment_settlements.stripe_fee     END,
          amount_net     = CASE WHEN payment_settlements.stripe_charge_id IS NULL AND EXCLUDED.stripe_charge_id IS NOT NULL THEN EXCLUDED.amount_net     ELSE payment_settlements.amount_net     END,
          manuel_amount  = CASE WHEN payment_settlements.stripe_charge_id IS NULL AND EXCLUDED.stripe_charge_id IS NOT NULL THEN EXCLUDED.manuel_amount  ELSE payment_settlements.manuel_amount  END,
          armando_amount = CASE WHEN payment_settlements.stripe_charge_id IS NULL AND EXCLUDED.stripe_charge_id IS NOT NULL THEN EXCLUDED.armando_amount ELSE payment_settlements.armando_amount END,
          updated_at = now()
        RETURNING (xmax = 0) AS inserted
      `)
      const rows = (res as unknown as { rows?: Array<{ inserted: boolean }> }).rows
        ?? (res as unknown as Array<{ inserted: boolean }>)
      const inserted = Array.isArray(rows) && rows[0]?.inserted === true
      if (inserted) {
        console.log('💰 Settlement registrado correctamente')
      } else {
        // 2º evento del mismo pago (dedup/enriquecido, comportamiento normal en altas).
        // Observabilidad: vigila el patrón y caza si el índice se cae o cambia el flujo.
        console.log(`💰 Settlement enriquecido (dedup por invoice ${data.invoiceId})`)
        await emit({
          source: 'vercel',
          severity: 'info',
          eventType: 'stripe_settlement_deduped',
          endpoint: '/api/stripe/webhook',
          userId: data.userId,
          deployVersion: process.env.GIT_COMMIT_SHA?.slice(0, 8) ?? null,
          metadata: { invoiceId: data.invoiceId, incomingHasCharge: !!data.chargeId },
        })
      }
      return
    }

    // Pago SIN factura (puntual): idempotencia por payment_intent (unique existente).
    let error: unknown = null
    try {
      await data.db
        .insert(paymentSettlements)
        .values({
          stripePaymentIntentId: data.paymentIntentId,
          stripeChargeId: data.chargeId,
          stripeInvoiceId: data.invoiceId,
          stripeCustomerId: data.customerId,
          userId: data.userId,
          userEmail: data.userEmail,
          amountGross: data.amountGross,
          stripeFee: stripeFee,
          amountNet: amountNet,
          currency: data.currency || 'eur',
          manuelAmount: manuelAmount,
          armandoAmount: armandoAmount,
          paymentDate: paymentDate
        })
    } catch (e) {
      error = e
    }

    if (error) {
      // 23505 = unique_violation (settlement ya registrado por stripe_payment_intent_id)
      if ((error as { code?: string }).code === '23505') {
        console.log('💰 Settlement ya registrado (duplicado), ignorando')
        return
      }
      throw error
    }

    console.log('💰 Settlement registrado correctamente')
  } catch (error) {
    console.error('❌ Error registrando settlement:', error)
    throw error
  }
}

/**
 * Localiza la settlement de un charge probando charge_id → payment_intent →
 * invoice. Necesario porque las settlements de suscripción a veces sólo guardan
 * el invoice_id (charge/payment_intent null) — fue el caso del incidente Lidia.
 */
async function findSettlementForCharge(
  charge: Stripe.Charge,
  db: Db,
): Promise<typeof paymentSettlements.$inferSelect | null> {
  // `charge.invoice` está en el payload con apiVersion 2024-06-20 pero el SDK
  // 18.3.0 lo quitó del tipo Charge → accessor de runtime tipado.
  const rawInvoice = (charge as { invoice?: string | { id?: string } | null }).invoice ?? null
  const invoiceId = typeof rawInvoice === 'string' ? rawInvoice : rawInvoice?.id ?? null
  const paymentIntentId =
    typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id ?? null

  const conditions = [eq(paymentSettlements.stripeChargeId, charge.id)]
  if (paymentIntentId) conditions.push(eq(paymentSettlements.stripePaymentIntentId, paymentIntentId))
  if (invoiceId) conditions.push(eq(paymentSettlements.stripeInvoiceId, invoiceId))

  const rows = await db
    .select()
    .from(paymentSettlements)
    .where(or(...conditions))
    .orderBy(desc(paymentSettlements.createdAt))
    .limit(1)
  return rows[0] ?? null
}

/**
 * `charge.refunded` — un cargo fue reembolsado (total o parcial). Reflejarlo en
 * la settlement: NO mutamos amount_gross/stripe_fee (base histórica), pero
 * recalculamos el neto adeudado y el split Manuel/Armando desde esa base menos
 * lo reembolsado (idempotente; `charge.amount_refunded` es acumulado). Así las
 * queries de ingresos/payout que suman esas columnas quedan correctas.
 *
 * Origen 07/06/2026: sin este handler los reembolsos eran invisibles para la BD
 * (caso Lidia: hubo que corregir a mano). NO degradamos al usuario aquí: la
 * pérdida de acceso, si la hay, la gestiona `customer.subscription.deleted`.
 */
async function handleChargeRefunded(charge: Stripe.Charge, db: Db): Promise<void> {
  const refundedAmount = charge.amount_refunded ?? 0
  const refundReason = charge.refunds?.data?.[0]?.reason ?? null

  // Programa de embajadores: reembolso → rechazar el referido (clawback) para que el cron no lo
  // promueva a payable. Best-effort; no rompe el flujo de settlement. No-op si no era referido.
  try {
    if (charge.customer) {
      const [u] = await db.select({ id: userProfiles.id }).from(userProfiles)
        .where(eq(userProfiles.stripeCustomerId, charge.customer as string)).limit(1)
      if (u) {
        const { rejectReferralOnRefund } = await import('@/lib/referrals/queries')
        const r = await rejectReferralOnRefund(u.id)
        if (r.rejected) {
          console.log(`🏅 [Referral] Reembolso → referido de ${u.id} RECHAZADO (${r.rejected})`)
          emitReferralEvent('referral_refund_clawback', { userId: u.id, endpoint: '/api/stripe/webhook', severity: 'warn', metadata: { alreadyPaid: r.alreadyPaid } })
        }
        if (r.alreadyPaid) console.warn(`🏅 [Referral] Reembolso de ${u.id} con recompensa YA pagada — clawback MANUAL`)
      }
    }
  } catch (e) {
    console.error('⚠️ [Referral] Error en clawback por reembolso:', (e as Error).message)
    emitReferralEvent('referral_error', { endpoint: '/api/stripe/webhook', severity: 'warn', metadata: { step: 'clawback', message: (e as Error).message } })
  }

  const settlement = await findSettlementForCharge(charge, db)
  if (!settlement) {
    console.warn(`⚠️ charge.refunded sin settlement (charge ${charge.id}) — no se pudo reflejar`)
    await emit({
      source: 'vercel',
      severity: 'warn',
      eventType: 'settlement_refund_no_match',
      endpoint: '/api/stripe/webhook',
      metadata: { chargeId: charge.id, refundedAmount },
    })
    return
  }

  const split = computeSettlementAfterRefund({
    amountGross: settlement.amountGross,
    stripeFee: settlement.stripeFee,
    refundedAmount,
  })

  await db
    .update(paymentSettlements)
    .set({
      refundedAmount,
      refundedAt: new Date().toISOString(),
      refundReason,
      amountNet: split.amountNet,
      manuelAmount: split.manuelAmount,
      armandoAmount: split.armandoAmount,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(paymentSettlements.id, settlement.id))

  console.log(
    `💸 Refund reflejado settlement ${settlement.id}: reembolsado ${refundedAmount}, neto ${settlement.amountNet}→${split.amountNet}`,
  )

  // Si la comisión de Armando YA estaba marcada como pagada y ahora se reduce,
  // hay un sobrepago que reclamar — visibilizarlo (no se auto-corrige).
  const clawback = settlement.armandoMarkedPaid && split.armandoAmount < settlement.armandoAmount
  await emit({
    source: 'vercel',
    severity: clawback ? 'warn' : 'info',
    eventType: 'settlement_refunded',
    endpoint: '/api/stripe/webhook',
    metadata: {
      settlementId: settlement.id,
      userEmail: settlement.userEmail,
      chargeId: charge.id,
      refundedAmount,
      refundReason,
      amountNetBefore: settlement.amountNet,
      amountNetAfter: split.amountNet,
      armandoClawbackNeeded: clawback,
      armandoAlreadyPaid: settlement.armandoMarkedPaid,
    },
  })
}

/**
 * `charge.dispute.created` — un chargeback abierto. Lo registramos (visibilidad
 * + plazo de respuesta) y emitimos alerta. NO ajustamos dinero todavía: un
 * dispute puede ganarse; el ajuste se hará cuando se cierre como `lost`.
 */
async function handleChargeDisputeCreated(dispute: Stripe.Dispute, db: Db): Promise<void> {
  const chargeId = typeof dispute.charge === 'string' ? dispute.charge : dispute.charge?.id ?? null
  let settlementId: string | null = null
  let userEmail: string | null = null

  if (chargeId) {
    const settlement = await findSettlementForCharge({ id: chargeId } as Stripe.Charge, db)
    if (settlement) {
      settlementId = settlement.id
      userEmail = settlement.userEmail
      await db
        .update(paymentSettlements)
        .set({ disputedAt: new Date().toISOString(), disputeStatus: dispute.status, updatedAt: new Date().toISOString() })
        .where(eq(paymentSettlements.id, settlement.id))
    }
  }

  console.warn(`🚨 Chargeback abierto: dispute ${dispute.id} charge ${chargeId} status ${dispute.status}`)
  await emit({
    source: 'vercel',
    severity: 'critical',
    eventType: 'chargeback_opened',
    endpoint: '/api/stripe/webhook',
    metadata: {
      disputeId: dispute.id,
      chargeId,
      amount: dispute.amount,
      reason: dispute.reason,
      status: dispute.status,
      dueBy: dispute.evidence_details?.due_by ?? null,
      settlementId,
      userEmail,
    },
  })
}

/**
 * `charge.dispute.closed` — el chargeback se resolvió. Si se PERDIÓ (`lost`) el
 * dinero salió de nuestra cuenta: tratamos el importe disputado como dinero
 * devuelto adicional al ya reembolsado y recalculamos el neto adeudado y el
 * split desde la base inmutable (idempotente: no mutamos refunded_amount, sólo
 * sumamos dispute.amount en el cálculo). Si se ganó (`won`), sólo registramos
 * el estado: el dinero se mantiene.
 */
async function handleChargeDisputeClosed(dispute: Stripe.Dispute, db: Db): Promise<void> {
  const chargeId = typeof dispute.charge === 'string' ? dispute.charge : dispute.charge?.id ?? null
  const lost = dispute.status === 'lost'
  const settlement = chargeId ? await findSettlementForCharge({ id: chargeId } as Stripe.Charge, db) : null

  if (settlement) {
    let moneyUpdate: Record<string, number> = {}
    if (lost) {
      const split = computeSettlementAfterRefund({
        amountGross: settlement.amountGross,
        stripeFee: settlement.stripeFee,
        refundedAmount: (settlement.refundedAmount ?? 0) + dispute.amount,
      })
      moneyUpdate = {
        amountNet: split.amountNet,
        manuelAmount: split.manuelAmount,
        armandoAmount: split.armandoAmount,
      }
    }
    await db
      .update(paymentSettlements)
      .set({ disputeStatus: dispute.status, updatedAt: new Date().toISOString(), ...moneyUpdate })
      .where(eq(paymentSettlements.id, settlement.id))
  }

  console.warn(`⚖️ Chargeback cerrado: dispute ${dispute.id} status ${dispute.status}${lost ? ' (PERDIDO, dinero retirado)' : ''}`)
  await emit({
    source: 'vercel',
    severity: lost ? 'critical' : 'info',
    eventType: 'chargeback_closed',
    endpoint: '/api/stripe/webhook',
    metadata: {
      disputeId: dispute.id,
      chargeId,
      status: dispute.status,
      lost,
      amount: dispute.amount,
      settlementId: settlement?.id ?? null,
      userEmail: settlement?.userEmail ?? null,
    },
  })
}


export const POST = withErrorLogging('/api/stripe/webhook', _POST, { skipBodyParse: true })
