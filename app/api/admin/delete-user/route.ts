// app/api/admin/delete-user/route.ts
import { NextResponse, type NextRequest } from 'next/server'
import { deleteUserRequestSchema } from '@/lib/api/admin-delete-user/schemas'
import { deleteUserData, sendDeletionConfirmationEmail } from '@/lib/api/admin-delete-user'
import { authAdmin } from '@/lib/auth/server'
import { requireAdmin } from '@/lib/api/shared/auth'
import { getAdminDb } from '@/db/client'
import { userProfiles } from '@/db/schema'
import { eq } from 'drizzle-orm'

import { withErrorLogging } from '@/lib/api/withErrorLogging'
async function _DELETE(request: NextRequest) {
  try {
    // 🔒 Endpoint destructivo e irreversible (borra cualquier cuenta por userId).
    // Sin este guard era invocable SIN autenticación (no hay middleware /api/admin/*).
    // Requiere Bearer token de un email admin (whitelist en requireAdmin).
    const auth = await requireAdmin(request)
    if (!auth.ok) return auth.response

    const body = await request.json()
    const parsed = deleteUserRequestSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'userId es requerido' },
        { status: 400 }
      )
    }

    const { userId } = parsed.data

    // Capturar datos del usuario ANTES del borrado (para enviar email de
    // confirmación RGPD posteriormente, cuando user_profiles ya no exista).
    // Lecturas de user_profiles por Drizzle; el borrado de auth.users por el
    // puerto agnóstico `authAdmin` (Fase 4 D).
    let userEmail: string | null = null
    let userFullName: string | null = null
    try {
      const [profile] = await getAdminDb()
        .select({ email: userProfiles.email, full_name: userProfiles.fullName })
        .from(userProfiles)
        .where(eq(userProfiles.id, userId))
        .limit(1)

      if (profile) {
        userEmail = profile.email
        userFullName = profile.full_name
      }
    } catch (err) {
      console.warn('⚠️ No se pudo leer perfil antes de delete:', err)
    }

    // Eliminar datos de todas las tablas (SSOT de la cuenta: user_profiles + cascada, RDS)
    const deletionResults = await deleteUserData(userId)

    // Revocar identidad en el store de auth LEGACY (Supabase GoTrue). Tras el flip
    // a Auth.js (Fase B) el SSOT de la cuenta es user_profiles (RDS, por email) y
    // los usuarios NUEVOS no tienen fila GoTrue → este paso es limpieza best-effort:
    //   - 'not_present' (post-flip / ya ausente) = ESPERADO, no es fallo.
    //   - 'error' (fallo real: red/permisos) = crítico, el registro legacy pervive.
    // ANTES se gateaba el éxito y el email RGPD por el borrado en Supabase, así que
    // todo usuario post-flip reportaba 500 y NUNCA recibía el email (bug 09/07/2026).
    let authOutcome: 'deleted' | 'not_present' | 'error' | 'exception' = 'exception'
    try {
      const authRes = await authAdmin.deleteUser(userId)
      authOutcome = authRes.outcome
      if (authRes.outcome === 'deleted') {
        console.log('✅ Identidad legacy (Supabase) eliminada')
        deletionResults.push({ table: 'auth.users', status: 'deleted' })
      } else if (authRes.outcome === 'not_present') {
        console.log('ℹ️ Sin identidad en el store legacy (usuario post-flip / ya ausente) — nada que revocar')
        deletionResults.push({
          table: 'auth.users',
          status: 'skipped',
          reason: 'sin registro en el store de auth legacy (Supabase): usuario post-flip o ya ausente',
        })
      } else {
        console.error('❌ Error REAL eliminando identidad legacy (Supabase):', authRes.error)
        deletionResults.push({ table: 'auth.users', status: 'error', error: authRes.error?.message })
      }
    } catch (authErr) {
      console.error('❌ Excepción eliminando identidad legacy:', authErr)
      deletionResults.push({
        table: 'auth.users',
        status: 'exception',
        error: authErr instanceof Error ? authErr.message : 'Unknown error'
      })
    }

    // Verificación por SSOT: la cuenta está borrada cuando user_profiles ya no
    // existe. Los triggers materializadores (`20260523_materialized_stats_triggers.sql`)
    // pueden re-poblar stats durante la cascada → esta comprobación es la FUENTE DE
    // VERDAD del éxito, no la ausencia de excepciones ni el store de auth legacy.
    let profileStillExists = false
    try {
      const [profileAfter] = await getAdminDb()
        .select({ id: userProfiles.id })
        .from(userProfiles)
        .where(eq(userProfiles.id, userId))
        .limit(1)
      profileStillExists = !!profileAfter
    } catch (err) {
      console.error('❌ Error verificando user_profiles post-delete:', err)
    }
    const accountDeleted = !profileStillExists

    // Email RGPD (Art. 12.3) — OBLIGATORIO. Se envía cuando la CUENTA está borrada
    // (user_profiles ya no existe), con independencia del store de auth legacy: un
    // usuario post-flip no tiene fila GoTrue y aun así su cuenta (sus datos) SÍ se
    // ha eliminado. No rompe el flujo si falla: log + continúa.
    if (accountDeleted && userEmail) {
      const emailResult = await sendDeletionConfirmationEmail({
        email: userEmail,
        fullName: userFullName,
      })
      deletionResults.push({
        table: '_deletion_email',
        status: emailResult.sent ? 'deleted' : 'error',
        reason: emailResult.sent ? `emailId: ${emailResult.emailId}` : undefined,
        error: emailResult.error,
      })
    } else if (accountDeleted && !userEmail) {
      console.warn('⚠️ Cuenta eliminada pero sin email disponible para el RGPD')
      deletionResults.push({
        table: '_deletion_email',
        status: 'skipped',
        reason: 'email no disponible antes del borrado',
      })
    }

    // Éxito = la cuenta ya no existe en el SSOT + sin errores CRÍTICOS. Un fallo
    // real del store legacy o de una tabla cuenta como crítico; 'skipped'/'deleted'
    // no. Un email RGPD fallido (status 'error') también marca 500 → se reintenta.
    const criticalErrors = deletionResults.filter(
      r => r.status === 'error' || r.status === 'exception'
    )
    const success = accountDeleted && criticalErrors.length === 0
    const httpStatus = success ? 200 : 500

    console.log(
      success
        ? `🗑️ Eliminación completada para usuario: ${userId} (auth legacy: ${authOutcome})`
        : `❌ Eliminación incompleta para ${userId} — profile=${profileStillExists ? 'EXISTE' : 'borrado'} errors=${criticalErrors.length} authLegacy=${authOutcome}`
    )

    return NextResponse.json(
      {
        success,
        message: success
          ? 'Usuario eliminado correctamente'
          : 'Eliminación incompleta: revisa details y aplica fallback manual',
        profileDeleted: accountDeleted,
        authLegacy: authOutcome,
        criticalErrors: criticalErrors.length,
        details: deletionResults,
      },
      { status: httpStatus }
    )

  } catch (error) {
    console.error('❌ Error inesperado eliminando usuario:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export const DELETE = withErrorLogging('/api/admin/delete-user', _DELETE)
