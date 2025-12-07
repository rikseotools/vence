// Script para borrar completamente un usuario y todos sus datos
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function deleteUserCompletely(email) {
  console.log(`🗑️ ELIMINACIÓN COMPLETA DE USUARIO: ${email}\n`)
  console.log('=' .repeat(70))
  console.log('⚠️  ADVERTENCIA: Esta acción es IRREVERSIBLE\n')

  try {
    // 1. Buscar el usuario
    const { data: { users }, error: searchError } = await supabase.auth.admin.listUsers()

    if (searchError) {
      console.error('❌ Error buscando usuarios:', searchError)
      return
    }

    const user = users.find(u => u.email?.toLowerCase() === email.toLowerCase())

    if (!user) {
      console.log(`❌ Usuario con email ${email} no encontrado`)
      console.log('\n🔍 Buscando variaciones...')

      // Buscar variaciones del email
      const possibleEmails = [
        email,
        email.replace('@gmail.com', ''),
        email + '@gmail.com',
        email.replace('@', '')
      ]

      for (const testEmail of possibleEmails) {
        const found = users.find(u => u.email?.toLowerCase() === testEmail.toLowerCase())
        if (found) {
          console.log(`✅ Encontrado como: ${found.email}`)
          console.log('   Usa este email para eliminar el usuario')
          return
        }
      }

      console.log('❌ No se encontró el usuario con ninguna variación')
      return
    }

    const userId = user.id
    console.log('✅ Usuario encontrado:')
    console.log(`   Email: ${user.email}`)
    console.log(`   User ID: ${userId}`)
    console.log(`   Creado: ${new Date(user.created_at).toLocaleDateString('es-ES')}\n`)

    // 2. Recopilar información antes de borrar
    console.log('📊 RECOPILANDO DATOS DEL USUARIO...\n')

    // Tests realizados
    const { data: tests, error: testsError } = await supabase
      .from('tests')
      .select('id')
      .eq('user_id', userId)

    console.log(`📝 Tests realizados: ${tests?.length || 0}`)

    // Respuestas guardadas
    const { data: questions } = await supabase
      .from('test_questions')
      .select('id')
      .eq('tests.user_id', userId)

    console.log(`❓ Preguntas respondidas: ${questions?.length || 0}`)

    // Perfil
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (profile) {
      console.log(`👤 Perfil encontrado:`)
      console.log(`   Oposición: ${profile.target_oposicion || 'No configurada'}`)
      console.log(`   Onboarding: ${profile.onboarding_completed_at ? 'Completado' : 'No completado'}`)
    }

    // 3. Confirmar eliminación
    console.log('\n' + '='.repeat(70))
    console.log('🗑️ INICIANDO ELIMINACIÓN...\n')

    // Orden de eliminación (respetando foreign keys)
    const deletionSteps = [
      {
        table: 'test_questions',
        condition: 'tests.user_id',
        via: 'tests'
      },
      {
        table: 'detailed_answers',
        condition: 'user_id',
        direct: true
      },
      {
        table: 'test_sessions',
        condition: 'user_id',
        direct: true
      },
      {
        table: 'tests',
        condition: 'user_id',
        direct: true
      },
      {
        table: 'user_progress',
        condition: 'user_id',
        direct: true
      },
      {
        table: 'user_streaks',
        condition: 'user_id',
        direct: true
      },
      {
        table: 'medals',
        condition: 'user_id',
        direct: true
      },
      {
        table: 'question_disputes',
        condition: 'user_id',
        direct: true
      },
      {
        table: 'user_feedback',
        condition: 'user_id',
        direct: true
      },
      {
        table: 'feedback_conversations',
        condition: 'user_id',
        direct: true
      },
      {
        table: 'notification_events',
        condition: 'user_id',
        direct: true
      },
      {
        table: 'email_events',
        condition: 'user_id',
        direct: true
      },
      {
        table: 'user_notification_metrics',
        condition: 'user_id',
        direct: true
      },
      {
        table: 'public_user_profiles',
        condition: 'id',
        direct: true
      },
      {
        table: 'user_profiles',
        condition: 'id',
        direct: true
      }
    ]

    let totalDeleted = 0

    // Eliminar datos de cada tabla
    for (const step of deletionSteps) {
      if (step.direct) {
        const { data, error } = await supabase
          .from(step.table)
          .delete()
          .eq(step.condition, userId)
          .select()

        if (error) {
          console.log(`⚠️  Error eliminando de ${step.table}:`, error.message)
        } else {
          const count = data?.length || 0
          if (count > 0) {
            console.log(`✅ Eliminados ${count} registros de ${step.table}`)
            totalDeleted += count
          } else {
            console.log(`   - ${step.table}: Sin datos`)
          }
        }
      }
    }

    // 4. Eliminar el usuario de Auth
    console.log('\n🔐 Eliminando usuario de autenticación...')

    const { error: authDeleteError } = await supabase.auth.admin.deleteUser(userId)

    if (authDeleteError) {
      console.error('❌ Error eliminando usuario de Auth:', authDeleteError)
      console.log('   Los datos fueron eliminados pero el usuario Auth persiste')
    } else {
      console.log('✅ Usuario eliminado del sistema de autenticación')
    }

    // 5. Resumen final
    console.log('\n' + '='.repeat(70))
    console.log('✅ ELIMINACIÓN COMPLETADA\n')
    console.log(`📊 Resumen:`)
    console.log(`   - Total de registros eliminados: ${totalDeleted}`)
    console.log(`   - Usuario Auth: ${authDeleteError ? 'ERROR al eliminar' : 'Eliminado'}`)
    console.log(`   - Email liberado: ${user.email}`)
    console.log('\n✅ El usuario puede volver a registrarse con el mismo email')
    console.log('   Al registrarse de nuevo:')
    console.log('   1. Verá el modal de onboarding')
    console.log('   2. Tendrá que completar todos los datos')
    console.log('   3. Empezará desde cero con todas las estadísticas')

  } catch (error) {
    console.error('❌ Error general:', error)
  }
}

// Ejecutar con confirmación
const email = process.argv[2]

if (!email) {
  console.log('❌ Uso: node delete-user-complete.js <email>')
  console.log('   Ejemplo: node delete-user-complete.js rikseotools@gmail.com')
} else {
  console.log('⚠️  CONFIRMACIÓN REQUERIDA')
  console.log(`   Vas a eliminar PERMANENTEMENTE al usuario: ${email}`)
  console.log('   Esta acción NO se puede deshacer\n')
  console.log('   Si estás seguro, el script procederá en 5 segundos...')
  console.log('   (Presiona Ctrl+C para cancelar)\n')

  setTimeout(() => {
    deleteUserCompletely(email)
  }, 5000)
}