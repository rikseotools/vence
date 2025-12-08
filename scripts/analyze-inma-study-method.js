// Analizar cómo estudia Inma Corcuera
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function analyzeInmaStudyMethod() {
  try {
    const inmaId = '7194d681-0047-47da-8d2f-45634b2605a1'

    console.log('🔍 Analizando método de estudio de Inma Corcuera...\n')

    // 1. Ver todos los tests de Inma
    const { data: tests, error: testsError } = await supabase
      .from('tests')
      .select('id, test_type, created_at, is_completed')
      .eq('user_id', inmaId)
      .eq('is_completed', true)
      .order('created_at', { ascending: true })

    if (testsError) {
      console.error('❌ Error:', testsError)
      return
    }

    console.log(`📊 Total de tests completados: ${tests.length}\n`)

    // 2. Ver distribución por tipo de test
    const testTypeCount = {}
    tests.forEach(test => {
      const type = test.test_type || 'unknown'
      testTypeCount[type] = (testTypeCount[type] || 0) + 1
    })

    console.log('📋 Tipos de test:')
    Object.entries(testTypeCount).forEach(([type, count]) => {
      console.log(`  ${type}: ${count} tests (${Math.round(count/tests.length*100)}%)`)
    })
    console.log('')

    // 3. Analizar temas de las preguntas
    const { data: questions, error: questionsError } = await supabase
      .from('test_questions')
      .select('tema_number, article_id, test_id')
      .in('test_id', tests.map(t => t.id))

    if (questionsError) {
      console.error('❌ Error obteniendo preguntas:', questionsError)
      return
    }

    console.log(`📚 Total de preguntas respondidas: ${questions.length}\n`)

    // 4. Distribución por tema
    const temaCount = {}
    questions.forEach(q => {
      const tema = q.tema_number === null ? 'null' : q.tema_number
      temaCount[tema] = (temaCount[tema] || 0) + 1
    })

    console.log('📖 Distribución por tema:')
    const sortedTemas = Object.entries(temaCount).sort((a, b) => b[1] - a[1])
    sortedTemas.forEach(([tema, count]) => {
      const percentage = Math.round(count/questions.length*100)
      const bar = '█'.repeat(Math.floor(percentage/5))
      console.log(`  Tema ${tema === 'null' ? 'ALEATORIO' : tema.padStart(2, '0')}: ${count.toString().padStart(3)} preguntas (${percentage}%) ${bar}`)
    })
    console.log('')

    // 5. ¿Estudia por artículos específicos?
    const articleCount = {}
    questions.forEach(q => {
      if (q.article_id) {
        articleCount[q.article_id] = (articleCount[q.article_id] || 0) + 1
      }
    })

    const totalArticleQuestions = Object.values(articleCount).reduce((a, b) => a + b, 0)
    if (totalArticleQuestions > 0) {
      const porcentajeArticulos = Math.round(totalArticleQuestions / questions.length * 100)
      console.log(`⚖️ Estudia artículos específicos: ${porcentajeArticulos}% de preguntas`)
      console.log(`   (${Object.keys(articleCount).length} artículos diferentes)\n`)
    }

    // 6. Determinar patrón de estudio
    console.log('🎯 CONCLUSIÓN:\n')

    const temaAleatorioCount = temaCount['null'] || temaCount['0'] || 0
    const porcentajeAleatorio = Math.round(temaAleatorioCount / questions.length * 100)

    if (porcentajeAleatorio > 80) {
      console.log('  📌 Inma estudia principalmente con TESTS ALEATORIOS')
      console.log(`     (${porcentajeAleatorio}% de preguntas en tema aleatorio)`)
    } else if (sortedTemas.length > 15) {
      console.log('  📌 Inma estudia de forma VARIADA por múltiples temas')
      console.log(`     (${sortedTemas.length} temas diferentes)`)
    } else if (sortedTemas.length <= 5) {
      console.log('  📌 Inma se ENFOCA en pocos temas específicos')
      console.log(`     (Solo ${sortedTemas.length} temas diferentes)`)
      console.log('\n  Temas principales:')
      sortedTemas.slice(0, 5).forEach(([tema, count]) => {
        console.log(`     - Tema ${tema}: ${count} preguntas`)
      })
    } else {
      console.log('  📌 Inma estudia de forma SISTEMÁTICA por temas')
      console.log(`     (${sortedTemas.length} temas diferentes, distribución equilibrada)`)
    }

    if (totalArticleQuestions > 0) {
      const porcentajeArticulos = Math.round(totalArticleQuestions / questions.length * 100)
      if (porcentajeArticulos > 30) {
        console.log(`\n  ⚖️ También estudia por ARTÍCULOS específicos (${porcentajeArticulos}% de preguntas)`)
      }
    }

    console.log('')

  } catch (err) {
    console.error('❌ Error inesperado:', err)
  }
}

analyzeInmaStudyMethod()
