// Script para verificar las estadísticas del usuario actual
// Ejecutar: node scripts/check-user-stats.js

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

async function checkUserStats() {
  console.log('🔍 VERIFICANDO ESTADÍSTICAS DEL USUARIO\n')

  // Calcular fechas de "ayer"
  const yesterday = new Date()
  yesterday.setUTCDate(yesterday.getUTCDate() - 1)
  yesterday.setUTCHours(0, 0, 0, 0)
  const startDate = yesterday.toISOString()

  const yesterdayEnd = new Date(yesterday)
  yesterdayEnd.setUTCHours(23, 59, 59, 999)
  const endDate = yesterdayEnd.toISOString()

  console.log('📅 Rango de AYER (UTC):')
  console.log('   Start:', startDate)
  console.log('   End:', endDate)
  console.log()

  // Obtener TODOS los usuarios con sus stats de ayer (sin límite de 5 preguntas)
  console.log('🔍 Consultando TODAS las respuestas de ayer (sin filtro mínimo)...')
  const { data: allAnswers, error: allError } = await supabase
    .from('test_questions')
    .select(`
      id,
      created_at,
      is_correct,
      tests!inner(user_id)
    `)
    .gte('created_at', startDate)
    .lte('created_at', endDate)

  if (allError) {
    console.error('❌ Error:', allError)
    return
  }

  console.log(`📊 Total respuestas de ayer: ${allAnswers?.length || 0}`)
  console.log()

  // Agrupar por usuario
  const userStats = {}
  allAnswers?.forEach(answer => {
    const userId = answer.tests.user_id
    if (!userStats[userId]) {
      userStats[userId] = {
        total: 0,
        correct: 0,
        answers: []
      }
    }
    userStats[userId].total++
    if (answer.is_correct) userStats[userId].correct++
    userStats[userId].answers.push(answer.created_at)
  })

  const usersWithStats = Object.entries(userStats).map(([userId, stats]) => ({
    userId,
    total: stats.total,
    correct: stats.correct,
    accuracy: Math.round((stats.correct / stats.total) * 100),
    firstAnswer: stats.answers[0],
    lastAnswer: stats.answers[stats.answers.length - 1]
  }))

  // Ordenar por accuracy y total
  usersWithStats.sort((a, b) => {
    if (b.accuracy !== a.accuracy) return b.accuracy - a.accuracy
    return b.total - a.total
  })

  console.log('👥 TODOS los usuarios con actividad ayer:')
  usersWithStats.forEach((user, i) => {
    const meetsMinimum = user.total >= 5 ? '✅' : '❌'
    console.log(`   ${meetsMinimum} #${i + 1}: ${user.userId.substring(0, 8)}... - ${user.accuracy}% (${user.total} preguntas)`)
    console.log(`       Primera: ${user.firstAnswer}`)
    console.log(`       Última: ${user.lastAnswer}`)
  })

  console.log()
  console.log(`📊 Total usuarios: ${usersWithStats.length}`)
  console.log(`   Con >= 5 preguntas: ${usersWithStats.filter(u => u.total >= 5).length}`)
  console.log(`   Con < 5 preguntas: ${usersWithStats.filter(u => u.total < 5).length}`)
  console.log()

  // Ahora llamar al RPC y comparar
  console.log('🔍 Llamando a RPC get_ranking_for_period...')
  const { data: rpcRanking, error: rpcError } = await supabase.rpc('get_ranking_for_period', {
    p_start_date: startDate,
    p_end_date: endDate,
    p_min_questions: 5,
    p_limit: 100
  })

  if (rpcError) {
    console.error('❌ Error RPC:', rpcError)
    return
  }

  console.log(`📊 RPC devolvió: ${rpcRanking?.length || 0} usuarios`)
  console.log()

  if (rpcRanking && rpcRanking.length > 0) {
    console.log('🏆 Top 10 del RPC:')
    rpcRanking.slice(0, 10).forEach((user, i) => {
      console.log(`   #${i + 1}: ${user.user_id.substring(0, 8)}... - ${user.accuracy}% (${user.total_questions} preguntas)`)
    })
  }

  console.log()
  console.log('🔍 COMPARACIÓN:')
  console.log(`   Usuarios en base de datos: ${usersWithStats.length}`)
  console.log(`   Usuarios con >= 5 preguntas: ${usersWithStats.filter(u => u.total >= 5).length}`)
  console.log(`   Usuarios devueltos por RPC: ${rpcRanking?.length || 0}`)

  if (usersWithStats.filter(u => u.total >= 5).length !== rpcRanking?.length) {
    console.log('   ⚠️ HAY DISCREPANCIA!')
  } else {
    console.log('   ✅ Los números coinciden')
  }
}

checkUserStats().catch(console.error)
