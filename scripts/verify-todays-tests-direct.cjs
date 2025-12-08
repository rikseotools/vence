require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function main() {
  console.log('🔍 Verificando tests de HOY directamente en BD...\n')

  // Zona horaria de Madrid
  const madridNow = new Date().toLocaleString('en-US', { timeZone: 'Europe/Madrid' })
  const madridDate = new Date(madridNow)

  // Inicio del día en Madrid (00:00:00)
  const startOfDayMadrid = new Date(madridDate)
  startOfDayMadrid.setHours(0, 0, 0, 0)

  // Fin del día en Madrid (23:59:59)
  const endOfDayMadrid = new Date(madridDate)
  endOfDayMadrid.setHours(23, 59, 59, 999)

  console.log('📅 Fecha de hoy (Madrid):', madridDate.toLocaleDateString('es-ES', { timeZone: 'Europe/Madrid' }))
  console.log('🕐 Rango:', startOfDayMadrid.toISOString(), 'a', endOfDayMadrid.toISOString())
  console.log()

  // Query 1: Tests con is_completed = true
  const { data: completedTrue, error: error1 } = await supabase
    .from('tests')
    .select('id, user_id, completed_at, is_completed, total_questions')
    .eq('is_completed', true)
    .gte('completed_at', startOfDayMadrid.toISOString())
    .lte('completed_at', endOfDayMadrid.toISOString())
    .order('completed_at', { ascending: true })

  if (error1) {
    console.error('❌ Error query 1:', error1)
  } else {
    console.log(`✅ Tests con is_completed = TRUE hoy: ${completedTrue.length}`)
    if (completedTrue.length > 0) {
      console.log('\n📝 Detalle:')
      completedTrue.forEach((test, i) => {
        const time = new Date(test.completed_at).toLocaleTimeString('es-ES', { timeZone: 'Europe/Madrid' })
        console.log(`  ${i + 1}. ${time} - ${test.total_questions} preguntas - ${test.id}`)
      })
    }
  }

  console.log('\n---\n')

  // Query 2: Tests con completed_at pero is_completed = false (POSIBLES BUGS)
  const { data: completedFalse, error: error2 } = await supabase
    .from('tests')
    .select('id, user_id, completed_at, is_completed, total_questions')
    .eq('is_completed', false)
    .not('completed_at', 'is', null)
    .gte('completed_at', startOfDayMadrid.toISOString())
    .lte('completed_at', endOfDayMadrid.toISOString())

  if (error2) {
    console.error('❌ Error query 2:', error2)
  } else {
    console.log(`⚠️  Tests con completed_at pero is_completed = FALSE: ${completedFalse.length}`)
    if (completedFalse.length > 0) {
      console.log('   (Estos podrían ser bugs)')
    }
  }

  console.log('\n---\n')

  // Query 3: Ver lo que muestra el RPC del admin dashboard
  const { data: rpcData, error: error3 } = await supabase
    .rpc('get_admin_dashboard_stats')

  if (error3) {
    console.error('❌ Error llamando RPC:', error3)
  } else {
    console.log('📊 RPC get_admin_dashboard_stats devuelve:')
    console.log(rpcData[0])
  }

  console.log('\n---\n')

  // Query 4: Contar manualmente tests completados hoy
  console.log('🔢 Conteo manual de tests completados hoy:')
  console.log(`   WHERE is_completed = true`)
  console.log(`   AND completed_at >= '${startOfDayMadrid.toISOString()}'`)
  console.log(`   AND completed_at <= '${endOfDayMadrid.toISOString()}'`)
  console.log(`   RESULT: ${completedTrue?.length || 0} tests`)
}

main()
