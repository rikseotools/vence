// Script para verificar stats específicos de manuel
// Ejecutar: node scripts/check-manuel-stats.js

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // Usar service role para ver todos los datos
)

async function checkManuelStats() {
  console.log('🔍 INVESTIGANDO STATS DE MANUEL\n')

  // 1. Encontrar user_id de Manuel
  const { data: authUser, error: authError } = await supabase.auth.admin.listUsers()

  if (authError) {
    console.error('❌ Error obteniendo usuarios:', authError)
    return
  }

  const manuel = authUser.users.find(u => u.email === 'manueltrader@gmail.com')

  if (!manuel) {
    console.log('❌ No se encontró usuario con email manueltrader@gmail.com')
    return
  }

  const manuelUserId = manuel.id
  console.log('✅ Usuario encontrado:')
  console.log(`   Email: ${manuel.email}`)
  console.log(`   User ID: ${manuelUserId}`)
  console.log(`   Nombre: ${manuel.user_metadata?.full_name || 'N/A'}`)
  console.log()

  // 2. Calcular fechas de ayer
  const yesterday = new Date()
  yesterday.setUTCDate(yesterday.getUTCDate() - 1)
  yesterday.setUTCHours(0, 0, 0, 0)
  const startDate = yesterday.toISOString()

  const yesterdayEnd = new Date(yesterday)
  yesterdayEnd.setUTCHours(23, 59, 59, 999)
  const endDate = yesterdayEnd.toISOString()

  console.log('📅 Rango de AYER (UTC):')
  console.log(`   ${startDate} → ${endDate}`)
  console.log()

  // 3. Buscar tests de Manuel de ayer
  const { data: manuelTests, error: testsError } = await supabase
    .from('tests')
    .select('id, created_at')
    .eq('user_id', manuelUserId)
    .gte('created_at', startDate)
    .lte('created_at', endDate)

  console.log('🎯 Tests de Manuel de AYER:')
  if (testsError) {
    console.error('   ❌ Error:', testsError)
  } else if (!manuelTests || manuelTests.length === 0) {
    console.log('   ✅ NO HAY TESTS DE AYER')
    console.log('   → Manuel NO hizo tests ayer')
  } else {
    console.log(`   ⚠️ ENCONTRADOS ${manuelTests.length} tests:`)
    manuelTests.forEach(test => {
      console.log(`      - Test ${test.id.substring(0, 8)}... creado: ${test.created_at}`)
    })
  }
  console.log()

  // 4. Buscar respuestas de Manuel de ayer
  const { data: manuelAnswers, error: answersError } = await supabase
    .from('test_questions')
    .select(`
      id,
      created_at,
      is_correct,
      tests!inner(user_id)
    `)
    .eq('tests.user_id', manuelUserId)
    .gte('created_at', startDate)
    .lte('created_at', endDate)

  console.log('📝 Respuestas de Manuel de AYER:')
  if (answersError) {
    console.error('   ❌ Error:', answersError)
  } else if (!manuelAnswers || manuelAnswers.length === 0) {
    console.log('   ✅ NO HAY RESPUESTAS DE AYER')
    console.log('   → Manuel NO respondió preguntas ayer')
  } else {
    const correct = manuelAnswers.filter(a => a.is_correct).length
    const accuracy = Math.round((correct / manuelAnswers.length) * 100)

    console.log(`   ⚠️ ENCONTRADAS ${manuelAnswers.length} respuestas:`)
    console.log(`      Correctas: ${correct}`)
    console.log(`      Accuracy: ${accuracy}%`)
    console.log()
    console.log('   Primeras 5 respuestas:')
    manuelAnswers.slice(0, 5).forEach(answer => {
      console.log(`      - ${answer.created_at} → ${answer.is_correct ? '✅' : '❌'}`)
    })
  }
  console.log()

  // 5. Verificar posición de Manuel en el ranking de ayer
  console.log('🏆 Posición de Manuel en ranking de AYER:')
  const { data: ranking, error: rankingError } = await supabase.rpc('get_ranking_for_period', {
    p_start_date: startDate,
    p_end_date: endDate,
    p_min_questions: 5,
    p_limit: 100
  })

  if (rankingError) {
    console.error('   ❌ Error RPC:', rankingError)
  } else {
    const manuelInRanking = ranking?.find(u => u.user_id === manuelUserId)

    if (manuelInRanking) {
      const rank = ranking.indexOf(manuelInRanking) + 1
      console.log(`   ⚠️ MANUEL ESTÁ EN EL RANKING:`)
      console.log(`      Posición: #${rank}`)
      console.log(`      Preguntas: ${manuelInRanking.total_questions}`)
      console.log(`      Correctas: ${manuelInRanking.correct_answers}`)
      console.log(`      Accuracy: ${manuelInRanking.accuracy}%`)
    } else {
      console.log('   ✅ Manuel NO está en el ranking de ayer')
      console.log('   → Confirmado: No hizo tests ayer')
    }
  }
  console.log()

  // 6. Buscar últimas 10 respuestas de Manuel (sin filtro de fecha)
  console.log('📊 Últimas 10 respuestas de Manuel (cualquier fecha):')
  const { data: recentAnswers, error: recentError } = await supabase
    .from('test_questions')
    .select(`
      id,
      created_at,
      is_correct,
      tests!inner(user_id)
    `)
    .eq('tests.user_id', manuelUserId)
    .order('created_at', { ascending: false })
    .limit(10)

  if (recentError) {
    console.error('   ❌ Error:', recentError)
  } else if (recentAnswers && recentAnswers.length > 0) {
    console.log(`   Últimas ${recentAnswers.length} respuestas:`)
    recentAnswers.forEach((answer, i) => {
      console.log(`      ${i + 1}. ${answer.created_at} → ${answer.is_correct ? '✅' : '❌'}`)
    })
  } else {
    console.log('   ⚠️ No hay respuestas registradas')
  }
  console.log()

  console.log('📋 CONCLUSIÓN:')
  if (!manuelAnswers || manuelAnswers.length === 0) {
    console.log('   ✅ Manuel NO hizo tests ayer (2025-11-22)')
    console.log('   ✅ Manuel NO debe aparecer en el ranking de ayer')
    console.log()
    console.log('   Si el modal muestra a Manuel en el ranking de ayer:')
    console.log('   → Es un BUG de caché o estado antiguo')
    console.log('   → El RPC está funcionando correctamente')
    console.log('   → El problema está en el frontend (RankingModal.js)')
  } else {
    console.log('   ⚠️ Manuel SÍ hizo tests ayer')
    console.log('   ⚠️ Es correcto que aparezca en el ranking')
  }
}

checkManuelStats().catch(console.error)
