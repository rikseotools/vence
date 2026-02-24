import 'server-only'
import { Resend } from 'resend'
import { createClient } from '@supabase/supabase-js'
import {
  getEmailPreferencesV2,
  canSendEmail,
  sendEmailV2,
  generateUnsubscribeToken as generateUnsubscribeTokenV2,
  getUnsubscribeUrl,
} from '@/lib/api/emails'
import type { EmailPreferences, EmailType } from '@/lib/api/emails'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import { emailTemplates } from './templates'

// ============================================
// HELPERS
// ============================================

function getResend() {
  if (!process.env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY no está configurada')
  }
  return new Resend(process.env.RESEND_API_KEY)
}

function getSupabase() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Variables de entorno de Supabase no configuradas')
  }
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

// ============================================
// TYPES
// ============================================

export interface EmailSendResult {
  success: boolean
  emailId?: string
  unsubscribeToken?: string | null
  cancelled?: boolean
  reason?: string
  message?: string
  error?: string
  details?: Record<string, unknown>
}

interface CampaignDetail {
  userId: string
  email: string
  fullName: string | null
  daysInactive?: number
  daysSinceRegistration?: number
  emailType: string
  category: string
  success: boolean
  cancelled: boolean
  error: string | null
  emailId: string | null
  articlesCount?: number
}

interface CampaignResults {
  total: number
  sent: number
  failed: number
  cancelled: number
  message?: string
  success?: boolean
  error?: string
  details: CampaignDetail[]
}

interface UnsubscribeResult {
  success: boolean
  error?: string
  message?: string
  email?: string
  updatedPreferences?: Record<string, boolean | string>
}

interface DetectedUser {
  user_id: string
  email: string
  full_name: string | null
  days_inactive?: number
  days_since_registration?: number
}

interface EmailQueueItem {
  user: DetectedUser
  emailType: string
  priority: number
  category: string
}

interface WeeklyReportUser {
  id: string
  email: string
  full_name: string | null
  target_oposicion: string | null
  problematicArticles: { article_id: string; [key: string]: unknown }[]
  articlesCount: number
}

// ============================================
// CORE FUNCTIONS (delegate to v2)
// ============================================

export async function getEmailPreferences(userId: string): Promise<EmailPreferences> {
  return getEmailPreferencesV2(userId)
}

export async function canSendEmailType(userId: string, emailType: string): Promise<boolean> {
  const result = await canSendEmail(userId, emailType as EmailType)
  return result.canSend
}

export async function sendEmail(
  userId: string,
  emailType: string,
  customData: Record<string, unknown> = {}
): Promise<EmailSendResult> {
  return sendEmailV2({
    userId,
    emailType: emailType as EmailType,
    customData,
  }) as Promise<EmailSendResult>
}

export async function generateUnsubscribeToken(
  userId: string,
  email: string,
  emailType: string
): Promise<string | null> {
  try {
    return await generateUnsubscribeTokenV2(userId, email, emailType)
  } catch {
    console.warn('⚠️ Error generating unsubscribe token, returning null')
    return null
  }
}

// ============================================
// UNSUBSCRIBE (Supabase - no v2 equivalent yet)
// ============================================

export async function validateUnsubscribeToken(token: string) {
  try {
    const supabase = getSupabase()
    const { data: tokenData, error } = await supabase
      .from('email_unsubscribe_tokens')
      .select(`
        *,
        user_profiles(email, full_name)
      `)
      .eq('token', token)
      .is('used_at', null)
      .gt('expires_at', new Date().toISOString())
      .single()

    if (error || !tokenData) {
      return null
    }

    return {
      userId: tokenData.user_id as string,
      email: tokenData.email as string,
      emailType: tokenData.email_type as string,
      userProfile: tokenData.user_profiles as { email: string; full_name: string } | null,
    }
  } catch (error) {
    console.error('❌ Error validating token:', error)
    return null
  }
}

const VALID_EMAIL_PREF_KEYS = [
  'email_reactivacion',
  'email_urgente',
  'email_bienvenida_motivacional',
  'email_bienvenida_inmediato',
  'email_resumen_semanal',
] as const

export async function processUnsubscribeByToken(
  token: string,
  specificTypes: string[] | null = null,
  unsubscribeAll = false
): Promise<UnsubscribeResult> {
  try {
    const tokenInfo = await validateUnsubscribeToken(token)
    if (!tokenInfo) {
      return {
        success: false,
        error: 'Token inválido, expirado o ya usado',
      }
    }

    const { userId, email, emailType } = tokenInfo
    const updateData: Record<string, boolean | string> = {}

    if (unsubscribeAll) {
      for (const key of VALID_EMAIL_PREF_KEYS) {
        updateData[key] = false
      }
      updateData.unsubscribed_all = true
      updateData.unsubscribed_at = new Date().toISOString()
    } else if (specificTypes) {
      for (const type of specificTypes) {
        const key = `email_${type}`
        if ((VALID_EMAIL_PREF_KEYS as readonly string[]).includes(key)) {
          updateData[key] = false
        }
      }
    } else {
      if (emailType === 'all') {
        for (const key of VALID_EMAIL_PREF_KEYS) {
          updateData[key] = false
        }
        updateData.unsubscribed_all = true
        updateData.unsubscribed_at = new Date().toISOString()
      } else {
        const key = `email_${emailType}`
        if ((VALID_EMAIL_PREF_KEYS as readonly string[]).includes(key)) {
          updateData[key] = false
        }
      }
    }

    const supabase = getSupabase()
    const { error: prefsError } = await supabase
      .from('email_preferences')
      .update({
        ...updateData,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)

    if (prefsError) {
      console.error('❌ Error actualizando preferencias:', prefsError)
      return {
        success: false,
        error: 'Error actualizando preferencias de email',
      }
    }

    // Mark token as used
    await supabase
      .from('email_unsubscribe_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('token', token)

    return {
      success: true,
      message: 'Preferencias de email actualizadas correctamente',
      email,
      updatedPreferences: updateData,
    }
  } catch (error) {
    console.error('❌ Error in processUnsubscribeByToken:', error)
    return {
      success: false,
      error: 'Error interno procesando unsubscribe',
    }
  }
}

// ============================================
// SERVER TEST
// ============================================

export async function testServerConnection() {
  try {
    const supabase = getSupabase()
    await supabase.from('user_profiles').select('id').limit(1)
    return { success: true as const, message: 'Conexión exitosa' }
  } catch (error) {
    return { success: false as const, error: (error as Error).message }
  }
}

// ============================================
// DETECTION FUNCTIONS (Supabase RPCs)
// ============================================

export async function detectInactiveUsers(): Promise<DetectedUser[]> {
  try {
    const supabase = getSupabase()
    const { data: inactiveUsers, error } = await supabase.rpc('get_inactive_users_for_emails')

    if (error) {
      console.error('Error detectando usuarios inactivos:', error)
      return []
    }

    const usersWithEmailPermission: DetectedUser[] = []

    for (const user of inactiveUsers || []) {
      const emailType = user.days_inactive >= 14 ? 'urgente' : 'reactivacion'
      const canSend = await canSendEmailType(user.user_id, emailType)
      if (canSend) {
        usersWithEmailPermission.push(user)
      }
    }

    console.log(`📊 Usuarios inactivos: ${inactiveUsers?.length || 0}, con permiso: ${usersWithEmailPermission.length}`)
    return usersWithEmailPermission
  } catch (error) {
    console.error('Error en detectInactiveUsers:', error)
    return []
  }
}

export async function detectUnmotivatedUsers(): Promise<DetectedUser[]> {
  try {
    const supabase = getSupabase()
    const { data: unmotivatedUsers, error } = await supabase.rpc('get_unmotivated_new_users')

    if (error) {
      console.error('Error detectando usuarios no motivados:', error)
      return []
    }

    const usersWithEmailPermission: DetectedUser[] = []

    for (const user of unmotivatedUsers || []) {
      const canSend = await canSendEmailType(user.user_id, 'bienvenida_motivacional')
      if (canSend) {
        usersWithEmailPermission.push(user)
      }
    }

    console.log(`📊 Usuarios sin empezar: ${unmotivatedUsers?.length || 0}, con permiso: ${usersWithEmailPermission.length}`)
    return usersWithEmailPermission
  } catch (error) {
    console.error('Error en detectUnmotivatedUsers:', error)
    return []
  }
}

export async function detectUsersForEmails(): Promise<EmailQueueItem[]> {
  try {
    const inactiveUsers = await detectInactiveUsers()
    const unmotivatedUsers = await detectUnmotivatedUsers()

    const emailQueue: EmailQueueItem[] = []

    for (const user of inactiveUsers) {
      const emailType = (user.days_inactive || 0) >= 14 ? 'urgente' : 'reactivacion'
      emailQueue.push({
        user,
        emailType,
        priority: (user.days_inactive || 0) >= 14 ? 90 : 70,
        category: 'inactive_user',
      })
    }

    for (const user of unmotivatedUsers) {
      emailQueue.push({
        user,
        emailType: 'bienvenida_motivacional',
        priority: 60,
        category: 'unmotivated_new_user',
      })
    }

    emailQueue.sort((a, b) => b.priority - a.priority)
    console.log(`✅ ${emailQueue.length} usuarios necesitan emails`)
    return emailQueue
  } catch (error) {
    console.error('❌ Error detectando usuarios para emails:', error)
    return []
  }
}

// ============================================
// CAMPAIGN FUNCTIONS
// ============================================

export async function sendWelcomeEmailImmediate(userId: string): Promise<EmailSendResult> {
  try {
    const supabase = getSupabase()
    const { data: existingEmail } = await supabase
      .from('email_logs')
      .select('id')
      .eq('user_id', userId)
      .eq('email_type', 'bienvenida_inmediato')
      .single()

    if (existingEmail) {
      return { success: false, reason: 'already_sent', message: 'Email de bienvenida ya enviado' }
    }

    return await sendEmail(userId, 'bienvenida_inmediato', {})
  } catch (error) {
    console.error('❌ Error enviando email de bienvenida inmediato:', error)
    return { success: false, error: (error as Error).message }
  }
}

export async function runEmailCampaign(): Promise<CampaignResults> {
  try {
    console.log('🚀 Iniciando campaña automática completa...')

    const inactiveUsers = await detectInactiveUsers()
    const unmotivatedUsers = await detectUnmotivatedUsers()

    const totalUsers = inactiveUsers.length + unmotivatedUsers.length

    if (totalUsers === 0) {
      return {
        total: 0, sent: 0, failed: 0, cancelled: 0,
        message: 'No hay usuarios con permisos de email para procesar',
        details: [],
      }
    }

    const results: CampaignResults = {
      total: totalUsers, sent: 0, failed: 0, cancelled: 0, details: [],
    }

    for (const user of inactiveUsers) {
      const emailType = (user.days_inactive || 0) >= 14 ? 'urgente' : 'reactivacion'
      const result = await sendEmail(user.user_id, emailType, {
        daysInactive: user.days_inactive,
      })

      if (result.success) results.sent++
      else if (result.cancelled) results.cancelled++
      else results.failed++

      results.details.push({
        userId: user.user_id,
        email: user.email,
        fullName: user.full_name,
        daysInactive: user.days_inactive,
        emailType,
        category: 'inactive_user',
        success: result.success,
        cancelled: result.cancelled || false,
        error: result.error || null,
        emailId: result.emailId || null,
      })

      await new Promise(resolve => setTimeout(resolve, 300))
    }

    for (const user of unmotivatedUsers) {
      const result = await sendEmail(user.user_id, 'bienvenida_motivacional', {
        daysSince: user.days_since_registration,
      })

      if (result.success) results.sent++
      else if (result.cancelled) results.cancelled++
      else results.failed++

      results.details.push({
        userId: user.user_id,
        email: user.email,
        fullName: user.full_name,
        daysSinceRegistration: user.days_since_registration,
        emailType: 'bienvenida_motivacional',
        category: 'unmotivated_new_user',
        success: result.success,
        cancelled: result.cancelled || false,
        error: result.error || null,
        emailId: result.emailId || null,
      })

      await new Promise(resolve => setTimeout(resolve, 300))
    }

    console.log('🎉 Campaña completa:', {
      total: results.total,
      enviados: results.sent,
      cancelados: results.cancelled,
      fallidos: results.failed,
    })

    return results
  } catch (error) {
    console.error('❌ Error en campaña automática:', error)
    return {
      success: false,
      error: (error as Error).message,
      total: 0, sent: 0, failed: 0, cancelled: 0, details: [],
    }
  }
}

// ============================================
// STATS & HEALTH
// ============================================

export async function getEmailCampaignStats(daysBack = 30) {
  try {
    const supabase = getSupabase()
    const { data: emailStats, error } = await supabase
      .from('email_logs')
      .select('*')
      .gte('sent_at', new Date(Date.now() - (daysBack * 24 * 60 * 60 * 1000)).toISOString())
      .order('sent_at', { ascending: false })

    if (error) {
      console.error('Error obteniendo estadísticas de email:', error)
      return null
    }

    const statsByType: Record<string, { sent: number; opened: number; clicked: number; openRate: number | string; clickRate: number | string }> = {}
    let totalSent = 0
    let totalOpened = 0
    let totalClicked = 0

    for (const email of emailStats || []) {
      const type = email.email_type as string
      if (!statsByType[type]) {
        statsByType[type] = { sent: 0, opened: 0, clicked: 0, openRate: 0, clickRate: 0 }
      }
      statsByType[type].sent++
      totalSent++
      if (email.opened_at) { statsByType[type].opened++; totalOpened++ }
      if (email.clicked_at) { statsByType[type].clicked++; totalClicked++ }
    }

    for (const type of Object.keys(statsByType)) {
      const s = statsByType[type]
      s.openRate = s.sent > 0 ? (s.opened / s.sent * 100).toFixed(1) : 0
      s.clickRate = s.sent > 0 ? (s.clicked / s.sent * 100).toFixed(1) : 0
    }

    return {
      period: `${daysBack} días`,
      overall: {
        totalSent,
        totalOpened,
        totalClicked,
        openRate: totalSent > 0 ? (totalOpened / totalSent * 100).toFixed(1) : 0,
        clickRate: totalSent > 0 ? (totalClicked / totalSent * 100).toFixed(1) : 0,
      },
      byType: statsByType,
      recentEmails: (emailStats || []).slice(0, 10),
    }
  } catch (error) {
    console.error('Error en getEmailCampaignStats:', error)
    return null
  }
}

export async function checkEmailSystemHealth() {
  try {
    const resendConfigured = !!process.env.RESEND_API_KEY
    const supabaseConfigured = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)

    let tablesAccessible = false
    try {
      const supabase = getSupabase()
      const { error: e1 } = await supabase.from('user_profiles').select('id').limit(1)
      const { error: e2 } = await supabase.from('email_preferences').select('id').limit(1)
      const { error: e3 } = await supabase.from('email_logs').select('id').limit(1)
      tablesAccessible = !e1 && !e2 && !e3
    } catch {
      tablesAccessible = false
    }

    let sqlFunctionsWorking = false
    try {
      const supabase = getSupabase()
      const { error } = await supabase.rpc('get_inactive_users_for_emails')
      sqlFunctionsWorking = !error
    } catch {
      sqlFunctionsWorking = false
    }

    const recentStats = await getEmailCampaignStats(7)

    return {
      overall: resendConfigured && supabaseConfigured && tablesAccessible && sqlFunctionsWorking ? 'healthy' : 'issues',
      components: {
        resend: { status: resendConfigured ? 'ok' : 'error', message: resendConfigured ? 'API key configurada' : 'Falta RESEND_API_KEY' },
        supabase: { status: supabaseConfigured ? 'ok' : 'error', message: supabaseConfigured ? 'Configuración correcta' : 'Faltan variables de entorno' },
        database: { status: tablesAccessible ? 'ok' : 'error', message: tablesAccessible ? 'Acceso a todas las tablas' : 'Error accediendo a tablas' },
        functions: { status: sqlFunctionsWorking ? 'ok' : 'error', message: sqlFunctionsWorking ? 'Funciones SQL funcionando' : 'Error en funciones SQL' },
      },
      recentActivity: recentStats,
      timestamp: new Date().toISOString(),
    }
  } catch (error) {
    console.error('❌ Error verificando salud del sistema:', error)
    return {
      overall: 'error',
      error: (error as Error).message,
      timestamp: new Date().toISOString(),
    }
  }
}

export async function cleanupExpiredTokens(): Promise<number> {
  try {
    const supabase = getSupabase()
    const { data, error } = await supabase
      .from('email_unsubscribe_tokens')
      .delete()
      .lt('expires_at', new Date().toISOString())
      .select('count')

    if (error) {
      console.error('❌ Error limpiando tokens:', error)
      return 0
    }

    return data?.length || 0
  } catch (error) {
    console.error('❌ Error en cleanupExpiredTokens:', error)
    return 0
  }
}

// ============================================
// WEEKLY REPORT
// ============================================

export async function detectUsersForWeeklyReport(): Promise<WeeklyReportUser[]> {
  try {
    const supabase = getSupabase()

    const { data: activeUsers, error } = await supabase
      .from('user_profiles')
      .select('id, email, full_name, target_oposicion')
      .eq('is_active_student', true)
      .not('email', 'is', null)

    if (error) {
      console.error('Error obteniendo usuarios activos:', error)
      return []
    }

    const usersForWeeklyReport: WeeklyReportUser[] = []

    for (const user of activeUsers || []) {
      try {
        const canSend = await canSendEmailType(user.id, 'resumen_semanal')
        if (!canSend) continue

        const { data: recentEmail } = await supabase
          .from('email_logs')
          .select('id')
          .eq('user_id', user.id)
          .eq('email_type', 'resumen_semanal')
          .gte('sent_at', new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString())
          .single()

        if (recentEmail) continue

        const { data: problematicArticles, error: articlesError } = await supabase
          .rpc('get_user_problematic_articles_weekly', { user_uuid: user.id })

        if (articlesError) continue

        if (problematicArticles && problematicArticles.length > 0) {
          usersForWeeklyReport.push({
            ...user,
            problematicArticles,
            articlesCount: problematicArticles.length,
          })
        }
      } catch {
        continue
      }
    }

    console.log(`📧 ${usersForWeeklyReport.length} usuarios necesitan resumen semanal`)
    return usersForWeeklyReport
  } catch (error) {
    console.error('❌ Error en detectUsersForWeeklyReport:', error)
    return []
  }
}

export async function sendWeeklyReportEmail(
  userId: string,
  articlesData: { article_id: string; [key: string]: unknown }[] = []
): Promise<EmailSendResult> {
  try {
    const supabase = getSupabase()

    // Check if already sent this week
    const { data: recentEmail } = await supabase
      .from('email_logs')
      .select('id')
      .eq('user_id', userId)
      .eq('email_type', 'resumen_semanal')
      .gte('sent_at', new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString())
      .single()

    if (recentEmail) {
      return { success: false, reason: 'already_sent', message: 'Resumen semanal ya enviado esta semana' }
    }

    const canSend = await canSendEmailType(userId, 'resumen_semanal')
    if (!canSend) {
      return {
        success: false,
        cancelled: true,
        reason: 'user_unsubscribed',
        message: 'Usuario ha desactivado emails semanales',
      }
    }

    const { data: user, error: userError } = await supabase
      .from('user_profiles')
      .select('email, full_name, target_oposicion')
      .eq('id', userId)
      .single()

    if (userError || !user) {
      throw new Error(`Usuario ${userId} no encontrado: ${userError?.message}`)
    }

    // resumen_semanal template takes 5 args (the 5th being articlesData)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const template = (emailTemplates as any)['resumen_semanal']
    if (!template) {
      throw new Error('Template resumen_semanal no encontrado')
    }

    const userName = user.full_name || 'Estudiante'
    const baseUrl = 'https://www.vence.es'
    const articleIds = articlesData.map(a => a.article_id).join(',')
    const testUrl = `${baseUrl}/auxiliar-administrativo-estado/test/articulos-dirigido?articles=${encodeURIComponent(articleIds)}&utm_source=email&utm_campaign=resumen_semanal`

    const unsubscribeToken = await generateUnsubscribeToken(userId, user.email, 'resumen_semanal')
    const unsubscribeUrl = unsubscribeToken
      ? getUnsubscribeUrl(unsubscribeToken)
      : `${baseUrl}/perfil?tab=emails&utm_source=email_unsubscribe`

    const subject = template.subject(userName, articlesData.length) as string
    const html = template.html(userName, 0, testUrl, unsubscribeUrl, articlesData) as string

    const resend = getResend()
    const emailResponse = await resend.emails.send({
      from: `${process.env.EMAIL_FROM_NAME || 'Vence'} <${process.env.EMAIL_FROM_ADDRESS || 'info@vence.es'}>`,
      to: user.email,
      subject,
      html,
    })

    if (emailResponse.error) {
      throw new Error(`Resend error: ${emailResponse.error.message || emailResponse.error}`)
    }

    // Log to email_logs
    const { error: logError } = await supabase
      .from('email_logs')
      .insert({
        user_id: userId,
        email_type: 'resumen_semanal',
        subject,
        status: 'sent',
      })

    if (logError) {
      console.error('⚠️ Error registrando email log:', logError)
    }

    return {
      success: true,
      emailId: emailResponse.data?.id,
      unsubscribeToken,
      message: `Resumen semanal enviado a ${user.email}`,
      details: {
        to: user.email,
        subject,
        testUrl,
        unsubscribeUrl,
        resendId: emailResponse.data?.id,
        articlesCount: articlesData.length,
      },
    }
  } catch (error) {
    console.error('❌ Error enviando resumen semanal:', error)
    return { success: false, error: (error as Error).message }
  }
}

export async function runWeeklyReportCampaign(): Promise<CampaignResults> {
  try {
    console.log('🚀 Iniciando campaña de resumenes semanales...')

    const usersForWeeklyReport = await detectUsersForWeeklyReport()

    if (usersForWeeklyReport.length === 0) {
      return {
        total: 0, sent: 0, failed: 0, cancelled: 0,
        message: 'No hay usuarios que necesiten resumen semanal',
        details: [],
      }
    }

    const results: CampaignResults = {
      total: usersForWeeklyReport.length, sent: 0, failed: 0, cancelled: 0, details: [],
    }

    for (const user of usersForWeeklyReport) {
      const result = await sendWeeklyReportEmail(user.id, user.problematicArticles)

      if (result.success) results.sent++
      else if (result.cancelled) results.cancelled++
      else results.failed++

      results.details.push({
        userId: user.id,
        email: user.email,
        fullName: user.full_name,
        articlesCount: user.articlesCount,
        emailType: 'resumen_semanal',
        category: 'weekly_report',
        success: result.success,
        cancelled: result.cancelled || false,
        error: result.error || null,
        emailId: result.emailId || null,
      })

      await new Promise(resolve => setTimeout(resolve, 500))
    }

    console.log('🎉 Campaña de resumenes semanales finalizada:', {
      total: results.total,
      enviados: results.sent,
      cancelados: results.cancelled,
      fallidos: results.failed,
    })

    return results
  } catch (error) {
    console.error('❌ Error en campaña de resumenes semanales:', error)
    return {
      success: false,
      error: (error as Error).message,
      total: 0, sent: 0, failed: 0, cancelled: 0, details: [],
    }
  }
}

// ============================================
// BACKWARD COMPAT: EmailService class
// ============================================

export class EmailService {
  templates = {
    reactivation_urgent: {
      subject: '¡Te echamos de menos! Tu progreso en Vence te espera',
      type: 'reactivation',
      trigger: { days_inactive: 7, max_days: 14 },
    },
    reactivation_gentle: {
      subject: 'Te hemos preparado algo especial',
      type: 'reactivation',
      trigger: { days_inactive: 3, max_days: 7 },
    },
  }

  async detectUsersForEmails() {
    return detectUsersForEmails()
  }

  async runEmailCampaign() {
    return runEmailCampaign()
  }
}

export const emailService = new EmailService()
