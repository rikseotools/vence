// app/api/topic-review/route.js
import { createClient } from '@supabase/supabase-js'

const getSupabase = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

/**
 * GET /api/topic-review
 * Lista oposiciones disponibles y temas con estadísticas de verificación
 *
 * Query params:
 * - position: tipo de oposición (ej: 'auxiliar_administrativo')
 * - topic_id: UUID del tema para obtener sus preguntas (para verificación directa)
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const positionType = searchParams.get('position')
    const topicId = searchParams.get('topic_id')

    // Si se solicita un topic_id específico, devolver las preguntas de ese tema
    if (topicId) {
      return await getTopicQuestions(topicId)
    }

    // 1. Obtener oposiciones disponibles (para el selector)
    const { data: positions, error: posError } = await getSupabase()
      .from('topics')
      .select('position_type')
      .not('position_type', 'is', null)

    if (posError) {
      console.error('Error obteniendo position_types:', posError)
    }

    // Extraer valores únicos de position_type y añadir psicotécnicos
    const uniquePositions = [
      ...new Set(positions?.map(p => p.position_type) || []),
      'psicotecnicos' // Añadir psicotécnicos como opción especial
    ]

    // Si no hay position seleccionado, devolver solo la lista de oposiciones
    if (!positionType) {
      return Response.json({
        success: true,
        positions: uniquePositions,
        topics: []
      })
    }

    // Si es psicotécnicos, usar lógica especial
    if (positionType === 'psicotecnicos') {
      return await getPsychometricTopics()
    }

    // 2. Obtener temas de la oposición seleccionada
    const { data: topics, error: topicsError } = await getSupabase()
      .from('topics')
      .select(`
        id,
        topic_number,
        title,
        description,
        position_type,
        is_active
      `)
      .eq('position_type', positionType)
      .eq('is_active', true)
      .order('topic_number', { ascending: true })

    if (topicsError) {
      return Response.json({
        success: false,
        error: 'Error obteniendo temas',
        details: topicsError.message
      }, { status: 500 })
    }

    // 3. Para cada tema, obtener leyes y estadísticas
    const topicsWithStats = await Promise.all(
      topics.map(async (topic) => {
        // Obtener leyes vinculadas via topic_scope
        const { data: topicScopes } = await getSupabase()
          .from('topic_scope')
          .select(`
            id,
            article_numbers,
            laws (
              id,
              short_name,
              name,
              description
            )
          `)
          .eq('topic_id', topic.id)

        // Obtener artículos y preguntas para este tema
        const lawIds = topicScopes?.map(ts => ts.laws?.id).filter(Boolean) || []

        // Detectar si el tema tiene leyes virtuales (tienen "ficticia" en la descripción)
        const hasVirtualLaws = topicScopes?.some(ts =>
          ts.laws?.description?.toLowerCase().includes('ficticia')
        ) || false

        let stats = {
          total_questions: 0,
          verified: 0,
          // Estados para leyes normales
          perfect: 0,
          bad_explanation: 0,
          bad_answer: 0,
          bad_answer_and_explanation: 0,
          wrong_article: 0,
          wrong_article_bad_explanation: 0,
          wrong_article_bad_answer: 0,
          all_wrong: 0,
          // Estados para leyes virtuales/técnicas
          tech_perfect: 0,
          tech_bad_explanation: 0,
          tech_bad_answer: 0,
          tech_bad_answer_and_explanation: 0,
          pending: 0,
          last_verified_at: null
        }

        if (lawIds.length > 0) {
          // Obtener artículos por cada ley específica según su scope
          // (evita mezclar artículos de diferentes leyes con el mismo número)
          let allArticleIds = []
          for (const scope of topicScopes || []) {
            if (!scope.laws?.id || !scope.article_numbers?.length) continue

            const { data: articles } = await getSupabase()
              .from('articles')
              .select('id')
              .eq('law_id', scope.laws.id)
              .in('article_number', scope.article_numbers)

            if (articles) {
              allArticleIds.push(...articles.map(a => a.id))
            }
          }

          const articleIds = allArticleIds

          if (articleIds.length > 0) {
            // Obtener preguntas vinculadas a esos artículos
            const { data: questions } = await getSupabase()
              .from('questions')
              .select(`
                id,
                verified_at,
                verification_status,
                topic_review_status
              `)
              .in('primary_article_id', articleIds)
              .eq('is_active', true)

            if (questions) {
              stats.total_questions = questions.length

              for (const q of questions) {
                const status = q.topic_review_status

                if (status && status !== 'pending') {
                  stats.verified++
                  if (stats[status] !== undefined) {
                    stats[status]++
                  }
                } else if (q.verified_at) {
                  // Verificado por el sistema antiguo de monitoreo
                  stats.verified++
                  if (q.verification_status === 'ok') {
                    stats.perfect++
                  } else if (q.verification_status === 'problem') {
                    stats.bad_answer++ // Asumimos respuesta mal si viene del sistema antiguo
                  }
                } else {
                  stats.pending++
                }

                // Última verificación
                if (q.verified_at) {
                  const verifiedDate = new Date(q.verified_at)
                  if (!stats.last_verified_at || verifiedDate > new Date(stats.last_verified_at)) {
                    stats.last_verified_at = q.verified_at
                  }
                }
              }
            }
          }
        }

        // Formatear leyes para el frontend (detecta virtual por descripción)
        const laws = topicScopes?.map(ts => ({
          id: ts.laws?.id,
          short_name: ts.laws?.short_name,
          name: ts.laws?.name,
          is_virtual: ts.laws?.description?.toLowerCase().includes('ficticia') || false,
          article_numbers: ts.article_numbers
        })).filter(l => l.id) || []

        return {
          ...topic,
          stats,
          laws,
          hasVirtualLaws // Indica si el tema tiene contenido técnico
        }
      })
    )

    // Agrupar por bloques según el tipo de oposición
    let blocks = []

    if (positionType === 'administrativo') {
      // Administrativo del Estado (C1) - 6 bloques, 45 temas
      // Numeración: Bloque I: 1-11, Bloque II: 201-204, Bloque III: 301-307, etc.
      blocks = [
        {
          id: 'block1',
          title: 'Bloque I: Organización del Estado (11 temas)',
          topics: topicsWithStats.filter(t => t.topic_number >= 1 && t.topic_number <= 11)
        },
        {
          id: 'block2',
          title: 'Bloque II: Organización de Oficinas Públicas (4 temas)',
          topics: topicsWithStats.filter(t => t.topic_number >= 201 && t.topic_number <= 204)
        },
        {
          id: 'block3',
          title: 'Bloque III: Derecho Administrativo General (7 temas)',
          topics: topicsWithStats.filter(t => t.topic_number >= 301 && t.topic_number <= 307)
        },
        {
          id: 'block4',
          title: 'Bloque IV: Gestión de Personal (9 temas)',
          topics: topicsWithStats.filter(t => t.topic_number >= 401 && t.topic_number <= 409)
        },
        {
          id: 'block5',
          title: 'Bloque V: Gestión Financiera (6 temas)',
          topics: topicsWithStats.filter(t => t.topic_number >= 501 && t.topic_number <= 506)
        },
        {
          id: 'block6',
          title: 'Bloque VI: Informática Básica y Ofimática (8 temas)',
          topics: topicsWithStats.filter(t => t.topic_number >= 601 && t.topic_number <= 608)
        }
      ]
    } else {
      // Auxiliar Administrativo (C2) - 2 bloques
      blocks = [
        {
          id: 'block1',
          title: 'Bloque I: Temas Generales',
          topics: topicsWithStats.filter(t => t.topic_number < 100)
        },
        {
          id: 'block2',
          title: 'Bloque II: Temas Específicos',
          topics: topicsWithStats.filter(t => t.topic_number >= 100)
        }
      ]
    }

    return Response.json({
      success: true,
      positions: uniquePositions,
      blocks
    })

  } catch (error) {
    console.error('Error en topic-review:', error)
    return Response.json({
      success: false,
      error: 'Error interno del servidor',
      details: error.message
    }, { status: 500 })
  }
}

/**
 * Obtiene categorías psicotécnicas con sus preguntas (similar a topics pero para psychometric)
 */
async function getPsychometricTopics() {
  try {
    // 1. Obtener todas las categorías activas
    const { data: categories, error: categoriesError } = await getSupabase()
      .from('psychometric_categories')
      .select('*')
      .eq('is_active', true)
      .order('display_order')

    if (categoriesError) {
      console.error('Error obteniendo categorías psicotécnicas:', categoriesError)
      return Response.json({
        success: false,
        error: 'Error obteniendo categorías psicotécnicas'
      }, { status: 500 })
    }

    // 2. Para cada categoría, obtener estadísticas de preguntas
    const categoriesWithStats = await Promise.all(
      categories.map(async (category) => {
        // Obtener preguntas de esta categoría
        const { data: questions } = await getSupabase()
          .from('psychometric_questions')
          .select('id, is_verified, difficulty')
          .eq('category_id', category.id)
          .eq('is_active', true)

        const stats = {
          total_questions: questions?.length || 0,
          verified: questions?.filter(q => q.is_verified).length || 0,
          pending: questions?.filter(q => !q.is_verified).length || 0,
          // Para psicotécnicos solo usamos "tech_perfect" para verificadas
          tech_perfect: questions?.filter(q => q.is_verified).length || 0
        }

        return {
          id: category.id,
          topic_number: category.display_order,
          title: category.display_name,
          description: category.description,
          position_type: 'psicotecnicos',
          is_active: category.is_active,
          stats,
          laws: [], // Psicotécnicos no tienen leyes
          hasVirtualLaws: true // Marcar como técnico
        }
      })
    )

    // 3. Crear un solo bloque con todas las categorías psicotécnicas
    const blocks = [
      {
        id: 'psychometric',
        title: '🧠 Pruebas Psicotécnicas',
        topics: categoriesWithStats
      }
    ]

    return Response.json({
      success: true,
      positions: ['psicotecnicos'],
      blocks
    })

  } catch (error) {
    console.error('Error en getPsychometricTopics:', error)
    return Response.json({
      success: false,
      error: 'Error interno del servidor',
      details: error.message
    }, { status: 500 })
  }
}

/**
 * Obtiene las preguntas de un tema específico para verificación directa
 */
async function getTopicQuestions(topicId) {
  try {
    // Primero intentar si es una categoría psicotécnica
    const { data: psychoCategory, error: psychoError } = await getSupabase()
      .from('psychometric_categories')
      .select('id, display_name, category_key')
      .eq('id', topicId)
      .single()

    // Si es psicotécnico, devolver preguntas psicotécnicas
    if (psychoCategory && !psychoError) {
      const { data: psychoQuestions, error: psychoQuestionsError } = await getSupabase()
        .from('psychometric_questions')
        .select('id, question_text, is_verified, difficulty')
        .eq('category_id', topicId)
        .eq('is_active', true)
        .order('created_at', { ascending: true })

      if (psychoQuestionsError) {
        return Response.json({
          success: false,
          error: 'Error obteniendo preguntas psicotécnicas',
          details: psychoQuestionsError.message
        }, { status: 500 })
      }

      // Mapear al formato esperado (similar a questions normales)
      const mappedQuestions = psychoQuestions.map(q => ({
        id: q.id,
        question_text: q.question_text,
        // Mapear is_verified a topic_review_status para compatibilidad
        topic_review_status: q.is_verified ? 'tech_perfect' : 'pending',
        verified_at: q.is_verified ? new Date().toISOString() : null,
        verification_status: q.is_verified ? 'ok' : null,
        primary_article_id: null
      }))

      return Response.json({
        success: true,
        topic: {
          id: psychoCategory.id,
          title: psychoCategory.display_name,
          topic_number: 0
        },
        questions: mappedQuestions
      })
    }

    // 1. Obtener el tema normal
    const { data: topic, error: topicError } = await getSupabase()
      .from('topics')
      .select('id, title, topic_number')
      .eq('id', topicId)
      .single()

    if (topicError || !topic) {
      return Response.json({
        success: false,
        error: 'Tema no encontrado'
      }, { status: 404 })
    }

    // 2. Obtener scope del tema (leyes y artículos)
    const { data: topicScopes } = await getSupabase()
      .from('topic_scope')
      .select(`
        article_numbers,
        laws (id, short_name)
      `)
      .eq('topic_id', topicId)

    // 3. Obtener artículos por cada ley específica
    let allArticleIds = []
    for (const scope of topicScopes || []) {
      if (!scope.laws?.id || !scope.article_numbers?.length) continue

      const { data: articles } = await getSupabase()
        .from('articles')
        .select('id')
        .eq('law_id', scope.laws.id)
        .in('article_number', scope.article_numbers)

      if (articles) {
        allArticleIds.push(...articles.map(a => a.id))
      }
    }

    if (allArticleIds.length === 0) {
      return Response.json({
        success: true,
        topic,
        questions: []
      })
    }

    // 4. Obtener preguntas de esos artículos
    const { data: questions, error: questionsError } = await getSupabase()
      .from('questions')
      .select(`
        id,
        question_text,
        topic_review_status,
        verified_at,
        verification_status,
        primary_article_id
      `)
      .in('primary_article_id', allArticleIds)
      .eq('is_active', true)
      .order('created_at', { ascending: true })

    if (questionsError) {
      return Response.json({
        success: false,
        error: 'Error obteniendo preguntas',
        details: questionsError.message
      }, { status: 500 })
    }

    return Response.json({
      success: true,
      topic,
      questions: questions || []
    })

  } catch (error) {
    console.error('Error en getTopicQuestions:', error)
    return Response.json({
      success: false,
      error: 'Error interno',
      details: error.message
    }, { status: 500 })
  }
}
