// Investigación exhaustiva de preguntas de Nila
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function investigateNilaDeep() {
  try {
    console.log('\n🔍 INVESTIGACIÓN EXHAUSTIVA - Usuario Nila\n')
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

    // Fechas
    const now = new Date()
    const todayUTC = new Date()
    todayUTC.setUTCHours(0, 0, 0, 0)
    const todayUTCEnd = new Date(todayUTC)
    todayUTCEnd.setUTCHours(23, 59, 59, 999)

    // Últimas 24 horas (rolling)
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000)

    console.log('📅 RANGOS DE TIEMPO:')
    console.log(`   Ahora:              ${now.toISOString()}`)
    console.log(`   Hoy UTC inicio:     ${todayUTC.toISOString()}`)
    console.log(`   Hoy UTC fin:        ${todayUTCEnd.toISOString()}`)
    console.log(`   Últimas 24h desde:  ${last24h.toISOString()}`)
    console.log('')

    console.log('='.repeat(80))
    console.log('\n📊 ANÁLISIS POR TABLA:\n')

    // 1. TEST_QUESTIONS - Tabla principal
    const { data: tq_today } = await supabase
      .from('test_questions')
      .select('id, created_at, is_correct, tests!inner(user_id, created_at)')
      .eq('tests.user_id', userId)
      .gte('created_at', todayUTC.toISOString())
      .lte('created_at', todayUTCEnd.toISOString())

    const { data: tq_24h } = await supabase
      .from('test_questions')
      .select('id, created_at, is_correct, tests!inner(user_id)')
      .eq('tests.user_id', userId)
      .gte('created_at', last24h.toISOString())

    console.log('1️⃣  TEST_QUESTIONS (tabla principal del RPC):')
    console.log(`   • Hoy UTC:        ${tq_today?.length || 0} preguntas`)
    console.log(`   • Últimas 24h:    ${tq_24h?.length || 0} preguntas`)

    // 2. DETAILED_ANSWERS - Tabla alternativa
    const { data: da_today } = await supabase
      .from('detailed_answers')
      .select('id, created_at, is_correct')
      .eq('user_id', userId)
      .gte('created_at', todayUTC.toISOString())
      .lte('created_at', todayUTCEnd.toISOString())

    const { data: da_24h } = await supabase
      .from('detailed_answers')
      .select('id, created_at, is_correct')
      .eq('user_id', userId)
      .gte('created_at', last24h.toISOString())

    console.log('\n2️⃣  DETAILED_ANSWERS (tabla alternativa):')
    console.log(`   • Hoy UTC:        ${da_today?.length || 0} preguntas`)
    console.log(`   • Últimas 24h:    ${da_24h?.length || 0} preguntas`)

    // 3. TESTS - Tests creados/completados
    const { data: tests_today } = await supabase
      .from('tests')
      .select('id, status, created_at, completed_at')
      .eq('user_id', userId)
      .gte('created_at', todayUTC.toISOString())
      .lte('created_at', todayUTCEnd.toISOString())

    const { data: tests_24h } = await supabase
      .from('tests')
      .select('id, status, created_at')
      .eq('user_id', userId)
      .gte('created_at', last24h.toISOString())

    console.log('\n3️⃣  TESTS (sesiones de test):')
    console.log(`   • Hoy UTC:        ${tests_today?.length || 0} tests`)
    console.log(`   • Últimas 24h:    ${tests_24h?.length || 0} tests`)

    // 4. Función RPC get_ranking_for_period
    const { data: rpc_today } = await supabase.rpc('get_ranking_for_period', {
      p_start_date: todayUTC.toISOString(),
      p_end_date: todayUTCEnd.toISOString(),
      p_min_questions: 0,
      p_limit: 1000
    })

    const nilaRPC = rpc_today?.find(r => r.user_id === userId)

    console.log('\n4️⃣  RPC get_ranking_for_period (usado por ranking modal):')
    console.log(`   • Total preguntas: ${nilaRPC?.total_questions || 0}`)
    console.log(`   • Correctas:       ${nilaRPC?.correct_answers || 0}`)
    console.log(`   • Precisión:       ${nilaRPC?.accuracy || 0}%`)

    console.log('\n' + '='.repeat(80))
    console.log('\n⏰ ANÁLISIS TEMPORAL DETALLADO:\n')

    // Obtener todas las preguntas de las últimas 48 horas con timestamps exactos
    const { data: all_recent } = await supabase
      .from('test_questions')
      .select('id, created_at, is_correct, tests!inner(user_id)')
      .eq('tests.user_id', userId)
      .gte('created_at', new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })

    // Agrupar por hora
    const byHour = {}
    all_recent?.forEach(q => {
      const date = new Date(q.created_at)
      const hour = date.toISOString().substring(0, 13) // "2025-12-07T10"
      byHour[hour] = (byHour[hour] || 0) + 1
    })

    console.log('📊 Distribución por hora (últimas 48h):')
    Object.entries(byHour)
      .sort()
      .reverse()
      .slice(0, 20)
      .forEach(([hour, count]) => {
        const hourDate = new Date(hour + ':00:00Z')
        const isToday = hourDate >= todayUTC && hourDate <= todayUTCEnd
        const is24h = hourDate >= last24h
        const marker = isToday ? '✅ HOY UTC' : (is24h ? '🔵 Últimas 24h' : '⚪ Anterior')
        console.log(`   ${hour}:00 → ${count.toString().padStart(3)} preguntas ${marker}`)
      })

    console.log('\n' + '='.repeat(80))
    console.log('\n🔍 VERIFICACIÓN DE DISCREPANCIAS:\n')

    // Verificar si hay IDs únicos vs duplicados
    const uniqueIds = new Set(tq_today?.map(q => q.id) || [])
    console.log(`• IDs únicos en test_questions hoy: ${uniqueIds.size}`)
    console.log(`• Total registros en test_questions hoy: ${tq_today?.length || 0}`)

    if (uniqueIds.size !== (tq_today?.length || 0)) {
      console.log(`  ⚠️  HAY DUPLICADOS: ${(tq_today?.length || 0) - uniqueIds.size} preguntas duplicadas`)
    }

    // Verificar si detailed_answers tiene datos diferentes
    if ((da_today?.length || 0) > 0) {
      console.log(`\n⚠️  ATENCIÓN: detailed_answers tiene ${da_today?.length} registros`)
      console.log(`   (test_questions tiene ${tq_today?.length})`)

      if (da_today.length !== tq_today?.length) {
        console.log(`   🔴 DISCREPANCIA: ${Math.abs(da_today.length - (tq_today?.length || 0))} preguntas de diferencia`)
      }
    }

    // Verificar preguntas en el borde de medianoche
    const midnightBuffer = 60 * 60 * 1000 // 1 hora
    const nearMidnight = all_recent?.filter(q => {
      const date = new Date(q.created_at)
      const hour = date.getUTCHours()
      return hour === 23 || hour === 0
    })

    if (nearMidnight?.length > 0) {
      console.log(`\n⚠️  ${nearMidnight.length} preguntas cerca de medianoche UTC (23:00-00:59)`)
      console.log(`   Estas pueden causar confusión entre "hoy" y "ayer"`)
    }

    console.log('\n' + '='.repeat(80))
    console.log('\n📌 CONCLUSIÓN:\n')

    const sources = [
      { name: 'test_questions (hoy UTC)', value: tq_today?.length || 0 },
      { name: 'test_questions (24h rolling)', value: tq_24h?.length || 0 },
      { name: 'detailed_answers (hoy UTC)', value: da_today?.length || 0 },
      { name: 'RPC get_ranking_for_period', value: nilaRPC?.total_questions || 0 }
    ]

    const max = Math.max(...sources.map(s => s.value))
    const min = Math.min(...sources.filter(s => s.value > 0).map(s => s.value))

    sources.forEach(s => {
      const marker = s.value === max ? '🔴 MÁXIMO' : (s.value === min ? '🟢 MÍNIMO' : '')
      console.log(`${s.name.padEnd(35)} = ${s.value.toString().padStart(3)} ${marker}`)
    })

    if (max !== min) {
      console.log(`\n🔴 DISCREPANCIA ENCONTRADA: ${max - min} preguntas de diferencia`)
      console.log(`   Fuente máxima: ${max} preguntas`)
      console.log(`   Fuente mínima: ${min} preguntas`)
    } else {
      console.log(`\n✅ CONSISTENCIA: Todas las fuentes muestran ${max} preguntas`)
    }

    console.log('\n' + '='.repeat(80) + '\n')

  } catch (err) {
    console.error('\n❌ ERROR:', err.message)
    console.error(err)
  }
}

investigateNilaDeep()
