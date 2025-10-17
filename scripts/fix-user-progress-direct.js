// scripts/fix-user-progress-direct.js
// MIGRACIÓN DIRECTA: Insertar en user_progress usando INSERT directo (sin RPC)

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://yqbpstxowvgipqspqrgo.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxYnBzdHhvd3ZnaXBxc3BxcmdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDg3NjcwMywiZXhwIjoyMDY2NDUyNzAzfQ.4yUKsfS-enlY6iGICFkKi-HPqNUyTkHczUqc5kgQB3w'
)

async function checkUserProgressColumns() {
  console.log('🔍 Verificando columnas de user_progress...')
  
  // Intentar hacer una query que nos devuelva información sobre las columnas
  const { data, error } = await supabase
    .from('user_progress')
    .insert([{
      user_id: '00000000-0000-0000-0000-000000000000',
      topic_number: 999,
      tests_completed: 0
    }])
    .select('*')
  
  if (error) {
    console.log('Estructura de error:', error.message)
    console.log('Detalles:', error.details)
    console.log('Hint:', error.hint)
  } else {
    console.log('✅ Datos insertados para prueba:', data)
    
    // Borrar el registro de prueba
    await supabase
      .from('user_progress')
      .delete()
      .eq('topic_number', 999)
  }
}

async function fixUserProgressDirect() {
  try {
    console.log('🚀 MIGRACIÓN DIRECTA: user_progress...')
    
    // 1. Obtener tests completados con estadísticas por tema
    console.log('📊 Analizando tests completados...')
    const { data: testData, error } = await supabase
      .from('tests')
      .select(`
        id, user_id, score, total_questions, completed_at,
        test_questions!inner(tema_number)
      `)
      .eq('is_completed', true)
      .not('user_id', 'is', null)
      .limit(20) // Empezar con pocos para probar
    
    if (error) {
      console.error('❌ Error:', error)
      return
    }
    
    console.log(`📈 ${testData.length} tests para analizar`)
    
    // 2. Agrupar por usuario y tema
    const userTopicStats = new Map()
    
    testData.forEach(test => {
      const temas = [...new Set(test.test_questions.map(q => q.tema_number).filter(t => t && t > 0))]
      
      temas.forEach(tema => {
        const key = `${test.user_id}-${tema}`
        
        if (!userTopicStats.has(key)) {
          userTopicStats.set(key, {
            user_id: test.user_id,
            topic_number: tema,
            tests: [],
            accuracy_sum: 0,
            best_accuracy: 0
          })
        }
        
        const stats = userTopicStats.get(key)
        const accuracy = Math.round((test.score / test.total_questions) * 100)
        
        stats.tests.push({
          test_id: test.id,
          accuracy,
          completed_at: test.completed_at
        })
        stats.accuracy_sum += accuracy
        stats.best_accuracy = Math.max(stats.best_accuracy, accuracy)
      })
    })
    
    console.log(`👥 ${userTopicStats.size} combinaciones usuario-tema encontradas`)
    
    // 3. Insertar registros user_progress
    let inserted = 0
    let errors = 0
    
    for (const [key, stats] of userTopicStats.entries()) {
      try {
        // Verificar si ya existe
        const { data: existing } = await supabase
          .from('user_progress')
          .select('id')
          .eq('user_id', stats.user_id)
          .eq('topic_number', stats.topic_number)
          .single()
        
        if (existing) {
          console.log(`   ⏭️  Ya existe: usuario ${stats.user_id} tema ${stats.topic_number}`)
          continue
        }
        
        // Calcular estadísticas
        const avgAccuracy = Math.round(stats.accuracy_sum / stats.tests.length)
        const lastTest = stats.tests.sort((a, b) => new Date(b.completed_at) - new Date(a.completed_at))[0]
        
        // Intentar con campos básicos
        const { error: insertError } = await supabase
          .from('user_progress')
          .insert({
            user_id: stats.user_id,
            topic_number: stats.topic_number,
            tests_completed: stats.tests.length,
            average_accuracy: avgAccuracy,
            best_accuracy: stats.best_accuracy,
            last_test_date: lastTest.completed_at,
            is_unlocked: true,
            unlock_date: stats.tests[0].completed_at,
            current_streak: avgAccuracy >= 70 ? 1 : 0
          })
        
        if (insertError) {
          console.error(`   ❌ Error tema ${stats.topic_number}:`, insertError.message)
          errors++
        } else {
          console.log(`   ✅ Insertado: tema ${stats.topic_number} (${avgAccuracy}% avg, ${stats.best_accuracy}% best)`)
          inserted++
        }
        
      } catch (err) {
        console.error(`   ❌ Excepción:`, err.message)
        errors++
      }
    }
    
    console.log('\n' + '='.repeat(50))
    console.log('📊 RESULTADO FINAL')
    console.log('='.repeat(50))
    console.log(`✅ Registros insertados: ${inserted}`)
    console.log(`❌ Errores: ${errors}`)
    
    if (inserted > 0) {
      console.log('\n🎉 ¡Algunos usuarios ya tienen progreso actualizado!')
      console.log('   Los nuevos tests ahora actualizarán automáticamente.')
    }
    
  } catch (error) {
    console.error('💥 Error fatal:', error)
  }
}

async function main() {
  console.log('🔧 MIGRACIÓN DIRECTA USER_PROGRESS')
  console.log('=' .repeat(50))
  
  console.log('1️⃣ Verificando estructura...')
  await checkUserProgressColumns()
  
  console.log('\n2️⃣ Procesando datos...')
  await fixUserProgressDirect()
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().then(() => process.exit(0)).catch(console.error)
}