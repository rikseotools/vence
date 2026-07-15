// app/api/admin/delete-user/route.ts
import { NextResponse, type NextRequest } from 'next/server'
import { deleteUserRequestSchema } from '@/lib/api/admin-delete-user/schemas'
import { deleteUserData, ensureDeletionLogRow, sendDeletionConfirmationEmail } from '@/lib/api/admin-delete-user'
import { authAdmin } from '@/lib/auth/server'
import { requireAdmin } from '@/lib/api/shared/auth'
import { getAdminDb } from '@/db/client'
import { userProfiles } from '@/db/schema'
import { eq, sql } from 'drizzle-orm'

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
    let userPlanType: string | null = null
    let userTargetOposicion: string | null = null
    let userRegisteredAt: string | null = null
    // Reintento de una cuenta ya borrada: se salta la llamada al borrado (idempotencia real).
    let alreadyDeleted = false
    try {
      const [profile] = await getAdminDb()
        .select({
          email: userProfiles.email,
          full_name: userProfiles.fullName,
          plan_type: userProfiles.planType,
          target_oposicion: userProfiles.targetOposicion,
          created_at: userProfiles.createdAt,
        })
        .from(userProfiles)
        .where(eq(userProfiles.id, userId))
        .limit(1)

      if (profile) {
        userEmail = profile.email
        userFullName = profile.full_name
        userPlanType = profile.plan_type
        userTargetOposicion = profile.target_oposicion
        userRegisteredAt = profile.created_at
      }
    } catch (err) {
      console.warn('⚠️ No se pudo leer perfil antes de delete:', err)
    }

    // 🔒 CAPA DE SEGURIDAD (RGPD + requisito de delete_user_account): la fila de
    // auditoría `deleted_users_log` DEBE existir ANTES del borrado (la fn SQL escribe
    // archived_data en ella y falla si no está; y el email de esa fila es la fuente
    // DURABLE del correo RGPD en reintentos). FAIL-CLOSED: si no hay email de perfil
    // o el insert falla, ABORTAMOS (nunca borrar sin registro de auditoría). Idempotente.
    if (userEmail) {
      // Perfil presente → asegurar la fila de auditoría ANTES del borrado (fail-closed).
      try {
        const logResult = await ensureDeletionLogRow(
          userId,
          {
            email: userEmail,
            fullName: userFullName,
            planType: userPlanType,
            targetOposicion: userTargetOposicion,
            registeredAt: userRegisteredAt,
          },
          { requestedVia: 'admin_panel', adminEmail: auth.user.email }
        )
        console.log(`🧾 deleted_users_log ${logResult.inserted ? 'insertada' : 'ya existía (idempotente)'} para ${userId}`)
      } catch (logErr) {
        console.error('❌ No se pudo crear el registro de auditoría deleted_users_log:', logErr)
        return NextResponse.json(
          {
            success: false,
            error: 'No se pudo crear el registro de auditoría previo al borrado. Borrado abortado (fail-closed).',
            details: logErr instanceof Error ? logErr.message : String(logErr),
          },
          { status: 500 }
        )
      }
    } else {
      // Sin email de perfil = perfil AUSENTE (¿ya borrado en un intento previo?) o pre-read
      // fallido. NO abortar en seco: si YA existe la fila de auditoría para este userId es un
      // REINTENTO de una cuenta ya borrada → NO se re-invoca delete_user_account (LANZARÍA
      // `no_data_found`: su primer statement exige que user_profiles exista, ver migración
      // 20260626 líneas 45-46) → se marca `alreadyDeleted` para SALTARSE el borrado y solo
      // confirmar + reenviar el email RGPD durable. Solo se aborta 409 si NO hay ni perfil ni
      // fila de log (usuario inexistente / read fallido en 1er intento).
      let hasLogRow = false
      try {
        const res = await getAdminDb().execute(
          sql`SELECT 1 FROM public.deleted_users_log WHERE original_user_id = ${userId}::uuid LIMIT 1`
        )
        const rows = Array.isArray(res) ? res : ((res as { rows?: unknown[] }).rows || [])
        hasLogRow = rows.length > 0
      } catch (err) {
        console.error('❌ No se pudo comprobar deleted_users_log (fail-closed → abortar):', err)
      }
      if (!hasLogRow) {
        console.error('❌ delete-user abortado: sin perfil y sin fila de auditoría previa para', userId)
        return NextResponse.json(
          {
            success: false,
            error:
              'No se pudo capturar el perfil (email) y no existe registro de auditoría previo para este userId. Borrado abortado: el usuario no existe o no se pudo leer. Verifica el userId y reintenta.',
          },
          { status: 409 }
        )
      }
      alreadyDeleted = true
      console.log(`♻️ Perfil ausente pero deleted_users_log ya existe para ${userId} → reintento idempotente (se salta el borrado, ya hecho)`)
    }

    // Eliminar datos (SSOT: user_profiles + cascada, RDS) — SALVO que sea un reintento de una
    // cuenta ya borrada: delete_user_account() lanzaría `no_data_found` (exige user_profiles),
    // así que en ese caso se salta (idempotencia real; el estado ya es "borrado").
    // NOTA (follow-up, no bloqueante): en el caso raro de reintentar tras un 500 cuyo email SÍ
    // se envió (p.ej. error del store de auth legacy), el email RGPD se reenvía → un duplicado.
    // Un marcador durable `rgpd_email_sent_at` en deleted_users_log lo haría exactly-once (migración).
    const deletionResults = alreadyDeleted
      ? [{
          table: '_delete_user_account',
          status: 'skipped' as const,
          reason: 'cuenta ya borrada (reintento idempotente); no se re-invoca delete_user_account',
        }]
      : await deleteUserData(userId)

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
    // Falla CERRADO: si la verificación NO se puede leer (blip de pool, timeout,
    // failover), "desconocido" ≠ "borrado" → asumimos que el perfil PODRÍA seguir
    // vivo (profileStillExists=true) para NO reportar éxito ni mandar el email RGPD
    // sin haber confirmado el borrado. Es la fuente de verdad del éxito; no puede
    // fallar abierto sobre el eje que precisamente vigila.
    let profileStillExists = true
    try {
      const [profileAfter] = await getAdminDb()
        .select({ id: userProfiles.id })
        .from(userProfiles)
        .where(eq(userProfiles.id, userId))
        .limit(1)
      profileStillExists = !!profileAfter
    } catch (err) {
      console.error('❌ Error verificando user_profiles post-delete (fail-closed → no éxito):', err)
      // profileStillExists queda true → success=false, sin email prematuro.
    }
    const accountDeleted = !profileStillExists

    // Email RGPD (Art. 12.3) — OBLIGATORIO. Se envía cuando la CUENTA está borrada
    // (user_profiles ya no existe), con independencia del store de auth legacy.
    //
    // DURABILIDAD (F3): el pre-read de user_profiles captura el email en el 1er
    // intento, pero si el envío falla y el admin REINTENTA, user_profiles ya no
    // existe → userEmail=null → el email legal se perdería para siempre. Como la
    // fn SQL exige que `deleted_users_log` (con el email) exista ANTES de borrar,
    // ese email es DURABLE → lo usamos de fuente cuando el pre-read viene vacío.
    let recipientEmail = userEmail
    let recipientName = userFullName
    if (accountDeleted && !recipientEmail) {
      try {
        const res = await getAdminDb().execute(
          sql`SELECT email, full_name FROM deleted_users_log WHERE original_user_id = ${userId}::uuid ORDER BY deleted_at DESC LIMIT 1`,
        )
        const row = (Array.isArray(res) ? res : (res as { rows?: unknown[] }).rows || [])[0] as
          | { email: string | null; full_name: string | null }
          | undefined
        if (row?.email) {
          recipientEmail = row.email
          recipientName = row.full_name ?? recipientName
        }
      } catch (err) {
        console.error('❌ Error leyendo email durable de deleted_users_log:', err)
      }
    }

    if (accountDeleted && recipientEmail) {
      const emailResult = await sendDeletionConfirmationEmail({
        email: recipientEmail,
        fullName: recipientName,
      })
      deletionResults.push({
        table: '_deletion_email',
        status: emailResult.sent ? 'deleted' : 'error',
        reason: emailResult.sent ? `emailId: ${emailResult.emailId}` : undefined,
        error: emailResult.error,
      })
    } else if (accountDeleted && !recipientEmail) {
      console.warn('⚠️ Cuenta eliminada pero sin email disponible (ni user_profiles ni deleted_users_log) para el RGPD')
      deletionResults.push({
        table: '_deletion_email',
        status: 'error',
        reason: 'email no disponible en user_profiles ni deleted_users_log',
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
