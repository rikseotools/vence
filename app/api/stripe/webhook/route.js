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

      // 🔥 FIX BUG: Crear registro en user_subscriptions AQUÍ como backup
      // El evento customer.subscription.created puede llegar antes y fallar
      // porque stripe_customer_id aún no estaba guardado
      if (session.subscription) {
        try {
          const subscription = await stripe.subscriptions.retrieve(session.subscription)

          // Determinar plan_type basado en el intervalo
          // NOTA: Valores permitidos: 'trial', 'premium_semester', 'premium_annual'
          let planType = 'premium_semester'
          if (subscription.items?.data?.[0]?.price?.recurring?.interval === 'year') {
            planType = 'premium_annual'
          }
          // Mensual también usa premium_semester (constraint de BD no tiene monthly)

          // Usar upsert para evitar duplicados si customer.subscription.created ya lo creó
          const { error: subError } = await supabase
            .from('user_subscriptions')
            .upsert({
              user_id: userId,
              stripe_customer_id: session.customer,
              stripe_subscription_id: subscription.id,
              status: subscription.status,
              plan_type: planType,
              current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
              current_period_end: new Date(subscription.current_period_end * 1000).toISOString()
            }, {
              onConflict: 'user_id',
              ignoreDuplicates: false
            })

          if (subError) {
            console.error('⚠️ Error creando subscription record (puede ser duplicado):', subError.message)
          } else {
            console.log('✅ Subscription record creado/actualizado en user_subscriptions')
          }
        } catch (subErr) {
          console.error('⚠️ Error procesando subscription en checkout:', subErr.message)
        }
      }

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

      // 💰 Registrar pago para liquidación Manuel/Armando
      try {
        await recordPaymentSettlement({
          paymentIntentId: session.payment_intent,
          chargeId: null, // Se obtiene del payment_intent
          invoiceId: session.invoice,
          customerId: session.customer,
          userId,
          userEmail: data?.[0]?.email || session.customer_email,
          amountGross: session.amount_total, // En céntimos
          currency: session.currency,
          paymentDate: new Date(session.created * 1000).toISOString(),
          supabase
        })
        console.log('💰 Pago registrado en payment_settlements')
      } catch (settlementErr) {
        console.error('Error registrando settlement:', settlementErr)
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

        // 🔥 FIX BUG: También crear subscription record aquí
        if (session.subscription) {
          try {
            const subscription = await stripe.subscriptions.retrieve(session.subscription)
            // NOTA: Valores permitidos: 'trial', 'premium_semester', 'premium_annual'
            let planType = 'premium_semester'
            if (subscription.items?.data?.[0]?.price?.recurring?.interval === 'year') {
              planType = 'premium_annual'
            }
            // Mensual también usa premium_semester (constraint de BD no tiene monthly)

            await supabase
              .from('user_subscriptions')
              .upsert({
                user_id: existingUser.id,
                stripe_customer_id: session.customer,
                stripe_subscription_id: subscription.id,
                status: subscription.status,
                plan_type: planType,
                current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
                current_period_end: new Date(subscription.current_period_end * 1000).toISOString()
              }, { onConflict: 'user_id', ignoreDuplicates: false })

            console.log('✅ Subscription record creado para usuario encontrado por email')
          } catch (subErr) {
            console.error('⚠️ Error creando subscription por email:', subErr.message)
          }
        }

        // 📧 Enviar email de notificación al admin (CASO 2)
        try {
          await sendAdminPurchaseEmail({
            userEmail: customer.email,
            userName: 'Usuario encontrado por email',
            amount: session.amount_total / 100,
            currency: session.currency?.toUpperCase() || 'EUR',
            stripeCustomerId: session.customer,
            userId: existingUser.id
          })
          console.log('📧 Email de nueva compra enviado al admin (CASO 2)')
        } catch (emailErr) {
          console.error('Error enviando email admin (CASO 2):', emailErr)
        }

        // 💰 Registrar pago para liquidación (CASO 2)
        try {
          await recordPaymentSettlement({
            paymentIntentId: session.payment_intent,
            chargeId: null,
            invoiceId: session.invoice,
            customerId: session.customer,
            userId: existingUser.id,
            userEmail: customer.email,
            amountGross: session.amount_total,
            currency: session.currency,
            paymentDate: new Date(session.created * 1000).toISOString(),
            supabase
          })
          console.log('💰 Settlement registrado (CASO 2)')
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

// Resto de funciones igual...
async function handleSubscriptionCreated(subscription, supabase) {
  console.log('📋 handleSubscriptionCreated:', subscription.id)

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
    console.log('📋 userId encontrado por stripe_customer_id:', userId)
  }

  if (!userId) {
    // 🔥 FIX: Si no encontramos el usuario, puede ser que checkout.session.completed
    // aún no haya guardado el stripe_customer_id. No es error crítico porque
    // handleCheckoutSessionCompleted también crea el registro.
    console.log('⚠️ No user ID found for subscription:', subscription.id, '- checkout.session.completed lo manejará')
    return
  }

  // Determinar plan_type basado en el intervalo
  // NOTA: Valores permitidos: 'trial', 'premium_semester', 'premium_annual'
  let planType = 'premium_semester'
  if (subscription.items?.data?.[0]?.price?.recurring?.interval === 'year') {
    planType = 'premium_annual'
  }
  // Mensual también usa premium_semester (constraint de BD no tiene monthly)

  try {
    // 🔥 FIX: Usar upsert en lugar de insert para evitar duplicados
    const { error } = await supabase
      .from('user_subscriptions')
      .upsert({
        user_id: userId,
        stripe_customer_id: subscription.customer,
        stripe_subscription_id: subscription.id,
        status: subscription.status,
        plan_type: planType,
        trial_start: subscription.trial_start ? new Date(subscription.trial_start * 1000).toISOString() : null,
        trial_end: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
        current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
        current_period_end: new Date(subscription.current_period_end * 1000).toISOString()
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

async function handleSubscriptionUpdated(subscription, supabase) {
  try {
    // Actualizar user_subscriptions
    await supabase
      .from('user_subscriptions')
      .update({
        status: subscription.status,
        current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
        current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
        cancel_at_period_end: subscription.cancel_at_period_end
      })
      .eq('stripe_subscription_id', subscription.id)

    console.log(`✅ Subscription ${subscription.id} updated to status: ${subscription.status}`)

    // 🔥 FIX: Si el status cambia a past_due o unpaid, notificar al admin
    if (['past_due', 'unpaid'].includes(subscription.status)) {
      console.log(`⚠️ Subscription ${subscription.id} tiene problemas de pago: ${subscription.status}`)

      // Buscar usuario para notificar
      const { data: subData } = await supabase
        .from('user_subscriptions')
        .select('user_id')
        .eq('stripe_subscription_id', subscription.id)
        .single()

      if (subData?.user_id) {
        const { data: userProfile } = await supabase
          .from('user_profiles')
          .select('email, full_name')
          .eq('id', subData.user_id)
          .single()

        if (userProfile) {
          try {
            await sendAdminPaymentIssueEmail({
              userEmail: userProfile.email,
              userName: userProfile.full_name,
              status: subscription.status,
              subscriptionId: subscription.id
            })
            console.log('📧 Email de problema de pago enviado al admin')
          } catch (emailErr) {
            console.error('Error enviando email de problema de pago:', emailErr)
          }
        }
      }
    }
  } catch (error) {
    console.error('Error updating subscription:', error)
  }
}

async function handleSubscriptionDeleted(subscription, supabase) {
  try {
    // 1. Obtener el user_id antes de actualizar
    const { data: subData } = await supabase
      .from('user_subscriptions')
      .select('user_id')
      .eq('stripe_subscription_id', subscription.id)
      .single()

    // 2. Actualizar user_subscriptions
    await supabase
      .from('user_subscriptions')
      .update({
        status: 'canceled'
      })
      .eq('stripe_subscription_id', subscription.id)

    console.log(`✅ Subscription ${subscription.id} canceled in user_subscriptions`)

    // 3. 🔥 FIX: También degradar el usuario a FREE en user_profiles
    if (subData?.user_id) {
      const { error: profileError } = await supabase
        .from('user_profiles')
        .update({ plan_type: 'free' })
        .eq('id', subData.user_id)

      if (profileError) {
        console.error('❌ Error degradando usuario a free:', profileError)
      } else {
        console.log(`✅ User ${subData.user_id} degradado a plan FREE`)
      }

      // Notificar al admin sobre la cancelación
      try {
        const { data: userProfile } = await supabase
          .from('user_profiles')
          .select('email, full_name')
          .eq('id', subData.user_id)
          .single()

        if (userProfile) {
          await sendAdminCancellationEmail({
            userEmail: userProfile.email,
            userName: userProfile.full_name,
            subscriptionId: subscription.id,
            reason: subscription.cancellation_details?.reason || 'No especificado'
          })
          console.log('📧 Email de cancelación enviado al admin')
        }
      } catch (emailErr) {
        console.error('Error enviando email de cancelación:', emailErr)
      }
    }
  } catch (error) {
    console.error('Error canceling subscription:', error)
  }
}

async function handlePaymentSucceeded(invoice, supabase) {
  console.log('💳 handlePaymentSucceeded:', invoice.id, 'billing_reason:', invoice.billing_reason)

  if (invoice.subscription) {
    try {
      const subscription = await stripe.subscriptions.retrieve(invoice.subscription)

      // Buscar usuario por metadata O por customer_id
      let userId = subscription.metadata?.supabase_user_id
      let userEmail = null

      if (!userId) {
        const { data: user } = await supabase
          .from('user_profiles')
          .select('id, email')
          .eq('stripe_customer_id', subscription.customer)
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

        // 💰 Registrar pago para liquidación (tanto primer pago como renovaciones)
        // billing_reason: 'subscription_create' (primer pago) o 'subscription_cycle' (renovación)
        try {
          await recordPaymentSettlement({
            paymentIntentId: invoice.payment_intent,
            chargeId: invoice.charge,
            invoiceId: invoice.id,
            customerId: invoice.customer,
            userId,
            userEmail: userEmail || invoice.customer_email,
            amountGross: invoice.amount_paid, // En céntimos
            currency: invoice.currency,
            paymentDate: new Date(invoice.created * 1000).toISOString(),
            supabase
          })
          console.log('💰 Settlement registrado desde invoice.payment_succeeded')
        } catch (settlementErr) {
          console.error('Error registrando settlement en payment_succeeded:', settlementErr)
        }
      }
    } catch (error) {
      console.error('Error handling payment success:', error)
    }
  }
}

async function handlePaymentFailed(invoice, supabase) {
  console.log(`⚠️ Payment failed for invoice ${invoice.id}`)

  // 🔥 FIX: Buscar usuario y notificar al admin
  if (invoice.subscription) {
    try {
      const subscription = await stripe.subscriptions.retrieve(invoice.subscription)

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
            amount: invoice.amount_due / 100,
            currency: invoice.currency?.toUpperCase() || 'EUR'
          })
          console.log('📧 Email de pago fallido enviado al admin')
        }
      }
    } catch (error) {
      console.error('Error handling payment failed:', error)
    }
  }
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

// Función para enviar email de problema de pago al admin
async function sendAdminPaymentIssueEmail(data) {
  const statusLabels = {
    'past_due': '⏰ Pago Atrasado',
    'unpaid': '❌ No Pagado',
    'payment_failed': '💳 Pago Fallido'
  }

  const statusLabel = statusLabels[data.status] || data.status
  const currencySymbol = data.currency === 'EUR' ? '€' : (data.currency || '')

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Problema de Pago</title>
      </head>
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
            <a href="https://dashboard.stripe.com/subscriptions/${data.subscriptionId}"
               style="background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
              📊 Ver en Stripe
            </a>
          </div>

        </div>
      </body>
    </html>
  `

  await resend.emails.send({
    from: process.env.FROM_EMAIL || 'info@vence.es',
    to: ADMIN_EMAIL,
    subject: `⚠️ ${statusLabel} - ${data.userEmail}`,
    html: html
  })
}

// 💰 Función para registrar pago en payment_settlements (liquidación Manuel/Armando)
async function recordPaymentSettlement({ paymentIntentId, chargeId, invoiceId, customerId, userId, userEmail, amountGross, currency, paymentDate, supabase }) {
  try {
    // Obtener el balance_transaction para conocer el fee de Stripe
    let stripeFee = 0
    let actualChargeId = chargeId

    // Si no tenemos chargeId pero tenemos paymentIntentId, obtener el charge
    if (!actualChargeId && paymentIntentId) {
      try {
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId)
        if (paymentIntent.latest_charge) {
          actualChargeId = paymentIntent.latest_charge
        }
      } catch (piErr) {
        console.log('⚠️ No se pudo obtener payment_intent:', piErr.message)
      }
    }

    if (actualChargeId) {
      try {
        const charge = await stripe.charges.retrieve(actualChargeId)
        if (charge.balance_transaction) {
          const balanceTransaction = await stripe.balanceTransactions.retrieve(charge.balance_transaction)
          stripeFee = balanceTransaction.fee // Fee en céntimos
        }
      } catch (chargeErr) {
        console.log('⚠️ No se pudo obtener fee de Stripe:', chargeErr.message)
      }
    }

    // Calcular montos
    const amountNet = amountGross - stripeFee
    const manuelAmount = Math.round(amountNet * 0.9)  // 90% para Manuel
    const armandoAmount = amountNet - manuelAmount    // 10% para Armando (resto para evitar redondeo)

    console.log('💰 Settlement:', {
      gross: amountGross,
      stripeFee,
      net: amountNet,
      manuel: manuelAmount,
      armando: armandoAmount
    })

    // Insertar en payment_settlements
    const { error } = await supabase
      .from('payment_settlements')
      .insert({
        stripe_payment_intent_id: paymentIntentId,
        stripe_charge_id: chargeId,
        stripe_invoice_id: invoiceId,
        stripe_customer_id: customerId,
        user_id: userId,
        user_email: userEmail,
        amount_gross: amountGross,
        stripe_fee: stripeFee,
        amount_net: amountNet,
        currency: currency || 'eur',
        manuel_amount: manuelAmount,
        armando_amount: armandoAmount,
        payment_date: paymentDate || new Date().toISOString()
      })

    if (error) {
      // Si es duplicado por payment_intent, ignorar silenciosamente
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

// Función para enviar email de cancelación al admin
async function sendAdminCancellationEmail(data) {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Suscripción Cancelada</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; margin: 0; padding: 20px; background-color: #f5f5f5;">
        <div style="max-width: 600px; margin: 0 auto; background: white; padding: 20px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">

          <div style="text-align: center; background: linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%); margin: -20px -20px 20px -20px; padding: 30px 20px; border-radius: 10px 10px 0 0;">
            <h1 style="color: #4b5563; margin: 0;">👋 Suscripción Cancelada</h1>
            <p style="color: #6b7280; margin: 10px 0 0 0; font-size: 18px;">Un usuario ha cancelado su suscripción</p>
          </div>

          <div style="background: #f9fafb; padding: 15px; border-radius: 8px; margin-bottom: 20px; border: 1px solid #e5e7eb;">
            <h3 style="color: #374151; margin: 0 0 15px 0;">👤 Datos del Cliente:</h3>
            <p style="margin: 8px 0;"><strong>Email:</strong> ${data.userEmail}</p>
            <p style="margin: 8px 0;"><strong>Nombre:</strong> ${data.userName || 'Sin nombre'}</p>
            <p style="margin: 8px 0;"><strong>Subscription ID:</strong> ${data.subscriptionId}</p>
            <p style="margin: 8px 0;"><strong>Motivo:</strong> ${data.reason}</p>
            <p style="margin: 8px 0;"><strong>Fecha:</strong> ${new Date().toLocaleString('es-ES')}</p>
          </div>

          <div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
            <p style="margin: 0; color: #92400e;">
              💡 <strong>Nota:</strong> El usuario ha sido degradado automáticamente a plan FREE.
            </p>
          </div>

        </div>
      </body>
    </html>
  `

  await resend.emails.send({
    from: process.env.FROM_EMAIL || 'info@vence.es',
    to: ADMIN_EMAIL,
    subject: `👋 Cancelación - ${data.userEmail}`,
    html: html
  })
}