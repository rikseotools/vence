// scripts/fix-user-progress-missing.js
// MIGRACIÓN MASIVA: Actualizar user_progress para todos los usuarios que han completado tests

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://yqbpstxowvgipqspqrgo.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxYnBzdHhvd3ZnaXBxc3BxcmdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDg3NjcwMywiZXhwIjoyMDY2NDUyNzAzfQ.4yUKsfS-enlY6iGICFkKi-HPqNUyTkHczUqc5kgQB3w'
)

async function fixUserProgressForAllUsers() {
  try {
    console.log('🚀 INICIANDO MIGRACIÓN MASIVA: Actualizando user_progress...')
    
    // 1. Obtener todos los usuarios que han completado tests pero puede que les falte user_progress
    console.log('📊 Obteniendo usuarios con tests completados...')
    const { data: completedTests, error: testsError } = await supabase
      .from('tests')
      .select('id, user_id, is_completed, completed_at, score, total_questions')
      .eq('is_completed', true)
      .not('user_id', 'is', null)
      .order('completed_at', { ascending: true })
    
    if (testsError) {
      console.error('❌ Error obteniendo tests:', testsError)
      return
    }
    
    console.log(`📈 Encontrados ${completedTests.length} tests completados`)
    
    // 2. Agrupar por usuario
    const testsByUser = {}
    completedTests.forEach(test => {
      if (!testsByUser[test.user_id]) {
        testsByUser[test.user_id] = []
      }
      testsByUser[test.user_id].push(test)
    })
    
    console.log(`👥 Afecta a ${Object.keys(testsByUser).length} usuarios únicos`)
    
    // 3. Procesar cada usuario
    let usersProcessed = 0
    let usersFixed = 0
    let errors = 0
    
    for (const [userId, userTests] of Object.entries(testsByUser)) {
      try {
        console.log(`\n🔄 Procesando usuario ${usersProcessed + 1}/${Object.keys(testsByUser).length}: ${userId}`)
        console.log(`   📝 ${userTests.length} tests completados`)
        
        // Procesar cada test del usuario para actualizar user_progress
        for (const test of userTests) {
          try {
            console.log(`   🎯 Actualizando progreso para test ${test.id}...`)
            
            const { error: progressError } = await supabase
              .rpc('update_user_progress', {
                p_user_id: userId,
                p_test_id: test.id
              })
            
            if (progressError) {
              console.error(`   ❌ Error en test ${test.id}:`, progressError.message)
              errors++
            } else {
              console.log(`   ✅ Test ${test.id} procesado`)
            }
            
            // Pequeña pausa para no sobrecargar la BD
            await new Promise(resolve => setTimeout(resolve, 100))
            
          } catch (testError) {
            console.error(`   ❌ Excepción en test ${test.id}:`, testError.message)
            errors++
          }
        }
        
        usersProcessed++
        usersFixed++
        
        // Pausa cada 10 usuarios
        if (usersProcessed % 10 === 0) {
          console.log(`\n⏱️  Pausa de 2 segundos... (${usersProcessed}/${Object.keys(testsByUser).length})`)
          await new Promise(resolve => setTimeout(resolve, 2000))
        }
        
      } catch (userError) {
        console.error(`❌ Error procesando usuario ${userId}:`, userError.message)
        usersProcessed++
        errors++
      }
    }
    
    // 4. Reporte final
    console.log('\n' + '='.repeat(50))
    console.log('📊 REPORTE FINAL DE MIGRACIÓN')
    console.log('='.repeat(50))
    console.log(`✅ Usuarios procesados: ${usersProcessed}`)
    console.log(`🔧 Usuarios corregidos: ${usersFixed}`)
    console.log(`❌ Errores: ${errors}`)
    console.log(`📝 Total tests procesados: ${completedTests.length}`)
    
    if (errors === 0) {
      console.log('\n🎉 ¡MIGRACIÓN COMPLETADA EXITOSAMENTE!')
      console.log('   Todos los usuarios ahora deberían tener su progreso actualizado')
    } else {
      console.log('\n⚠️  MIGRACIÓN COMPLETADA CON ERRORES')
      console.log(`   ${errors} errores encontrados - revisar logs arriba`)
    }
    
  } catch (error) {
    console.error('💥 Error fatal en migración:', error)
  }
}

// Función para verificar el estado antes y después
async function verifyUserProgress() {
  try {
    console.log('\n🔍 VERIFICANDO ESTADO ACTUAL...')
    
    const { data: progressCount, error } = await supabase
      .from('user_progress')
      .select('id', { count: 'exact', head: true })
    
    if (error) {
      console.error('❌ Error verificando user_progress:', error)
      return
    }
    
    console.log(`📊 Registros en user_progress: ${progressCount || 0}`)
    
    // También obtener número de tests completados
    const { data: completedCount, error: testError } = await supabase
      .from('tests')
      .select('id', { count: 'exact', head: true })
      .eq('is_completed', true)
      .not('user_id', 'is', null)
    
    if (!testError) {
      console.log(`📝 Tests completados: ${completedCount || 0}`)
    }
    
  } catch (error) {
    console.error('❌ Error en verificación:', error)
  }
}

// Ejecutar migración
async function main() {
  console.log('🔧 SCRIPT DE MIGRACIÓN: Fix User Progress Missing')
  console.log('=' .repeat(60))
  
  await verifyUserProgress()
  
  console.log('\n¿Continuar con la migración? Esta operación:')
  console.log('- Llamará update_user_progress() para cada test completado')
  console.log('- Puede tomar varios minutos')
  console.log('- Es segura (no borra datos)')
  
  // Auto-ejecutar en 3 segundos
  console.log('\n⏰ Iniciando en 3 segundos... (Ctrl+C para cancelar)')
  await new Promise(resolve => setTimeout(resolve, 3000))
  
  await fixUserProgressForAllUsers()
  
  console.log('\n🔍 Verificando estado final...')
  await verifyUserProgress()
}

// Ejecutar si es el módulo principal
if (import.meta.url === `file://${process.argv[1]}`) {
  main().then(() => process.exit(0)).catch(console.error)
}