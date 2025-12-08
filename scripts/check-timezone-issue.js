// Script para verificar problema de zona horaria
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

async function checkTimezoneIssue() {
  console.log('🔍 Investigando problema de zona horaria...\n')
  console.log('=' . repeat(60))

  try {
    // 1. Verificar zona horaria local vs UTC
    const now = new Date()
    const localTime = now.toLocaleString('es-ES')
    const utcTime = now.toISOString()
    const localDate = now.toLocaleDateString('es-ES')

    console.log('🕐 INFORMACIÓN DE TIEMPO:')
    console.log(`Hora local (España): ${localTime}`)
    console.log(`Hora UTC: ${utcTime}`)
    console.log(`Fecha local: ${localDate}`)
    console.log(`Offset UTC: ${now.getTimezoneOffset()} minutos`)
    console.log()

    // 2. Verificar los últimos 10 tests completados sin importar fecha
    console.log('📊 ÚLTIMOS 10 TESTS COMPLETADOS:')
    console.log('-'.repeat(40))

    const { data: recentTests, error: error1 } = await supabase
      .from('tests')
      .select('id, user_id, created_at, completed_at, is_completed, score')
      .eq('is_completed', true)
      .order('completed_at', { ascending: false })
      .limit(10)

    if (error1) {
      console.error('❌ Error:', error1)
      return
    }

    console.log(`Total encontrados: ${recentTests?.length || 0}`)
    if (recentTests && recentTests.length > 0) {
      recentTests.forEach((test, idx) => {
        const completedDate = new Date(test.completed_at)
        const localCompleted = completedDate.toLocaleString('es-ES')
        const today = new Date()
        today.setHours(0,0,0,0)
        const isToday = completedDate >= today

        console.log(`\n${idx + 1}. Test ID: ${test.id.substring(0,8)}...`)
        console.log(`   Completado UTC: ${test.completed_at}`)
        console.log(`   Completado Local: ${localCompleted}`)
        console.log(`   Es hoy? ${isToday ? '✅ SÍ' : '❌ NO'}`)
        console.log(`   Score: ${test.score}`)
      })
    }

    // 3. Buscar tests con diferentes métodos de fecha
    console.log('\n\n🔍 BÚSQUEDA DE TESTS DE HOY CON DIFERENTES MÉTODOS:')
    console.log('-'.repeat(40))

    // Método 1: Usando fecha ISO (como hace el admin)
    const todayISO = new Date().toISOString().split('T')[0]
    console.log(`\nMétodo 1: gte('completed_at', '${todayISO}')`)

    const { data: method1, error: err1 } = await supabase
      .from('tests')
      .select('id, completed_at')
      .eq('is_completed', true)
      .gte('completed_at', todayISO)
      .limit(5)

    console.log(`Resultados: ${method1?.length || 0}`)
    if (method1 && method1.length > 0) {
      method1.forEach(t => console.log(`  - ${t.completed_at}`))
    }

    // Método 2: Usando inicio del día en hora local española
    const todayLocal = new Date()
    todayLocal.setHours(0, 0, 0, 0)
    // Ajustar a UTC considerando zona horaria española (UTC+1 o UTC+2)
    const todayUTC = new Date(todayLocal.getTime() - todayLocal.getTimezoneOffset() * 60000)
    console.log(`\nMétodo 2: gte('completed_at', '${todayUTC.toISOString()}')`)

    const { data: method2, error: err2 } = await supabase
      .from('tests')
      .select('id, completed_at')
      .eq('is_completed', true)
      .gte('completed_at', todayUTC.toISOString())
      .limit(5)

    console.log(`Resultados: ${method2?.length || 0}`)
    if (method2 && method2.length > 0) {
      method2.forEach(t => console.log(`  - ${t.completed_at}`))
    }

    // Método 3: Últimas 24 horas
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000)
    console.log(`\nMétodo 3: Últimas 24 horas desde ${last24Hours.toISOString()}`)

    const { data: method3, error: err3 } = await supabase
      .from('tests')
      .select('id, completed_at')
      .eq('is_completed', true)
      .gte('completed_at', last24Hours.toISOString())
      .limit(5)

    console.log(`Resultados: ${method3?.length || 0}`)
    if (method3 && method3.length > 0) {
      method3.forEach(t => console.log(`  - ${t.completed_at}`))
    }

    // 4. Verificar si el problema es con completed_at vs created_at
    console.log('\n\n🔍 COMPARACIÓN completed_at VS created_at:')
    console.log('-'.repeat(40))

    const { data: comparison, error: err4 } = await supabase
      .from('tests')
      .select('id, created_at, completed_at, is_completed')
      .order('created_at', { ascending: false })
      .limit(10)

    if (comparison) {
      console.log('Últimos 10 tests (por created_at):')
      comparison.forEach(test => {
        const status = test.is_completed ? '✅' : '⏸️'
        console.log(`${status} Created: ${test.created_at}`)
        if (test.completed_at) {
          console.log(`   Completed: ${test.completed_at}`)
        }
      })
    }

    // 5. Buscar específicamente tests de HOY en hora española
    console.log('\n\n🔍 TESTS DE HOY EN HORA ESPAÑOLA:')
    console.log('-'.repeat(40))

    // Para España, el día empieza a las 23:00 UTC del día anterior (UTC+1)
    // o 22:00 UTC (UTC+2 en verano)
    const todaySpainStart = new Date()
    todaySpainStart.setHours(0, 0, 0, 0)
    // Convertir a UTC restando el offset
    const offset = todaySpainStart.getTimezoneOffset() // será negativo para España
    const todayStartUTC = new Date(todaySpainStart.getTime() - offset * 60000)

    console.log(`Inicio del día en España (UTC): ${todayStartUTC.toISOString()}`)

    const { data: todaySpain, error: err5 } = await supabase
      .from('tests')
      .select('*')
      .eq('is_completed', true)
      .gte('completed_at', todayStartUTC.toISOString())
      .order('completed_at', { ascending: false })

    console.log(`\n✅ Tests completados hoy (hora España): ${todaySpain?.length || 0}`)
    if (todaySpain && todaySpain.length > 0) {
      console.log('\nPrimeros 5 tests de hoy:')
      todaySpain.slice(0, 5).forEach((test, idx) => {
        const localTime = new Date(test.completed_at).toLocaleString('es-ES')
        console.log(`${idx + 1}. User: ${test.user_id?.substring(0,8)}...`)
        console.log(`   Completado: ${localTime}`)
        console.log(`   Score: ${test.score}/${test.total_questions}`)
      })
    }

  } catch (err) {
    console.error('❌ Error:', err)
  }
}

checkTimezoneIssue()