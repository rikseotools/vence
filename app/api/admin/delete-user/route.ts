// app/api/admin/delete-user/route.ts
import { NextResponse } from 'next/server'
import { deleteUserRequestSchema } from '@/lib/api/admin-delete-user/schemas'
import { deleteUserData } from '@/lib/api/admin-delete-user'
import { getServiceClient } from '@/lib/api/shared/auth'

export async function DELETE(request: Request) {
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

    // Eliminar datos de todas las tablas
    const deletionResults = await deleteUserData(userId)

    // Eliminar de auth.users (requiere Supabase Admin API)
    try {
      const supabase = getServiceClient()
      const { error: authError } = await supabase.auth.admin.deleteUser(userId)

      if (authError) {
        console.error('❌ Error eliminando de auth.users:', authError)
        deletionResults.push({ table: 'auth.users', status: 'error', error: authError.message })
      } else {
        console.log('✅ Usuario eliminado de auth.users')
        deletionResults.push({ table: 'auth.users', status: 'deleted' })
      }
    } catch (authErr) {
      console.error('❌ Excepción eliminando de auth.users:', authErr)
      deletionResults.push({
        table: 'auth.users',
        status: 'exception',
        error: authErr instanceof Error ? authErr.message : 'Unknown error'
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
