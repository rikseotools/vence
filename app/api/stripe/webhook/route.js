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

// ✅ ACTUALIZADO: Manejar checkout completado (modo directo Y usuario logueado)
async function handleCheckoutSessionCompleted(session, supabase) {
  console.log('🎯 Checkout completado:', session.id)
  
  // CASO 1: Usuario logueado (tiene userId en metadata)
  const userId = session.subscription?.metadata?.supabase_user_id || 
                 session.metadata?.supabase_user_id

  if (userId) {
    console.log('👤 Checkout de usuario logueado:', userId)
    try {
      await supabase
        .from('user_profiles')
        .update({
          plan_type: 'trial',
          stripe_customer_id: session.customer
        })
        .eq('id', userId)

      console.log(`✅ User ${userId} started trial via checkout`)
    } catch (error) {
      console.error('Error updating logged user:', error)
    }
    return
  }

  // CASO 2: Checkout directo (sin userId) - crear usuario
  const createdVia = session.subscription?.metadata?.created_via
  if (createdVia === 'direct_checkout') {
    console.log('🚀 Checkout directo detectado')
    
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
          console.log('📧 Actualizando usuario existente:', customer.email)
          await supabase
            .from('user_profiles')
            .update({
              plan_type: 'trial',
              stripe_customer_id: session.customer
            })
            .eq('id', existingUser.id)
        } else {
          // Usuario nuevo - crear cuenta
          console.log('🆕 Creando nuevo usuario:', customer.email)
          
          // Crear usuario en Supabase Auth
          const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
            email: customer.email,
            email_confirm: true,
            user_metadata: {
              full_name: customer.name || customer.email.split('@')[0],
              created_via: 'stripe_checkout'
            }
          })

          if (authError) {
            console.error('Error creando usuario en Auth:', authError)
            return
          }

          // Crear perfil de usuario
          await supabase
            .from('user_profiles')
            .insert({
              id: authUser.user.id,
              email: customer.email,
              full_name: customer.name || customer.email.split('@')[0],
              plan_type: 'trial',
              stripe_customer_id: session.customer,
              created_via: 'stripe_checkout'
            })

          console.log(`✅ Nuevo usuario creado: ${authUser.user.id}`)
        }
      }
    } catch (error) {
      console.error('Error manejando checkout directo:', error)
    }
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