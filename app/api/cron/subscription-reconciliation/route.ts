// app/api/cron/subscription-reconciliation/route.ts
// Endpoint para reconciliar user_profiles.plan_type con user_subscriptions
// Detecta y corrige usuarios con suscripción activa pero plan_type != 'premium'

import { NextResponse, NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

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

export async function GET(request: NextRequest) {
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

    // 1. Buscar usuarios con suscripción activa
    const { data: activeSubscriptions, error: subError } = await supabase
      .from('user_subscriptions')
      .select('user_id, status, stripe_subscription_id, current_period_end')
      .eq('status', 'active')

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

    // 5. Enviar reporte si hubo inconsistencias
    if (inconsistencies.length > 0) {
      console.log(`\n📊 Resumen: ${inconsistencies.length} inconsistencia(s) encontrada(s)`)

      if (!dryRun) {
        await sendReconciliationReport(inconsistencies)
      }
    } else {
      console.log('✅ No se encontraron inconsistencias')
    }

    return NextResponse.json({
      success: true,
      dryRun,
      totalActiveSubscriptions: activeSubscriptions?.length || 0,
      inconsistenciesFound: inconsistencies.length,
      inconsistenciesFixed: inconsistencies.filter(i => i.fixed).length,
      details: inconsistencies
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
