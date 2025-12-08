// Script para verificar toda la actividad de hoy
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function checkTodayActivity() {
  console.log('📊 ACTIVIDAD COMPLETA DE HOY (8 de diciembre de 2025)')
  console.log('=' . repeat(60))

  const todayStart = new Date().toISOString().split('T')[0]

  try {
    // 1. Tests completados hoy
    const { data: completedTests, error: err1 } = await supabase
      .from('tests')
      .select('id, user_id, created_at, completed_at, score, total_questions')
      .eq('is_completed', true)
      .gte('completed_at', todayStart)

    console.log('\n✅ TESTS COMPLETADOS HOY:')
    console.log('-'.repeat(40))
    console.log(`Total: ${completedTests?.length || 0}`)
    if (completedTests && completedTests.length > 0) {
      completedTests.slice(0, 3).forEach(test => {
        const time = new Date(test.completed_at).toLocaleTimeString('es-ES')
        console.log(`  - ${time} - Score: ${test.score}/${test.total_questions}`)
      })
    }

    // 2. Tests en progreso hoy
    const { data: inProgressTests, error: err2 } = await supabase
      .from('tests')
      .select('id, user_id, created_at, total_questions')
      .eq('is_completed', false)
      .gte('created_at', todayStart)

    console.log('\n⏸️ TESTS EN PROGRESO HOY:')
    console.log('-'.repeat(40))
    console.log(`Total: ${inProgressTests?.length || 0}`)
    if (inProgressTests && inProgressTests.length > 0) {
      // Agrupar por usuario
      const byUser = {}
      inProgressTests.forEach(test => {
        const userId = test.user_id?.substring(0, 8) || 'unknown'
        byUser[userId] = (byUser[userId] || 0) + 1
      })

      console.log('Por usuario:')
      Object.entries(byUser).slice(0, 5).forEach(([user, count]) => {
        console.log(`  - Usuario ${user}...: ${count} test(s)`)
      })

      console.log('\nÚltimos 5 iniciados:')
      inProgressTests.slice(0, 5).forEach(test => {
        const time = new Date(test.created_at).toLocaleTimeString('es-ES')
        console.log(`  - ${time} - ${test.total_questions} preguntas`)
      })
    }

    // 3. Total de actividad
    console.log('\n📈 RESUMEN DE ACTIVIDAD HOY:')
    console.log('-'.repeat(40))
    const totalActivity = (completedTests?.length || 0) + (inProgressTests?.length || 0)
    console.log(`Tests iniciados: ${totalActivity}`)
    console.log(`Tests completados: ${completedTests?.length || 0}`)
    console.log(`Tests en progreso: ${inProgressTests?.length || 0}`)

    if (totalActivity > 0) {
      const completionRate = ((completedTests?.length || 0) / totalActivity * 100).toFixed(1)
      console.log(`Tasa de finalización: ${completionRate}%`)
    }

    // 4. Usuarios activos hoy
    const allUserIds = new Set([
      ...(completedTests?.map(t => t.user_id) || []),
      ...(inProgressTests?.map(t => t.user_id) || [])
    ])
    console.log(`\nUsuarios activos hoy: ${allUserIds.size}`)

    // 5. Preguntas respondidas hoy
    const { data: questionsToday, error: err3 } = await supabase
      .from('test_questions')
      .select('id, is_correct')
      .gte('created_at', todayStart)

    if (!err3 && questionsToday) {
      const correctCount = questionsToday.filter(q => q.is_correct).length
      console.log(`\nPreguntas respondidas hoy: ${questionsToday.length}`)
      console.log(`Respuestas correctas: ${correctCount}`)
      if (questionsToday.length > 0) {
        const accuracyToday = (correctCount / questionsToday.length * 100).toFixed(1)
        console.log(`Precisión del día: ${accuracyToday}%`)
      }
    }

  } catch (err) {
    console.error('❌ Error:', err)
  }
}

checkTodayActivity()