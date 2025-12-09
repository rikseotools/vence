// Debug detección de método de estudio
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function debugDetection(userId, userName) {
  console.log(`\n${'='.repeat(60)}`)
  console.log(`🔍 DEBUG: ${userName}`)
  console.log('='.repeat(60))

  // 1. Obtener tests con título
  const { data: userTests } = await supabase
    .from('tests')
    .select('id, title')
    .eq('user_id', userId)
    .eq('is_completed', true)

  if (!userTests || userTests.length === 0) {
    console.log('❌ Sin tests completados\n')
    return
  }

  console.log(`\n📊 Total tests: ${userTests.length}`)

  // 2. Analizar títulos
  const temaTests = userTests.filter(t => t.title && t.title.match(/Test Tema \d+/i))
  const temaXTests = userTests.filter(t => t.title && t.title.match(/Test Tema X/i))
  const temaPercentage = Math.round((temaTests.length / userTests.length) * 100)

  console.log(`\n📝 Análisis de títulos:`)
  console.log(`  - Tests con "Tema [número]": ${temaTests.length} (${temaPercentage}%)`)
  console.log(`  - Tests con "Tema X": ${temaXTests.length}`)

  // Mostrar algunos ejemplos
  console.log(`\n🔍 Ejemplos de títulos:`)
  userTests.slice(0, 5).forEach(t => {
    console.log(`  - "${t.title}"`)
  })

  // 3. Lógica de detección
  console.log(`\n🎯 DETECCIÓN:`)

  if (temaPercentage > 50) {
    console.log(`  ✅ Detectado como ESTUDIA POR TEMAS (${temaPercentage}% > 50%)`)
  } else if (temaXTests.length > 0) {
    console.log(`  ⚠️ Es "Tema X", analizando porcentajes...`)

    // Analizar porcentajes
    const { data: questionsData } = await supabase
      .from('test_questions')
      .select('article_id')
      .in('test_id', userTests.map(t => t.id))

    if (questionsData && questionsData.length > 0) {
      const totalQuestions = questionsData.length
      const withArticle = questionsData.filter(q => q.article_id !== null).length
      const uniqueArticles = new Set(questionsData.filter(q => q.article_id).map(q => q.article_id))
      const articlePercentage = Math.round((withArticle / totalQuestions) * 100)

      console.log(`     Preguntas totales: ${totalQuestions}`)
      console.log(`     Con article_id: ${withArticle} (${articlePercentage}%)`)
      console.log(`     Artículos únicos: ${uniqueArticles.size}`)

      if (articlePercentage > 70) {
        console.log(`  ✅ Detectado como ESTUDIA POR LEYES (${articlePercentage}% > 70%)`)
      } else {
        console.log(`  ✅ Detectado como TESTS ALEATORIOS (${articlePercentage}% <= 70%)`)
      }
    }
  } else {
    console.log(`  ✅ Detectado como TESTS ALEATORIOS (por defecto)`)
  }
}

async function main() {
  console.log('🔍 Debugeando detección de método de estudio...\n')

  // Buscar Nila
  const { data: nila } = await supabase
    .from('user_profiles')
    .select('id, full_name')
    .ilike('full_name', '%nila%')
    .single()

  if (nila) {
    await debugDetection(nila.id, nila.full_name)
  }

  // Buscar Manuel
  const { data: manuel } = await supabase
    .from('user_profiles')
    .select('id, full_name')
    .ilike('full_name', '%manuel%')
    .single()

  if (manuel) {
    await debugDetection(manuel.id, manuel.full_name)
  }

  // También Inma para comparar
  await debugDetection('7194d681-0047-47da-8d2f-45634b2605a1', 'Inma Corcuera')
}

main()
