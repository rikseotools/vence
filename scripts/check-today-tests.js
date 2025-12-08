// Script para verificar tests de hoy
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

async function checkTodayTests() {
  console.log('🔍 Verificando tests de hoy...\n')

  const today = new Date()
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const todayEnd = new Date(todayStart)
  todayEnd.setDate(todayEnd.getDate() + 1)

  console.log('📅 Fecha de hoy (inicio):', todayStart.toISOString())
  console.log('📅 Fecha de hoy (fin):', todayEnd.toISOString())
  console.log()

  try {
    // 1. Verificar tests completados hoy
    const { data: todayCompletedTests, error: error1 } = await supabase
      .from('tests')
      .select('id, user_id, completed_at, is_completed, score, total_questions')
      .eq('is_completed', true)
      .gte('completed_at', todayStart.toISOString())
      .lt('completed_at', todayEnd.toISOString())
      .order('completed_at', { ascending: false })

    if (error1) {
      console.error('❌ Error consultando tests completados:', error1)
      return
    }

    console.log('✅ Tests completados hoy:', todayCompletedTests?.length || 0)
    if (todayCompletedTests && todayCompletedTests.length > 0) {
      console.log('Primeros 3 tests:')
      todayCompletedTests.slice(0, 3).forEach(test => {
        console.log(`  - ID: ${test.id}, User: ${test.user_id?.substring(0,8)}..., Completed: ${test.completed_at}`)
      })
    }
    console.log()

    // 2. Verificar tests creados hoy (aunque no estén completados)
    const { data: todayCreatedTests, error: error2 } = await supabase
      .from('tests')
      .select('id, user_id, created_at, is_completed, completed_at')
      .gte('created_at', todayStart.toISOString())
      .lt('created_at', todayEnd.toISOString())
      .order('created_at', { ascending: false })

    if (error2) {
      console.error('❌ Error consultando tests creados:', error2)
      return
    }

    console.log('📝 Tests creados hoy (total):', todayCreatedTests?.length || 0)
    const completedToday = todayCreatedTests?.filter(t => t.is_completed) || []
    console.log('📝 De esos, completados:', completedToday.length)
    console.log()

    // 3. Verificar los últimos 5 tests completados (sin importar fecha)
    const { data: recentTests, error: error3 } = await supabase
      .from('tests')
      .select('id, user_id, completed_at, created_at, is_completed')
      .eq('is_completed', true)
      .order('completed_at', { ascending: false })
      .limit(5)

    if (error3) {
      console.error('❌ Error consultando tests recientes:', error3)
      return
    }

    console.log('🕐 Últimos 5 tests completados:')
    recentTests?.forEach(test => {
      const completedDate = new Date(test.completed_at)
      const isToday = completedDate >= todayStart && completedDate < todayEnd
      console.log(`  - Completed: ${test.completed_at} ${isToday ? '✅ HOY' : ''}`)
    })
    console.log()

    // 4. Verificar la consulta que usa el admin
    const todayISO = new Date().toISOString().split('T')[0]
    console.log('🔍 Fecha que usa el admin para filtrar:', todayISO)

    const { data: adminQuery, error: error4 } = await supabase
      .from('tests')
      .select('id, completed_at, score, total_questions, user_id')
      .eq('is_completed', true)
      .gte('completed_at', todayISO)
      .order('completed_at', { ascending: false })
      .limit(10)

    if (error4) {
      console.error('❌ Error en consulta admin:', error4)
      return
    }

    console.log('📊 Resultado consulta admin (gte completed_at', todayISO, '):', adminQuery?.length || 0)
    if (adminQuery && adminQuery.length > 0) {
      console.log('Primeros resultados:')
      adminQuery.slice(0, 3).forEach(test => {
        console.log(`  - Completed: ${test.completed_at}`)
      })
    }

  } catch (err) {
    console.error('❌ Error inesperado:', err)
  }
}

checkTodayTests()