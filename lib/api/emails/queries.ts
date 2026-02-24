// lib/api/emails/queries.ts - Core v2 email module (Drizzle + Zod)
import { getDb } from '@/db/client'
import { emailPreferences, emailLogs, emailEvents, emailUnsubscribeTokens, userProfiles } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { Resend } from 'resend'
import crypto from 'crypto'
import { emailTemplates } from '@/lib/emails/templates'
import type {
  EmailType,
  EmailPreferences,
  SendEmailRequest,
  SendEmailResponse,
  CanSendResult,
} from './schemas'
import { EMAIL_TYPE_TO_CATEGORY } from './schemas'

// ============================================
// GET EMAIL PREFERENCES (Drizzle)
// ============================================

export async function getEmailPreferencesV2(userId: string): Promise<EmailPreferences> {
  try {
    const db = getDb()

    const [prefs] = await db
      .select({
        email_reactivacion: emailPreferences.emailReactivacion,
        email_urgente: emailPreferences.emailUrgente,
        email_bienvenida_motivacional: emailPreferences.emailBienvenidaMotivacional,
        email_bienvenida_inmediato: emailPreferences.emailBienvenidaInmediato,
        email_resumen_semanal: emailPreferences.emailResumenSemanal,
        unsubscribed_all: emailPreferences.unsubscribedAll,
        email_soporte_disabled: emailPreferences.emailSoporteDisabled,
        email_newsletter_disabled: emailPreferences.emailNewsletterDisabled,
      })
      .from(emailPreferences)
      .where(eq(emailPreferences.userId, userId))
      .limit(1)

    if (!prefs) {
      // Create defaults for new user
      console.log('📝 [Emails/v2] Creating default preferences for new user')

      const [created] = await db
        .insert(emailPreferences)
        .values({
          userId,
          emailReactivacion: true,
          emailUrgente: true,
          emailBienvenidaMotivacional: true,
          emailBienvenidaInmediato: true,
          emailResumenSemanal: true,
          unsubscribedAll: false,
          emailSoporteDisabled: false,
          emailNewsletterDisabled: false,
        })
        .onConflictDoUpdate({
          target: emailPreferences.userId,
          set: { updatedAt: new Date().toISOString() },
        })
        .returning({
          email_reactivacion: emailPreferences.emailReactivacion,
          email_urgente: emailPreferences.emailUrgente,
          email_bienvenida_motivacional: emailPreferences.emailBienvenidaMotivacional,
          email_bienvenida_inmediato: emailPreferences.emailBienvenidaInmediato,
          email_resumen_semanal: emailPreferences.emailResumenSemanal,
          unsubscribed_all: emailPreferences.unsubscribedAll,
          email_soporte_disabled: emailPreferences.emailSoporteDisabled,
          email_newsletter_disabled: emailPreferences.emailNewsletterDisabled,
        })

      if (created) {
        return {
          email_reactivacion: created.email_reactivacion ?? true,
          email_urgente: created.email_urgente ?? true,
          email_bienvenida_motivacional: created.email_bienvenida_motivacional ?? true,
          email_bienvenida_inmediato: created.email_bienvenida_inmediato ?? true,
          email_resumen_semanal: created.email_resumen_semanal ?? true,
          unsubscribed_all: created.unsubscribed_all ?? false,
          email_soporte_disabled: created.email_soporte_disabled ?? false,
          email_newsletter_disabled: created.email_newsletter_disabled ?? false,
        }
      }

      // Fallback if insert failed
      return defaultPreferences(true)
    }

    return {
      email_reactivacion: prefs.email_reactivacion ?? true,
      email_urgente: prefs.email_urgente ?? true,
      email_bienvenida_motivacional: prefs.email_bienvenida_motivacional ?? true,
      email_bienvenida_inmediato: prefs.email_bienvenida_inmediato ?? true,
      email_resumen_semanal: prefs.email_resumen_semanal ?? true,
      unsubscribed_all: prefs.unsubscribed_all ?? false,
      email_soporte_disabled: prefs.email_soporte_disabled ?? false,
      email_newsletter_disabled: prefs.email_newsletter_disabled ?? false,
    }
  } catch (error) {
    console.error('❌ [Emails/v2] Error getting preferences:', error)
    // Safe fallback: block all emails on error
    return defaultPreferences(false)
  }
}

function defaultPreferences(enabled: boolean): EmailPreferences {
  return {
    email_reactivacion: enabled,
    email_urgente: enabled,
    email_bienvenida_motivacional: enabled,
    email_bienvenida_inmediato: enabled,
    email_resumen_semanal: enabled,
    unsubscribed_all: !enabled,
    email_soporte_disabled: false,
    email_newsletter_disabled: !enabled,
  }
}

// ============================================
// CAN SEND EMAIL CHECK
// ============================================

export async function canSendEmail(userId: string, emailType: EmailType): Promise<CanSendResult> {
  const category = EMAIL_TYPE_TO_CATEGORY[emailType]

  if (!category) {
    return { canSend: false, reason: `Unknown email type: ${emailType}` }
  }

  // Admin emails always send (no preference check)
  if (category === 'admin') {
    return { canSend: true }
  }

  const prefs = await getEmailPreferencesV2(userId)

  switch (category) {
    case 'soporte':
      // Transactional: only blocked by soporte toggle, NOT by unsubscribed_all
      if (prefs.email_soporte_disabled) {
        return { canSend: false, reason: 'soporte_disabled' }
      }
      return { canSend: true }

    case 'newsletter':
      // Blocked by unsubscribed_all OR newsletter toggle
      if (prefs.unsubscribed_all) {
        return { canSend: false, reason: 'unsubscribed_all' }
      }
      if (prefs.email_newsletter_disabled) {
        return { canSend: false, reason: 'newsletter_disabled' }
      }
      return { canSend: true }

    case 'marketing': {
      // Blocked by unsubscribed_all (master toggle)
      if (prefs.unsubscribed_all) {
        return { canSend: false, reason: 'unsubscribed_all' }
      }
      // Check individual toggle
      const toggleMap: Partial<Record<EmailType, boolean>> = {
        reactivacion: prefs.email_reactivacion,
        urgente: prefs.email_urgente,
        bienvenida_motivacional: prefs.email_bienvenida_motivacional,
        bienvenida_inmediato: prefs.email_bienvenida_inmediato,
        resumen_semanal: prefs.email_resumen_semanal,
      }
      const toggle = toggleMap[emailType]
      if (toggle === false) {
        return { canSend: false, reason: `${emailType}_disabled` }
      }
      return { canSend: true }
    }
  }
}

// ============================================
// GENERATE UNSUBSCRIBE TOKEN (Drizzle)
// ============================================

export async function generateUnsubscribeToken(
  userId: string,
  email: string,
  emailType: string
): Promise<string> {
  const db = getDb()
  const token = crypto.randomBytes(32).toString('hex')

  await db.insert(emailUnsubscribeTokens).values({
    userId,
    token,
    email,
    emailType,
  })

  return token
}

export function getUnsubscribeUrl(token: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.vence.es'
  return `${baseUrl}/unsubscribe?token=${token}`
}

// ============================================
// LOG EMAIL (Drizzle)
// ============================================

async function logEmailSent(
  userId: string,
  emailType: string,
  subject: string,
  emailAddress: string
): Promise<void> {
  try {
    const db = getDb()

    await Promise.all([
      db.insert(emailLogs).values({
        userId,
        emailType,
        subject,
        status: 'sent',
      }),
      db.insert(emailEvents).values({
        userId,
        emailType,
        eventType: 'sent',
        emailAddress,
        subject,
      }),
    ])
  } catch (error) {
    // Don't fail the email send if logging fails
    console.error('⚠️ [Emails/v2] Error logging email:', error)
  }
}

// ============================================
// SEND EMAIL (core function)
// ============================================

export async function sendEmailV2(params: SendEmailRequest): Promise<SendEmailResponse> {
  const { userId, emailType, customData = {} } = params

  console.log(`📧 [Emails/v2] Sending ${emailType} to user ${userId}`)

  // 1. Check preferences
  const canSend = await canSendEmail(userId, emailType)
  if (!canSend.canSend) {
    console.log(`⏭️ [Emails/v2] Blocked: ${canSend.reason}`)
    return {
      success: false,
      cancelled: true,
      reason: canSend.reason || 'preference_blocked',
      message: `Email ${emailType} blocked: ${canSend.reason}`,
    }
  }

  // 2. Get user info
  const db = getDb()
  const [user] = await db
    .select({
      email: userProfiles.email,
      fullName: userProfiles.fullName,
      targetOposicion: userProfiles.targetOposicion,
    })
    .from(userProfiles)
    .where(eq(userProfiles.id, userId))
    .limit(1)

  if (!user?.email) {
    return {
      success: false,
      error: `Usuario no encontrado o sin email: ${userId}`,
    }
  }

  // 3. Generate unsubscribe URL
  const token = await generateUnsubscribeToken(userId, user.email, emailType)
  const unsubscribeUrl = getUnsubscribeUrl(token)

  // 4. Render template
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const template = (emailTemplates as any)[emailType]
  if (!template) {
    return {
      success: false,
      error: `Template not found for email type: ${emailType}`,
    }
  }

  const toEmail = customData.to as string || user.email
  const userName = customData.userName as string || user.fullName || 'Usuario'
  const daysInactive = (customData.daysInactive as number) || (customData.daysSince as number) || 7
  const baseUrl = 'https://www.vence.es'
  const testUrl = `${baseUrl}/auxiliar-administrativo-estado/test?utm_source=email&utm_campaign=${emailType}`

  // Each template has different argument signatures
  let subject: string
  let html: string

  if (emailType === 'soporte_respuesta') {
    subject = template.subject()
    html = template.html(userName, customData.adminMessage, customData.chatUrl, unsubscribeUrl)
  } else if (emailType === 'impugnacion_respuesta') {
    subject = template.subject(customData.status)
    html = template.html(userName, customData.status, customData.adminResponse, customData.questionText, customData.disputeUrl, unsubscribeUrl)
  } else {
    subject = template.subject(userName, daysInactive)
    html = template.html(userName, daysInactive, testUrl, unsubscribeUrl)
  }

  // 5. Send via Resend
  const fromName = process.env.EMAIL_FROM_NAME || 'Vence'
  const fromAddress = process.env.EMAIL_FROM_ADDRESS || 'info@vence.es'
  const from = `${fromName} <${fromAddress}>`

  const resend = new Resend(process.env.RESEND_API_KEY)
  const { data, error } = await resend.emails.send({
    from,
    to: toEmail,
    subject,
    html,
    headers: {
      'List-Unsubscribe': `<${unsubscribeUrl}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
  })

  if (error) {
    console.error(`❌ [Emails/v2] Resend error:`, error)
    return {
      success: false,
      error: error.message || 'Error enviando email',
    }
  }

  // 6. Log
  await logEmailSent(userId, emailType, subject, toEmail)

  console.log(`✅ [Emails/v2] Email sent: ${data?.id}`)

  return {
    success: true,
    emailId: data?.id || 'unknown',
  }
}
