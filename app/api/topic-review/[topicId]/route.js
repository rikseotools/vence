// app/api/topic-review/[topicId]/route.js
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

/**
 * GET /api/topic-review/[topicId]
 * Obtiene detalle de un tema con leyes, artículos y preguntas
 */
export async function GET(request, { params }) {
  try {
    const { topicId } = await params

    if (!topicId) {
      return Response.json({
        success: false,
        error: 'Se requiere topicId'
      }, { status: 400 })
    }

    // 1. Obtener el tema
    const { data: topic, error: topicError } = await supabase
      .from('topics')
      .select(`
        id,
        topic_number,
        title,
        description,
        position_type
      `)
      .eq('id', topicId)
      .single()

    if (topicError || !topic) {
      return Response.json({
        success: false,
        error: 'Tema no encontrado'
      }, { status: 404 })
    }

    // 2. Obtener topic_scope (mapeo a leyes y artículos)
    const { data: topicScopes, error: scopeError } = await supabase
      .from('topic_scope')
      .select(`
        id,
        article_numbers,
        title_numbers,
        chapter_numbers,
        laws (
          id,
          short_name,
          name,
          boe_url,
          description
        )
      `)
      .eq('topic_id', topicId)

    if (scopeError) {
      return Response.json({
        success: false,
        error: 'Error obteniendo scope del tema',
        details: scopeError.message
      }, { status: 500 })
    }

    // 3. Para cada ley, obtener artículos con preguntas
    const lawsWithArticles = await Promise.all(
      (topicScopes || []).map(async (scope) => {
        if (!scope.laws) return null

        const articleNumbers = scope.article_numbers || []

        // Obtener artículos de esta ley que estén en el scope
        const { data: articles } = await supabase
          .from('articles')
          .select(`
            id,
            article_number,
            title,
            content
          `)
          .eq('law_id', scope.laws.id)
          .in('article_number', articleNumbers)
          .order('article_number', { ascending: true })

        // Para cada artículo, obtener sus preguntas
        const articlesWithQuestions = await Promise.all(
          (articles || []).map(async (article) => {
            const { data: questions } = await supabase
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
                verified_at,
                verification_status,
                topic_review_status,
                is_official_exam
              `)
              .eq('primary_article_id', article.id)
              .eq('is_active', true)
              .order('created_at', { ascending: true })

            // Obtener verificaciones IA si existen
            const questionIds = questions?.map(q => q.id) || []
            let aiVerifications = {}

            if (questionIds.length > 0) {
              const { data: verifications } = await supabase
                .from('ai_verification_results')
                .select(`
                  question_id,
                  is_correct,
                  is_literal,
                  confidence,
                  explanation,
                  article_quote,
                  suggested_fix,
                  correct_option_should_be,
                  verified_at,
                  fix_applied,
                  discarded
                `)
                .in('question_id', questionIds)

              // Crear mapa de verificaciones
              if (verifications) {
                for (const v of verifications) {
                  aiVerifications[v.question_id] = v
                }
              }
            }

            // Combinar preguntas con verificaciones
            const questionsWithVerification = (questions || []).map(q => {
              const aiV = aiVerifications[q.id]

              // Determinar estado de revisión
              let reviewStatus = q.topic_review_status || 'pending'

              if (!q.topic_review_status && aiV) {
                // Derivar estado de ai_verification_results usando las 3 variables
                if (aiV.discarded || aiV.fix_applied) {
                  reviewStatus = 'perfect' // Descartado o corregido = OK
                } else if (aiV.article_ok !== undefined) {
                  // Nuevo sistema con 3 variables
                  const articleOk = aiV.article_ok === true
                  const answerOk = aiV.answer_ok === true
                  const explanationOk = aiV.explanation_ok === true

                  if (articleOk) {
                    if (answerOk && explanationOk) reviewStatus = 'perfect'
                    else if (answerOk && !explanationOk) reviewStatus = 'bad_explanation'
                    else if (!answerOk && explanationOk) reviewStatus = 'bad_answer'
                    else reviewStatus = 'bad_answer_and_explanation'
                  } else {
                    if (answerOk && explanationOk) reviewStatus = 'wrong_article'
                    else if (answerOk && !explanationOk) reviewStatus = 'wrong_article_bad_explanation'
                    else if (!answerOk && explanationOk) reviewStatus = 'wrong_article_bad_answer'
                    else reviewStatus = 'all_wrong'
                  }
                } else if (aiV.is_correct !== undefined) {
                  // Sistema antiguo con is_correct/is_literal
                  if (aiV.is_correct === true) {
                    reviewStatus = 'perfect'
                  } else {
                    reviewStatus = 'bad_answer'
                  }
                }
              } else if (!q.topic_review_status && q.verified_at) {
                // Sistema antiguo de monitoreo
                reviewStatus = q.verification_status === 'ok' ? 'perfect' :
                               q.verification_status === 'problem' ? 'bad_answer' : 'pending'
              }

              return {
                ...q,
                review_status: reviewStatus,
                ai_verification: aiV || null
              }
            })

            // Stats del artículo (incluye estados técnicos)
            const articleStats = {
              total: questionsWithVerification.length,
              // Estados normales
              perfect: questionsWithVerification.filter(q => q.review_status === 'perfect').length,
              bad_explanation: questionsWithVerification.filter(q => q.review_status === 'bad_explanation').length,
              bad_answer: questionsWithVerification.filter(q => q.review_status === 'bad_answer').length,
              bad_answer_and_explanation: questionsWithVerification.filter(q => q.review_status === 'bad_answer_and_explanation').length,
              wrong_article: questionsWithVerification.filter(q => q.review_status === 'wrong_article').length,
              wrong_article_bad_explanation: questionsWithVerification.filter(q => q.review_status === 'wrong_article_bad_explanation').length,
              wrong_article_bad_answer: questionsWithVerification.filter(q => q.review_status === 'wrong_article_bad_answer').length,
              all_wrong: questionsWithVerification.filter(q => q.review_status === 'all_wrong').length,
              // Estados técnicos (leyes virtuales)
              tech_perfect: questionsWithVerification.filter(q => q.review_status === 'tech_perfect').length,
              tech_bad_explanation: questionsWithVerification.filter(q => q.review_status === 'tech_bad_explanation').length,
              tech_bad_answer: questionsWithVerification.filter(q => q.review_status === 'tech_bad_answer').length,
              tech_bad_answer_and_explanation: questionsWithVerification.filter(q => q.review_status === 'tech_bad_answer_and_explanation').length,
              pending: questionsWithVerification.filter(q => q.review_status === 'pending').length
            }

            return {
              ...article,
              questions: questionsWithVerification,
              stats: articleStats
            }
          })
        )

        // Stats de la ley (incluye estados técnicos)
        const lawStats = {
          total_articles: articlesWithQuestions.length,
          total_questions: articlesWithQuestions.reduce((sum, a) => sum + a.stats.total, 0),
          // Estados normales
          perfect: articlesWithQuestions.reduce((sum, a) => sum + a.stats.perfect, 0),
          bad_explanation: articlesWithQuestions.reduce((sum, a) => sum + a.stats.bad_explanation, 0),
          bad_answer: articlesWithQuestions.reduce((sum, a) => sum + a.stats.bad_answer, 0),
          bad_answer_and_explanation: articlesWithQuestions.reduce((sum, a) => sum + a.stats.bad_answer_and_explanation, 0),
          wrong_article: articlesWithQuestions.reduce((sum, a) => sum + a.stats.wrong_article, 0),
          wrong_article_bad_explanation: articlesWithQuestions.reduce((sum, a) => sum + a.stats.wrong_article_bad_explanation, 0),
          wrong_article_bad_answer: articlesWithQuestions.reduce((sum, a) => sum + a.stats.wrong_article_bad_answer, 0),
          all_wrong: articlesWithQuestions.reduce((sum, a) => sum + a.stats.all_wrong, 0),
          // Estados técnicos
          tech_perfect: articlesWithQuestions.reduce((sum, a) => sum + a.stats.tech_perfect, 0),
          tech_bad_explanation: articlesWithQuestions.reduce((sum, a) => sum + a.stats.tech_bad_explanation, 0),
          tech_bad_answer: articlesWithQuestions.reduce((sum, a) => sum + a.stats.tech_bad_answer, 0),
          tech_bad_answer_and_explanation: articlesWithQuestions.reduce((sum, a) => sum + a.stats.tech_bad_answer_and_explanation, 0),
          pending: articlesWithQuestions.reduce((sum, a) => sum + a.stats.pending, 0)
        }

        return {
          id: scope.laws.id,
          short_name: scope.laws.short_name,
          name: scope.laws.name,
          boe_url: scope.laws.boe_url,
          is_virtual: scope.laws.description?.toLowerCase().includes('ficticia') || false,
          articles: articlesWithQuestions,
          stats: lawStats
        }
      })
    )

    // Filtrar nulls
    const laws = lawsWithArticles.filter(Boolean)

    // Detectar si el tema tiene leyes virtuales
    const hasVirtualLaws = laws.some(l => l.is_virtual === true)

    // Stats globales del tema (incluye estados técnicos)
    const topicStats = {
      total_laws: laws.length,
      total_articles: laws.reduce((sum, l) => sum + l.stats.total_articles, 0),
      total_questions: laws.reduce((sum, l) => sum + l.stats.total_questions, 0),
      // Estados normales
      perfect: laws.reduce((sum, l) => sum + l.stats.perfect, 0),
      bad_explanation: laws.reduce((sum, l) => sum + l.stats.bad_explanation, 0),
      bad_answer: laws.reduce((sum, l) => sum + l.stats.bad_answer, 0),
      bad_answer_and_explanation: laws.reduce((sum, l) => sum + l.stats.bad_answer_and_explanation, 0),
      wrong_article: laws.reduce((sum, l) => sum + l.stats.wrong_article, 0),
      wrong_article_bad_explanation: laws.reduce((sum, l) => sum + l.stats.wrong_article_bad_explanation, 0),
      wrong_article_bad_answer: laws.reduce((sum, l) => sum + l.stats.wrong_article_bad_answer, 0),
      all_wrong: laws.reduce((sum, l) => sum + l.stats.all_wrong, 0),
      // Estados técnicos
      tech_perfect: laws.reduce((sum, l) => sum + l.stats.tech_perfect, 0),
      tech_bad_explanation: laws.reduce((sum, l) => sum + l.stats.tech_bad_explanation, 0),
      tech_bad_answer: laws.reduce((sum, l) => sum + l.stats.tech_bad_answer, 0),
      tech_bad_answer_and_explanation: laws.reduce((sum, l) => sum + l.stats.tech_bad_answer_and_explanation, 0),
      pending: laws.reduce((sum, l) => sum + l.stats.pending, 0),
      hasVirtualLaws
    }

    return Response.json({
      success: true,
      topic: {
        ...topic,
        stats: topicStats
      },
      laws
    })

  } catch (error) {
    console.error('Error en topic-review/[topicId]:', error)
    return Response.json({
      success: false,
      error: 'Error interno del servidor',
      details: error.message
    }, { status: 500 })
  }
}
