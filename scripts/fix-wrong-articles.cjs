#!/usr/bin/env node
/**
 * fix-wrong-articles.cjs
 *
 * Corrige artículos mal asignados usando Claude (Anthropic).
 * Lee las preguntas marcadas como 'wrong_article' y usa IA para
 * determinar el artículo correcto.
 *
 * Uso:
 *   node scripts/fix-wrong-articles.cjs [opciones]
 *
 * Opciones:
 *   --limit <N>      Número máximo de preguntas a procesar (default: 100)
 *   --dry-run        No guardar cambios, solo mostrar sugerencias
 *   --auto-accept    Aceptar automáticamente sugerencias con alta confianza
 *
 * Ejemplos:
 *   node scripts/fix-wrong-articles.cjs --limit 10 --dry-run
 *   node scripts/fix-wrong-articles.cjs --limit 50 --auto-accept
 */

require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')
const Anthropic = require('@anthropic-ai/sdk').default

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

let anthropic = null

async function getAnthropicClient() {
  if (anthropic) return anthropic

  // Obtener API key de ai_api_config
  const { data: config } = await supabase
    .from('ai_api_config')
    .select('api_key_encrypted')
    .eq('provider', 'anthropic')
    .single()

  if (!config?.api_key_encrypted) {
    throw new Error('No se encontró API key de Anthropic en ai_api_config')
  }

  const apiKey = Buffer.from(config.api_key_encrypted, 'base64').toString('utf-8')
  anthropic = new Anthropic({ apiKey })
  return anthropic
}

// Parse args
const args = process.argv.slice(2)
const getArg = (name) => {
  const idx = args.indexOf(name)
  return idx !== -1 ? args[idx + 1] : null
}
const hasFlag = (name) => args.includes(name)

const LIMIT = parseInt(getArg('--limit') || '100')
const DRY_RUN = hasFlag('--dry-run')
const AUTO_ACCEPT = hasFlag('--auto-accept')

// Función para formatear tiempo
const formatTime = (ms) => {
  if (ms < 1000) return `${ms}ms`
  const seconds = Math.floor(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  if (minutes < 60) return `${minutes}m ${remainingSeconds}s`
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  return `${hours}h ${remainingMinutes}m`
}

async function findCorrectArticle(question, currentArticle, suggestedArticle, lawArticles) {
  const client = await getAnthropicClient()

  const prompt = `Eres un experto en legislación española. Analiza esta pregunta de oposiciones y determina qué artículo de ley es el más relevante.

PREGUNTA:
${question.question_text}

OPCIONES:
A) ${question.option_a}
B) ${question.option_b}
C) ${question.option_c}
D) ${question.option_d}

RESPUESTA CORRECTA: ${['A', 'B', 'C', 'D'][question.correct_option]}

EXPLICACIÓN: ${question.explanation || 'No disponible'}

ARTÍCULO ACTUALMENTE ASIGNADO:
- ${currentArticle.law_name} - Artículo ${currentArticle.article_number}
- Contenido: ${currentArticle.content?.substring(0, 500) || 'No disponible'}...

${suggestedArticle ? `ARTÍCULO SUGERIDO POR SIMILITUD SEMÁNTICA:
- ${suggestedArticle.law_name} - Artículo ${suggestedArticle.article_number}
- Similitud: ${suggestedArticle.similarity}%
- Contenido: ${suggestedArticle.content?.substring(0, 500) || 'No disponible'}...` : ''}

ARTÍCULOS DISPONIBLES DE LA LEY ${currentArticle.law_name}:
${lawArticles.slice(0, 30).map(a => `- Art. ${a.article_number}: ${a.title || a.content?.substring(0, 100) || 'Sin contenido'}...`).join('\n')}

INSTRUCCIONES:
1. Analiza qué artículo es el que REALMENTE corresponde a esta pregunta
2. Considera el contenido de la pregunta, las opciones y la explicación
3. Si el artículo sugerido es mejor que el actual, recomiéndalo
4. Si ninguno es correcto, sugiere el artículo correcto de la lista

Responde SOLO con un JSON válido (sin markdown):
{
  "recommendation": "keep_current" | "use_suggested" | "use_other",
  "article_number": <número del artículo recomendado>,
  "law_name": "<nombre de la ley>",
  "confidence": "high" | "medium" | "low",
  "reason": "<explicación breve de por qué este artículo es el correcto>"
}`

  try {
    const response = await client.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }]
    })

    const text = response.content[0].text.trim()
    // Limpiar posibles marcadores de código
    const cleanJson = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    return JSON.parse(cleanJson)
  } catch (error) {
    console.error('Error parseando respuesta:', error.message)
    return null
  }
}

async function main() {
  console.log('🔧 Corrector de Artículos con Claude')
  console.log('====================================')
  console.log(`📊 Configuración:`)
  console.log(`   - Límite: ${LIMIT}`)
  console.log(`   - Dry run: ${DRY_RUN}`)
  console.log(`   - Auto-accept: ${AUTO_ACCEPT}`)
  console.log('')

  // 1. Obtener preguntas con wrong_article
  console.log('📥 Cargando preguntas con artículo mal asignado...')

  const { data: verifications, error: verError } = await supabase
    .from('ai_verification_results')
    .select('question_id, correct_article_suggestion, explanation')
    .eq('ai_provider', 'embedding_similarity')
    .eq('article_ok', false)
    .limit(LIMIT)

  if (verError) {
    console.error('❌ Error:', verError.message)
    process.exit(1)
  }

  if (!verifications || verifications.length === 0) {
    console.log('✅ No hay preguntas pendientes de corrección')
    process.exit(0)
  }

  console.log(`📚 Preguntas a procesar: ${verifications.length}`)

  // Estimación de tiempo (~3s por pregunta con Claude)
  const estimatedMinutes = Math.ceil(verifications.length * 3 / 60)
  console.log(`⏱️ Tiempo estimado: ~${estimatedMinutes} minutos`)
  console.log('')

  // 2. Procesar cada pregunta
  const results = {
    fixed: [],
    kept: [],
    errors: [],
    skipped: []
  }

  const startTime = Date.now()

  for (let i = 0; i < verifications.length; i++) {
    const v = verifications[i]

    // Calcular ETA
    if (i > 0) {
      const elapsed = Date.now() - startTime
      const avgTime = elapsed / i
      const remaining = (verifications.length - i) * avgTime
      process.stdout.write(`\r⏳ Procesando ${i + 1}/${verifications.length}... ETA: ${formatTime(remaining)}   `)
    } else {
      process.stdout.write(`\r⏳ Procesando ${i + 1}/${verifications.length}...   `)
    }

    try {
      // Obtener datos completos de la pregunta
      const { data: question } = await supabase
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
          articles!primary_article_id (
            id,
            article_number,
            content,
            title,
            law_id,
            laws (id, short_name)
          )
        `)
        .eq('id', v.question_id)
        .single()

      if (!question || !question.articles) {
        results.skipped.push({ questionId: v.question_id, reason: 'No se encontró la pregunta o artículo' })
        continue
      }

      const currentArticle = {
        id: question.articles.id,
        article_number: question.articles.article_number,
        content: question.articles.content,
        title: question.articles.title,
        law_id: question.articles.law_id,
        law_name: question.articles.laws?.short_name || 'Desconocida'
      }

      // Parsear sugerencia de embeddings
      let suggestedArticle = null
      let explanationData = {}
      try {
        explanationData = JSON.parse(v.explanation || '{}')
        if (explanationData.suggestedArticleId) {
          const { data: suggested } = await supabase
            .from('articles')
            .select('id, article_number, content, title, law_id, laws(short_name)')
            .eq('id', explanationData.suggestedArticleId)
            .single()

          if (suggested) {
            suggestedArticle = {
              id: suggested.id,
              article_number: suggested.article_number,
              content: suggested.content,
              title: suggested.title,
              law_id: suggested.law_id,
              law_name: suggested.laws?.short_name || 'Desconocida',
              similarity: Math.round((explanationData.suggestedSimilarity || 0) * 100)
            }
          }
        }
      } catch (e) {
        // Ignorar error de parseo
      }

      // Obtener artículos de la ley actual para contexto
      const { data: lawArticles } = await supabase
        .from('articles')
        .select('id, article_number, content, title')
        .eq('law_id', currentArticle.law_id)
        .order('article_number', { ascending: true })
        .limit(50)

      // Llamar a Claude para análisis
      const recommendation = await findCorrectArticle(
        question,
        currentArticle,
        suggestedArticle,
        lawArticles || []
      )

      if (!recommendation) {
        results.errors.push({ questionId: v.question_id, error: 'No se pudo obtener recomendación' })
        continue
      }

      // Procesar recomendación
      if (recommendation.recommendation === 'keep_current') {
        results.kept.push({
          questionId: v.question_id,
          reason: recommendation.reason
        })

        // Marcar como correcto en ai_verification_results
        if (!DRY_RUN) {
          await supabase
            .from('ai_verification_results')
            .update({ article_ok: true })
            .eq('question_id', v.question_id)
            .eq('ai_provider', 'embedding_similarity')

          await supabase
            .from('questions')
            .update({ topic_review_status: null, verification_status: null })
            .eq('id', v.question_id)
        }

      } else if (recommendation.recommendation === 'use_suggested' && suggestedArticle) {
        // Usar artículo sugerido
        const shouldApply = AUTO_ACCEPT || recommendation.confidence === 'high'

        results.fixed.push({
          questionId: v.question_id,
          oldArticle: `${currentArticle.law_name} Art. ${currentArticle.article_number}`,
          newArticle: `${suggestedArticle.law_name} Art. ${suggestedArticle.article_number}`,
          newArticleId: suggestedArticle.id,
          confidence: recommendation.confidence,
          reason: recommendation.reason,
          applied: shouldApply && !DRY_RUN
        })

        if (shouldApply && !DRY_RUN) {
          await supabase
            .from('questions')
            .update({
              primary_article_id: suggestedArticle.id,
              topic_review_status: null,
              verification_status: 'ai_corrected'
            })
            .eq('id', v.question_id)

          await supabase
            .from('ai_verification_results')
            .update({ article_ok: true })
            .eq('question_id', v.question_id)
            .eq('ai_provider', 'embedding_similarity')
        }

      } else if (recommendation.recommendation === 'use_other') {
        // Buscar el artículo recomendado
        const { data: newArticle } = await supabase
          .from('articles')
          .select('id, article_number, laws(short_name)')
          .eq('law_id', currentArticle.law_id)
          .eq('article_number', recommendation.article_number)
          .single()

        if (newArticle) {
          const shouldApply = AUTO_ACCEPT || recommendation.confidence === 'high'

          results.fixed.push({
            questionId: v.question_id,
            oldArticle: `${currentArticle.law_name} Art. ${currentArticle.article_number}`,
            newArticle: `${newArticle.laws?.short_name || currentArticle.law_name} Art. ${newArticle.article_number}`,
            newArticleId: newArticle.id,
            confidence: recommendation.confidence,
            reason: recommendation.reason,
            applied: shouldApply && !DRY_RUN
          })

          if (shouldApply && !DRY_RUN) {
            await supabase
              .from('questions')
              .update({
                primary_article_id: newArticle.id,
                topic_review_status: null,
                verification_status: 'ai_corrected'
              })
              .eq('id', v.question_id)

            await supabase
              .from('ai_verification_results')
              .update({ article_ok: true })
              .eq('question_id', v.question_id)
              .eq('ai_provider', 'embedding_similarity')
          }
        } else {
          results.errors.push({
            questionId: v.question_id,
            error: `No se encontró artículo ${recommendation.article_number} en ${currentArticle.law_name}`
          })
        }
      }

      // Pausa para no saturar la API
      await new Promise(r => setTimeout(r, 500))

    } catch (err) {
      results.errors.push({
        questionId: v.question_id,
        error: err.message
      })
    }
  }

  // Calcular tiempo total
  const totalTime = Date.now() - startTime

  console.log('\n\n')
  console.log('📊 RESULTADOS')
  console.log('=============')
  console.log(`✅ Corregidos: ${results.fixed.length}`)
  console.log(`🔒 Mantenidos (Claude dice que están bien): ${results.kept.length}`)
  console.log(`⚠️ Errores: ${results.errors.length}`)
  console.log(`⏭️ Saltados: ${results.skipped.length}`)
  console.log(`⏱️ Tiempo total: ${formatTime(totalTime)}`)
  console.log('')

  // Mostrar correcciones
  if (results.fixed.length > 0) {
    console.log('🔧 CORRECCIONES:')
    console.log('----------------')
    results.fixed.slice(0, 20).forEach((f, i) => {
      const status = f.applied ? '✅' : '📝'
      console.log(`${i + 1}. ${status} ${f.oldArticle} → ${f.newArticle}`)
      console.log(`   Confianza: ${f.confidence} | ${f.reason.substring(0, 60)}...`)
    })
    if (results.fixed.length > 20) {
      console.log(`\n... y ${results.fixed.length - 20} más`)
    }
  }

  // Mostrar mantenidos
  if (results.kept.length > 0) {
    console.log('\n🔒 MANTENIDOS (artículo original correcto):')
    console.log('-------------------------------------------')
    results.kept.slice(0, 10).forEach((k, i) => {
      console.log(`${i + 1}. Pregunta ${k.questionId}: ${k.reason.substring(0, 70)}...`)
    })
    if (results.kept.length > 10) {
      console.log(`\n... y ${results.kept.length - 10} más`)
    }
  }

  if (DRY_RUN) {
    console.log('\n⚠️ DRY RUN - No se guardaron cambios')
  }

  console.log('\n📈 RESUMEN FINAL')
  console.log('================')
  console.log(`Procesadas: ${verifications.length}`)
  console.log(`Corregidas: ${results.fixed.filter(f => f.applied).length}`)
  console.log(`Pendientes de revisión: ${results.fixed.filter(f => !f.applied).length}`)
}

main().catch(console.error)
