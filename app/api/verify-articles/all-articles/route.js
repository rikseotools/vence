import { createClient } from '@supabase/supabase-js'

const getSupabase = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

/**
 * GET /api/verify-articles/all-articles
 * Devuelve todos los artículos de una ley que tienen preguntas asociadas
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const lawId = searchParams.get('lawId')

    if (!lawId) {
      return Response.json({
        success: false,
        error: 'lawId es requerido'
      }, { status: 400 })
    }

    // Obtener todos los artículos de la ley
    const { data: articles, error: articlesError } = await getSupabase()
      .from('articles')
      .select('id, article_number, title')
      .eq('law_id', lawId)
      .eq('is_active', true)
      .order('article_number')

    if (articlesError) {
      console.error('❌ [ALL-ARTICLES] Error cargando artículos:', articlesError)
      throw articlesError
    }

    if (!articles || articles.length === 0) {
      return Response.json({
        success: true,
        articles: [],
        total: 0
      })
    }

    // Obtener IDs de artículos
    const articleIds = articles.map(a => a.id)

    // Obtener preguntas con su estado de verificación
    const { data: questions, error: questionsError } = await getSupabase()
      .from('questions')
      .select('id, primary_article_id, verified_at, verification_status')
      .in('primary_article_id', articleIds)
      .eq('is_active', true)

    if (questionsError) {
      console.error('❌ [ALL-ARTICLES] Error cargando preguntas:', questionsError)
      throw questionsError
    }

    // Contar preguntas por artículo y su estado de verificación
    const questionCounts = {}
    const verificationStats = {} // { article_id: { total, ok, problem, pending } }

    for (const q of questions || []) {
      const artId = q.primary_article_id
      questionCounts[artId] = (questionCounts[artId] || 0) + 1

      // Inicializar stats si no existen
      if (!verificationStats[artId]) {
        verificationStats[artId] = { total: 0, ok: 0, problem: 0, pending: 0, lastVerified: null }
      }

      verificationStats[artId].total++

      // Clasificar según estado de verificación
      if (!q.verified_at) {
        // Pregunta nunca verificada
        verificationStats[artId].pending++
      } else {
        // Actualizar última verificación
        if (!verificationStats[artId].lastVerified || q.verified_at > verificationStats[artId].lastVerified) {
          verificationStats[artId].lastVerified = q.verified_at
        }

        // Clasificar por status (solo 'ok' y 'problem', null = sin determinar)
        if (q.verification_status === 'ok') {
          verificationStats[artId].ok++
        } else if (q.verification_status === 'problem') {
          verificationStats[artId].problem++
        }
        // Si status es null pero tiene verified_at, fue verificada pero indeterminada (raro)
      }
    }

    // Separar artículos con y sin preguntas
    const articlesWithQuestions = articles
      .filter(a => questionCounts[a.id] > 0)
      .map(a => ({
        article_number: a.article_number,
        title: a.title || `Artículo ${a.article_number}`,
        question_count: questionCounts[a.id] || 0,
        article_id: a.id,
        has_questions: true
      }))

    const articlesWithoutQuestions = articles
      .filter(a => !questionCounts[a.id])
      .map(a => ({
        article_number: a.article_number,
        title: a.title || `Artículo ${a.article_number}`,
        question_count: 0,
        article_id: a.id,
        has_questions: false
      }))

    // Función para ordenar por número de artículo
    const sortByArticleNumber = (a, b) => {
      const numA = parseInt(a.article_number)
      const numB = parseInt(b.article_number)
      if (!isNaN(numA) && !isNaN(numB)) {
        return numA - numB
      }
      return String(a.article_number).localeCompare(String(b.article_number))
    }

    // Ordenar ambas listas
    articlesWithQuestions.sort(sortByArticleNumber)
    articlesWithoutQuestions.sort(sortByArticleNumber)

    // Añadir info de verificación a artículos con preguntas (usando stats de preguntas)
    const articlesWithVerification = articlesWithQuestions.map(article => {
      const stats = verificationStats[article.article_id] || {
        total: 0, ok: 0, problem: 0, pending: article.question_count, lastVerified: null
      }

      return {
        ...article,
        last_verified: stats.lastVerified,
        verified_ok: stats.ok,
        with_problems: stats.problem,
        pending: stats.pending
      }
    })

    return Response.json({
      success: true,
      articles: articlesWithVerification,
      articlesWithoutQuestions: articlesWithoutQuestions,
      total: articlesWithVerification.length,
      totalWithoutQuestions: articlesWithoutQuestions.length
    })

  } catch (error) {
    console.error('Error en all-articles:', error)
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}
