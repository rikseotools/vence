// Script para verificar el fix de engagement
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

async function testEngagementFix() {
  console.log('🔍 VERIFICANDO FIX DE ENGAGEMENT')
  console.log('=' . repeat(60))

  try {
    // 1. Consulta mejorada (como el fix)
    console.log('\n1️⃣ CONSULTA MEJORADA (order + limit):')
    console.log('-'.repeat(40))

    const { data: completedTests, error: testsError } = await supabase
      .from('tests')
      .select('user_id, completed_at, is_completed')
      .eq('is_completed', true)
      .not('completed_at', 'is', null)
      .order('completed_at', { ascending: false })
      .limit(5000)

    console.log(`Tests obtenidos: ${completedTests?.length || 0}`)

    if (completedTests && completedTests.length > 0) {
      // Ver los más recientes
      console.log('\n5 tests más recientes:')
      completedTests.slice(0, 5).forEach(test => {
        const date = new Date(test.completed_at)
        console.log(`  - ${date.toISOString()} (${date.toLocaleDateString('es-ES')})`)
      })

      // Calcular métricas reales
      const { data: users } = await supabase
        .from('user_profiles')
        .select('id, created_at')
        .limit(1000)

      const existingUserIds = new Set(users?.map(u => u.id) || [])
      const validCompletedTests = completedTests.filter(t => existingUserIds.has(t.user_id))

      // Tests últimos 7 días
      const last7DaysTests = validCompletedTests.filter(t => {
        const testDate = new Date(t.completed_at)
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        return testDate >= sevenDaysAgo
      })

      // Tests últimos 30 días
      const last30DaysTests = validCompletedTests.filter(t => {
        const testDate = new Date(t.completed_at)
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        return testDate >= thirtyDaysAgo
      })

      console.log('\n📊 MÉTRICAS CON FIX:')
      console.log('-'.repeat(40))
      console.log(`Tests válidos totales: ${validCompletedTests.length}`)
      console.log(`Tests últimos 7 días: ${last7DaysTests.length}`)
      console.log(`Tests últimos 30 días: ${last30DaysTests.length}`)

      // Calcular DAU
      const uniqueUsers7Days = new Set(last7DaysTests.map(t => t.user_id))
      console.log(`Usuarios únicos últimos 7 días: ${uniqueUsers7Days.size}`)

      // Calcular MAU
      const uniqueUsers30Days = new Set(last30DaysTests.map(t => t.user_id))
      console.log(`Usuarios únicos últimos 30 días (MAU): ${uniqueUsers30Days.size}`)

      // DAU/MAU
      if (uniqueUsers30Days.size > 0) {
        const dauMauRatio = Math.round((uniqueUsers7Days.size / uniqueUsers30Days.size) * 100)
        console.log(`DAU/MAU ratio: ${dauMauRatio}%`)
      }
    }

    // 2. Comparación con query del dashboard
    console.log('\n2️⃣ QUERY DEL DASHBOARD (últimos 30 días):')
    console.log('-'.repeat(40))

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const { data: recentTests } = await supabase
      .from('tests')
      .select('id, is_completed, created_at, completed_at, user_id, score, total_questions')
      .gte('created_at', thirtyDaysAgo)
      .order('created_at', { ascending: false })
      .limit(5000)

    console.log(`Tests obtenidos (30 días): ${recentTests?.length || 0}`)

    const completedRecent = recentTests?.filter(t => t.is_completed) || []
    console.log(`Tests completados (30 días): ${completedRecent.length}`)

    if (completedRecent.length > 0) {
      const mostRecent = new Date(completedRecent[0].completed_at)
      console.log(`Test completado más reciente: ${mostRecent.toISOString()} (${mostRecent.toLocaleDateString('es-ES')})`)
    }

  } catch (err) {
    console.error('❌ Error:', err)
  }
}

testEngagementFix()