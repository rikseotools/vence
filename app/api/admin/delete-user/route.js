// app/api/admin/delete-user/route.js
// API para eliminar un usuario y todos sus datos relacionados
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Usar service role para bypasear RLS
const getServiceSupabase = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

export async function DELETE(request) {
  try {
    const { userId } = await request.json()

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'userId es requerido' },
        { status: 400 }
      )
    }

    const supabase = getServiceSupabase()

    console.log('🗑️ Iniciando eliminación de usuario:', userId)

    // Orden de eliminación para respetar foreign keys
    const tablesToClean = [
      { table: 'pwa_events', column: 'user_id' },
      { table: 'pwa_sessions', column: 'user_id' },
      { table: 'notification_events', column: 'user_id' },
      { table: 'email_events', column: 'user_id' },
      { table: 'email_preferences', column: 'user_id' },
      { table: 'user_notification_metrics', column: 'user_id' },
      { table: 'user_question_history', column: 'user_id' },
      { table: 'user_streaks', column: 'user_id' },
      { table: 'ai_chat_logs', column: 'user_id' },
      { table: 'detailed_answers', column: 'user_id' },
      { table: 'test_questions', column: 'user_id', skipIfNotExists: true },
      { table: 'tests', column: 'user_id' },
      { table: 'test_sessions', column: 'user_id' },
      { table: 'user_sessions', column: 'user_id' },
      { table: 'user_subscriptions', column: 'user_id' },
      { table: 'conversion_events', column: 'user_id' },
      { table: 'user_feedback', column: 'user_id' },
      { table: 'question_disputes', column: 'user_id' },
      { table: 'deleted_users_log', column: 'original_user_id' },
      { table: 'user_roles', column: 'user_id' },
      { table: 'user_profiles', column: 'id' },
    ]

    const deletionResults = []

    for (const { table, column, skipIfNotExists } of tablesToClean) {
      try {
        const { error, count } = await supabase
          .from(table)
          .delete()
          .eq(column, userId)

        if (error) {
          // Si la tabla no existe o hay error de permisos, continuar
          if (skipIfNotExists || error.code === '42P01') {
            console.log(`⚠️ Tabla ${table} no existe o sin datos, continuando...`)
            deletionResults.push({ table, status: 'skipped', reason: error.message })
          } else {
            console.error(`❌ Error borrando de ${table}:`, error)
            deletionResults.push({ table, status: 'error', error: error.message })
          }
        } else {
          console.log(`✅ Datos eliminados de ${table}`)
          deletionResults.push({ table, status: 'deleted' })
        }
      } catch (err) {
        console.error(`❌ Excepción borrando de ${table}:`, err)
        deletionResults.push({ table, status: 'exception', error: err.message })
      }
    }

    // Finalmente, eliminar de auth.users
    try {
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
      deletionResults.push({ table: 'auth.users', status: 'exception', error: authErr.message })
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
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
