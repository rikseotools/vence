import 'server-only'
import { Resend } from 'resend'
import { createClient } from '@supabase/supabase-js'
import { eq, and, gt, gte, lt, isNull, isNotNull, desc, sql } from 'drizzle-orm'
import { getAdminDb } from '@/db/client'
import {
  emailLogs,
  emailEvents,
  emailPreferences,
  emailUnsubscribeTokens,
  userProfiles,
} from '@/db/schema'
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
import { getUserProblematicArticlesWeekly } from '@/lib/api/notifications/queries'
import { isInProblematicArticlesRollout } from '@/lib/api/rollout/problematic-articles'
import { logRolloutEvent } from '@/lib/api/rollout/problematic-articles-logs'

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
  errorCode?: 'invalid_token' | 'db_error' | 'internal_error'
  message?: string
  email?: string
  updatedPreferences?: Record<string, boolean | string>
  warnings?: string[]
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

export interface ValidateTokenOk {
  ok: true
  userId: string
  email: string
  emailType: string
  userProfile: { email: string; full_name: string } | null
}
export interface ValidateTokenErr {
  ok: false
  code: 'not_found' | 'db_error'
  error: string
  dbError?: unknown
}
export type ValidateTokenResult = ValidateTokenOk | ValidateTokenErr

export async function validateUnsubscribeToken(token: string): Promise<ValidateTokenResult> {
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

    if (error) {
      // PGRST116 = no rows returned (token no existe, expirado o ya usado)
      if ((error as { code?: string }).code === 'PGRST116') {
        return { ok: false, code: 'not_found', error: 'Token inválido, expirado o ya usado' }
      }
      console.error('❌ [validateUnsubscribeToken] DB error:', error)
      return { ok: false, code: 'db_error', error: 'Error consultando token en BD', dbError: error }
    }
    if (!tokenData) {
      return { ok: false, code: 'not_found', error: 'Token inválido, expirado o ya usado' }
    }

    return {
      ok: true,
      userId: tokenData.user_id as string,
      email: tokenData.email as string,
      emailType: tokenData.email_type as string,
      userProfile: tokenData.user_profiles as { email: string; full_name: string } | null,
    }
  } catch (error) {
    console.error('❌ [validateUnsubscribeToken] Exception:', error)
    return { ok: false, code: 'db_error', error: 'Error interno validando token', dbError: error }
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
  unsubscribeAll = false,
  categories: string[] | null = null
): Promise<UnsubscribeResult> {
  try {
    const tokenResult = await validateUnsubscribeToken(token)
    if (!tokenResult.ok) {
      return {
        success: false,
        error: tokenResult.error,
        errorCode: tokenResult.code === 'db_error' ? 'db_error' : 'invalid_token',
      }
    }

    const { userId, email, emailType } = tokenResult
    const updateData: Record<string, boolean | string> = {}

    if (unsubscribeAll) {
      // Nuclear: disable everything
      for (const key of VALID_EMAIL_PREF_KEYS) {
        updateData[key] = false
      }
      updateData.unsubscribed_all = true
      updateData.email_newsletter_disabled = true
      updateData.email_soporte_disabled = true
      updateData.unsubscribed_at = new Date().toISOString()
    } else if (categories && categories.length > 0) {
      // Category-based unsubscribe
      if (categories.includes('marketing')) {
        for (const key of VALID_EMAIL_PREF_KEYS) {
          updateData[key] = false
        }
        updateData.unsubscribed_all = true
        updateData.unsubscribed_at = new Date().toISOString()
      }
      if (categories.includes('newsletter')) {
        updateData.email_newsletter_disabled = true
      }
      if (categories.includes('soporte')) {
        updateData.email_soporte_disabled = true
      }
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

    // ⚠️ NO migrado a Drizzle (Fase 3 strangler fig agnosticismo-supabase):
    // los tests __tests__/emails/unsubscribeFlow.test.ts mockean
    // @supabase/supabase-js (no Drizzle/Postgres) para simular escenarios
    // específicos de error (prefsUpdateError, markUsedError). Migrar este
    // código sin actualizar también los mocks del test rompe la suite (4
    // tests fallidos en el primer intento).
    // Para migrar correctamente, en próximo PR:
    //   1. Cambiar el mock del test a mockear @/db/client (getAdminDb).
    //   2. Cambiar el shape de mocks para que devuelvan promesas Drizzle-like.
    //   3. Migrar el código aquí.
    const supabase = getSupabase()
    const { error: prefsError } = await supabase
      .from('email_preferences')
      .update({
        ...updateData,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)

    if (prefsError) {
      console.error('❌ [processUnsubscribeByToken] DB error updating email_preferences', {
        userId,
        email,
        updateData,
        error: prefsError,
      })
      return {
        success: false,
        error: 'Error actualizando preferencias de email',
        errorCode: 'db_error',
      }
    }

    // Mark token as used — no fatal si falla (baja ya aplicada) pero MUST ser traceable
    const warnings: string[] = []
    const { error: markUsedError } = await supabase
      .from('email_unsubscribe_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('token', token)

    if (markUsedError) {
      // CRÍTICO: token sigue siendo reutilizable hasta que expire.
      // La baja ya está aplicada, así que no revertimos; solo queremos rastro.
      console.error('❌ [processUnsubscribeByToken] Failed to mark token as used (token reusable until expiry)', {
        userId,
        email,
        token: token.slice(0, 8) + '...',
        error: markUsedError,
      })
      warnings.push('mark_token_used_failed')
    }

    return {
      success: true,
      message: 'Preferencias de email actualizadas correctamente',
      email,
      updatedPreferences: updateData,
      ...(warnings.length > 0 ? { warnings } : {}),
    }
  } catch (error) {
    console.error('❌ [processUnsubscribeByToken] Unhandled exception:', error)
    return {
      success: false,
      error: 'Error interno procesando unsubscribe',
      errorCode: 'internal_error',
    }
  }
}

// ============================================
// SERVER TEST
// ============================================

export async function testServerConnection() {
  try {
    // Health check: cualquier SELECT 1 fila a una tabla cualquiera vale.
    const db = getAdminDb()
    await db.select({ id: userProfiles.id }).from(userProfiles).limit(1)
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
    // RPC PostgREST → db.execute (RETURNS TABLE → array de filas snake_case,
    // idéntico a lo que devolvía supabase.rpc).
    let inactiveUsers: DetectedUser[] | null = null
    let error: unknown = null
    try {
      inactiveUsers = (await getAdminDb().execute(sql`SELECT * FROM get_inactive_users_for_emails()`)) as unknown as DetectedUser[]
    } catch (e) {
      error = e
    }

    if (error) {
      console.error('Error detectando usuarios inactivos:', error)
      return []
    }

    const usersWithEmailPermission: DetectedUser[] = []

    for (const user of inactiveUsers || []) {
      const emailType = (user.days_inactive ?? 0) >= 14 ? 'urgente' : 'reactivacion'
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
    let unmotivatedUsers: DetectedUser[] | null = null
    let error: unknown = null
    try {
      unmotivatedUsers = (await getAdminDb().execute(sql`SELECT * FROM get_unmotivated_new_users()`)) as unknown as DetectedUser[]
    } catch (e) {
      error = e
    }

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
    // Comprobar si ya se envió antes (idempotencia). Solo necesitamos ≥1 fila.
    const db = getAdminDb()
    const existing = await db
      .select({ id: emailLogs.id })
      .from(emailLogs)
      .where(and(
        eq(emailLogs.userId, userId),
        eq(emailLogs.emailType, 'bienvenida_inmediato'),
      ))
      .limit(1)

    if (existing.length > 0) {
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
    const db = getAdminDb()
    let emailStats: Array<Record<string, unknown>>
    try {
      const since = new Date(Date.now() - (daysBack * 24 * 60 * 60 * 1000)).toISOString()
      emailStats = await db
        .select()
        .from(emailLogs)
        .where(gte(emailLogs.sentAt, since))
        .orderBy(desc(emailLogs.sentAt)) as Array<Record<string, unknown>>
    } catch (error) {
      console.error('Error obteniendo estadísticas de email:', error)
      return null
    }

    const statsByType: Record<string, { sent: number; opened: number; clicked: number; openRate: number | string; clickRate: number | string }> = {}
    let totalSent = 0
    let totalOpened = 0
    let totalClicked = 0

    for (const email of emailStats || []) {
      // Drizzle devuelve camelCase (emailType, openedAt, clickedAt), no snake_case.
      const type = email.emailType as string
      if (!statsByType[type]) {
        statsByType[type] = { sent: 0, opened: 0, clicked: 0, openRate: 0, clickRate: 0 }
      }
      statsByType[type].sent++
      totalSent++
      if (email.openedAt) { statsByType[type].opened++; totalOpened++ }
      if (email.clickedAt) { statsByType[type].clicked++; totalClicked++ }
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
      // Health check: SELECT 1 row from cada tabla. Si todas responden → tablas accesibles.
      const db = getAdminDb()
      await Promise.all([
        db.select({ id: userProfiles.id }).from(userProfiles).limit(1),
        db.select({ id: emailPreferences.id }).from(emailPreferences).limit(1),
        db.select({ id: emailLogs.id }).from(emailLogs).limit(1),
      ])
      tablesAccessible = true
    } catch {
      tablesAccessible = false
    }

    let sqlFunctionsWorking = false
    try {
      await getAdminDb().execute(sql`SELECT * FROM get_inactive_users_for_emails()`)
      sqlFunctionsWorking = true
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
    const db = getAdminDb()
    const deleted = await db
      .delete(emailUnsubscribeTokens)
      .where(lt(emailUnsubscribeTokens.expiresAt, new Date().toISOString()))
      .returning({ id: emailUnsubscribeTokens.id })
    return deleted.length
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
    const db = getAdminDb()

    let activeUsers: Array<{ id: string; email: string; full_name: string | null; target_oposicion: string | null }>
    try {
      const rows = await db
        .select({
          id: userProfiles.id,
          email: userProfiles.email,
          full_name: userProfiles.fullName,
          target_oposicion: userProfiles.targetOposicion,
        })
        .from(userProfiles)
        .where(and(
          eq(userProfiles.isActiveStudent, true),
          isNotNull(userProfiles.email),
        ))
      activeUsers = rows as typeof activeUsers
    } catch (error) {
      console.error('Error obteniendo usuarios activos:', error)
      return []
    }

    const usersForWeeklyReport: WeeklyReportUser[] = []

    for (const user of activeUsers || []) {
      try {
        const canSend = await canSendEmailType(user.id, 'resumen_semanal')
        if (!canSend) continue

        // Check si se envió esta semana — ≥1 fila ya basta.
        const recent = await db
          .select({ id: emailLogs.id })
          .from(emailLogs)
          .where(and(
            eq(emailLogs.userId, user.id),
            eq(emailLogs.emailType, 'resumen_semanal'),
            gte(emailLogs.sentAt, new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString()),
          ))
          .limit(1)

        if (recent.length > 0) continue

        // Despliegue gradual. Ver docs/maintenance/despliegue-articulos-problematicos.md
        let problematicArticles: any[] = []
        const startedAt = Date.now()
        const usingNewPath = isInProblematicArticlesRollout(user.id)
        try {
          if (usingNewPath) {
            problematicArticles = await getUserProblematicArticlesWeekly({ userId: user.id })
          } else {
            // RPC legacy PostgREST → db.execute. Un fallo lanza → lo captura
            // el catch externo (continue), igual que el `if (articlesError) continue`.
            const rows = await getAdminDb().execute(sql`SELECT * FROM get_user_problematic_articles_weekly(${user.id}::uuid)`)
            problematicArticles = (rows as unknown as any[]) ?? []
          }
        } catch (e) {
          console.warn('⚠️ problematic-articles fetch falló:', (e as Error).message)
          continue
        }
        logRolloutEvent({
          userId: user.id,
          path: usingNewPath ? 'new' : 'old',
          articlesCount: problematicArticles.length,
          lawNames: problematicArticles.map((a: any) => a.law_name).filter(Boolean),
          durationMs: Date.now() - startedAt,
        })

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
    const db = getAdminDb()

    // Check if already sent this week — ≥1 fila basta.
    const recent = await db
      .select({ id: emailLogs.id })
      .from(emailLogs)
      .where(and(
        eq(emailLogs.userId, userId),
        eq(emailLogs.emailType, 'resumen_semanal'),
        gte(emailLogs.sentAt, new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString()),
      ))
      .limit(1)

    if (recent.length > 0) {
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

    // Cargar datos del user (legacy single-fetch — preservamos el throw si no
    // existe vs error transitorio: ambos hacen throw aquí, así que NO depende
    // de discriminación PGRST116).
    type UserRow = { email: string; full_name: string | null; target_oposicion: string | null }
    let user: UserRow
    try {
      const userRows = await db
        .select({
          email: userProfiles.email,
          full_name: userProfiles.fullName,
          target_oposicion: userProfiles.targetOposicion,
        })
        .from(userProfiles)
        .where(eq(userProfiles.id, userId))
        .limit(1)
      const row = userRows[0]
      if (!row) throw new Error(`Usuario ${userId} no encontrado`)
      user = row as UserRow
    } catch (err) {
      throw new Error(`Usuario ${userId} no encontrado: ${err instanceof Error ? err.message : String(err)}`)
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
      headers: {
        'List-Unsubscribe': `<${unsubscribeUrl}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
    })

    if (emailResponse.error) {
      throw new Error(`Resend error: ${emailResponse.error.message || emailResponse.error}`)
    }

    // Log to email_logs + email_events (Drizzle INSERTs en paralelo).
    // Promise.allSettled → un fallo en uno no impide el otro ni rompe el flujo.
    const [logResult, eventResult] = await Promise.allSettled([
      db.insert(emailLogs).values({
        userId,
        emailType: 'resumen_semanal',
        subject,
        status: 'sent',
      }),
      db.insert(emailEvents).values({
        userId,
        emailType: 'resumen_semanal',
        eventType: 'sent',
        emailAddress: user.email,
        subject,
      }),
    ])

    if (logResult.status === 'rejected') {
      console.error('⚠️ Error registrando email log:', logResult.reason)
    }
    if (eventResult.status === 'rejected') {
      console.error('⚠️ Error registrando email event:', eventResult.reason)
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
