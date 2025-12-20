import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Límites de lote por modelo (debe coincidir con ai-verify-article)
const MODEL_BATCH_LIMITS = {
  'claude-3-haiku-20240307': 4,
  'claude-sonnet-4-20250514': 10,
  'claude-sonnet-4-5-20250929': 10,
  'gpt-4o-mini': 18,
  'gpt-4o': 18,
  'gpt-4-turbo': 4,
  'gemini-1.5-flash': 10,
  'gemini-1.5-flash-8b': 10,
  'gemini-1.5-pro': 10,
  'gemini-2.0-flash-exp': 10,
}

/**
 * POST /api/verify-articles/batch-info
 * Obtiene información de lotes para un conjunto de artículos
 */
export async function POST(request) {
  try {
    const { lawId, articleNumbers, model } = await request.json()

    if (!lawId || !articleNumbers || !Array.isArray(articleNumbers)) {
      return Response.json({
        success: false,
        error: 'Se requiere lawId y articleNumbers (array)'
      }, { status: 400 })
    }

    const batchSize = MODEL_BATCH_LIMITS[model] || 4

    // Obtener artículos con sus IDs
    const { data: articles, error: articlesError } = await supabase
      .from('articles')
      .select('id, article_number')
      .eq('law_id', lawId)
      .in('article_number', articleNumbers)

    if (articlesError) {
      throw articlesError
    }

    // Para cada artículo, contar preguntas activas
    const articleInfo = []
    let totalQuestions = 0
    let totalBatches = 0

    for (const article of articles) {
      const { count, error: countError } = await supabase
        .from('questions')
        .select('id', { count: 'exact', head: true })
        .eq('primary_article_id', article.id)
        .eq('is_active', true)

      if (countError) {
        console.error(`Error contando preguntas para artículo ${article.article_number}:`, countError)
        continue
      }

      const questionCount = count || 0
      const batches = Math.ceil(questionCount / batchSize)

      articleInfo.push({
        articleNumber: article.article_number,
        questionCount,
        batches,
        batchSize
      })

      totalQuestions += questionCount
      totalBatches += batches
    }

    return Response.json({
      success: true,
      model,
      batchSize,
      articles: articleInfo,
      totals: {
        articles: articleInfo.length,
        questions: totalQuestions,
        batches: totalBatches
      }
    })

  } catch (error) {
    console.error('Error obteniendo batch info:', error)
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}
