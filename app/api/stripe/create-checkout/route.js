// app/api/stripe/create-checkout/route.js - CORREGIDO PARA SISTEMA DUAL
import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { getAdminDb } from '@/db/client'
import { userProfiles } from '@/db/schema'
import { eq } from 'drizzle-orm'

import { withErrorLogging } from '@/lib/api/withErrorLogging'
import {
  findBlockingSubscription,
  buildCheckoutIdempotencyKey,
} from '@/lib/stripe-checkout-validators'
async function _POST(request) {
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

    // 🔄 BUSCAR USUARIO CON RETRY (para evitar problemas de timing)
    let user = null
    let attempts = 0
    const maxAttempts = 3

    while (!user && attempts < maxAttempts) {
      attempts++
      console.log(`🔍 Buscando usuario (intento ${attempts}/${maxAttempts})...`)
      
      // Con Drizzle, "no encontrado" = array vacío (ya no hay PGRST116) → reintenta;
      // un error real de BD lanza → 500.
      let userData = null
      let userError = null
      try {
        const rows = await getAdminDb()
          .select({
            email: userProfiles.email,
            full_name: userProfiles.fullName,
            stripe_customer_id: userProfiles.stripeCustomerId,
            plan_type: userProfiles.planType,
            registration_source: userProfiles.registrationSource,
            requires_payment: userProfiles.requiresPayment,
          })
          .from(userProfiles)
          .where(eq(userProfiles.id, userId))
          .limit(1)
        userData = rows[0] ?? null
      } catch (e) {
        userError = e
      }

      if (userData) {
        user = userData
        console.log('✅ Usuario encontrado:', user.email, 'Plan:', user.plan_type, 'Fuente:', user.registration_source)
        break
      }

      if (userError) {
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
    const customerExisted = !!customerId

    if (!customerId) {
      console.log('🆕 Creando nuevo customer en Stripe...')
      try {
        const customer = await stripe().customers.create({
          email: user.email,
          name: user.full_name,
          metadata: {
            supabase_user_id: userId,
            registration_source: user.registration_source,
            plan_type: user.plan_type
          }
        })
        
        customerId = customer.id
        
        // Guardar customer ID en BD (best-effort, igual que antes)
        try {
          await getAdminDb()
            .update(userProfiles)
            .set({ stripeCustomerId: customerId })
            .where(eq(userProfiles.id, userId))
        } catch (updErr) {
          console.error('⚠️ Error guardando stripe_customer_id:', updErr)
        }

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

    // 🛡️ GUARDIA ANTI-SUSCRIPCIÓN DUPLICADA (incidente 2026-06-07: doble
    // checkout → 2 subs active + 2 charges de €20). Stripe permite N subs por
    // customer; sin esta comprobación un doble-submit (volver atrás, doble
    // clic, no ver la confirmación) cobra de nuevo. Se consulta a Stripe
    // (autoritativo; user_subscriptions guarda 1 fila/usuario y va stale —
    // fue justo el punto ciego del incidente). Solo aplica a customers que ya
    // existían: uno recién creado no puede tener subs. Fail-open ante error de
    // Stripe: no bloquear ingresos por un blip; la idempotency key de abajo
    // sigue cubriendo el doble-clic concurrente.
    if (customerExisted) {
      try {
        const existingSubs = await stripe().subscriptions.list({
          customer: customerId,
          status: 'all',
          limit: 10,
        })
        const blocking = findBlockingSubscription(existingSubs.data)
        if (blocking) {
          console.log(`🛡️ Usuario ya tiene suscripción ${blocking.status} (${blocking.id}) — bloqueando 2º checkout`)
          return NextResponse.json(
            {
              error: 'already_subscribed',
              message: 'Ya tienes una suscripción activa. Gestiona tu plan desde tu perfil.',
              subscriptionStatus: blocking.status,
            },
            { status: 409 }
          )
        }
      } catch (guardErr) {
        // Fail-open: registrar pero no bloquear (la idempotency key mitiga).
        console.error('⚠️ No se pudo verificar suscripciones existentes (fail-open):', guardErr.message)
      }
    }

    // Crear checkout session con trial
    try {
      const sessionData = {
        customer: customerId,
        client_reference_id: userId,
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
      // Idempotency key (bucket 1 min): dos submits del mismo (usuario, precio)
      // en el mismo minuto reusan la MISMA session en vez de crear dos.
      const idempotencyKey = buildCheckoutIdempotencyKey(userId, priceId, Date.now())
      const session = await stripe().checkout.sessions.create(sessionData, { idempotencyKey })

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

export const POST = withErrorLogging('/api/stripe/create-checkout', _POST)
