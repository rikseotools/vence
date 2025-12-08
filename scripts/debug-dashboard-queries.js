// Script para debuggear las consultas del dashboard
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

async function debugDashboardQueries() {
  console.log('🔍 DEBUGGING DASHBOARD QUERIES')
  console.log('=' . repeat(60))

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  console.log(`📅 Fecha hace 30 días: ${thirtyDaysAgo}`)
  console.log()

  try {
    // 1. Query exacta que usa el dashboard
    console.log('1️⃣ QUERY DEL DASHBOARD (últimos 30 días):')
    console.log('-'.repeat(40))

    const { data: recentTests, error: testsError, count } = await supabase
      .from('tests')
      .select('id, is_completed, created_at, completed_at, user_id, score, total_questions', { count: 'exact' })
      .gte('created_at', thirtyDaysAgo)

    console.log(`Total devuelto: ${recentTests?.length}`)
    console.log(`Count exacto: ${count}`)

    if (recentTests) {
      // Filtrar tests válidos completados (igual que el dashboard)
      const validCompletedTests = recentTests.filter(t =>
        t.is_completed === true &&
        t.completed_at &&
        t.score !== null &&
        t.total_questions > 0 &&
        !isNaN(t.score) &&
        !isNaN(t.total_questions) &&
        t.score >= 0
      )

      console.log(`Tests válidos completados: ${validCompletedTests.length}`)

      // Analizar por qué se filtran tantos
      const completedTests = recentTests.filter(t => t.is_completed === true)
      console.log(`\nAnálisis de filtrado:`)
      console.log(`- Tests totales: ${recentTests.length}`)
      console.log(`- Tests completados: ${completedTests.length}`)
      console.log(`- Con completed_at: ${completedTests.filter(t => t.completed_at).length}`)
      console.log(`- Con score !== null: ${completedTests.filter(t => t.score !== null).length}`)
      console.log(`- Con total_questions > 0: ${completedTests.filter(t => t.total_questions > 0).length}`)
      console.log(`- Pasaron todos los filtros: ${validCompletedTests.length}`)

      // Ver algunos ejemplos de tests filtrados
      const filteredOut = completedTests.filter(t => {
        return !(t.completed_at &&
                t.score !== null &&
                t.total_questions > 0 &&
                !isNaN(t.score) &&
                !isNaN(t.total_questions) &&
                t.score >= 0)
      })

      if (filteredOut.length > 0) {
        console.log(`\n⚠️ Ejemplos de tests completados pero filtrados:`)
        filteredOut.slice(0, 3).forEach(test => {
          console.log(`  - ID: ${test.id.substring(0, 8)}...`)
          console.log(`    completed_at: ${test.completed_at}`)
          console.log(`    score: ${test.score}`)
          console.log(`    total_questions: ${test.total_questions}`)
        })
      }
    }

    // 2. Verificar tests completados directamente
    console.log('\n2️⃣ TESTS COMPLETADOS DIRECTAMENTE (30 días):')
    console.log('-'.repeat(40))

    const { data: directCompleted, count: directCount } = await supabase
      .from('tests')
      .select('id', { count: 'exact' })
      .eq('is_completed', true)
      .gte('completed_at', thirtyDaysAgo)

    console.log(`Tests completados (30 días): ${directCount}`)

    // 3. Verificar esta semana
    const now = new Date()
    const dayOfWeek = now.getDay()
    const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
    const thisMonday = new Date(now)
    thisMonday.setDate(now.getDate() - daysFromMonday)
    thisMonday.setHours(0, 0, 0, 0)

    console.log('\n3️⃣ TESTS ESTA SEMANA:')
    console.log('-'.repeat(40))
    console.log(`Desde el lunes: ${thisMonday.toISOString()}`)

    const { data: weekTests, count: weekCount } = await supabase
      .from('tests')
      .select('id', { count: 'exact' })
      .eq('is_completed', true)
      .gte('completed_at', thisMonday.toISOString())

    console.log(`Tests completados esta semana: ${weekCount}`)

    // 4. Usuarios únicos activos
    console.log('\n4️⃣ USUARIOS ACTIVOS:')
    console.log('-'.repeat(40))

    const { data: activeMonth } = await supabase
      .from('tests')
      .select('user_id')
      .eq('is_completed', true)
      .gte('completed_at', thirtyDaysAgo)

    const uniqueUsersMonth = new Set(activeMonth?.map(t => t.user_id) || [])
    console.log(`Usuarios únicos (30 días): ${uniqueUsersMonth.size}`)

    const { data: activeWeek } = await supabase
      .from('tests')
      .select('user_id')
      .eq('is_completed', true)
      .gte('completed_at', thisMonday.toISOString())

    const uniqueUsersWeek = new Set(activeWeek?.map(t => t.user_id) || [])
    console.log(`Usuarios únicos esta semana: ${uniqueUsersWeek.size}`)

    // 5. Tests abandonados
    console.log('\n5️⃣ TESTS ABANDONADOS:')
    console.log('-'.repeat(40))

    const { count: abandonedCount } = await supabase
      .from('tests')
      .select('id', { count: 'exact' })
      .eq('is_completed', false)
      .gte('created_at', thirtyDaysAgo)

    console.log(`Tests abandonados (30 días): ${abandonedCount}`)

  } catch (err) {
    console.error('❌ Error:', err)
  }
}

debugDashboardQueries()