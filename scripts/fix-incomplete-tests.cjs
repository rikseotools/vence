// Script para identificar y corregir tests mal marcados como incompletos
require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function main() {
  console.log('🔍 Buscando tests incompletos que deberían estar completados...\n')

  // Obtener tests con completed_at pero is_completed = false
  const { data: allTests, error: testsError } = await supabase
    .from('tests')
    .select('id, user_id, created_at, completed_at, is_completed, total_questions')
    .eq('is_completed', false)
    .not('completed_at', 'is', null)
    .order('created_at', { ascending: false })

  if (testsError) {
    console.error('❌ Error obteniendo tests:', testsError)
    return
  }

  console.log(`📊 Tests con completed_at pero is_completed=false: ${allTests.length}`)

  // Verificar cuántas preguntas tiene cada uno
  const testsWithQuestionCount = []
  for (const test of allTests) {
    const { count, error: countError } = await supabase
      .from('test_questions')
      .select('*', { count: 'exact', head: true })
      .eq('test_id', test.id)

    if (!countError) {
      testsWithQuestionCount.push({
        ...test,
        saved_questions: count,
        should_be_completed: count >= (test.total_questions || 0)
      })
    }
  }

  const actualTestsToFix = testsWithQuestionCount.filter(t => t.should_be_completed)

  console.log('\n📋 RESUMEN:')
  console.log(`   Tests analizados: ${testsWithQuestionCount.length}`)
  console.log(`   Tests que deberían estar completados: ${actualTestsToFix.length}`)
  console.log(`   Tests realmente incompletos: ${testsWithQuestionCount.length - actualTestsToFix.length}\n`)

  if (actualTestsToFix.length === 0) {
    console.log('✅ No hay tests para corregir. Todo está bien!')
    return
  }

  // Mostrar algunos ejemplos
  console.log('📝 EJEMPLOS DE TESTS A CORREGIR:')
  actualTestsToFix.slice(0, 5).forEach((test, i) => {
    console.log(`\n${i + 1}. Test ID: ${test.id}`)
    console.log(`   Usuario: ${test.user_id}`)
    console.log(`   Creado: ${new Date(test.created_at).toLocaleString('es-ES', { timeZone: 'Europe/Madrid' })}`)
    console.log(`   Completed at: ${new Date(test.completed_at).toLocaleString('es-ES', { timeZone: 'Europe/Madrid' })}`)
    console.log(`   Preguntas: ${test.saved_questions}/${test.total_questions}`)
    console.log(`   is_completed: ${test.is_completed} ❌ (debería ser true)`)
  })

  if (actualTestsToFix.length > 5) {
    console.log(`\n   ... y ${actualTestsToFix.length - 5} tests más`)
  }

  // Agrupar por fecha
  const byDate = {}
  actualTestsToFix.forEach(test => {
    const date = new Date(test.created_at).toLocaleDateString('es-ES', { timeZone: 'Europe/Madrid' })
    if (!byDate[date]) byDate[date] = []
    byDate[date].push(test)
  })

  console.log('\n📅 TESTS POR FECHA:')
  Object.keys(byDate).sort().reverse().forEach(date => {
    const tests = byDate[date]
    const uniqueUsers = new Set(tests.map(t => t.user_id)).size
    console.log(`   ${date}: ${tests.length} tests de ${uniqueUsers} usuarios`)
  })

  console.log('\n⚠️  Para aplicar el fix, ejecuta:')
  console.log('   node scripts/fix-incomplete-tests.cjs --apply\n')

  // Si se pasa --apply, aplicar el fix
  if (process.argv.includes('--apply')) {
    console.log('🔧 APLICANDO FIX...\n')

    let fixed = 0
    for (const test of actualTestsToFix) {
      const { error: updateError } = await supabase
        .from('tests')
        .update({
          is_completed: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', test.id)

      if (updateError) {
        console.error(`❌ Error actualizando test ${test.id}:`, updateError.message)
      } else {
        fixed++
      }
    }

    console.log(`\n✅ FIX COMPLETADO: ${fixed}/${actualTestsToFix.length} tests actualizados`)
  }
}

main()
