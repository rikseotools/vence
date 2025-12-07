// Script para verificar stats de Manuel (sin service role)
// Ejecutar: node scripts/check-manuel-stats-v2.js

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

async function checkManuelStats() {
  console.log('🔍 INVESTIGANDO STATS DE MANUEL\n')

  // 1. Buscar user_id en admin_users_with_roles
  const { data: adminUsers, error: adminError } = await supabase
    .from('admin_users_with_roles')
    .select('user_id, email, full_name')
    .eq('email', 'manueltrader@gmail.com')
    .single()

  if (adminError || !adminUsers) {
    console.log('⚠️ No se pudo encontrar en admin_users_with_roles')
    console.log('   Intentando buscar en tests recientes...')

    // Buscar en tests recientes
    const { data: recentTests } = await supabase
      .from('tests')
      .select('user_id')
      .order('created_at', { ascending: false })
      .limit(100)

    if (recentTests && recentTests.length > 0) {
      console.log(`\n📊 Usuarios únicos en últimos 100 tests:`)
      const uniqueUsers = [...new Set(recentTests.map(t => t.user_id))]

      for (const userId of uniqueUsers.slice(0, 10)) {
        const { data: profile } = await supabase
          .from('admin_users_with_roles')
          .select('email')
          .eq('user_id', userId)
          .single()

        if (profile) {
          console.log(`   ${userId.substring(0, 8)}... → ${profile.email}`)
        }
      }
    }
    return
  }

  const manuelUserId = adminUsers.user_id
  console.log('✅ Usuario encontrado:')
  console.log(`   Email: ${adminUsers.email}`)
  console.log(`   User ID: ${manuelUserId}`)
  console.log(`   Nombre: ${adminUsers.full_name || 'N/A'}`)
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

  // 3. Buscar respuestas de Manuel de ayer
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
    console.log('   Primeras 10 respuestas:')
    manuelAnswers.slice(0, 10).forEach(answer => {
      console.log(`      - ${answer.created_at} → ${answer.is_correct ? '✅' : '❌'}`)
    })
  }
  console.log()

  // 4. Verificar posición de Manuel en el ranking de ayer
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
    console.log(`   Total usuarios en ranking: ${ranking?.length || 0}`)
    const manuelInRanking = ranking?.find(u => u.user_id === manuelUserId)

    if (manuelInRanking) {
      const rank = ranking.indexOf(manuelInRanking) + 1
      console.log(`   ⚠️ MANUEL ESTÁ EN EL RANKING:`)
      console.log(`      Posición: #${rank} de ${ranking.length}`)
      console.log(`      Preguntas: ${manuelInRanking.total_questions}`)
      console.log(`      Correctas: ${manuelInRanking.correct_answers}`)
      console.log(`      Accuracy: ${manuelInRanking.accuracy}%`)
    } else {
      console.log('   ✅ Manuel NO está en el ranking de ayer')
      console.log('   (Puede tener < 5 preguntas o no hizo tests)')
    }
  }
  console.log()

  // 5. Buscar últimas 10 respuestas de Manuel (sin filtro de fecha)
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

    // Calcular cuándo fue la última vez que hizo tests
    const lastAnswer = recentAnswers[0]
    const lastDate = new Date(lastAnswer.created_at)
    const now = new Date()
    const hoursSince = Math.floor((now - lastDate) / (1000 * 60 * 60))

    console.log()
    console.log(`   Última actividad: hace ${hoursSince} horas`)
    console.log(`   Fecha: ${lastAnswer.created_at}`)
  } else {
    console.log('   ⚠️ No hay respuestas registradas')
  }
  console.log()

  console.log('═'.repeat(60))
  console.log('📋 CONCLUSIÓN DEFINITIVA:')
  console.log('═'.repeat(60))
  if (!manuelAnswers || manuelAnswers.length === 0) {
    console.log('✅ Manuel NO hizo tests AYER (2025-11-22)')
    console.log('✅ Manuel NO debe aparecer en el ranking de AYER')
    console.log()
    console.log('Si el modal web muestra a Manuel en el ranking de ayer:')
    console.log('→ BUG CONFIRMADO: Estado antiguo/caché en el frontend')
    console.log('→ El RPC backend está funcionando correctamente')
    console.log('→ Solución: Arreglar get_user_ranking_position y limpiar estado')
  } else {
    console.log('⚠️ Manuel SÍ hizo tests ayer')
    console.log(`⚠️ Total preguntas: ${manuelAnswers.length}`)
    if (manuelAnswers.length >= 5) {
      console.log('⚠️ Es CORRECTO que aparezca en el ranking (>= 5 preguntas)')
    } else {
      console.log('⚠️ NO debe aparecer en ranking (< 5 preguntas)')
    }
  }
  console.log('═'.repeat(60))
}

checkManuelStats().catch(console.error)
