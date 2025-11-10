#!/usr/bin/env node

// scripts/analyze-conceptos-generales.js
// Analizar con IA todas las preguntas de conceptos generales de procedimiento administrativo

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function analyzeConceptosGenerales() {
  try {
    console.log('🤖 ANÁLISIS IA: CONCEPTOS GENERALES - PROCEDIMIENTO ADMINISTRATIVO\n')

    // Obtener ID de la sección conceptos-generales
    const { data: collection } = await supabase
      .from('content_collections')
      .select('id')
      .eq('slug', 'procedimiento-administrativo')
      .single()

    if (!collection) {
      console.log('❌ No se encontró la colección procedimiento-administrativo')
      return
    }

    const { data: section } = await supabase
      .from('content_sections')
      .select('id, name')
      .eq('collection_id', collection.id)
      .eq('slug', 'conceptos-generales')
      .single()

    if (!section) {
      console.log('❌ No se encontró la sección conceptos-generales')
      return
    }

    console.log(`📋 Analizando sección: ${section.name} (ID: ${section.id})\n`)

    // Buscar preguntas relacionadas con conceptos generales
    const conceptosKeywords = [
      'Ley 39/2015',
      'principios de actuación',
      'derechos de los ciudadanos', 
      'capacidad de obrar',
      'procedimiento administrativo común',
      'ámbito de aplicación',
      'definiciones',
      'conceptos básicos'
    ]

    let allQuestions = new Set()
    
    // Buscar por cada keyword
    for (const keyword of conceptosKeywords) {
      console.log(`🔍 Buscando preguntas con: "${keyword}"`)
      
      const { data: questions } = await supabase
        .from('questions')
        .select(`
          id, 
          question_text,
          articles!inner (
            id,
            article_number,
            laws!inner (
              id,
              short_name,
              name
            )
          )
        `)
        .ilike('question_text', `%${keyword}%`)
        .eq('is_active', true)
        .limit(50)

      if (questions && questions.length > 0) {
        console.log(`   📝 Encontradas: ${questions.length} preguntas`)
        questions.forEach(q => allQuestions.add(JSON.stringify(q)))
      }
    }

    const uniqueQuestions = Array.from(allQuestions).map(q => JSON.parse(q))
    console.log(`\n📊 TOTAL DE PREGUNTAS ÚNICAS ENCONTRADAS: ${uniqueQuestions.length}\n`)

    // Analizar cada pregunta con IA (simulado)
    const analysisResults = []
    
    for (const [index, question] of uniqueQuestions.slice(0, 20).entries()) {
      console.log(`🤖 Analizando pregunta ${index + 1}/20:`)
      console.log(`   📝 "${question.question_text.substring(0, 80)}..."`)
      
      const analysis = await analyzeQuestionWithAI(question)
      analysisResults.push({
        questionId: question.id,
        lawId: question.articles?.laws?.id,
        lawShortName: question.articles?.laws?.short_name,
        articleNumber: question.articles?.article_number,
        isConceptosGenerales: analysis.isConceptosGenerales,
        confidence: analysis.confidence,
        reasoning: analysis.reasoning
      })
      
      console.log(`   🎯 Es conceptos generales: ${analysis.isConceptosGenerales} (${analysis.confidence}%)`)
      console.log(`   💭 Razón: ${analysis.reasoning}`)
      console.log('')
    }

    // Mostrar resumen
    const validQuestions = analysisResults.filter(r => r.isConceptosGenerales && r.confidence >= 70)
    console.log(`📈 RESUMEN DEL ANÁLISIS:`)
    console.log(`   ✅ Preguntas válidas para conceptos generales: ${validQuestions.length}`)
    console.log(`   📊 Preguntas analizadas: ${analysisResults.length}`)
    console.log(`   📋 Preguntas totales encontradas: ${uniqueQuestions.length}`)

    // Agrupar por ley y artículo
    const lawArticleMap = {}
    validQuestions.forEach(q => {
      if (!lawArticleMap[q.lawShortName]) {
        lawArticleMap[q.lawShortName] = {
          lawId: q.lawId,
          articles: new Set()
        }
      }
      if (q.articleNumber) {
        lawArticleMap[q.lawShortName].articles.add(q.articleNumber)
      }
    })

    console.log(`\n🏛️ MAPEO PARA CONTENT_SCOPE (conceptos-generales):`)
    Object.entries(lawArticleMap).forEach(([lawName, data]) => {
      const articlesArray = Array.from(data.articles).sort()
      console.log(`   📚 ${lawName}:`)
      console.log(`       - ID: ${data.lawId}`)
      console.log(`       - Artículos: [${articlesArray.join(', ')}]`)
    })

    return {
      sectionId: section.id,
      validQuestions,
      lawArticleMap,
      totalAnalyzed: analysisResults.length
    }

  } catch (error) {
    console.error('❌ Error en análisis:', error.message)
  }
}

// Simular análisis con IA
async function analyzeQuestionWithAI(question) {
  // En un caso real, aquí iría una llamada a OpenAI/Claude
  // Por ahora, simular análisis basado en contenido
  
  const questionText = question.question_text.toLowerCase()
  
  // Criterios para conceptos generales
  const conceptosKeywords = [
    'ley 39/2015', 'ámbito de aplicación', 'principios', 'derechos',
    'capacidad', 'definiciones', 'conceptos', 'administración pública',
    'ciudadanos', 'interesados', 'procedimiento administrativo común'
  ]
  
  let score = 0
  let foundKeywords = []
  
  conceptosKeywords.forEach(keyword => {
    if (questionText.includes(keyword)) {
      score += 15
      foundKeywords.push(keyword)
    }
  })
  
  // Bonus si menciona artículos típicos de conceptos generales (1-8)
  const articleMatches = questionText.match(/art[íi]culo\s*(\d+)/g)
  if (articleMatches) {
    articleMatches.forEach(match => {
      const articleNum = parseInt(match.match(/\d+/)[0])
      if (articleNum >= 1 && articleNum <= 8) {
        score += 20
      }
    })
  }
  
  const confidence = Math.min(score, 100)
  const isConceptosGenerales = confidence >= 50
  
  const reasoning = `Encontradas keywords: [${foundKeywords.join(', ')}]. Score: ${score}.`
  
  return {
    isConceptosGenerales,
    confidence,
    reasoning
  }
}

// Ejecutar si es llamado directamente
if (process.env.NODE_ENV !== 'test') {
  analyzeConceptosGenerales()
    .then(result => {
      if (result) {
        console.log('\n✅ Análisis completado exitosamente')
      }
    })
    .catch(error => {
      console.error('❌ Error:', error.message)
      process.exit(1)
    })
}