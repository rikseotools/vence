// Script para verificar todas las métricas del dashboard de admin
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

async function verifyDashboard() {
  console.log('🔍 Verificando todas las métricas del dashboard admin...\n')
  console.log('=' . repeat(60))

  try {
    // 1. ESTADÍSTICAS GENERALES (RPC)
    console.log('\n1️⃣ ESTADÍSTICAS GENERALES (RPC)')
    console.log('-'.repeat(40))

    const { data: dashboardStats, error: rpcError } = await supabase
      .rpc('get_dashboard_stats')

    if (rpcError) {
      console.error('❌ Error en RPC:', rpcError)
    } else if (dashboardStats && dashboardStats[0]) {
      const stats = dashboardStats[0]
      console.log(`✅ Total usuarios: ${stats.total_users}`)
      console.log(`✅ Usuarios con tests: ${stats.users_with_tests}`)
      console.log(`✅ Engagement: ${stats.engagement_percentage}%`)
    }

    // 2. TESTS DE HOY
    console.log('\n2️⃣ TESTS DE HOY')
    console.log('-'.repeat(40))

    const todayStart = new Date().toISOString().split('T')[0]
    const { data: todayTests, error: todayError } = await supabase
      .from('tests')
      .select('id, user_id, completed_at, score, total_questions')
      .eq('is_completed', true)
      .gte('completed_at', todayStart)
      .order('completed_at', { ascending: false })

    console.log(`📅 Fecha de búsqueda: ${todayStart}`)
    console.log(`${todayTests?.length === 0 ? '⚠️' : '✅'} Tests completados hoy: ${todayTests?.length || 0}`)

    if (todayTests && todayTests.length > 0) {
      console.log('Últimos 3:')
      todayTests.slice(0, 3).forEach(t => {
        console.log(`  - User: ${t.user_id?.substring(0,8)}..., Score: ${t.score}/${t.total_questions}`)
      })
    }

    // 3. TESTS DE ESTA SEMANA
    console.log('\n3️⃣ TESTS DE ESTA SEMANA')
    console.log('-'.repeat(40))

    const now = new Date()
    const dayOfWeek = now.getDay()
    const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
    const thisMonday = new Date(now)
    thisMonday.setDate(now.getDate() - daysFromMonday)
    thisMonday.setHours(0, 0, 0, 0)

    const { data: weekTests, error: weekError } = await supabase
      .from('tests')
      .select('id')
      .eq('is_completed', true)
      .gte('completed_at', thisMonday.toISOString())

    console.log(`📅 Desde el lunes: ${thisMonday.toISOString()}`)
    console.log(`✅ Tests completados esta semana: ${weekTests?.length || 0}`)

    // 4. TESTS DE LOS ÚLTIMOS 30 DÍAS
    console.log('\n4️⃣ TESTS ÚLTIMOS 30 DÍAS')
    console.log('-'.repeat(40))

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const { data: monthTests, error: monthError } = await supabase
      .from('tests')
      .select('id, score, total_questions')
      .eq('is_completed', true)
      .gte('created_at', thirtyDaysAgo.toISOString())

    console.log(`✅ Tests últimos 30 días: ${monthTests?.length || 0}`)

    // Calcular precisión promedio
    if (monthTests && monthTests.length > 0) {
      let totalAccuracy = 0
      let validTests = 0

      monthTests.forEach(test => {
        if (test.score !== null && test.total_questions > 0) {
          const accuracy = test.score <= test.total_questions
            ? (test.score / test.total_questions) * 100
            : test.score // Ya es porcentaje
          totalAccuracy += accuracy
          validTests++
        }
      })

      const avgAccuracy = validTests > 0 ? Math.round(totalAccuracy / validTests) : 0
      console.log(`📊 Precisión promedio: ${avgAccuracy}%`)
    }

    // 5. USUARIOS NUEVOS ESTA SEMANA
    console.log('\n5️⃣ USUARIOS NUEVOS ESTA SEMANA')
    console.log('-'.repeat(40))

    const { data: newUsers, error: newUsersError } = await supabase
      .from('admin_users_with_roles')
      .select('user_id, user_created_at, registration_source')
      .gte('user_created_at', thisMonday.toISOString())
      .order('user_created_at', { ascending: false })

    console.log(`✅ Usuarios nuevos esta semana: ${newUsers?.length || 0}`)

    if (newUsers && newUsers.length > 0) {
      // Desglose por fuente
      const bySource = newUsers.reduce((acc, user) => {
        const source = user.registration_source || 'unknown'
        acc[source] = (acc[source] || 0) + 1
        return acc
      }, {})

      console.log('Por fuente:')
      Object.entries(bySource).forEach(([source, count]) => {
        console.log(`  - ${source}: ${count}`)
      })
    }

    // 6. USUARIOS ACTIVOS
    console.log('\n6️⃣ USUARIOS ACTIVOS')
    console.log('-'.repeat(40))

    // Usuarios activos esta semana
    const { data: weekActiveUsers, error: weekActiveError } = await supabase
      .from('tests')
      .select('user_id')
      .eq('is_completed', true)
      .gte('completed_at', thisMonday.toISOString())

    const uniqueWeekUsers = new Set(weekActiveUsers?.map(t => t.user_id) || [])
    console.log(`✅ Usuarios activos esta semana: ${uniqueWeekUsers.size}`)

    // Usuarios activos últimos 30 días
    const { data: monthActiveUsers, error: monthActiveError } = await supabase
      .from('tests')
      .select('user_id')
      .eq('is_completed', true)
      .gte('completed_at', thirtyDaysAgo.toISOString())

    const uniqueMonthUsers = new Set(monthActiveUsers?.map(t => t.user_id) || [])
    console.log(`✅ Usuarios activos últimos 30 días: ${uniqueMonthUsers.size}`)

    // 7. TESTS ABANDONADOS
    console.log('\n7️⃣ TESTS ABANDONADOS')
    console.log('-'.repeat(40))

    const { data: abandonedTests, error: abandonedError } = await supabase
      .from('tests')
      .select('id')
      .eq('is_completed', false)
      .gte('created_at', thirtyDaysAgo.toISOString())

    console.log(`⚠️ Tests abandonados (30 días): ${abandonedTests?.length || 0}`)

    // 8. ACTIVIDAD RECIENTE
    console.log('\n8️⃣ ACTIVIDAD RECIENTE')
    console.log('-'.repeat(40))

    const { data: recentActivity, error: recentError } = await supabase
      .from('tests')
      .select('id, user_id, created_at, completed_at, is_completed')
      .order('created_at', { ascending: false })
      .limit(5)

    console.log('Últimos 5 tests (cualquier estado):')
    recentActivity?.forEach(test => {
      const status = test.is_completed ? '✅ Completado' : '⏸️ En progreso'
      const date = new Date(test.created_at).toLocaleString('es-ES')
      console.log(`  - ${status} - ${date}`)
    })

    console.log('\n' + '='.repeat(60))
    console.log('✅ Verificación completada')

  } catch (err) {
    console.error('❌ Error inesperado:', err)
  }
}

verifyDashboard()