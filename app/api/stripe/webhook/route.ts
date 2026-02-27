// app/api/stripe/webhook/route.ts
import { NextResponse, NextRequest } from 'next/server'
import { headers } from 'next/headers'
import { stripe } from '@/lib/stripe'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import type Stripe from 'stripe'
import { shouldDowngradeNow, formatPeriodEnd, determinePlanType } from '@/lib/stripe-webhook-handlers'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type StripeSubscription = any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type StripeInvoice = any
type StripeCheckoutSession = Stripe.Checkout.Session
type StripeCustomer = Stripe.Customer

// Helper to retrieve subscription
async function getSubscription(subscriptionId: string): Promise<StripeSubscription> {
  return await stripe().subscriptions.retrieve(subscriptionId)
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

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!

// Types
interface PurchaseEmailData {
  userEmail: string
  userName: string
  amount: number
  currency: string
  stripeCustomerId: string
  userId: string
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
  supabase: SupabaseClient
}

// Crear cliente con SERVICE_ROLE_KEY para bypasear RLS
const getServiceSupabase = (): SupabaseClient => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    const headersList = await headers()
    const signature = headersList.get('stripe-signature')

    if (!signature || !webhookSecret) {
      console.error('Missing signature or webhook secret')
      return NextResponse.json({ error: 'Webhook signature missing' }, { status: 400 })
    }

    let event: Stripe.Event
    try {
      event = stripe().webhooks.constructEvent(body, signature, webhookSecret)
    } catch (err) {
      const error = err as Error
      console.error('Webhook signature verification failed:', error.message)
      return NextResponse.json({ error: 'Webhook signature verification failed' }, { status: 400 })
    }

    const supabase = getServiceSupabase()

    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(event.data.object as StripeCheckoutSession, supabase)
        break

      case 'customer.subscription.created':
        await handleSubscriptionCreated(event.data.object as StripeSubscription, supabase)
        break

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as StripeSubscription, supabase)
        break

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as StripeSubscription, supabase)
        break

      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event.data.object as StripeInvoice, supabase)
        break

      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object as StripeInvoice, supabase)
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

async function handleCheckoutSessionCompleted(
  session: StripeCheckoutSession,
  supabase: SupabaseClient
): Promise<void> {
  console.log('🎯 Checkout completado:', session.id)

  let userId: string | null = null

  // Si hay subscription, recuperarla para obtener metadata
  if (session.subscription) {
    try {
      const subscription = await getSubscription(session.subscription as string)
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
    const { data: userByCustomer } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('stripe_customer_id', session.customer as string)
      .single()

    userId = userByCustomer?.id || null
    console.log('📋 userId desde stripe_customer_id:', userId)
  }

  if (userId) {
    console.log('👤 Activando premium para usuario:', userId)

    const { data: beforeData } = await supabase
      .from('user_profiles')
      .select('plan_type, updated_at')
      .eq('id', userId)
      .single()
    console.log('📊 ANTES del update:', beforeData)

    const { data, error } = await supabase
      .from('user_profiles')
      .update({
        plan_type: 'premium',
        stripe_customer_id: session.customer as string
      })
      .eq('id', userId)
      .select()

    if (error) {
      console.error('❌ Error actualizando usuario a premium:', error)
    } else {
      console.log(`✅ User ${userId} ahora es PREMIUM`, data)

      let planType = 'subscription'

      if (session.subscription) {
        try {
          const subscription = await getSubscription(session.subscription as string)
          planType = determinePlanType(subscription)

          const { error: subError } = await supabase
            .from('user_subscriptions')
            .upsert({
              user_id: userId,
              stripe_customer_id: session.customer as string,
              stripe_subscription_id: subscription.id,
              status: normalizeStripeStatus(subscription.status),
              plan_type: planType,
              current_period_start: subscription.current_period_start
                ? new Date(subscription.current_period_start * 1000).toISOString()
                : null,
              current_period_end: subscription.current_period_end
                ? new Date(subscription.current_period_end * 1000).toISOString()
                : null
            }, {
              onConflict: 'user_id',
              ignoreDuplicates: false
            })

          if (subError) {
            console.error('⚠️ Error creando subscription record:', subError.message)
          } else {
            console.log('✅ Subscription record creado/actualizado')
          }
        } catch (subErr) {
          const e = subErr as Error
          console.error('⚠️ Error procesando subscription:', e.message)
        }
      }

      // Trackear conversiones
      try {
        await supabase.rpc('track_conversion_event', {
          p_user_id: userId,
          p_event_type: 'payment_completed',
          p_event_data: {
            amount: (session.amount_total || 0) / 100,
            currency: session.currency,
            plan: planType,
            timestamp: new Date().toISOString()
          }
        })
      } catch (trackErr) {
        console.error('Error tracking conversion:', trackErr)
      }

      try {
        await supabase.rpc('mark_upgrade_conversion', { p_user_id: userId })
      } catch (abErr) {
        console.error('Error marking A/B conversion:', abErr)
      }

      // Email admin
      try {
        const userProfile = data?.[0] || {}
        await sendAdminPurchaseEmail({
          userEmail: userProfile.email || session.customer_email || '',
          userName: userProfile.full_name || 'Sin nombre',
          amount: (session.amount_total || 0) / 100,
          currency: session.currency?.toUpperCase() || 'EUR',
          stripeCustomerId: session.customer as string,
          userId
        })
        console.log('📧 Email de nueva compra enviado')
      } catch (emailErr) {
        console.error('Error enviando email admin:', emailErr)
      }

      // Settlement
      try {
        await recordPaymentSettlement({
          paymentIntentId: session.payment_intent as string | null,
          chargeId: null,
          invoiceId: session.invoice as string | null,
          customerId: session.customer as string,
          userId,
          userEmail: data?.[0]?.email || session.customer_email || '',
          amountGross: session.amount_total || 0,
          currency: session.currency || 'eur',
          paymentDate: new Date((session.created || 0) * 1000).toISOString(),
          supabase
        })
      } catch (settlementErr) {
        console.error('Error registrando settlement:', settlementErr)
      }
    }

    const { data: afterData } = await supabase
      .from('user_profiles')
      .select('plan_type, updated_at')
      .eq('id', userId)
      .single()
    console.log('📊 DESPUÉS del update:', afterData)

    if (afterData?.plan_type !== 'premium') {
      console.error('🚨 ALERTA: El plan_type NO se actualizó a premium!')
    }
    return
  }

  // CASO 2: Buscar por email
  console.log('🔍 Buscando usuario por email del customer...')
  try {
    const customer = await stripe().customers.retrieve(session.customer as string) as StripeCustomer

    if (customer.email) {
      const { data: existingUser } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('email', customer.email)
        .single()

      if (existingUser) {
        console.log('📧 Actualizando usuario existente por email:', customer.email)

        // Verificar estado ANTES del update
        const { data: beforeData } = await supabase
          .from('user_profiles')
          .select('plan_type, stripe_customer_id')
          .eq('id', existingUser.id)
          .single()
        console.log('📊 ANTES del update (CASO 2):', beforeData)

        const { data: updateData, error: updateError } = await supabase
          .from('user_profiles')
          .update({
            plan_type: 'premium',
            stripe_customer_id: session.customer as string
          })
          .eq('id', existingUser.id)
          .select()

        if (updateError) {
          console.error('❌ Error actualizando usuario a premium (CASO 2):', updateError)
        } else {
          console.log(`✅ User ${existingUser.id} ahora es PREMIUM (encontrado por email)`, updateData)
        }

        // Verificar estado DESPUÉS del update
        const { data: afterData } = await supabase
          .from('user_profiles')
          .select('plan_type, stripe_customer_id')
          .eq('id', existingUser.id)
          .single()
        console.log('📊 DESPUÉS del update (CASO 2):', afterData)

        if (afterData?.plan_type !== 'premium') {
          console.error('🚨 ALERTA CRÍTICA: El plan_type NO se actualizó a premium (CASO 2)!')
          // Intentar una vez más
          console.log('🔄 Reintentando actualización...')
          const { error: retryError } = await supabase
            .from('user_profiles')
            .update({ plan_type: 'premium' })
            .eq('id', existingUser.id)

          if (retryError) {
            console.error('❌ Error en reintento:', retryError)
          } else {
            const { data: finalData } = await supabase
              .from('user_profiles')
              .select('plan_type')
              .eq('id', existingUser.id)
              .single()
            console.log('📊 Después del reintento:', finalData)
          }
        }

        if (session.subscription) {
          try {
            const subscription = await getSubscription(session.subscription as string)
            const planType = determinePlanType(subscription)

            await supabase
              .from('user_subscriptions')
              .upsert({
                user_id: existingUser.id,
                stripe_customer_id: session.customer as string,
                stripe_subscription_id: subscription.id,
                status: normalizeStripeStatus(subscription.status),
                plan_type: planType,
                current_period_start: subscription.current_period_start
                  ? new Date(subscription.current_period_start * 1000).toISOString()
                  : null,
                current_period_end: subscription.current_period_end
                  ? new Date(subscription.current_period_end * 1000).toISOString()
                  : null
              }, { onConflict: 'user_id', ignoreDuplicates: false })
          } catch (subErr) {
            const e = subErr as Error
            console.error('⚠️ Error creando subscription por email:', e.message)
          }
        }

        try {
          await sendAdminPurchaseEmail({
            userEmail: customer.email,
            userName: 'Usuario encontrado por email',
            amount: (session.amount_total || 0) / 100,
            currency: session.currency?.toUpperCase() || 'EUR',
            stripeCustomerId: session.customer as string,
            userId: existingUser.id
          })
        } catch (emailErr) {
          console.error('Error enviando email admin (CASO 2):', emailErr)
        }

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
            supabase
          })
        } catch (settlementErr) {
          console.error('Error registrando settlement (CASO 2):', settlementErr)
        }
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
  supabase: SupabaseClient
): Promise<void> {
  console.log('📋 handleSubscriptionCreated:', subscription.id)

  let userId = subscription.metadata?.supabase_user_id

  if (!userId) {
    const { data: user } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('stripe_customer_id', subscription.customer as string)
      .single()

    userId = user?.id
    console.log('📋 userId encontrado por stripe_customer_id:', userId)
  }

  if (!userId) {
    console.log('⚠️ No user ID found for subscription:', subscription.id)
    return
  }

  const planType = determinePlanType(subscription)

  try {
    const { error } = await supabase
      .from('user_subscriptions')
      .upsert({
        user_id: userId,
        stripe_customer_id: subscription.customer as string,
        stripe_subscription_id: subscription.id,
        status: normalizeStripeStatus(subscription.status),
        plan_type: planType,
        trial_start: subscription.trial_start
          ? new Date(subscription.trial_start * 1000).toISOString()
          : null,
        trial_end: subscription.trial_end
          ? new Date(subscription.trial_end * 1000).toISOString()
          : null,
        current_period_start: subscription.current_period_start
          ? new Date(subscription.current_period_start * 1000).toISOString()
          : null,
        current_period_end: subscription.current_period_end
          ? new Date(subscription.current_period_end * 1000).toISOString()
          : null
      }, {
        onConflict: 'user_id',
        ignoreDuplicates: false
      })

    if (error) {
      console.error('⚠️ Error en upsert subscription:', error.message)
    } else {
      console.log(`✅ Subscription created/updated for user ${userId}`)
    }
  } catch (error) {
    console.error('Error creating subscription record:', error)
  }
}

async function handleSubscriptionUpdated(
  subscription: StripeSubscription,
  supabase: SupabaseClient
): Promise<void> {
  try {
    const updateData: Record<string, unknown> = {
      status: normalizeStripeStatus(subscription.status),
      cancel_at_period_end: subscription.cancel_at_period_end
    }

    if (subscription.current_period_start) {
      updateData.current_period_start = new Date(subscription.current_period_start * 1000).toISOString()
    }
    if (subscription.current_period_end) {
      updateData.current_period_end = new Date(subscription.current_period_end * 1000).toISOString()
    }

    await supabase
      .from('user_subscriptions')
      .update(updateData)
      .eq('stripe_subscription_id', subscription.id)

    console.log(`✅ Subscription ${subscription.id} updated to status: ${subscription.status}`)

    if (subscription.cancel_at_period_end && subscription.status === 'active') {
      const periodEnd = subscription.current_period_end
        ? new Date(subscription.current_period_end * 1000).toLocaleString('es-ES')
        : 'fecha desconocida'
      console.log(`⏰ Subscription programada para cancelar. Premium hasta ${periodEnd}`)
    }

    if (subscription.status === 'canceled') {
      const now = Math.floor(Date.now() / 1000)
      const periodEndTimestamp = subscription.current_period_end || 0
      const shouldDowngrade = shouldDowngradeNow(periodEndTimestamp, now)

      const { data: subDataArray } = await supabase
        .from('user_subscriptions')
        .select('user_id')
        .eq('stripe_subscription_id', subscription.id)
        .limit(1)

      const subData = subDataArray?.[0]
      if (subData?.user_id) {
        if (shouldDowngrade) {
          await supabase
            .from('user_profiles')
            .update({ plan_type: 'free' })
            .eq('id', subData.user_id)
          console.log(`✅ User ${subData.user_id} degradado a FREE`)
        } else {
          const periodEnd = formatPeriodEnd(periodEndTimestamp)
          console.warn(`⚠️ Status canceled pero período termina en ${periodEnd}`)
        }
      }
    }

    if (['past_due', 'unpaid'].includes(subscription.status)) {
      console.log(`⚠️ Subscription ${subscription.id} tiene problemas de pago: ${subscription.status}`)

      const { data: paymentSubData } = await supabase
        .from('user_subscriptions')
        .select('user_id')
        .eq('stripe_subscription_id', subscription.id)
        .limit(1)

      const paymentSub = paymentSubData?.[0]
      if (paymentSub?.user_id) {
        const { data: profileData } = await supabase
          .from('user_profiles')
          .select('email, full_name')
          .eq('id', paymentSub.user_id)
          .limit(1)

        const userProfile = profileData?.[0]
        if (userProfile) {
          try {
            await sendAdminPaymentIssueEmail({
              userEmail: userProfile.email,
              userName: userProfile.full_name,
              status: subscription.status,
              subscriptionId: subscription.id
            })
            console.log('📧 Email de problema de pago enviado')
          } catch (emailErr) {
            console.error('Error enviando email:', emailErr)
          }
        }
      }
    }
  } catch (error) {
    console.error('Error updating subscription:', error)
  }
}

async function handleSubscriptionDeleted(
  subscription: StripeSubscription,
  supabase: SupabaseClient
): Promise<void> {
  try {
    const { data: subDataArray } = await supabase
      .from('user_subscriptions')
      .select('user_id')
      .eq('stripe_subscription_id', subscription.id)
      .limit(1)

    const subData = subDataArray?.[0]

    if (!subData) {
      console.warn(`⚠️ Subscription ${subscription.id} no encontrada en BD`)
    }

    const periodEnd = subscription.current_period_end
      ? new Date(subscription.current_period_end * 1000).toISOString()
      : null

    const updateData: Record<string, unknown> = { status: 'canceled' }
    // Solo actualizar current_period_end si Stripe lo envía, para no perder el dato histórico
    if (periodEnd) {
      updateData.current_period_end = periodEnd
    }

    await supabase
      .from('user_subscriptions')
      .update(updateData)
      .eq('stripe_subscription_id', subscription.id)

    console.log(`✅ Subscription ${subscription.id} canceled in user_subscriptions`)

    const now = Math.floor(Date.now() / 1000)
    const periodEndTimestamp = subscription.current_period_end || 0
    const shouldDowngrade = shouldDowngradeNow(periodEndTimestamp, now)

    if (subData?.user_id) {
      if (shouldDowngrade) {
        const { error: profileError } = await supabase
          .from('user_profiles')
          .update({ plan_type: 'free' })
          .eq('id', subData.user_id)

        if (profileError) {
          console.error('❌ Error degradando usuario:', profileError)
        } else {
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

async function handlePaymentSucceeded(
  invoice: StripeInvoice,
  supabase: SupabaseClient
): Promise<void> {
  console.log('💳 handlePaymentSucceeded:', invoice.id, 'billing_reason:', invoice.billing_reason)

  if (invoice.subscription) {
    try {
      const subscription = await getSubscription(invoice.subscription as string)

      let userId = subscription.metadata?.supabase_user_id
      let userEmail: string | null = null

      if (!userId) {
        const { data: user } = await supabase
          .from('user_profiles')
          .select('id, email')
          .eq('stripe_customer_id', subscription.customer as string)
          .single()

        userId = user?.id
        userEmail = user?.email
      }

      if (userId) {
        await supabase
          .from('user_profiles')
          .update({ plan_type: 'premium' })
          .eq('id', userId)

        console.log(`✅ Payment succeeded for user ${userId}`)

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
            supabase
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
  supabase: SupabaseClient
): Promise<void> {
  console.log(`⚠️ Payment failed for invoice ${invoice.id}`)

  if (invoice.subscription) {
    try {
      const subscription = await getSubscription(invoice.subscription as string)

      let userId = subscription.metadata?.supabase_user_id

      if (!userId) {
        const { data: user } = await supabase
          .from('user_profiles')
          .select('id')
          .eq('stripe_customer_id', subscription.customer as string)
          .single()

        userId = user?.id
      }

      if (userId) {
        const { data: userProfile } = await supabase
          .from('user_profiles')
          .select('email, full_name')
          .eq('id', userId)
          .single()

        if (userProfile) {
          await sendAdminPaymentIssueEmail({
            userEmail: userProfile.email,
            userName: userProfile.full_name || 'Sin nombre',
            status: 'payment_failed',
            subscriptionId: subscription.id,
            invoiceId: invoice.id,
            amount: (invoice.amount_due || 0) / 100,
            currency: invoice.currency?.toUpperCase() || 'EUR'
          })
          console.log('📧 Email de pago fallido enviado')
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
            <p style="margin: 8px 0;"><strong>Fecha:</strong> ${new Date().toLocaleString('es-ES')}</p>
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
        const paymentIntent = await stripe().paymentIntents.retrieve(data.paymentIntentId)
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
        const charge = await stripe().charges.retrieve(actualChargeId)
        if (charge.balance_transaction) {
          const balanceTransaction = await stripe().balanceTransactions.retrieve(
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

    const { error } = await data.supabase
      .from('payment_settlements')
      .insert({
        stripe_payment_intent_id: data.paymentIntentId,
        stripe_charge_id: data.chargeId,
        stripe_invoice_id: data.invoiceId,
        stripe_customer_id: data.customerId,
        user_id: data.userId,
        user_email: data.userEmail,
        amount_gross: data.amountGross,
        stripe_fee: stripeFee,
        amount_net: amountNet,
        currency: data.currency || 'eur',
        manuel_amount: manuelAmount,
        armando_amount: armandoAmount,
        payment_date: data.paymentDate || new Date().toISOString()
      })

    if (error) {
      if (error.code === '23505') {
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

