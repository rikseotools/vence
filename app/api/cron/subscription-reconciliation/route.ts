// app/api/cron/subscription-reconciliation/route.ts
// Endpoint para reconciliar user_profiles.plan_type con user_subscriptions
// Detecta y corrige usuarios con suscripción activa pero plan_type != 'premium'

import { NextResponse, NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import Stripe from 'stripe'

import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { invalidateProfileCache } from '@/lib/api/profile'
import { emit } from '@/lib/observability/emit'
const getResend = () => new Resend(process.env.RESEND_API_KEY)
const ADMIN_EMAIL = 'manueltrader@gmail.com'

const getServiceSupabase = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

interface Inconsistency {
  userId: string
  email: string
  planType: string
  subscriptionStatus: string
  subscriptionId: string
  currentPeriodEnd: string | null
  fixed: boolean
}

// Caso "Stripe tiene sub OK pero BD no tiene fila" — caso Andrea/Rocío/Mercedes.
// El pass 2 (consultar Stripe directo) crea estas filas si las detecta.
interface StripeMissingInDb {
  stripeCustomerId: string
  stripeSubscriptionId: string
  userId: string | null
  email: string | null
  status: string
  fixed: boolean
}

async function _GET(request: NextRequest) {
  // Verificar autorización
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  // Permitir acceso desde Vercel Cron o con CRON_SECRET
  const isVercelCron = request.headers.get('x-vercel-cron') === '1'
  const isAuthorized = authHeader === `Bearer ${cronSecret}` || isVercelCron

  if (!isAuthorized && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getServiceSupabase()
  const inconsistencies: Inconsistency[] = []
  const dryRun = request.nextUrl.searchParams.get('dry_run') === 'true'

  try {
    console.log('🔍 Iniciando reconciliación de suscripciones...')
    console.log('   Modo:', dryRun ? 'DRY RUN (sin cambios)' : 'LIVE (aplicando cambios)')

    // 1. Buscar usuarios con suscripción que dé acceso premium.
    //    Estados que mantienen acceso (alineado con cancelSubscription policy):
    //    - active/trialing: pagada y vigente
    //    - past_due: pago falló pero Stripe sigue reintentando; usuario conserva
    //      acceso hasta current_period_end (política Stripe smart retries)
    //    Antes solo se miraba 'active' → bug Mariangeles: su sub estuvo en
    //    past_due varios días, el cron no la detectaba y plan_type quedaba
    //    desincronizado si el webhook fallaba. Ver project_pending_stripe_cancel_bug.md
    const { data: activeSubscriptions, error: subError } = await supabase
      .from('user_subscriptions')
      .select('user_id, status, stripe_subscription_id, current_period_end')
      .in('status', ['active', 'trialing', 'past_due'])

    if (subError) {
      throw new Error(`Error obteniendo suscripciones: ${subError.message}`)
    }

    console.log(`📋 Suscripciones activas encontradas: ${activeSubscriptions?.length || 0}`)

    // 2. Para cada suscripción activa, verificar plan_type
    for (const sub of activeSubscriptions || []) {
      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('email, plan_type')
        .eq('id', sub.user_id)
        .single()

      if (profileError) {
        console.warn(`⚠️ No se encontró perfil para user_id: ${sub.user_id}`)
        continue
      }

      // Si plan_type no es premium, hay inconsistencia
      if (profile.plan_type !== 'premium') {
        console.log(`⚠️ INCONSISTENCIA: ${profile.email} tiene plan_type='${profile.plan_type}' pero suscripción activa`)

        const inconsistency: Inconsistency = {
          userId: sub.user_id,
          email: profile.email,
          planType: profile.plan_type,
          subscriptionStatus: sub.status,
          subscriptionId: sub.stripe_subscription_id,
          currentPeriodEnd: sub.current_period_end,
          fixed: false
        }

        // 3. Corregir si no es dry_run
        if (!dryRun) {
          const { error: updateError } = await supabase
            .from('user_profiles')
            .update({ plan_type: 'premium' })
            .eq('id', sub.user_id)

          if (updateError) {
            console.error(`❌ Error corrigiendo ${profile.email}:`, updateError)
          } else {
            // Invalidar cache (tag 'profile') tras UPDATE OK — sin esto, el
            // user vería plan_type='free' durante hasta 60s pese a estar
            // ya corregido en BD. Importante para cron porque es el fallback
            // si el webhook de Stripe se pierde.
            invalidateProfileCache()
            console.log(`✅ Corregido: ${profile.email} ahora es premium`)
            inconsistency.fixed = true
          }
        }

        inconsistencies.push(inconsistency)
      }
    }

    // 4. También verificar caso contrario: premium sin suscripción activa
    // (pero no auto-corregir, solo reportar)
    const { data: premiumUsers, error: premiumError } = await supabase
      .from('user_profiles')
      .select('id, email')
      .eq('plan_type', 'premium')

    if (!premiumError && premiumUsers) {
      for (const user of premiumUsers) {
        const { data: userSub } = await supabase
          .from('user_subscriptions')
          .select('status, current_period_end')
          .eq('user_id', user.id)
          .single()

        // Si no tiene suscripción activa pero es premium, reportar (no auto-degradar)
        if (!userSub || userSub.status !== 'active') {
          // Verificar si está dentro del periodo
          if (userSub?.current_period_end) {
            const periodEnd = new Date(userSub.current_period_end)
            if (periodEnd > new Date()) {
              // Está dentro del periodo pagado, es válido
              continue
            }
          }

          console.log(`📋 Usuario ${user.email} es premium pero sin suscripción activa (revisar manualmente)`)
        }
      }
    }

    // ─── PASS 2 ─── Consultar Stripe directo y detectar subs presentes en
    // Stripe pero AUSENTES en user_subscriptions. Caso real (Andrea/Rocío/
    // Mercedes 26-27/05/2026): webhook de Stripe se rompió, pagos
    // procesados en Stripe quedaron desincronizados con BD, usuarios pagaron
    // y NO se les aplicó premium. El cron pre-pass-2 NO lo detectaba porque
    // miraba solo BD; sin fila en BD, no había nada que comparar.
    //
    // Estrategia: consultar stripe.subscriptions.list({status:'active'}) de
    // los últimos 30 días (cubre periodo razonable de webhooks perdidos sin
    // explotar coste API), comparar contra user_subscriptions, crear fila
    // BD + actualizar plan_type para las que falten.
    const stripeMissing: StripeMissingInDb[] = []
    try {
      const stripeKey = process.env.STRIPE_SECRET_KEY
      if (!stripeKey) {
        console.warn('⚠️ STRIPE_SECRET_KEY no configurada — saltando pass 2')
      } else {
        const stripe = new Stripe(stripeKey)
        const since = Math.floor(Date.now() / 1000) - 30 * 24 * 3600 // 30 días

        // Paginar suscripciones active creadas últimos 30 días
        let starting_after: string | undefined
        let pagesScanned = 0
        const MAX_PAGES = 5 // 500 subs como tope; si superas necesitarás ampliar
        const stripeActives: Stripe.Subscription[] = []
        for (let i = 0; i < MAX_PAGES; i++) {
          const opts: Stripe.SubscriptionListParams = {
            status: 'active',
            limit: 100,
            created: { gte: since },
          }
          if (starting_after) opts.starting_after = starting_after
          const result = await stripe.subscriptions.list(opts)
          stripeActives.push(...result.data)
          pagesScanned++
          if (!result.has_more) break
          starting_after = result.data[result.data.length - 1].id
        }

        console.log(`📋 Stripe pass-2: ${stripeActives.length} subs active últimos 30d (${pagesScanned} pages)`)

        for (const sub of stripeActives) {
          // ¿Existe en user_subscriptions BD?
          const { data: bdSub } = await supabase
            .from('user_subscriptions')
            .select('id')
            .eq('stripe_subscription_id', sub.id)
            .maybeSingle()
          if (bdSub) continue // OK, sincronizada

          // Falta en BD. Buscar al usuario por stripe_customer_id.
          const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id
          const { data: profile } = await supabase
            .from('user_profiles')
            .select('id, email')
            .eq('stripe_customer_id', customerId)
            .maybeSingle()

          const entry: StripeMissingInDb = {
            stripeCustomerId: customerId,
            stripeSubscriptionId: sub.id,
            userId: profile?.id ?? null,
            email: profile?.email ?? null,
            status: sub.status,
            fixed: false,
          }

          if (!profile?.id) {
            // Customer Stripe sin perfil Vence asociado — caso muy raro,
            // reportar pero no auto-corregir (no sabemos qué user_id usar).
            console.warn(`⚠️ Stripe sub ${sub.id} sin user_profiles match para customer ${customerId}`)
            stripeMissing.push(entry)
            continue
          }

          if (!dryRun) {
            // Crear la fila en BD usando datos reales de Stripe.
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const item = (sub as any).items.data[0]
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const subAny = sub as any
            const periodStart = subAny.current_period_start ?? item?.current_period_start ?? sub.created
            const periodEnd = subAny.current_period_end ?? item?.current_period_end ?? null
            const interval = item?.price?.recurring?.interval
            const planType = interval === 'year' ? 'premium_annual' : 'premium_monthly'

            const { error: insertErr } = await supabase.from('user_subscriptions').insert({
              user_id: profile.id,
              stripe_customer_id: customerId,
              stripe_subscription_id: sub.id,
              status: sub.status,
              plan_type: planType,
              trial_start: sub.trial_start ? new Date(sub.trial_start * 1000).toISOString() : null,
              trial_end: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
              current_period_start: periodStart ? new Date(periodStart * 1000).toISOString() : null,
              current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
            })

            if (insertErr) {
              console.error(`❌ Pass-2 INSERT user_subscriptions falló para ${profile.email}:`, insertErr.message)
            } else {
              // Asegurar plan_type=premium en user_profiles
              await supabase
                .from('user_profiles')
                .update({ plan_type: 'premium', requires_payment: false })
                .eq('id', profile.id)
              invalidateProfileCache()
              console.log(`✅ Pass-2 RECOVERED ${profile.email} — sub ${sub.id} sincronizada en BD + premium activado`)
              entry.fixed = true
            }
          }

          stripeMissing.push(entry)
        }
      }
    } catch (stripeErr) {
      console.error('⚠️ Pass-2 error:', stripeErr)
      // No bloqueamos el reporte del Pass-1, solo emitimos el error.
      await emit({
        source: 'fargate',
        severity: 'error',
        eventType: 'subscription_reconciliation_pass2_error',
        endpoint: '/api/cron/subscription-reconciliation',
        errorMessage: stripeErr instanceof Error ? stripeErr.message.slice(0, 2000) : String(stripeErr),
      })
    }

    // Emit subscription_drift_missing_in_db específico para que la alerta
    // dispare aunque Pass-1 no encuentre nada (caso Andrea exacto: Pass-1
    // verde porque user_subscriptions vacío, Pass-2 detecta el drift real).
    if (stripeMissing.length > 0) {
      console.log(`📊 Pass-2 detected ${stripeMissing.length} subs en Stripe sin BD`)
      await emit({
        source: 'fargate',
        severity: 'error', // pago no aplicado = error inmediato
        eventType: 'subscription_drift_missing_in_db',
        endpoint: '/api/cron/subscription-reconciliation',
        metadata: {
          detected: stripeMissing.length,
          fixed: stripeMissing.filter(m => m.fixed).length,
          sampleSubs: stripeMissing.slice(0, 5).map(m => m.stripeSubscriptionId),
          sampleEmails: stripeMissing.slice(0, 5).map(m => m.email).filter(Boolean),
        },
      })
    }

    // 5. Enviar reporte si hubo inconsistencias
    if (inconsistencies.length > 0) {
      console.log(`\n📊 Resumen: ${inconsistencies.length} inconsistencia(s) encontrada(s)`)

      if (!dryRun) {
        await sendReconciliationReport(inconsistencies)
      }
    } else {
      console.log('✅ No se encontraron inconsistencias')
    }

    // 6. Telemetría a observable_events — alimenta RULE_SUBSCRIPTION_DRIFT.
    //    Antes solo había email, ahora también queda en obs_events para que
    //    la alerta declarativa (cooldown 60min) detecte detection>0 sostenido
    //    como señal de webhook roto. Caso Andrea/Mariangeles/Rocío evitable
    //    con esto: webhook se rompe → invoice paid pero plan_type stale →
    //    cron detecta drift → alerta inmediata sin esperar feedback del user.
    await emit({
      source: 'fargate',
      severity: inconsistencies.length > 0 ? 'warn' : 'info',
      eventType: 'subscription_drift',
      endpoint: '/api/cron/subscription-reconciliation',
      metadata: {
        detected: inconsistencies.length,
        fixed: inconsistencies.filter(i => i.fixed).length,
        dryRun,
        totalActiveSubscriptions: activeSubscriptions?.length || 0,
        sampleUsers: inconsistencies.slice(0, 5).map(i => i.userId),
      },
    })

    return NextResponse.json({
      success: true,
      dryRun,
      totalActiveSubscriptions: activeSubscriptions?.length || 0,
      inconsistenciesFound: inconsistencies.length,
      inconsistenciesFixed: inconsistencies.filter(i => i.fixed).length,
      details: inconsistencies,
      pass2: {
        stripeMissingInDb: stripeMissing.length,
        stripeMissingFixed: stripeMissing.filter(m => m.fixed).length,
        sample: stripeMissing.slice(0, 10),
      },
    })

  } catch (error) {
    const err = error as Error
    console.error('❌ Error en reconciliación:', err)

    return NextResponse.json({
      success: false,
      error: err.message
    }, { status: 500 })
  }
}

async function sendReconciliationReport(inconsistencies: Inconsistency[]): Promise<void> {
  const fixedCount = inconsistencies.filter(i => i.fixed).length

  const detailsHtml = inconsistencies.map(inc => `
    <tr>
      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${inc.email}</td>
      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${inc.planType}</td>
      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${inc.subscriptionStatus}</td>
      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${inc.fixed ? '✅ Sí' : '❌ No'}</td>
    </tr>
  `).join('')

  const html = `
    <!DOCTYPE html>
    <html>
      <head><meta charset="utf-8"><title>Reporte de Reconciliación</title></head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; margin: 0; padding: 20px; background-color: #f5f5f5;">
        <div style="max-width: 700px; margin: 0 auto; background: white; padding: 20px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <div style="text-align: center; background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); margin: -20px -20px 20px -20px; padding: 30px 20px; border-radius: 10px 10px 0 0; border-bottom: 4px solid #f59e0b;">
            <h1 style="color: #92400e; margin: 0;">🔧 Reconciliación de Suscripciones</h1>
            <p style="color: #b45309; margin: 10px 0 0 0; font-size: 18px;">Se detectaron ${inconsistencies.length} inconsistencia(s)</p>
          </div>

          <div style="background: #ecfdf5; padding: 15px; border-radius: 8px; margin-bottom: 20px; border: 2px solid #10b981;">
            <h3 style="color: #065f46; margin: 0 0 10px 0;">📊 Resumen:</h3>
            <p style="margin: 5px 0;">Inconsistencias detectadas: <strong>${inconsistencies.length}</strong></p>
            <p style="margin: 5px 0;">Corregidas automáticamente: <strong>${fixedCount}</strong></p>
            <p style="margin: 5px 0;">Fecha: <strong>${new Date().toLocaleString('es-ES')}</strong></p>
          </div>

          <div style="overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
              <thead>
                <tr style="background: #f3f4f6;">
                  <th style="padding: 10px; text-align: left; border-bottom: 2px solid #e5e7eb;">Email</th>
                  <th style="padding: 10px; text-align: left; border-bottom: 2px solid #e5e7eb;">Plan anterior</th>
                  <th style="padding: 10px; text-align: left; border-bottom: 2px solid #e5e7eb;">Estado sub.</th>
                  <th style="padding: 10px; text-align: left; border-bottom: 2px solid #e5e7eb;">Corregido</th>
                </tr>
              </thead>
              <tbody>
                ${detailsHtml}
              </tbody>
            </table>
          </div>

          <div style="margin-top: 20px; padding: 15px; background: #f0f9ff; border-radius: 8px;">
            <p style="margin: 0; color: #1e40af; font-size: 14px;">
              💡 <strong>Nota:</strong> Las inconsistencias ocurren cuando el webhook de Stripe no actualiza correctamente el plan_type.
              Este proceso de reconciliación se ejecuta automáticamente para corregirlas.
            </p>
          </div>
        </div>
      </body>
    </html>
  `

  try {
    await getResend().emails.send({
      from: process.env.FROM_EMAIL || 'info@vence.es',
      to: ADMIN_EMAIL,
      subject: `🔧 Reconciliación: ${inconsistencies.length} inconsistencia(s) detectada(s)`,
      html
    })
    console.log('📧 Reporte de reconciliación enviado')
  } catch (emailErr) {
    console.error('Error enviando reporte:', emailErr)
  }
}

export const GET = withErrorLogging('/api/cron/subscription-reconciliation', _GET)
