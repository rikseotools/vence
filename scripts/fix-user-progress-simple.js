// scripts/fix-user-progress-simple.js
// MIGRACIÓN SIMPLE: Actualizar user_progress directamente sin RPC

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://yqbpstxowvgipqspqrgo.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxYnBzdHhvd3ZnaXBxc3BxcmdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDg3NjcwMywiZXhwIjoyMDY2NDUyNzAzfQ.4yUKsfS-enlY6iGICFkKi-HPqNUyTkHczUqc5kgQB3w'
)

async function fixUserProgressSimple() {
  try {
    console.log('🚀 MIGRACIÓN SIMPLE: Insertando registros user_progress...')
    
    // 1. Obtener tests completados con información de tema
    console.log('📊 Obteniendo tests completados...')
    const { data: tests, error } = await supabase
      .from('tests')
      .select(`
        id, user_id, score, total_questions, completed_at, is_completed,
        test_questions!inner(tema_number)
      `)
      .eq('is_completed', true)
      .not('user_id', 'is', null)
      .limit(50) // Procesar en lotes pequeños
    
    if (error) {
      console.error('❌ Error:', error)
      return
    }
    
    console.log(`📈 Encontrados ${tests.length} tests para procesar`)
    
    // 2. Procesar cada test y crear user_progress
    let processed = 0
    let inserted = 0
    
    for (const test of tests) {
      try {
        // Obtener tema del test
        const temaNumbers = [...new Set(test.test_questions.map(q => q.tema_number))]
        
        for (const temaNumber of temaNumbers) {
          if (!temaNumber || temaNumber === 0) continue
          
          // Calcular estadísticas para este tema
          const temaQuestions = test.test_questions.filter(q => q.tema_number === temaNumber)
          const accuracy = temaQuestions.length > 0 ? (test.score / test.total_questions) * 100 : 0
          
          // Verificar si ya existe
          const { data: existing } = await supabase
            .from('user_progress')
            .select('id')
            .eq('user_id', test.user_id)
            .eq('topic_number', temaNumber)
            .single()
          
          if (existing) {
            console.log(`   ⏭️  Ya existe progreso para usuario ${test.user_id} tema ${temaNumber}`)
            continue
          }
          
          // Insertar nuevo registro
          const { error: insertError } = await supabase
            .from('user_progress')
            .insert({
              user_id: test.user_id,
              topic_number: temaNumber,
              tests_completed: 1,
              questions_answered: temaQuestions.length,
              questions_correct: Math.round((test.score / test.total_questions) * temaQuestions.length),
              average_accuracy: accuracy,
              best_accuracy: accuracy,
              total_time_spent: 0, // No tenemos esta data histórica
              last_test_date: test.completed_at,
              is_unlocked: true,
              unlock_date: test.completed_at,
              current_streak: accuracy >= 70 ? 1 : 0,
              best_streak: accuracy >= 70 ? 1 : 0
            })
          
          if (insertError) {
            console.error(`   ❌ Error insertando tema ${temaNumber}:`, insertError.message)
          } else {
            console.log(`   ✅ Creado progreso tema ${temaNumber} (${accuracy.toFixed(1)}%)`)
            inserted++
          }
        }
        
        processed++
        
        if (processed % 10 === 0) {
          console.log(`📊 Procesados: ${processed}/${tests.length}, Insertados: ${inserted}`)
        }
        
      } catch (testError) {
        console.error(`❌ Error procesando test ${test.id}:`, testError.message)
      }
    }
    
    console.log('\n' + '='.repeat(50))
    console.log('📊 REPORTE FINAL')
    console.log('='.repeat(50))
    console.log(`✅ Tests procesados: ${processed}`)
    console.log(`🔧 Registros insertados: ${inserted}`)
    console.log('\n🎉 ¡MIGRACIÓN COMPLETADA!')
    
  } catch (error) {
    console.error('💥 Error fatal:', error)
  }
}

// Verificar estado actual
async function checkCurrentState() {
  console.log('🔍 Verificando estado actual...')
  
  const { data: progressCount, error1 } = await supabase
    .from('user_progress')
    .select('id', { count: 'exact', head: true })
  
  const { data: testsCount, error2 } = await supabase
    .from('tests')
    .select('id', { count: 'exact', head: true })
    .eq('is_completed', true)
  
  console.log(`📊 user_progress registros: ${progressCount || 0}`)
  console.log(`📝 tests completados: ${testsCount || 0}`)
}

async function main() {
  console.log('🔧 MIGRACIÓN SIMPLE USER_PROGRESS')
  console.log('=' .repeat(50))
  
  await checkCurrentState()
  console.log('\n⏰ Iniciando en 3 segundos...')
  await new Promise(r => setTimeout(r, 3000))
  
  await fixUserProgressSimple()
  
  console.log('\n🔍 Estado final:')
  await checkCurrentState()
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().then(() => process.exit(0)).catch(console.error)
}