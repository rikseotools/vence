// Debug detallado: ¿Por qué faltan 8 preguntas?
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function debugNilaTests() {
  try {
    console.log('\n🔍 DEBUG: ¿Por qué faltan 8 preguntas? (3+25=28, pero ranking muestra 20)\n')
    console.log('='.repeat(80))

    // Buscar Nila
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

    // Fecha de hoy UTC
    const todayUTC = new Date()
    todayUTC.setUTCHours(0, 0, 0, 0)
    const todayUTCEnd = new Date(todayUTC)
    todayUTCEnd.setUTCHours(23, 59, 59, 999)

    console.log('📅 Rango: ' + todayUTC.toISOString() + ' a ' + todayUTCEnd.toISOString())
    console.log('')

    // ========================================================================
    // 1. BUSCAR TODOS LOS TESTS DE HOY (completados Y activos)
    // ========================================================================

    const { data: allTests, error: testsError } = await supabase
      .from('tests')
      .select('*')
      .eq('user_id', userId)
      .gte('created_at', todayUTC.toISOString())
      .lte('created_at', todayUTCEnd.toISOString())
      .order('created_at', { ascending: true })

    if (testsError) {
      console.error('❌ Error obteniendo tests:', testsError)
      return
    }

    console.log('📋 TESTS DE HOY:\n')
    console.log(`Total tests encontrados: ${allTests?.length || 0}\n`)

    if (!allTests || allTests.length === 0) {
      console.log('⚠️  NO HAY TESTS CREADOS HOY')
      console.log('   Esto significa que las preguntas pertenecen a tests de otros días\n')

      // Buscar preguntas de hoy y ver a qué tests pertenecen
      const { data: questionsToday } = await supabase
        .from('test_questions')
        .select('id, created_at, test_id, tests!inner(user_id, created_at, status)')
        .eq('tests.user_id', userId)
        .gte('created_at', todayUTC.toISOString())
        .lte('created_at', todayUTCEnd.toISOString())

      console.log(`📊 Preguntas de HOY: ${questionsToday?.length || 0}`)

      if (questionsToday && questionsToday.length > 0) {
        const testIds = new Set(questionsToday.map(q => q.test_id))
        console.log(`   Pertenecen a ${testIds.size} test(s) diferente(s)\n`)

        // Obtener info de esos tests
        for (const testId of testIds) {
          const { data: testInfo } = await supabase
            .from('tests')
            .select('id, created_at, status, tema_id, law_id')
            .eq('id', testId)
            .single()

          const questionsInTest = questionsToday.filter(q => q.test_id === testId)

          console.log(`   Test ID: ${testId.substring(0, 8)}...`)
          console.log(`   • Creado:  ${testInfo?.created_at || 'N/A'}`)
          console.log(`   • Estado:  ${testInfo?.status || 'N/A'}`)
          console.log(`   • Tema:    ${testInfo?.tema_id || testInfo?.law_id || 'N/A'}`)
          console.log(`   • Preguntas HOY: ${questionsInTest.length}`)
          console.log('')
        }
      }
    } else {
      // Hay tests creados hoy, analizar cada uno
      for (const test of allTests) {
        console.log(`Test ${allTests.indexOf(test) + 1}:`)
        console.log(`   ID:        ${test.id.substring(0, 8)}...`)
        console.log(`   Creado:    ${test.created_at}`)
        console.log(`   Estado:    ${test.status}`)
        console.log(`   Tema/Ley:  ${test.tema_id || test.law_id || 'N/A'}`)
        console.log(`   Config:    ${JSON.stringify(test.config || {}).substring(0, 50)}...`)

        // Contar preguntas de este test
        const { data: testQuestions } = await supabase
          .from('test_questions')
          .select('id, created_at, is_correct')
          .eq('test_id', test.id)

        console.log(`   Preguntas: ${testQuestions?.length || 0}`)

        // Ver cuántas de esas preguntas son de HOY
        const questionsToday = testQuestions?.filter(q => {
          const qDate = new Date(q.created_at)
          return qDate >= todayUTC && qDate <= todayUTCEnd
        }) || []

        if (questionsToday.length > 0 && questionsToday.length !== testQuestions?.length) {
          console.log(`   ⚠️  ${questionsToday.length} preguntas HOY, ${testQuestions.length - questionsToday.length} de otros días`)
        }

        console.log('')
      }
    }

    console.log('='.repeat(80))
    console.log('\n🔍 ANÁLISIS DE LA FUNCIÓN RPC:\n')

    // Ver qué devuelve el RPC con los parámetros exactos
    const { data: rpcResult, error: rpcError } = await supabase.rpc('get_ranking_for_period', {
      p_start_date: todayUTC.toISOString(),
      p_end_date: todayUTCEnd.toISOString(),
      p_min_questions: 0,
      p_limit: 1000
    })

    if (rpcError) {
      console.error('❌ Error en RPC:', rpcError)
    }

    const nilaRPC = rpcResult?.find(r => r.user_id === userId)
    console.log('RPC get_ranking_for_period devuelve:')
    console.log(`   Total preguntas: ${nilaRPC?.total_questions || 0}`)
    console.log(`   Correctas:       ${nilaRPC?.correct_answers || 0}`)
    console.log('')

    // ========================================================================
    // 2. QUERY DIRECTA (simulando lo que hace el RPC)
    // ========================================================================

    console.log('='.repeat(80))
    console.log('\n🔬 QUERY DIRECTA (simulando RPC):\n')

    const { data: directQuery, error: directError } = await supabase
      .from('test_questions')
      .select(`
        id,
        created_at,
        is_correct,
        test_id,
        tests!inner (
          user_id,
          created_at,
          status
        )
      `)
      .eq('tests.user_id', userId)
      .gte('created_at', todayUTC.toISOString())
      .lte('created_at', todayUTCEnd.toISOString())

    if (directError) {
      console.error('❌ Error en query directa:', directError)
    }

    console.log(`Query directa de test_questions:`)
    console.log(`   Total preguntas: ${directQuery?.length || 0}`)
    console.log(`   Correctas:       ${directQuery?.filter(q => q.is_correct).length || 0}`)
    console.log('')

    // ========================================================================
    // 3. VERIFICAR SI HAY FILTROS OCULTOS
    // ========================================================================

    console.log('='.repeat(80))
    console.log('\n🔎 VERIFICACIÓN DE FILTROS OCULTOS:\n')

    // Verificar si todas las preguntas tienen test_id válido
    const questionsWithoutTest = directQuery?.filter(q => !q.test_id) || []
    console.log(`• Preguntas sin test_id: ${questionsWithoutTest.length}`)

    // Verificar si hay preguntas con timestamps fuera de rango (edge case)
    const questionsOutOfRange = directQuery?.filter(q => {
      const qDate = new Date(q.created_at)
      return qDate < todayUTC || qDate > todayUTCEnd
    }) || []
    console.log(`• Preguntas fuera de rango: ${questionsOutOfRange.length}`)

    // Agrupar por test para ver la distribución
    const byTest = {}
    directQuery?.forEach(q => {
      const testId = q.test_id || 'sin-test'
      byTest[testId] = (byTest[testId] || 0) + 1
    })

    console.log(`\n📊 Distribución por test:`)
    Object.entries(byTest).forEach(([testId, count]) => {
      console.log(`   ${testId.substring(0, 8)}... → ${count} preguntas`)
    })

    console.log('\n' + '='.repeat(80))
    console.log('\n🎯 DIAGNÓSTICO:\n')

    const expected = 28 // 3 + 25
    const found = directQuery?.length || 0
    const missing = expected - found

    console.log(`✅ Esperado (según usuario):     28 preguntas (3 + 25)`)
    console.log(`📊 Encontrado en BD:             ${found} preguntas`)
    console.log(`❌ Faltante:                     ${missing} preguntas`)

    if (missing > 0) {
      console.log(`\n⚠️  PROBLEMA: Faltan ${missing} preguntas`)
      console.log(`\nPosibles causas:`)
      console.log(`   1. Las preguntas no se guardaron en test_questions`)
      console.log(`   2. Las preguntas están en otro día (UTC vs local)`)
      console.log(`   3. El test no se completó correctamente`)
      console.log(`   4. Hay un problema con el join tests.user_id`)
    } else if (missing < 0) {
      console.log(`\n⚠️  ANOMALÍA: Hay ${Math.abs(missing)} preguntas EXTRA`)
    } else {
      console.log(`\n✅ CORRECTO: Los números coinciden`)
    }

    console.log('\n' + '='.repeat(80) + '\n')

  } catch (err) {
    console.error('\n❌ ERROR:', err.message)
    console.error(err)
  }
}

debugNilaTests()
