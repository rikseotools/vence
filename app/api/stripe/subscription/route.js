// app/api/stripe/subscription/route.js - Obtener datos de suscripción del usuario
import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createClient } from '@supabase/supabase-js'

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 })
    }

    // Obtener stripe_customer_id del usuario
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('stripe_customer_id, plan_type')
      .eq('id', userId)
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Si no tiene stripe_customer_id, no tiene suscripción
    if (!profile.stripe_customer_id) {
      return NextResponse.json({
        hasSubscription: false,
        planType: profile.plan_type
      })
    }

    // Obtener suscripciones activas de Stripe
    const subscriptions = await stripe.subscriptions.list({
      customer: profile.stripe_customer_id,
      status: 'all',
      limit: 1,
      expand: ['data.default_payment_method']
    })

    if (subscriptions.data.length === 0) {
      return NextResponse.json({
        hasSubscription: false,
        planType: profile.plan_type,
        stripeCustomerId: profile.stripe_customer_id
      })
    }

    const subscription = subscriptions.data[0]

    // Formatear datos de la suscripción
    const subscriptionData = {
      hasSubscription: true,
      planType: profile.plan_type,
      stripeCustomerId: profile.stripe_customer_id,
      subscription: {
        id: subscription.id,
        status: subscription.status,
        currentPeriodStart: new Date(subscription.current_period_start * 1000).toISOString(),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        canceledAt: subscription.canceled_at ? new Date(subscription.canceled_at * 1000).toISOString() : null,
        created: new Date(subscription.created * 1000).toISOString(),
        // Info del plan
        planName: subscription.items.data[0]?.price?.nickname || 'Premium',
        planAmount: subscription.items.data[0]?.price?.unit_amount / 100,
        planCurrency: subscription.items.data[0]?.price?.currency,
        planInterval: subscription.items.data[0]?.price?.recurring?.interval,
        planIntervalCount: subscription.items.data[0]?.price?.recurring?.interval_count
      }
    }

    return NextResponse.json(subscriptionData)

  } catch (error) {
    console.error('Error getting subscription:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// Crear portal de gestión de Stripe
export async function POST(request) {
  try {
    const { userId } = await request.json()

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 })
    }

    // Obtener stripe_customer_id del usuario
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('stripe_customer_id')
      .eq('id', userId)
      .single()

    if (profileError || !profile?.stripe_customer_id) {
      return NextResponse.json({ error: 'No subscription found' }, { status: 404 })
    }

    // Crear sesión del portal de Stripe
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: `${process.env.NEXT_PUBLIC_SITE_URL}/perfil?tab=suscripcion`
    })

    return NextResponse.json({ url: portalSession.url })

  } catch (error) {
    console.error('Error creating portal session:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
