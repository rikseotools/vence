// Script para debuggear la página de engagement
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

async function debugEngagement() {
  console.log('🔍 DEBUGGING ENGAGEMENT PAGE')
  console.log('=' . repeat(60))

  try {
    // 1. Simular la consulta de la página de engagement (con range)
    console.log('\n1️⃣ CONSULTA DE TESTS COMPLETADOS (con range 0-9999):')
    console.log('-'.repeat(40))

    const { data: completedTests, error: testsError } = await supabase
      .from('tests')
      .select('user_id, completed_at, is_completed')
      .eq('is_completed', true)
      .not('completed_at', 'is', null)
      .range(0, 9999)

    console.log(`Tests obtenidos: ${completedTests?.length || 0}`)

    if (testsError) {
      console.error('Error:', testsError)
      return
    }

    // 2. Consulta de usuarios
    console.log('\n2️⃣ CONSULTA DE USUARIOS (con range 0-9999):')
    console.log('-'.repeat(40))

    const { data: users, error: usersError } = await supabase
      .from('user_profiles')
      .select('id, created_at')
      .range(0, 9999)

    console.log(`Usuarios obtenidos: ${users?.length || 0}`)

    if (usersError) {
      console.error('Error:', usersError)
      return
    }

    // 3. Filtrar tests válidos (como hace la página)
    console.log('\n3️⃣ PROCESAMIENTO DE DATOS:')
    console.log('-'.repeat(40))

    const existingUserIds = new Set(users.map(u => u.id))
    const validCompletedTests = completedTests.filter(t => existingUserIds.has(t.user_id))

    console.log(`Tests válidos (usuarios existentes): ${validCompletedTests.length}`)

    // 4. Calcular métricas básicas
    console.log('\n4️⃣ MÉTRICAS BÁSICAS:')
    console.log('-'.repeat(40))

    // DAU - últimos 7 días
    const last7DaysTests = validCompletedTests.filter(t => {
      const testDate = new Date(t.completed_at)
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      return testDate >= sevenDaysAgo
    })

    console.log(`Tests últimos 7 días: ${last7DaysTests.length}`)

    // Calcular DAU por día
    const dailyActiveUsers = {}
    for (let i = 0; i < 7; i++) {
      const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
      const dateKey = date.toISOString().split('T')[0]
      dailyActiveUsers[dateKey] = new Set()
    }

    last7DaysTests.forEach(test => {
      const testDate = new Date(test.completed_at)
      const dateKey = testDate.toISOString().split('T')[0]
      if (dailyActiveUsers[dateKey]) {
        dailyActiveUsers[dateKey].add(test.user_id)
      }
    })

    console.log('\nUsuarios activos por día (últimos 7 días):')
    Object.entries(dailyActiveUsers).forEach(([date, users]) => {
      console.log(`  ${date}: ${users.size} usuarios`)
    })

    const dailyActiveUsersArray = Object.values(dailyActiveUsers).map(set => set.size)
    const averageDAU = dailyActiveUsersArray.length > 0 ?
      Math.round(dailyActiveUsersArray.reduce((sum, dau) => sum + dau, 0) / dailyActiveUsersArray.length) : 0

    console.log(`\nDAU promedio: ${averageDAU}`)

    // MAU - últimos 30 días
    const last30DaysTests = validCompletedTests.filter(t => {
      const testDate = new Date(t.completed_at)
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      return testDate >= thirtyDaysAgo
    })

    const MAU = new Set(last30DaysTests.map(t => t.user_id)).size
    console.log(`MAU (usuarios únicos 30 días): ${MAU}`)

    // DAU/MAU ratio
    const dauMauRatio = MAU > 0 ? Math.round((averageDAU / MAU) * 100) : 0
    console.log(`DAU/MAU ratio: ${dauMauRatio}%`)

    // Registered Active Ratio
    const totalUsers = users.length
    const registeredActiveRatio = totalUsers > 0 ? Math.round((MAU / totalUsers) * 100) : 0
    console.log(`\nUsuarios registrados activos: ${registeredActiveRatio}% (${MAU}/${totalUsers})`)

    // 5. Verificar si hay datos recientes
    console.log('\n5️⃣ ANÁLISIS DE ACTIVIDAD RECIENTE:')
    console.log('-'.repeat(40))

    if (validCompletedTests.length > 0) {
      const mostRecentTest = validCompletedTests.reduce((latest, test) => {
        const testDate = new Date(test.completed_at)
        return testDate > latest ? testDate : latest
      }, new Date(0))

      console.log(`Test más reciente: ${mostRecentTest.toISOString()}`)

      const daysSinceLastTest = Math.floor((Date.now() - mostRecentTest.getTime()) / (1000 * 60 * 60 * 24))
      console.log(`Días desde el último test: ${daysSinceLastTest}`)

      if (daysSinceLastTest > 7) {
        console.log('⚠️ No hay actividad en los últimos 7 días - DAU será 0')
      }
    } else {
      console.log('⚠️ No hay tests completados válidos')
    }

  } catch (err) {
    console.error('❌ Error:', err)
  }
}

debugEngagement()