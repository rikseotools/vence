import { createClient } from '@supabase/supabase-js'

const getSupabase = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

/**
 * GET /api/verify-articles/verification-summaries
 * Obtiene resúmenes de verificación para múltiples artículos
 *
 * Query params:
 * - lawId: ID de la ley
 * - articles: lista de números de artículo separados por coma (e.g., "1,2,3,5")
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const lawId = searchParams.get('lawId')
    const articlesParam = searchParams.get('articles')

    if (!lawId || !articlesParam) {
      return Response.json({
        success: false,
        error: 'Se requiere lawId y articles'
      }, { status: 400 })
    }

    const articleNumbers = [...new Set(articlesParam.split(',').map(a => a.trim()).filter(Boolean))]

    if (articleNumbers.length === 0) {
      return Response.json({
        success: true,
        summaries: {},
        appliedFixes: {}
      })
    }

    // Obtener los artículos de esta ley con sus números
    const { data: articles, error: articlesError } = await getSupabase()
      .from('articles')
      .select('id, article_number')
      .eq('law_id', lawId)
      .in('article_number', articleNumbers)

    if (articlesError) {
      console.error('Error obteniendo artículos:', articlesError)
      return Response.json({
        success: false,
        error: 'Error obteniendo artículos'
      }, { status: 500 })
    }

    // Si no hay artículos, devolver resúmenes vacíos
    if (!articles || articles.length === 0) {
      return Response.json({
        success: true,
        summaries: {},
        appliedFixes: {}
      })
    }

    // Crear mapa de article_id a article_number
    const articleIdToNumber = {}
    const articleIds = []
    articles.forEach(a => {
      articleIdToNumber[a.id] = a.article_number
      articleIds.push(a.id)
    })

    // Obtener todas las preguntas vinculadas a estos artículos
    const { data: questions, error: questionsError } = await getSupabase()
      .from('questions')
      .select('id, primary_article_id')
      .in('primary_article_id', articleIds)
      .eq('is_active', true)

    if (questionsError) {
      console.error('Error obteniendo preguntas:', questionsError)
      return Response.json({
        success: false,
        error: 'Error obteniendo preguntas'
      }, { status: 500 })
    }

    // Si no hay preguntas, devolver resúmenes vacíos
    if (!questions || questions.length === 0) {
      return Response.json({
        success: true,
        summaries: {},
        appliedFixes: {}
      })
    }

    // Agrupar preguntas por artículo
    const questionsByArticle = {}
    const questionIds = []
    questions.forEach(q => {
      const articleNumber = articleIdToNumber[q.primary_article_id]
      if (!articleNumber) return

      if (!questionsByArticle[articleNumber]) {
        questionsByArticle[articleNumber] = []
      }
      questionsByArticle[articleNumber].push(q.id)
      questionIds.push(q.id)
    })

    // Obtener verificaciones de IA para estas preguntas
    const { data: verifications, error: verificationsError } = await getSupabase()
      .from('ai_verification_results')
      .select('question_id, is_correct, fix_applied, verified_at')
      .in('question_id', questionIds)
      .order('verified_at', { ascending: false })

    if (verificationsError) {
      console.error('Error obteniendo verificaciones:', verificationsError)
      // Continuar sin verificaciones
    }

    // Crear mapa de verificaciones (más reciente por question_id)
    const verificationMap = {}
    const appliedFixes = {}
    ;(verifications || []).forEach(v => {
      // Solo guardar la más reciente por pregunta
      if (!verificationMap[v.question_id]) {
        verificationMap[v.question_id] = v
      }
      // Registrar correcciones aplicadas
      if (v.fix_applied) {
        appliedFixes[v.question_id] = true
      }
    })

    // Calcular resúmenes por artículo
    const summaries = {}
    for (const articleNumber of articleNumbers) {
      const articleQuestionIds = questionsByArticle[articleNumber] || []

      if (articleQuestionIds.length === 0) {
        // No hay preguntas para este artículo
        continue
      }

      let ok = 0
      let fixed = 0
      let problems = 0
      let verified = 0
      let lastVerifiedAt = null

      for (const qId of articleQuestionIds) {
        const verification = verificationMap[qId]
        if (!verification) continue

        verified++

        // Obtener la fecha más reciente
        if (verification.verified_at) {
          const date = new Date(verification.verified_at)
          if (!lastVerifiedAt || date > new Date(lastVerifiedAt)) {
            lastVerifiedAt = verification.verified_at
          }
        }

        // Contar estados
        if (verification.fix_applied || appliedFixes[qId]) {
          fixed++
        } else if (verification.is_correct === true) {
          ok++
        } else if (verification.is_correct === false) {
          problems++
        }
      }

      summaries[articleNumber] = {
        total: articleQuestionIds.length,
        verified,
        ok,
        fixed,
        problems,
        lastVerifiedAt
      }
    }

    return Response.json({
      success: true,
      summaries,
      appliedFixes
    })

  } catch (error) {
    console.error('Error obteniendo resúmenes de verificación:', error)
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}
