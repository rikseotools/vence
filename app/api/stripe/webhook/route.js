// app/api/stripe/webhook/route.js - ACTUALIZADO PARA MODO DIRECTO
import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { stripe } from '@/lib/stripe'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const ADMIN_EMAIL = 'manueltrader@gmail.com'

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

// Crear cliente con SERVICE_ROLE_KEY para bypasear RLS
const getServiceSupabase = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

export async function POST(request) {
  try {
    const body = await request.text()
    const headersList = headers()
    const signature = headersList.get('stripe-signature')

    if (!signature || !webhookSecret) {
      console.error('Missing signature or webhook secret')
      return NextResponse.json({ error: 'Webhook signature missing' }, { status: 400 })
    }

    let event
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
    } catch (err) {
      console.error('Webhook signature verification failed:', err.message)
      return NextResponse.json({ error: 'Webhook signature verification failed' }, { status: 400 })
    }

    const supabase = getServiceSupabase()

    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(event.data.object, supabase)
        break
      
      case 'customer.subscription.created':
        await handleSubscriptionCreated(event.data.object, supabase)
        break
      
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object, supabase)
        break
      
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object, supabase)
        break
      
      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event.data.object, supabase)
        break
      
      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object, supabase)
        break
      
      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    return NextResponse.json({ received: true })

  } catch (error) {
    console.error('Webhook error:', error)
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 })
  }
}

// ✅ ACTUALIZADO: Manejar checkout completado (pago directo sin trial)
async function handleCheckoutSessionCompleted(session, supabase) {
  console.log('🎯 Checkout completado:', session.id)

  // Obtener userId: primero intentar desde subscription metadata, luego session metadata
  let userId = null

  // Si hay subscription, recuperarla para obtener metadata
  if (session.subscription) {
    try {
      const subscription = await stripe.subscriptions.retrieve(session.subscription)
      userId = subscription.metadata?.supabase_user_id
      console.log('📋 userId desde subscription metadata:', userId)
    } catch (err) {
      console.error('Error retrieving subscription:', err)
    }
  }

  // Fallback: buscar en session metadata
  if (!userId) {
    userId = session.metadata?.supabase_user_id
    console.log('📋 userId desde session metadata:', userId)
  }

  // Fallback: buscar usuario por stripe_customer_id
  if (!userId && session.customer) {
    const { data: userByCustomer } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('stripe_customer_id', session.customer)
      .single()

    userId = userByCustomer?.id
    console.log('📋 userId desde stripe_customer_id:', userId)
  }

  if (userId) {
    console.log('👤 Activando premium para usuario:', userId)
    console.log('🔑 SERVICE_ROLE_KEY configurada:', !!process.env.SUPABASE_SERVICE_ROLE_KEY)
    console.log('🔑 SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL)

    // ANTES: Verificar estado actual
    const { data: beforeData } = await supabase
      .from('user_profiles')
      .select('plan_type, updated_at')
      .eq('id', userId)
      .single()
    console.log('📊 ANTES del update:', beforeData)

    // UPDATE
    const { data, error } = await supabase
      .from('user_profiles')
      .update({
        plan_type: 'premium',
        stripe_customer_id: session.customer
      })
      .eq('id', userId)
      .select()

    if (error) {
      console.error('❌ Error actualizando usuario a premium:', error)
    } else {
      console.log(`✅ User ${userId} ahora es PREMIUM`, data)

      // Trackear conversion de pago completado
      try {
        await supabase.rpc('track_conversion_event', {
          p_user_id: userId,
          p_event_type: 'payment_completed',
          p_event_data: {
            amount: session.amount_total / 100,
            currency: session.currency,
            plan: session.mode,
            timestamp: new Date().toISOString()
          }
        })
        console.log('📊 Conversion event tracked: payment_completed')
      } catch (trackErr) {
        console.error('Error tracking conversion:', trackErr)
      }

      // Marcar conversión en A/B testing de mensajes de upgrade
      try {
        await supabase.rpc('mark_upgrade_conversion', {
          p_user_id: userId
        })
        console.log('📊 A/B test conversion marked for upgrade messages')
      } catch (abErr) {
        console.error('Error marking A/B conversion:', abErr)
      }

      // Enviar email de notificación al admin
      try {
        const userProfile = data?.[0] || {}
        await sendAdminPurchaseEmail({
          userEmail: userProfile.email || session.customer_email,
          userName: userProfile.full_name || 'Sin nombre',
          amount: session.amount_total / 100,
          currency: session.currency?.toUpperCase() || 'EUR',
          stripeCustomerId: session.customer,
          userId: userId
        })
        console.log('📧 Email de nueva compra enviado al admin')
      } catch (emailErr) {
        console.error('Error enviando email admin:', emailErr)
      }
    }

    // DESPUÉS: Verificar que se guardó
    const { data: afterData } = await supabase
      .from('user_profiles')
      .select('plan_type, updated_at')
      .eq('id', userId)
      .single()
    console.log('📊 DESPUÉS del update:', afterData)

    // Comparar
    if (afterData?.plan_type !== 'premium') {
      console.error('🚨 ALERTA: El plan_type NO se actualizó a premium!')
      console.error('🚨 beforeData:', beforeData)
      console.error('🚨 afterData:', afterData)
    }

    return
  }

  // CASO 2: Checkout directo (sin userId conocido) - buscar por email del customer
  console.log('🔍 Buscando usuario por email del customer...')

  try {
    // Obtener datos del customer de Stripe
    const customer = await stripe.customers.retrieve(session.customer)

    if (customer.email) {
      // Verificar si ya existe un usuario con este email
      const { data: existingUser } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('email', customer.email)
        .single()

      if (existingUser) {
        // Usuario existe - actualizar con datos de Stripe
        console.log('📧 Actualizando usuario existente por email:', customer.email)
        await supabase
          .from('user_profiles')
          .update({
            plan_type: 'premium',
            stripe_customer_id: session.customer
          })
          .eq('id', existingUser.id)

        console.log(`✅ User ${existingUser.id} ahora es PREMIUM (encontrado por email)`)
      } else {
        console.log('⚠️ No se encontró usuario con email:', customer.email)
      }
    }
  } catch (error) {
    console.error('Error manejando checkout:', error)
  }
}

// Resto de funciones igual...
async function handleSubscriptionCreated(subscription, supabase) {
  // Obtener userId desde metadata O desde customer
  let userId = subscription.metadata?.supabase_user_id

  if (!userId) {
    // Buscar por customer_id si no hay userId en metadata
    const { data: user } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('stripe_customer_id', subscription.customer)
      .single()
    
    userId = user?.id
  }

  if (!userId) {
    console.error('No user ID found for subscription:', subscription.id)
    return
  }

  try {
    await supabase
      .from('user_subscriptions')
      .insert({
        user_id: userId,
        stripe_customer_id: subscription.customer,
        stripe_subscription_id: subscription.id,
        status: subscription.status,
        plan_type: 'premium_semester',
        trial_start: subscription.trial_start ? new Date(subscription.trial_start * 1000).toISOString() : null,
        trial_end: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
        current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
        current_period_end: new Date(subscription.current_period_end * 1000).toISOString()
      })

    console.log(`✅ Subscription created for user ${userId}`)
  } catch (error) {
    console.error('Error creating subscription record:', error)
  }
}

async function handleSubscriptionUpdated(subscription, supabase) {
  try {
    await supabase
      .from('user_subscriptions')
      .update({
        status: subscription.status,
        current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
        current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
        cancel_at_period_end: subscription.cancel_at_period_end
      })
      .eq('stripe_subscription_id', subscription.id)

    console.log(`✅ Subscription ${subscription.id} updated`)
  } catch (error) {
    console.error('Error updating subscription:', error)
  }
}

async function handleSubscriptionDeleted(subscription, supabase) {
  try {
    await supabase
      .from('user_subscriptions')
      .update({
        status: 'canceled'
      })
      .eq('stripe_subscription_id', subscription.id)

    console.log(`✅ Subscription ${subscription.id} canceled`)
  } catch (error) {
    console.error('Error canceling subscription:', error)
  }
}

async function handlePaymentSucceeded(invoice, supabase) {
  if (invoice.subscription) {
    try {
      const subscription = await stripe.subscriptions.retrieve(invoice.subscription)
      
      // Buscar usuario por metadata O por customer_id
      let userId = subscription.metadata?.supabase_user_id
      
      if (!userId) {
        const { data: user } = await supabase
          .from('user_profiles')
          .select('id')
          .eq('stripe_customer_id', subscription.customer)
          .single()
        
        userId = user?.id
      }

      if (userId) {
        await supabase
          .from('user_profiles')
          .update({ plan_type: 'premium' })
          .eq('id', userId)

        console.log(`✅ Payment succeeded for user ${userId}`)
      }
    } catch (error) {
      console.error('Error handling payment success:', error)
    }
  }
}

async function handlePaymentFailed(invoice, supabase) {
  console.log(`⚠️ Payment failed for invoice ${invoice.id}`)
}

// Función para enviar email de nueva compra al admin
async function sendAdminPurchaseEmail(data) {
  const currencySymbol = data.currency === 'EUR' ? '€' : data.currency

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Nueva Compra Premium</title>
      </head>
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
            <a href="https://www.vence.es/admin/conversiones"
               style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
              📊 Ver Panel de Conversiones
            </a>
          </div>

          <div style="text-align: center; margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">
            <p style="margin: 0;">Vence Pro</p>
          </div>

        </div>
      </body>
    </html>
  `

  await resend.emails.send({
    from: process.env.FROM_EMAIL || 'info@vence.es',
    to: ADMIN_EMAIL,
    subject: `💰 ¡Nueva Compra Premium! - ${data.userEmail} - ${data.amount}${currencySymbol}`,
    html: html
  })
}