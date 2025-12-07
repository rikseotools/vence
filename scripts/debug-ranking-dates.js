// Script para debugear el problema de fechas en el ranking
// Ejecutar: node scripts/debug-ranking-dates.js

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

async function debugRankingDates() {
  console.log('🔍 DEBUGEANDO FILTROS DE FECHA DEL RANKING\n')

  // Calcular fechas de "ayer"
  const yesterday = new Date()
  yesterday.setUTCDate(yesterday.getUTCDate() - 1)
  yesterday.setUTCHours(0, 0, 0, 0)
  const startDate = yesterday.toISOString()

  const yesterdayEnd = new Date(yesterday)
  yesterdayEnd.setUTCHours(23, 59, 59, 999)
  const endDate = yesterdayEnd.toISOString()

  console.log('📅 Filtro AYER:')
  console.log('   Start:', startDate)
  console.log('   End:', endDate)
  console.log()

  // Llamar a la función RPC
  console.log('🔍 Llamando a get_ranking_for_period...')
  const { data: ranking, error } = await supabase.rpc('get_ranking_for_period', {
    p_start_date: startDate,
    p_end_date: endDate,
    p_min_questions: 5,
    p_limit: 100
  })

  if (error) {
    console.error('❌ Error:', error)
    return
  }

  console.log(`📊 Usuarios en ranking de AYER: ${ranking?.length || 0}`)
  console.log()

  if (ranking && ranking.length > 0) {
    console.log('🏆 Top 5:')
    ranking.slice(0, 5).forEach((user, i) => {
      console.log(`   #${i + 1}: ${user.user_id.substring(0, 8)}... - ${user.accuracy}% (${user.total_questions} preguntas)`)
    })
    console.log()
  }

  // Ahora vamos a verificar las fechas reales de las respuestas
  console.log('🔍 Verificando fechas REALES de test_questions...')
  console.log()

  const { data: questions, error: qError } = await supabase
    .from('test_questions')
    .select('created_at, tests!inner(user_id)')
    .gte('created_at', startDate)
    .lte('created_at', endDate)
    .limit(10)

  if (qError) {
    console.error('❌ Error:', qError)
    return
  }

  console.log(`📝 Preguntas respondidas AYER: ${questions?.length || 0}`)

  if (questions && questions.length > 0) {
    console.log('\nPrimeras 10 respuestas:')
    questions.forEach(q => {
      console.log(`   ${q.created_at} - User: ${q.tests.user_id.substring(0, 8)}...`)
    })
  } else {
    console.log('   ⚠️ NO HAY RESPUESTAS DE AYER')
    console.log('   Esto confirma que el filtro está funcionando')
    console.log('   Pero entonces... ¿por qué aparecen usuarios en el ranking?')
  }

  console.log()
  console.log('🔍 Verificando si hay respuestas SIN filtro de fecha...')

  const { data: allQuestions, error: allError } = await supabase
    .from('test_questions')
    .select('created_at')
    .order('created_at', { ascending: false })
    .limit(5)

  if (!allError && allQuestions) {
    console.log('\nÚltimas 5 respuestas (sin filtro):')
    allQuestions.forEach(q => {
      console.log(`   ${q.created_at}`)
    })
  }

  console.log()
  console.log('📋 DIAGNÓSTICO:')
  console.log('   Si hay 0 preguntas de ayer pero usuarios en el ranking:')
  console.log('   → La función RPC NO está respetando p_end_date')
  console.log()
  console.log('   Si hay preguntas de ayer:')
  console.log('   → El usuario SÍ hizo tests ayer (zona horaria?)')
}

debugRankingDates().catch(console.error)
