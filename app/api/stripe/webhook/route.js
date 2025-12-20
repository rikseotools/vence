// app/api/stripe/webhook/route.js - ACTUALIZADO PARA MODO DIRECTO
import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { stripe } from '@/lib/stripe'
import { getSupabaseClient } from '@/lib/supabase'

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

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

    const supabase = getSupabaseClient()

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
    try {
      await supabase
        .from('user_profiles')
        .update({
          plan_type: 'premium',
          stripe_customer_id: session.customer
        })
        .eq('id', userId)

      console.log(`✅ User ${userId} ahora es PREMIUM`)
    } catch (error) {
      console.error('Error updating logged user:', error)
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