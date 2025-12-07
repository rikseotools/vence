// Verificar si las preguntas perdidas se guardaron en otra sesión de test
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function checkDuplicateSessions() {
  try {
    console.log('\n🔍 VERIFICANDO SESIONES DUPLICADAS Y PREGUNTAS HUÉRFANAS\n')
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

    // Fecha de hoy
    const todayUTC = new Date()
    todayUTC.setUTCHours(0, 0, 0, 0)
    const todayUTCEnd = new Date(todayUTC)
    todayUTCEnd.setUTCHours(23, 59, 59, 999)

    // 1. BUSCAR TODOS LOS TESTS DE HOY (no solo 2)
    const { data: allTests } = await supabase
      .from('tests')
      .select('id, created_at, completed_at, is_completed, score, total_questions, test_type, topic_id, law_id')
      .eq('user_id', userId)
      .gte('created_at', todayUTC.toISOString())
      .lte('created_at', todayUTCEnd.toISOString())
      .order('created_at', { ascending: true })

    console.log(`📋 TESTS DE HOY: ${allTests?.length || 0}\n`)

    if (allTests && allTests.length > 0) {
      for (let i = 0; i < allTests.length; i++) {
        const test = allTests[i]
        console.log(`Test ${i + 1}:`)
        console.log(`   ID:        ${test.id}`)
        console.log(`   Creado:    ${test.created_at}`)
        console.log(`   Tipo:      ${test.test_type || 'N/A'}`)
        console.log(`   Total Q:   ${test.total_questions || 'N/A'}`)
        console.log(`   Score:     ${test.score || 0}`)
        console.log(`   Completed: ${test.is_completed}`)

        // Contar preguntas en cada test
        const { data: questions } = await supabase
          .from('test_questions')
          .select('question_order')
          .eq('test_id', test.id)
          .order('question_order')

        console.log(`   Preguntas guardadas: ${questions?.length || 0}`)

        if (questions && questions.length > 0) {
          const orders = questions.map(q => q.question_order).sort((a, b) => a - b)
          console.log(`   Órdenes: ${orders.join(', ')}`)
        }

        console.log('')
      }
    }

    // 2. BUSCAR PREGUNTAS DE HOY QUE NO PERTENEZCAN AL TEST 2
    const test2Id = allTests && allTests.length >= 2 ? allTests[1].id : null

    if (test2Id) {
      console.log('='.repeat(80))
      console.log(`\n🔍 BUSCANDO PREGUNTAS HUÉRFANAS (no en test 2: ${test2Id.substring(0, 8)}...)\n`)

      const { data: orphanQuestions } = await supabase
        .from('test_questions')
        .select('test_id, question_order, question_text, created_at, tests!inner(user_id, created_at)')
        .eq('tests.user_id', userId)
        .gte('created_at', todayUTC.toISOString())
        .lte('created_at', todayUTCEnd.toISOString())
        .neq('test_id', test2Id)

      console.log(`Preguntas de hoy en OTROS tests: ${orphanQuestions?.length || 0}`)

      if (orphanQuestions && orphanQuestions.length > 0) {
        const byTest = {}
        orphanQuestions.forEach(q => {
          if (!byTest[q.test_id]) {
            byTest[q.test_id] = []
          }
          byTest[q.test_id].push(q.question_order)
        })

        Object.entries(byTest).forEach(([testId, orders]) => {
          console.log(`   Test ${testId.substring(0, 8)}...: ${orders.sort((a, b) => a - b).join(', ')}`)
        })
      }
      console.log('')
    }

    // 3. BUSCAR PREGUNTAS CON question_order 11-18 EN CUALQUIER SESIÓN
    console.log('='.repeat(80))
    console.log('\n🎯 BUSCANDO ESPECÍFICAMENTE PREGUNTAS 11-18 EN CUALQUIER SESIÓN\n')

    const { data: missingQuestions } = await supabase
      .from('test_questions')
      .select('test_id, question_order, question_text, created_at, is_correct, tests!inner(user_id, created_at)')
      .eq('tests.user_id', userId)
      .gte('created_at', todayUTC.toISOString())
      .lte('created_at', todayUTCEnd.toISOString())
      .in('question_order', [11, 12, 13, 14, 15, 16, 17, 18])
      .order('question_order')

    console.log(`Preguntas 11-18 encontradas: ${missingQuestions?.length || 0}`)

    if (missingQuestions && missingQuestions.length > 0) {
      console.log('\n⚠️  ¡PREGUNTAS PERDIDAS ENCONTRADAS!\n')
      missingQuestions.forEach(q => {
        console.log(`   Orden ${q.question_order}: Test ${q.test_id.substring(0, 8)}... | ${q.created_at} | ${q.is_correct ? '✅' : '❌'}`)
      })
    } else {
      console.log('\n❌ Las preguntas 11-18 NO están en NINGUNA sesión de test')
      console.log('   Esto confirma que hubo un fallo de guardado total durante esas preguntas')
    }

    console.log('\n' + '='.repeat(80))

    // 4. ANÁLISIS DEL TIMING DEL GAP
    if (test2Id) {
      console.log('\n⏱️  ANÁLISIS DEL GAP TEMPORAL EN TEST 2\n')

      const { data: test2Questions } = await supabase
        .from('test_questions')
        .select('question_order, created_at, time_spent_seconds')
        .eq('test_id', test2Id)
        .order('created_at')

      if (test2Questions && test2Questions.length >= 2) {
        for (let i = 0; i < test2Questions.length - 1; i++) {
          const current = test2Questions[i]
          const next = test2Questions[i + 1]

          const currentTime = new Date(current.created_at)
          const nextTime = new Date(next.created_at)
          const gapSeconds = (nextTime - currentTime) / 1000

          // Detectar gaps anormalmente grandes (>60 segundos)
          if (gapSeconds > 60) {
            console.log(`🚨 GAP DETECTADO:`)
            console.log(`   Pregunta ${current.question_order} → Pregunta ${next.question_order}`)
            console.log(`   Gap: ${gapSeconds.toFixed(0)} segundos (${(gapSeconds / 60).toFixed(2)} minutos)`)
            console.log(`   Hora pregunta ${current.question_order}: ${current.created_at}`)
            console.log(`   Hora pregunta ${next.question_order}: ${next.created_at}`)
            console.log('')
          }
        }
      }
    }

    console.log('='.repeat(80) + '\n')

  } catch (err) {
    console.error('\n❌ ERROR:', err.message)
    console.error(err)
  }
}

checkDuplicateSessions()
