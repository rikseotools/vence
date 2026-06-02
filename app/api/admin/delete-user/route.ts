// app/api/admin/delete-user/route.ts
import { NextResponse } from 'next/server'
import { deleteUserRequestSchema } from '@/lib/api/admin-delete-user/schemas'
import { deleteUserData, sendDeletionConfirmationEmail } from '@/lib/api/admin-delete-user'
import { getServiceClient } from '@/lib/api/shared/auth'
import { getAdminDb } from '@/db/client'
import { userProfiles } from '@/db/schema'
import { eq } from 'drizzle-orm'

import { withErrorLogging } from '@/lib/api/withErrorLogging'
async function _DELETE(request: Request) {
  try {
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
    // `supabase` se mantiene SOLO para auth.admin.deleteUser (Auth = Fase 4);
    // las lecturas de user_profiles van por Drizzle.
    const supabase = getServiceClient()
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

    // Eliminar datos de todas las tablas
    const deletionResults = await deleteUserData(userId)

    // Eliminar de auth.users (requiere Supabase Admin API)
    let authDeleted = false
    try {
      const { error: authError } = await supabase.auth.admin.deleteUser(userId)

      if (authError) {
        console.error('❌ Error eliminando de auth.users:', authError)
        deletionResults.push({ table: 'auth.users', status: 'error', error: authError.message })
      } else {
        console.log('✅ Usuario eliminado de auth.users')
        deletionResults.push({ table: 'auth.users', status: 'deleted' })
        authDeleted = true
      }
    } catch (authErr) {
      console.error('❌ Excepción eliminando de auth.users:', authErr)
      deletionResults.push({
        table: 'auth.users',
        status: 'exception',
        error: authErr instanceof Error ? authErr.message : 'Unknown error'
      })
    }

    // Enviar email de confirmación RGPD (Art. 12.3 RGPD).
    // Sólo si el DELETE fue exitoso y tenemos un email capturado previo.
    // No rompe el flujo si falla: log + continúa.
    if (authDeleted && userEmail) {
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
    } else if (authDeleted && !userEmail) {
      console.warn('⚠️ Usuario eliminado pero no se pudo enviar email RGPD — email no disponible')
      deletionResults.push({
        table: '_deletion_email',
        status: 'skipped',
        reason: 'email no disponible antes del borrado',
      })
    }

    // Verificación final: el éxito se determina por el estado REAL en BD,
    // no por la ausencia de excepciones. Los triggers materializadores
    // (`20260523_materialized_stats_triggers.sql`) pueden re-poblar stats
    // tables durante la cascada del DELETE de user_profiles, causando
    // FK violation silenciosa que safeDelete captura como `status: 'error'`.
    // Sin esta verificación el endpoint reportaba success=true aunque
    // user_profiles y auth.users siguieran existiendo.
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

    const criticalErrors = deletionResults.filter(
      r => r.status === 'error' || r.status === 'exception'
    )
    const success = !profileStillExists && authDeleted && criticalErrors.length === 0
    const httpStatus = success ? 200 : 500

    console.log(
      success
        ? `🗑️ Eliminación completada para usuario: ${userId}`
        : `❌ Eliminación incompleta para ${userId} — profile=${profileStillExists ? 'EXISTE' : 'borrado'} auth=${authDeleted ? 'borrado' : 'EXISTE'} errors=${criticalErrors.length}`
    )

    return NextResponse.json(
      {
        success,
        message: success
          ? 'Usuario eliminado correctamente'
          : 'Eliminación incompleta: revisa details y aplica fallback manual',
        profileDeleted: !profileStillExists,
        authDeleted,
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
