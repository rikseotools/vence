// Análisis DETALLADO del Test 2 de Nila
// Verificar si hubo errores de guardado o duplicados
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function analyzeTest2Detailed() {
  try {
    console.log('\n🔬 ANÁLISIS DETALLADO DEL TEST 2 DE NILA\n')
    console.log('='.repeat(80))

    // 1. Buscar Nila
    const { data: profiles } = await supabase
      .from('public_user_profiles')
      .select('id, display_name')

    const nilaProfile = profiles?.find(p => p.display_name?.toLowerCase().includes('nila'))
    if (!nilaProfile) {
      console.log('❌ Usuario Nila no encontrado')
      return
    }

    const userId = nilaProfile.id
    console.log(`\n✅ Usuario: @${nilaProfile.display_name} (${userId})\n`)

    // 2. Obtener tests de hoy
    const todayUTC = new Date()
    todayUTC.setUTCHours(0, 0, 0, 0)
    const todayUTCEnd = new Date(todayUTC)
    todayUTCEnd.setUTCHours(23, 59, 59, 999)

    const { data: tests } = await supabase
      .from('tests')
      .select('*')
      .eq('user_id', userId)
      .gte('created_at', todayUTC.toISOString())
      .lte('created_at', todayUTCEnd.toISOString())
      .order('created_at', { ascending: true })

    if (!tests || tests.length < 2) {
      console.log('❌ No se encontraron 2 tests hoy')
      return
    }

    const test2 = tests[1] // Segundo test

    console.log('📋 TEST 2 - METADATA:\n')
    console.log(`ID:           ${test2.id}`)
    console.log(`Creado:       ${test2.created_at}`)
    console.log(`Completado:   ${test2.completed_at || 'N/A'}`)
    console.log(`Estado:       is_completed = ${test2.is_completed}`)
    console.log(`Puntuación:   ${test2.score || 0}`)
    console.log(`Total Q:      ${test2.total_questions || 'N/A'}`)
    console.log(`Tema:         ${test2.topic_id || 'N/A'}`)
    console.log(`Ley:          ${test2.law_id || 'N/A'}`)
    console.log(`Tipo:         ${test2.test_type || 'N/A'}`)
    console.log('')

    // 3. Obtener TODAS las preguntas del test 2
    const { data: questions } = await supabase
      .from('test_questions')
      .select('*')
      .eq('test_id', test2.id)
      .order('question_order', { ascending: true })

    console.log('📊 PREGUNTAS GUARDADAS EN test_questions:\n')
    console.log(`Total guardadas: ${questions.length}`)
    console.log('')

    if (questions.length > 0) {
      console.log('Listado de preguntas guardadas:')
      questions.forEach((q, idx) => {
        console.log(`  ${idx + 1}. Orden: ${q.question_order} | Respuesta: ${q.user_answer} | Correcta: ${q.is_correct ? '✅' : '❌'} | Tiempo: ${q.time_spent_seconds}s | Creada: ${q.created_at}`)
      })
      console.log('')

      // Verificar si hay saltos en question_order
      const orders = questions.map(q => q.question_order).sort((a, b) => a - b)
      const missingOrders = []
      const expectedMax = test2.total_questions || 25 // Asumir 25 si no está definido

      for (let i = 1; i <= expectedMax; i++) {
        if (!orders.includes(i)) {
          missingOrders.push(i)
        }
      }

      if (missingOrders.length > 0) {
        console.log('🚨 PREGUNTAS FALTANTES (por question_order):')
        console.log(`   Faltan ${missingOrders.length} preguntas:`, missingOrders.join(', '))
        console.log('')
      }

      // Análisis temporal
      const firstQ = new Date(questions[0].created_at)
      const lastQ = new Date(questions[questions.length - 1].created_at)
      const durationMs = lastQ - firstQ
      const durationMin = (durationMs / 1000 / 60).toFixed(2)

      console.log('⏱️  ANÁLISIS TEMPORAL:')
      console.log(`   Primera pregunta: ${questions[0].created_at}`)
      console.log(`   Última pregunta:  ${questions[questions.length - 1].created_at}`)
      console.log(`   Duración total:   ${durationMin} minutos`)
      console.log(`   Promedio/pregunta: ${(durationMin / questions.length).toFixed(2)} minutos`)
      console.log('')

      // Verificar duplicados por question_order
      const orderCounts = {}
      questions.forEach(q => {
        orderCounts[q.question_order] = (orderCounts[q.question_order] || 0) + 1
      })

      const duplicates = Object.entries(orderCounts).filter(([order, count]) => count > 1)
      if (duplicates.length > 0) {
        console.log('⚠️  DUPLICADOS DETECTADOS:')
        duplicates.forEach(([order, count]) => {
          console.log(`   Orden ${order}: ${count} veces`)
        })
        console.log('')
      }
    }

    // 4. Verificar si el test fue configurado con 25 preguntas o menos
    console.log('🔍 VERIFICACIÓN DE CONFIGURACIÓN:\n')

    if (test2.total_questions && test2.total_questions < 25) {
      console.log(`⚠️  El test fue configurado con ${test2.total_questions} preguntas, NO 25`)
      console.log(`   Esto explicaría por qué solo hay ${questions.length} preguntas guardadas`)
    } else if (!test2.total_questions) {
      console.log(`⚠️  El test NO tiene total_questions definido`)
      console.log(`   Esto puede ser un bug - el campo debería haberse actualizado al completar`)
    } else {
      console.log(`✅ El test fue configurado con ${test2.total_questions} preguntas`)
      console.log(`❌ Solo se guardaron ${questions.length} de ${test2.total_questions} preguntas`)
      console.log(`   FALTAN: ${test2.total_questions - questions.length} preguntas`)
    }
    console.log('')

    // 5. Analizar detailed_analytics
    if (test2.detailed_analytics) {
      console.log('📈 DETAILED ANALYTICS DEL TEST:\n')
      const analytics = typeof test2.detailed_analytics === 'string'
        ? JSON.parse(test2.detailed_analytics)
        : test2.detailed_analytics

      if (analytics.performance_summary) {
        console.log('Performance Summary:')
        console.log(`   Questions attempted: ${analytics.performance_summary.questions_attempted || 'N/A'}`)
        console.log(`   Accuracy: ${analytics.performance_summary.accuracy_percentage || 0}%`)
        console.log(`   Total time: ${analytics.performance_summary.total_time_minutes || 0} min`)
        console.log('')
      }

      if (analytics.improvement_areas) {
        console.log(`Improvement areas registradas: ${analytics.improvement_areas.length}`)
      }
    }

    // 6. DIAGNÓSTICO FINAL
    console.log('='.repeat(80))
    console.log('\n🎯 DIAGNÓSTICO FINAL:\n')

    const expectedQuestions = test2.total_questions || 25
    const actualQuestions = questions.length
    const missing = expectedQuestions - actualQuestions

    if (missing > 0) {
      console.log(`❌ PROBLEMA CONFIRMADO: Faltan ${missing} preguntas`)
      console.log(`   Esperadas: ${expectedQuestions}`)
      console.log(`   Guardadas: ${actualQuestions}`)
      console.log('')
      console.log('Posibles causas:')
      console.log('   1. Usuario abandonó después de responder solo 17 preguntas')
      console.log('   2. Errores de guardado silenciosos (constraint duplicado, red, timeout)')
      console.log('   3. Bug en el flujo de respuesta que no guardó las últimas 8 preguntas')
      console.log('   4. El test se marcó como completado prematuramente')
      console.log('')
      console.log('⚠️  El campo is_completed=true es INCORRECTO si el test debía tener 25 preguntas')
    } else if (missing < 0) {
      console.log(`⚠️  ANOMALÍA: Hay ${Math.abs(missing)} preguntas EXTRA`)
    } else {
      console.log(`✅ Los números coinciden: ${expectedQuestions} preguntas`)
    }

    console.log('\n' + '='.repeat(80) + '\n')

  } catch (err) {
    console.error('\n❌ ERROR:', err.message)
    console.error(err)
  }
}

analyzeTest2Detailed()
