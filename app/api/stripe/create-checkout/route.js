// app/api/stripe/create-checkout/route.js - CORREGIDO PARA SISTEMA DUAL
import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createClient } from '@supabase/supabase-js'


export async function POST(request) {
  try {
    console.log('🚀 API Stripe llamada - Sistema dual...')
    
    const { priceId, userId, mode = 'normal' } = await request.json()
    
    if (!priceId) {
      console.error('❌ Price ID faltante')
      return NextResponse.json(
        { error: 'Price ID is required' },
        { status: 400 }
      )
    }

    if (!userId) {
      console.error('❌ User ID requerido')
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      )
    }

    console.log('👤 Creando checkout para usuario:', userId)

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )
    
    // 🔄 BUSCAR USUARIO CON RETRY (para evitar problemas de timing)
    let user = null
    let attempts = 0
    const maxAttempts = 3

    while (!user && attempts < maxAttempts) {
      attempts++
      console.log(`🔍 Buscando usuario (intento ${attempts}/${maxAttempts})...`)
      
      const { data: userData, error: userError } = await supabase
        .from('user_profiles')
        .select('email, full_name, stripe_customer_id, plan_type, registration_source, requires_payment')
        .eq('id', userId)
        .single()

      if (userData) {
        user = userData
        console.log('✅ Usuario encontrado:', user.email, 'Plan:', user.plan_type, 'Fuente:', user.registration_source)
        break
      }

      if (userError && userError.code !== 'PGRST116') {
        console.error('❌ Error buscando usuario:', userError)
        return NextResponse.json(
          { error: 'Database error: ' + userError.message },
          { status: 500 }
        )
      }

      // Si no encontramos el usuario, esperar un poco antes del siguiente intento
      if (attempts < maxAttempts) {
        console.log('⏳ Usuario no encontrado, esperando 500ms...')
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    }

    if (!user) {
      console.error('❌ Usuario no encontrado después de', maxAttempts, 'intentos')
      return NextResponse.json(
        { error: 'User not found in database' },
        { status: 404 }
      )
    }

    // 🎯 VERIFICAR SI EL USUARIO PUEDE HACER CHECKOUT
    // Los usuarios legacy y orgánicos no deberían llegar aquí, pero por si acaso
    if (user.plan_type === 'legacy_free') {
      console.log('🎁 Usuario legacy detectado - no necesita pago')
      return NextResponse.json(
        { error: 'Legacy users do not need to pay' },
        { status: 400 }
      )
    }

    // Crear o obtener customer de Stripe
    let customerId = user.stripe_customer_id

    if (!customerId) {
      console.log('🆕 Creando nuevo customer en Stripe...')
      try {
        const customer = await stripe.customers.create({
          email: user.email,
          name: user.full_name,
          metadata: {
            supabase_user_id: userId,
            registration_source: user.registration_source,
            plan_type: user.plan_type
          }
        })
        
        customerId = customer.id
        
        // Guardar customer ID en Supabase
        await supabase
          .from('user_profiles')
          .update({ stripe_customer_id: customerId })
          .eq('id', userId)
          
        console.log('✅ Customer creado:', customerId)
      } catch (customerError) {
        console.error('❌ Error creando customer:', customerError)
        return NextResponse.json(
          { error: 'Error creating customer: ' + customerError.message },
          { status: 500 }
        )
      }
    } else {
      console.log('♻️ Usando customer existente:', customerId)
    }

    // Crear checkout session con trial
    try {
      const sessionData = {
        customer: customerId,
        mode: 'subscription',
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        subscription_data: {
          metadata: {
            supabase_user_id: userId,
            registration_source: user.registration_source,
            plan_type: user.plan_type
          }
        },
        success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/premium/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/premium?cancelled=true`,
        automatic_tax: { enabled: false },
        customer_update: {
          address: 'auto',
        },
        allow_promotion_codes: true,
      }

      console.log('🔄 Creando session de Stripe (pago inmediato)...')
      const session = await stripe.checkout.sessions.create(sessionData)

      console.log('✅ Checkout session creada:', session.id)
      console.log('📊 Usuario:', user.email, '| Fuente:', user.registration_source, '| Plan:', user.plan_type)
      
      return NextResponse.json({
        sessionId: session.id,
        checkoutUrl: session.url,  // URL directa de Stripe
        debug: {
          userEmail: user.email,
          registrationSource: user.registration_source,
          planType: user.plan_type
        }
      })
      
    } catch (sessionError) {
      console.error('❌ Error creando session de Stripe:', sessionError)
      return NextResponse.json(
        { error: 'Error creating checkout session: ' + sessionError.message },
        { status: 500 }
      )
    }

  } catch (error) {
    console.error('❌ Error general en API:', {
      name: error.name,
      message: error.message,
      stack: error.stack?.substring(0, 1000),
      code: error.code,
      type: error.type
    })
    
    return NextResponse.json(
      { error: 'Internal server error: ' + error.message },
      { status: 500 }
    )
  }
}