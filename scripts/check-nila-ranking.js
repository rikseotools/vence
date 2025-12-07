// Script para verificar preguntas de Nila en el ranking
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function checkNilaRanking() {
  try {
    console.log('\n🔍 Buscando usuario Nila...\n')

    // Buscar en public_user_profiles con display_name
    const { data: profiles, error: profileError } = await supabase
      .from('public_user_profiles')
      .select('id, display_name')

    if (profileError) {
      console.log('⚠️  No se pudieron cargar profiles:', profileError.message)
    }

    const nilaProfile = profiles?.find(p =>
      p.display_name?.toLowerCase().includes('nila')
    )

    let nila = null
    let nilaUserId = null

    if (nilaProfile) {
      nilaUserId = nilaProfile.id
      console.log('✅ Encontrado en public_user_profiles:')
      console.log(`   Display name: ${nilaProfile.display_name}`)
      console.log(`   User ID: ${nilaUserId}\n`)

      // Obtener datos completos del usuario
      const { data: userData } = await supabase.auth.admin.getUserById(nilaUserId)
      nila = userData?.user
    } else {
      // Buscar en auth users
      const { data: users, error: userError } = await supabase.auth.admin.listUsers()

      if (userError) {
        console.error('❌ Error:', userError.message)
        return
      }

      nila = users.users.find(u =>
        u.email?.toLowerCase().includes('nila') ||
        u.user_metadata?.full_name?.toLowerCase().includes('nila')
      )
    }

    if (!nila) {
      console.log('❌ Usuario Nila no encontrado')
      console.log('\n📧 Primeros 20 display_names disponibles:')
      profiles?.slice(0, 20).forEach(p => {
        console.log(`   - @${p.display_name || 'sin nombre'} (${p.id.substring(0, 8)}...)`)
      })
      return
    }

    const userId = nilaUserId || nila.id

    console.log('✅ Usuario encontrado:')
    console.log(`   Email: ${nila.email}`)
    console.log(`   ID: ${userId}`)
    console.log(`   Nombre: ${nila.user_metadata?.full_name || 'N/A'}`)
    if (nilaProfile) {
      console.log(`   Display name: @${nilaProfile.display_name}`)
    }
    console.log('')

    // Calcular "hoy" en UTC (como lo hace el ranking)
    const today = new Date()
    today.setUTCHours(0, 0, 0, 0)
    const startDate = today.toISOString()

    const todayEnd = new Date(today)
    todayEnd.setUTCHours(23, 59, 59, 999)
    const endDate = todayEnd.toISOString()

    console.log('📅 Rango de fechas (UTC):')
    console.log(`   Inicio: ${startDate}`)
    console.log(`   Fin:    ${endDate}\n`)

    // Obtener TODAS las preguntas del usuario (sin límite de fecha)
    const { data: allQuestions, error: allError } = await supabase
      .from('test_questions')
      .select(`
        id,
        created_at,
        is_correct,
        test_id,
        tests!inner(user_id)
      `)
      .eq('tests.user_id', userId)
      .order('created_at', { ascending: false })

    if (allError) {
      console.error('❌ Error obteniendo todas las preguntas:', allError)
      return
    }

    console.log(`📊 TODAS las preguntas: ${allQuestions.length}\n`)

    // Obtener preguntas de HOY según UTC
    const { data: todayQuestions, error: todayError } = await supabase
      .from('test_questions')
      .select(`
        id,
        created_at,
        is_correct,
        test_id,
        tests!inner(user_id)
      `)
      .eq('tests.user_id', userId)
      .gte('created_at', startDate)
      .lte('created_at', endDate)
      .order('created_at', { ascending: false })

    if (todayError) {
      console.error('❌ Error obteniendo preguntas de hoy:', todayError)
      return
    }

    console.log(`📊 Preguntas HOY (UTC): ${todayQuestions.length}`)
    console.log(`   Correctas: ${todayQuestions.filter(q => q.is_correct).length}`)
    console.log(`   Incorrectas: ${todayQuestions.filter(q => !q.is_correct).length}\n`)

    // Calcular "hoy" en hora local de España (UTC+1)
    const spainToday = new Date()
    spainToday.setHours(0, 0, 0, 0) // Medianoche hora local
    const spainStart = new Date(spainToday.getTime() - (1 * 60 * 60 * 1000)) // Convertir a UTC

    const spainTodayEnd = new Date(spainToday)
    spainTodayEnd.setHours(23, 59, 59, 999)
    const spainEnd = new Date(spainTodayEnd.getTime() - (1 * 60 * 60 * 1000))

    const { data: spainTodayQuestions } = await supabase
      .from('test_questions')
      .select(`id, created_at, is_correct, tests!inner(user_id)`)
      .eq('tests.user_id', userId)
      .gte('created_at', spainStart.toISOString())
      .lte('created_at', spainEnd.toISOString())

    console.log(`📊 Preguntas HOY (hora España UTC+1): ${spainTodayQuestions?.length || 0}`)
    console.log(`   Rango: ${spainStart.toISOString()} a ${spainEnd.toISOString()}`)
    console.log(`   (Esto sería de 00:00 a 23:59 hora local de España)\n`)

    // Verificar si hay diferencia entre detailed_answers y test_questions
    const { data: detailedAnswers } = await supabase
      .from('detailed_answers')
      .select('id, created_at, is_correct, user_id')
      .eq('user_id', userId)
      .gte('created_at', startDate)
      .lte('created_at', endDate)

    console.log(`📊 Respuestas en detailed_answers HOY (UTC): ${detailedAnswers?.length || 0}`)

    // Ver tests activos/completados de hoy
    const { data: todayTests } = await supabase
      .from('tests')
      .select('id, status, created_at, completed_at')
      .eq('user_id', userId)
      .gte('created_at', startDate)
      .lte('created_at', endDate)

    const completedTests = todayTests?.filter(t => t.status === 'completed').length || 0
    const activeTests = todayTests?.filter(t => t.status === 'active').length || 0

    console.log(`📊 Tests de hoy:`)
    console.log(`   Completados: ${completedTests}`)
    console.log(`   Activos (sin terminar): ${activeTests}`)
    console.log(`   Total: ${todayTests?.length || 0}\n`)

    // Usar la función RPC para verificar lo que devuelve
    const { data: rankingData, error: rankingError } = await supabase.rpc('get_ranking_for_period', {
      p_start_date: startDate,
      p_end_date: endDate,
      p_min_questions: 5,
      p_limit: 100
    })

    if (rankingError) {
      console.error('❌ Error en RPC:', rankingError)
      return
    }

    const nilaInRanking = rankingData?.find(r => r.user_id === userId)

    if (nilaInRanking) {
      console.log('🏆 Nila en el ranking RPC:')
      console.log(`   Total preguntas: ${nilaInRanking.total_questions}`)
      console.log(`   Respuestas correctas: ${nilaInRanking.correct_answers}`)
      console.log(`   Precisión: ${nilaInRanking.accuracy}%\n`)
    } else {
      console.log('⚠️  Nila NO aparece en el ranking RPC (menos de 5 preguntas hoy)\n')
    }

    // Agrupar preguntas recientes por hora local de España (UTC+1)
    console.log('🕐 Distribución por hora (últimas 50 preguntas):')
    const recent = allQuestions.slice(0, 50)
    const byHour = {}

    recent.forEach(q => {
      const date = new Date(q.created_at)
      const spainHour = new Date(date.getTime() + (1 * 60 * 60 * 1000)) // UTC+1
      const hourKey = spainHour.toISOString().substring(0, 13) // "2025-01-23T14"
      byHour[hourKey] = (byHour[hourKey] || 0) + 1
    })

    Object.entries(byHour)
      .sort()
      .reverse()
      .slice(0, 10)
      .forEach(([hour, count]) => {
        const utcDate = new Date(hour)
        const isToday = utcDate >= new Date(startDate) && utcDate <= new Date(endDate)
        console.log(`   ${hour} → ${count} preguntas ${isToday ? '✅ (hoy UTC)' : '⚠️  (NO hoy UTC)'}`)
      })

    console.log('\n')

    // Verificar si hay preguntas cerca de la medianoche
    const midnight = allQuestions.filter(q => {
      const hour = new Date(q.created_at).getUTCHours()
      return hour === 0 || hour === 23
    })

    if (midnight.length > 0) {
      console.log(`⚠️  ADVERTENCIA: ${midnight.length} preguntas cerca de medianoche UTC`)
      console.log('   Esto puede causar discrepancias entre zona horaria local y UTC\n')
    }

  } catch (err) {
    console.error('❌ Error:', err.message)
    console.error(err)
  }
}

checkNilaRanking()
