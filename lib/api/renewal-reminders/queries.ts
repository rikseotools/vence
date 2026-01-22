// lib/api/renewal-reminders/queries.ts - Queries tipadas para recordatorios de renovación
import { getDb } from '@/db/client'
import { userSubscriptions, userProfiles, emailLogs } from '@/db/schema'
import { eq, and, gte, lte, sql } from 'drizzle-orm'
import { Resend } from 'resend'
import { emailTemplates } from '@/lib/emails/templates'
import { generateUnsubscribeToken } from '@/lib/emails/emailService.server'
import type {
  GetSubscriptionsForReminderResponse,
  UserWithSubscription,
  SendReminderRequest,
  SendReminderResponse,
  RunReminderCampaignRequest,
  RunReminderCampaignResponse,
  CheckReminderSentResponse,
  ReminderResult,
} from './schemas'

// ============================================
// CONSTANTES
// ============================================

const BASE_URL = 'https://www.vence.es'
const EMAIL_TYPE = 'recordatorio_renovacion'

// Precios por plan (en euros)
const PLAN_PRICES: Record<string, number> = {
  'premium_semester': 59,
  'premium_monthly': 12,
  'premium': 59, // Default
}

// ============================================
// OBTENER SUSCRIPCIONES PRÓXIMAS A RENOVAR
// ============================================

export async function getSubscriptionsForReminder(
  daysBeforeRenewal: number = 7
): Promise<GetSubscriptionsForReminderResponse> {
  try {
    const db = getDb()

    // Calcular el rango de fechas
    const now = new Date()
    const targetDate = new Date()
    targetDate.setDate(now.getDate() + daysBeforeRenewal)

    // Rango: desde hoy + días - 1 hasta hoy + días + 1 (para capturar el día exacto)
    const startDate = new Date(targetDate)
    startDate.setHours(0, 0, 0, 0)
    const endDate = new Date(targetDate)
    endDate.setHours(23, 59, 59, 999)

    console.log(`🔍 Buscando suscripciones que renuevan entre ${startDate.toISOString()} y ${endDate.toISOString()}`)

    // Obtener suscripciones activas que:
    // - Están activas (status = 'active')
    // - NO están marcadas para cancelar (cancel_at_period_end = false)
    // - Tienen current_period_end en el rango
    const subscriptions = await db
      .select({
        id: userSubscriptions.id,
        stripeSubscriptionId: userSubscriptions.stripeSubscriptionId,
        stripeCustomerId: userSubscriptions.stripeCustomerId,
        userId: userSubscriptions.userId,
        status: userSubscriptions.status,
        planType: userSubscriptions.planType,
        currentPeriodEnd: userSubscriptions.currentPeriodEnd,
        cancelAtPeriodEnd: userSubscriptions.cancelAtPeriodEnd,
        // Datos del usuario
        email: userProfiles.email,
        fullName: userProfiles.fullName,
      })
      .from(userSubscriptions)
      .innerJoin(userProfiles, eq(userSubscriptions.userId, userProfiles.id))
      .where(and(
        eq(userSubscriptions.status, 'active'),
        eq(userSubscriptions.cancelAtPeriodEnd, false),
        gte(userSubscriptions.currentPeriodEnd, startDate.toISOString()),
        lte(userSubscriptions.currentPeriodEnd, endDate.toISOString())
      ))

    console.log(`📊 Encontradas ${subscriptions.length} suscripciones próximas a renovar`)

    // Mapear a formato de respuesta
    const mappedSubscriptions: UserWithSubscription[] = subscriptions.map(sub => {
      const periodEnd = new Date(sub.currentPeriodEnd!)
      const daysUntil = Math.ceil((periodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

      return {
        userId: sub.userId!,
        email: sub.email,
        fullName: sub.fullName,
        stripeSubscriptionId: sub.stripeSubscriptionId!,
        stripeCustomerId: sub.stripeCustomerId!,
        planType: sub.planType,
        currentPeriodEnd: sub.currentPeriodEnd!,
        daysUntilRenewal: daysUntil,
        planAmount: PLAN_PRICES[sub.planType || 'premium'] || 59,
      }
    })

    return {
      success: true,
      subscriptions: mappedSubscriptions,
      total: mappedSubscriptions.length,
    }
  } catch (error) {
    console.error('❌ Error obteniendo suscripciones para recordatorio:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    }
  }
}

// ============================================
// VERIFICAR SI YA SE ENVIÓ RECORDATORIO
// ============================================

export async function checkReminderAlreadySent(
  userId: string,
  periodEnd: string
): Promise<CheckReminderSentResponse> {
  try {
    const db = getDb()

    // Buscar si ya se envió un recordatorio para este período
    // Usamos el subject para identificar el período específico
    const periodEndDate = new Date(periodEnd)
    const formattedDate = periodEndDate.toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })

    const existingReminder = await db
      .select({
        id: emailLogs.id,
        sentAt: emailLogs.sentAt,
      })
      .from(emailLogs)
      .where(and(
        eq(emailLogs.userId, userId),
        eq(emailLogs.emailType, EMAIL_TYPE),
        // Buscar recordatorios enviados en los últimos 10 días
        gte(emailLogs.sentAt, sql`now() - interval '10 days'`)
      ))
      .limit(1)

    if (existingReminder.length > 0) {
      return {
        alreadySent: true,
        sentAt: existingReminder[0].sentAt,
      }
    }

    return {
      alreadySent: false,
      sentAt: null,
    }
  } catch (error) {
    console.error('❌ Error verificando recordatorio enviado:', error)
    // En caso de error, asumimos que no se envió para no bloquear
    return {
      alreadySent: false,
      sentAt: null,
    }
  }
}

// ============================================
// ENVIAR RECORDATORIO INDIVIDUAL
// ============================================

export async function sendRenewalReminder(
  params: SendReminderRequest
): Promise<SendReminderResponse> {
  try {
    const { userId, email, fullName, daysUntilRenewal, renewalDate, planAmount } = params

    console.log(`📧 Enviando recordatorio de renovación a ${email}`)

    // Verificar si ya se envió
    const { alreadySent } = await checkReminderAlreadySent(userId, renewalDate)
    if (alreadySent) {
      console.log(`⏭️ Recordatorio ya enviado a ${email} para este período`)
      return {
        success: false,
        skipped: true,
        skipReason: 'already_sent',
      }
    }

    // Obtener template
    const template = emailTemplates['recordatorio_renovacion']
    if (!template) {
      throw new Error('Template recordatorio_renovacion no encontrado')
    }

    // Generar URLs
    const gestionarUrl = `${BASE_URL}/perfil?tab=suscripcion&utm_source=email&utm_campaign=renewal_reminder`

    // Generar token de unsubscribe
    const unsubscribeToken = await generateUnsubscribeToken(userId, email, EMAIL_TYPE)
    const unsubscribeUrl = unsubscribeToken
      ? `${BASE_URL}/unsubscribe?token=${unsubscribeToken}&email=${encodeURIComponent(email)}`
      : `${BASE_URL}/perfil?tab=emails`

    // Formatear fecha
    const formattedDate = new Date(renewalDate).toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })

    const userName = fullName || 'Usuario'
    const subject = template.subject(userName, daysUntilRenewal)
    const html = template.html(userName, daysUntilRenewal, formattedDate, planAmount, gestionarUrl, unsubscribeUrl)

    // Enviar con Resend
    if (!process.env.RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY no configurada')
    }

    const resend = new Resend(process.env.RESEND_API_KEY)
    const emailResponse = await resend.emails.send({
      from: `${process.env.EMAIL_FROM_NAME || 'Vence'} <${process.env.EMAIL_FROM_ADDRESS || 'notificaciones@vence.es'}>`,
      to: email,
      subject,
      html,
    })

    if (emailResponse.error) {
      throw new Error(`Error de Resend: ${emailResponse.error.message}`)
    }

    // Registrar en email_logs
    const db = getDb()
    await db.insert(emailLogs).values({
      userId,
      emailType: EMAIL_TYPE,
      subject,
      status: 'sent',
    })

    console.log(`✅ Recordatorio enviado a ${email}`)

    return {
      success: true,
      emailId: emailResponse.data?.id,
    }
  } catch (error) {
    console.error(`❌ Error enviando recordatorio a ${params.email}:`, error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    }
  }
}

// ============================================
// EJECUTAR CAMPAÑA DE RECORDATORIOS
// ============================================

export async function runRenewalReminderCampaign(
  params: RunReminderCampaignRequest = { daysBeforeRenewal: 7, dryRun: false }
): Promise<RunReminderCampaignResponse> {
  try {
    const { daysBeforeRenewal, dryRun } = params

    console.log(`🚀 Iniciando campaña de recordatorios (${daysBeforeRenewal} días antes)${dryRun ? ' [DRY RUN]' : ''}`)

    // Obtener suscripciones próximas a renovar
    const { success, subscriptions, error } = await getSubscriptionsForReminder(daysBeforeRenewal)

    if (!success || !subscriptions) {
      return {
        success: false,
        total: 0,
        sent: 0,
        skipped: 0,
        failed: 0,
        error: error || 'Error obteniendo suscripciones',
      }
    }

    if (subscriptions.length === 0) {
      console.log('📭 No hay suscripciones próximas a renovar')
      return {
        success: true,
        total: 0,
        sent: 0,
        skipped: 0,
        failed: 0,
        results: [],
      }
    }

    const results: ReminderResult[] = []
    let sent = 0
    let skipped = 0
    let failed = 0

    // Procesar cada suscripción
    for (const sub of subscriptions) {
      if (dryRun) {
        console.log(`🔍 [DRY RUN] Se enviaría recordatorio a ${sub.email} (${sub.daysUntilRenewal} días, ${sub.planAmount}€)`)
        results.push({
          userId: sub.userId,
          email: sub.email,
          success: true,
          skipped: false,
          skipReason: null,
          emailId: 'dry-run',
          error: null,
        })
        sent++
        continue
      }

      const result = await sendRenewalReminder({
        userId: sub.userId,
        email: sub.email,
        fullName: sub.fullName,
        daysUntilRenewal: sub.daysUntilRenewal,
        renewalDate: sub.currentPeriodEnd,
        planAmount: sub.planAmount || 59,
      })

      results.push({
        userId: sub.userId,
        email: sub.email,
        success: result.success,
        skipped: result.skipped || false,
        skipReason: result.skipReason || null,
        emailId: result.emailId || null,
        error: result.error || null,
      })

      if (result.success) {
        sent++
      } else if (result.skipped) {
        skipped++
      } else {
        failed++
      }

      // Pausa entre emails para no saturar
      await new Promise(resolve => setTimeout(resolve, 300))
    }

    console.log(`🎉 Campaña completada: ${sent} enviados, ${skipped} omitidos, ${failed} fallidos`)

    return {
      success: true,
      total: subscriptions.length,
      sent,
      skipped,
      failed,
      results,
    }
  } catch (error) {
    console.error('❌ Error en campaña de recordatorios:', error)
    return {
      success: false,
      total: 0,
      sent: 0,
      skipped: 0,
      failed: 0,
      error: error instanceof Error ? error.message : 'Error desconocido',
    }
  }
}
