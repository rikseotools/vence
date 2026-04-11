// app/api/admin/delete-user/route.ts
import { NextResponse } from 'next/server'
import { deleteUserRequestSchema } from '@/lib/api/admin-delete-user/schemas'
import { deleteUserData, sendDeletionConfirmationEmail } from '@/lib/api/admin-delete-user'
import { getServiceClient } from '@/lib/api/shared/auth'

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
    const supabase = getServiceClient()
    let userEmail: string | null = null
    let userFullName: string | null = null
    try {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('email, full_name')
        .eq('id', userId)
        .maybeSingle()

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

    console.log('🗑️ Eliminación completada para usuario:', userId)

    return NextResponse.json({
      success: true,
      message: 'Usuario eliminado correctamente',
      details: deletionResults
    })

  } catch (error) {
    console.error('❌ Error inesperado eliminando usuario:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export const DELETE = withErrorLogging('/api/admin/delete-user', _DELETE)
