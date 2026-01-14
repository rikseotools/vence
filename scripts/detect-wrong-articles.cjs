#!/usr/bin/env node
/**
 * detect-wrong-articles.cjs
 *
 * Detecta preguntas con artículos mal asignados usando embeddings.
 * Compara la similitud semántica entre la pregunta y el artículo asignado.
 * Si la similitud es baja (<60%), probablemente está mal asignado.
 *
 * Uso:
 *   node scripts/detect-wrong-articles.cjs [opciones]
 *
 * Opciones:
 *   --limit <N>              Número máximo de preguntas a analizar (default: 1000)
 *   --threshold <0.0-1.0>    Umbral de similitud para considerar correcto (default: 0.60)
 *   --topk <N>               Número de artículos similares a buscar (default: 10)
 *   --topic <topic_id>       Filtrar por topic específico
 *   --exclude-informatica    Excluir preguntas de informática/ofimática
 *   --dry-run                No guardar cambios en BD, solo mostrar resultados
 *
 * Ejemplos:
 *   node scripts/detect-wrong-articles.cjs --limit 100 --dry-run
 *   node scripts/detect-wrong-articles.cjs --limit 500 --exclude-informatica --threshold 0.65
 *   node scripts/detect-wrong-articles.cjs --topic 45b9727b-66ba-4d05-8a1b-7cc955e7914c
 *
 * Resultado:
 *   Las preguntas con artículo mal asignado se marcan con:
 *   - topic_review_status = 'wrong_article'
 *   - verification_status = 'problem'
 */

require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')
const OpenAI = require('openai')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

let openai = null

async function getOpenAIClient() {
  if (openai) return openai

  // Obtener API key de ai_api_config
  const { data: config } = await supabase
    .from('ai_api_config')
    .select('api_key_encrypted')
    .eq('provider', 'openai')
    .single()

  if (!config?.api_key_encrypted) {
    throw new Error('No se encontró API key de OpenAI en ai_api_config')
  }

  const apiKey = Buffer.from(config.api_key_encrypted, 'base64').toString('utf-8')
  openai = new OpenAI({ apiKey })
  return openai
}

// Parse args
const args = process.argv.slice(2)
const getArg = (name) => {
  const idx = args.indexOf(name)
  return idx !== -1 ? args[idx + 1] : null
}
const hasFlag = (name) => args.includes(name)

const TOPIC_ID = getArg('--topic')
const LIMIT = parseInt(getArg('--limit') || '1000')
const DRY_RUN = hasFlag('--dry-run')
const EXCLUDE_INFORMATICA = hasFlag('--exclude-informatica')
const SIMILARITY_THRESHOLD = parseFloat(getArg('--threshold') || '0.60') // Mínimo de similitud
const TOP_K = parseInt(getArg('--topk') || '10') // Número de artículos similares a buscar

// IDs de "leyes" de informática (no son leyes reales, son categorías de ofimática)
const INFORMATICA_LAW_IDS = [
  'b403019a-bdf7-4795-886e-1d26f139602d', // Base de datos: Access
  'c9df042b-15df-4285-affb-6c93e2a71139', // Correo electrónico
  '9c0b25a4-c819-478c-972f-ee462d724a40', // Explorador Windows 11
  'c7475712-5ae4-4bec-9bd5-ff646c378e33', // Hojas de cálculo. Excel
  '82fd3977-ecf7-4f36-a6df-95c41445d3c2', // Informática Básica
  '7814de3a-7c9c-4045-88c2-d452b31f449a', // La Red Internet
  '850852d6-b5f9-4f04-8e6c-1d70c70ef400', // Portal de Internet
  '86f671a9-4fd8-42e6-91db-694f27eb4292', // Procesadores de texto
  '932efcfb-5dce-4bcc-9c6c-55eab19752b0', // Windows 11
]

async function generateEmbedding(text) {
  const client = await getOpenAIClient()
  // IMPORTANTE: Usar mismo modelo que generate-embeddings.cjs
  const response = await client.embeddings.create({
    model: 'text-embedding-3-small',
    input: text.replace(/\s+/g, ' ').trim().substring(0, 30000)
  })
  return response.data[0].embedding
}

async function findSimilarArticles(embedding, lawId = null) {
  // Usar la función RPC match_articles
  const { data, error } = await supabase.rpc('match_articles', {
    query_embedding: embedding,
    match_threshold: 0.3, // Usar threshold bajo para obtener más resultados
    match_count: TOP_K
  })

  if (error) {
    console.error('Error en match_articles:', error.message)
    return []
  }

  return data || []
}

// Calcular similitud coseno entre dos vectores
function cosineSimilarity(vecA, vecB) {
  let dotProduct = 0
  let normA = 0
  let normB = 0
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i]
    normA += vecA[i] * vecA[i]
    normB += vecB[i] * vecB[i]
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
}

// Obtener embedding de un artículo específico
async function getArticleEmbedding(articleId) {
  const { data } = await supabase
    .from('articles')
    .select('embedding')
    .eq('id', articleId)
    .single()

  if (data?.embedding) {
    return JSON.parse(data.embedding)
  }
  return null
}

async function main() {
  console.log('🔍 Detector de Artículos Mal Asignados')
  console.log('=====================================')
  console.log(`📊 Configuración:`)
  console.log(`   - Topic: ${TOPIC_ID || 'TODOS'}`)
  console.log(`   - Límite: ${LIMIT}`)
  console.log(`   - Dry run: ${DRY_RUN}`)
  console.log(`   - Excluir informática: ${EXCLUDE_INFORMATICA}`)
  console.log(`   - Umbral similitud: ${SIMILARITY_THRESHOLD}`)
  console.log(`   - Top K: ${TOP_K}`)
  console.log('')

  // 1. Obtener preguntas con artículo asignado
  let query = supabase
    .from('questions')
    .select(`
      id,
      question_text,
      option_a,
      option_b,
      option_c,
      option_d,
      correct_option,
      explanation,
      primary_article_id,
      topic_review_status,
      articles!primary_article_id (
        id,
        article_number,
        law_id,
        laws (short_name)
      )
    `)
    .eq('is_active', true)
    .not('primary_article_id', 'is', null)
    .limit(LIMIT)

  if (TOPIC_ID) {
    // Filtrar por topic
    const { data: topicQuestions } = await supabase
      .from('test_questions')
      .select('question_id')
      .eq('topic_id', TOPIC_ID)

    if (topicQuestions && topicQuestions.length > 0) {
      const questionIds = topicQuestions.map(q => q.question_id)
      query = query.in('id', questionIds)
    }
  }

  let { data: questions, error } = await query

  if (error) {
    console.error('❌ Error obteniendo preguntas:', error.message)
    process.exit(1)
  }

  // Filtrar preguntas de informática si se especifica
  if (EXCLUDE_INFORMATICA && questions) {
    const before = questions.length
    questions = questions.filter(q => {
      const lawId = q.articles?.law_id
      return !INFORMATICA_LAW_IDS.includes(lawId)
    })
    console.log(`📵 Excluidas ${before - questions.length} preguntas de informática`)
  }

  console.log(`📚 Preguntas a analizar: ${questions.length}`)
  console.log('')

  // 2. Analizar cada pregunta
  const results = {
    correct: [],      // Artículo asignado está en top 5
    wrong: [],        // Artículo asignado NO está en top 5
    noEmbedding: [],  // No se pudo generar embedding
    errors: []
  }

  let processed = 0
  let tokensUsed = 0

  for (const question of questions) {
    processed++
    process.stdout.write(`\r⏳ Procesando ${processed}/${questions.length}...`)

    try {
      // Construir texto para embedding (pregunta + opciones)
      const correctLetter = ['A', 'B', 'C', 'D'][question.correct_option]
      const correctOption = question[`option_${correctLetter.toLowerCase()}`]

      const textForEmbedding = [
        question.question_text,
        `Respuesta correcta: ${correctOption}`,
        question.explanation || ''
      ].join('\n').trim()

      // Generar embedding
      const embedding = await generateEmbedding(textForEmbedding)
      tokensUsed += Math.ceil(textForEmbedding.length / 4) // Aproximación

      // Buscar artículos similares
      const similarArticles = await findSimilarArticles(embedding)

      // Verificar artículo asignado
      const assignedArticleId = question.primary_article_id
      const foundInTop = similarArticles.find(a => a.id === assignedArticleId)

      // Calcular similitud directa con artículo asignado si no está en resultados
      let assignedSimilarity = foundInTop?.similarity || 0
      if (!foundInTop) {
        const articleEmbedding = await getArticleEmbedding(assignedArticleId)
        if (articleEmbedding) {
          assignedSimilarity = cosineSimilarity(embedding, articleEmbedding)
        }
      }

      const articleInfo = question.articles
      const assignedInfo = `${articleInfo?.laws?.short_name || '?'} Art. ${articleInfo?.article_number || '?'}`

      // Obtener nombres de leyes para los artículos similares
      const lawIds = [...new Set(similarArticles.map(a => a.law_id).filter(Boolean))]
      let lawNames = {}
      if (lawIds.length > 0) {
        const { data: laws } = await supabase
          .from('laws')
          .select('id, short_name')
          .in('id', lawIds)
        laws?.forEach(l => { lawNames[l.id] = l.short_name })
      }

      // Determinar posición del artículo asignado (en top o fuera)
      const rankInTop = foundInTop ? similarArticles.findIndex(a => a.id === assignedArticleId) + 1 : -1

      // Es correcto si:
      // 1. La similitud directa es alta (>= THRESHOLD), o
      // 2. Está en top K con buena similitud
      const isCorrect = (assignedSimilarity >= SIMILARITY_THRESHOLD) ||
                        (rankInTop > 0 && rankInTop <= 3) // Top 3 aunque similitud menor

      if (isCorrect) {
        results.correct.push({
          questionId: question.id,
          questionText: question.question_text.substring(0, 60) + '...',
          assignedArticle: assignedInfo,
          similarity: assignedSimilarity,
          rank: rankInTop
        })
      } else {
        // Artículo probablemente mal asignado
        const bestMatch = similarArticles[0]
        const bestLawName = bestMatch ? (lawNames[bestMatch.law_id] || '?') : '?'

        results.wrong.push({
          questionId: question.id,
          questionText: question.question_text.substring(0, 60) + '...',
          assignedArticle: assignedInfo,
          assignedArticleId: assignedArticleId,
          assignedSimilarity: assignedSimilarity,
          rankInTop: rankInTop > 0 ? rankInTop : 'fuera de top',
          suggestedArticle: bestMatch ? `${bestLawName} Art. ${bestMatch.article_number}` : 'N/A',
          suggestedArticleId: bestMatch?.id,
          suggestedSimilarity: bestMatch?.similarity || 0,
          allMatches: similarArticles.slice(0, 3).map(a => ({
            article: `${lawNames[a.law_id] || '?'} Art. ${a.article_number}`,
            similarity: a.similarity
          }))
        })
      }

      // Pequeña pausa para no saturar la API
      await new Promise(r => setTimeout(r, 100))

    } catch (err) {
      results.errors.push({
        questionId: question.id,
        error: err.message
      })
    }
  }

  console.log('\n')
  console.log('📊 RESULTADOS')
  console.log('=============')
  console.log(`✅ Artículos correctos: ${results.correct.length}`)
  console.log(`❌ Artículos mal asignados: ${results.wrong.length}`)
  console.log(`⚠️ Errores: ${results.errors.length}`)
  console.log(`💰 Tokens usados (aprox): ${tokensUsed}`)
  console.log('')

  // 3. Mostrar los mal asignados
  if (results.wrong.length > 0) {
    console.log('❌ PREGUNTAS CON ARTÍCULO MAL ASIGNADO:')
    console.log('---------------------------------------')
    results.wrong.slice(0, 20).forEach((w, i) => {
      console.log(`\n${i + 1}. ${w.questionText}`)
      console.log(`   Asignado: ${w.assignedArticle} (similitud: ${(w.assignedSimilarity * 100).toFixed(1)}%)`)
      console.log(`   Sugerido: ${w.suggestedArticle} (similitud: ${(w.suggestedSimilarity * 100).toFixed(1)}%)`)
    })

    if (results.wrong.length > 20) {
      console.log(`\n... y ${results.wrong.length - 20} más`)
    }
  }

  // 4. Guardar en BD si no es dry-run
  if (!DRY_RUN && results.wrong.length > 0) {
    console.log('\n💾 Guardando resultados en BD...')

    for (const wrong of results.wrong) {
      await supabase
        .from('questions')
        .update({
          topic_review_status: 'wrong_article',
          verification_status: 'problem',
          verified_at: new Date().toISOString()
        })
        .eq('id', wrong.questionId)
    }

    console.log(`✅ ${results.wrong.length} preguntas marcadas como 'wrong_article'`)
  } else if (DRY_RUN) {
    console.log('\n⚠️ Dry run - no se guardaron cambios en BD')
  }

  // 5. Resumen final
  console.log('\n📈 RESUMEN FINAL')
  console.log('================')
  console.log(`Total analizadas: ${processed}`)
  console.log(`Correctas: ${results.correct.length} (${(results.correct.length / processed * 100).toFixed(1)}%)`)
  console.log(`Mal asignadas: ${results.wrong.length} (${(results.wrong.length / processed * 100).toFixed(1)}%)`)

  // Guardar JSON con resultados
  const fs = require('fs')
  const outputFile = `wrong-articles-${Date.now()}.json`
  fs.writeFileSync(outputFile, JSON.stringify({
    timestamp: new Date().toISOString(),
    config: { TOPIC_ID, LIMIT, SIMILARITY_THRESHOLD, TOP_K },
    summary: {
      total: processed,
      correct: results.correct.length,
      wrong: results.wrong.length,
      errors: results.errors.length
    },
    wrongArticles: results.wrong
  }, null, 2))

  console.log(`\n📄 Resultados guardados en: ${outputFile}`)
}

main().catch(console.error)
