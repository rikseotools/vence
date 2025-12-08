// Script para verificar los temas dominados de David
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function checkDavidMasteredTopics() {
  try {
    const davidId = 'b375abac-c2a8-41c3-9c2b-bf937c9a5619'

    console.log('🔍 Analizando temas dominados de David...\n')

    // 1. Obtener estadísticas generales de David
    const { data: publicStats, error: statsError } = await supabase.rpc('get_user_public_stats', {
      p_user_id: davidId
    })

    if (statsError) {
      console.error('❌ Error obteniendo stats:', statsError)
      return
    }

    console.log('📊 ESTADÍSTICAS GENERALES:')
    console.log(`  Total preguntas: ${publicStats[0].total_questions}`)
    console.log(`  Precisión global: ${publicStats[0].global_accuracy}%`)
    console.log(`  Tests completados: ${publicStats[0].total_tests_completed}`)
    console.log(`  Temas dominados (RPC): ${publicStats[0].mastered_topics}`)
    console.log('')

    // 2. Verificar si existe la función get_user_theme_stats
    console.log('🔍 Verificando get_user_theme_stats...\n')

    const { data: themeStats, error: themeError } = await supabase.rpc('get_user_theme_stats', {
      p_user_id: davidId
    })

    if (themeError) {
      console.log('⚠️ get_user_theme_stats no disponible o hay error:', themeError.message)
      console.log('')
    } else if (themeStats && themeStats.length > 0) {
      console.log(`📚 ESTADÍSTICAS POR TEMA (${themeStats.length} temas con datos):`)

      // Contar cuántos temas cumplen criterios de "dominado"
      let temasConMas10Preguntas = 0
      let temasConMas80Precision = 0
      let temasDominados = 0

      themeStats.forEach(tema => {
        const precision = Math.round((tema.correct_count / tema.total_questions) * 100)
        const dominado = tema.total_questions >= 10 && precision >= 80

        if (tema.total_questions >= 10) temasConMas10Preguntas++
        if (precision >= 80) temasConMas80Precision++
        if (dominado) temasDominados++

        console.log(`  Tema ${tema.tema_number}: ${tema.total_questions} preguntas, ${precision}% precisión ${dominado ? '✅ DOMINADO' : ''}`)
      })

      console.log('')
      console.log('📊 RESUMEN:')
      console.log(`  Temas con ≥10 preguntas: ${temasConMas10Preguntas}`)
      console.log(`  Temas con ≥80% precisión: ${temasConMas80Precision}`)
      console.log(`  Temas DOMINADOS (≥10 preguntas Y ≥80%): ${temasDominados}`)
      console.log('')
      console.log(`⚠️ DISCREPANCIA: RPC dice ${publicStats[0].mastered_topics} pero deberían ser ${temasDominados}`)
    }

    // 3. Verificar directamente en test_questions (JOIN con tests)
    console.log('\n🔍 Consultando directamente test_questions...\n')

    // Primero obtener todos los test_ids de David
    const { data: tests, error: testsError } = await supabase
      .from('tests')
      .select('id')
      .eq('user_id', davidId)

    if (testsError) {
      console.error('❌ Error obteniendo tests:', testsError)
      return
    }

    const testIds = tests.map(t => t.id)
    console.log(`  David tiene ${testIds.length} tests\n`)

    // Ahora obtener todas las preguntas de esos tests
    const { data: answers, error: answersError } = await supabase
      .from('test_questions')
      .select('tema_number, is_correct')
      .in('test_id', testIds)

    if (answersError) {
      console.error('❌ Error:', answersError)
      return
    }

    // Agrupar por tema
    const temaStats = {}
    answers.forEach(answer => {
      const tema = answer.tema_number || 0
      if (!temaStats[tema]) {
        temaStats[tema] = { total: 0, correct: 0 }
      }
      temaStats[tema].total++
      if (answer.is_correct) temaStats[tema].correct++
    })

    console.log(`📚 ANÁLISIS DIRECTO DESDE test_questions (${Object.keys(temaStats).length} temas):\n`)

    let temasDominadosReal = 0
    Object.keys(temaStats).sort((a, b) => a - b).forEach(tema => {
      const stats = temaStats[tema]
      const precision = Math.round((stats.correct / stats.total) * 100)
      const dominado = stats.total >= 10 && precision >= 80

      if (dominado) temasDominadosReal++

      // Mostrar TODOS los temas, incluyendo tema 0
      console.log(`  Tema ${tema}: ${stats.total} preguntas, ${precision}% precisión ${dominado ? '✅ DOMINADO' : ''}`)
    })

    console.log('')
    console.log('=' .repeat(60))
    console.log(`🎯 CONCLUSIÓN:`)
    console.log(`  David debería tener: ${temasDominadosReal} temas dominados`)
    console.log(`  RPC devuelve: ${publicStats[0].mastered_topics}`)
    console.log(`  Diferencia: ${temasDominadosReal - publicStats[0].mastered_topics} temas`)
    console.log('=' .repeat(60))

  } catch (err) {
    console.error('❌ Error inesperado:', err)
  }
}

checkDavidMasteredTopics()
