// app/api/topic-review/route.js
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

/**
 * GET /api/topic-review
 * Lista oposiciones disponibles y temas con estadísticas de verificación
 *
 * Query params:
 * - position: tipo de oposición (ej: 'auxiliar_administrativo')
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const positionType = searchParams.get('position')

    // 1. Obtener oposiciones disponibles (para el selector)
    const { data: positions, error: posError } = await supabase
      .from('topics')
      .select('position_type')
      .not('position_type', 'is', null)

    if (posError) {
      console.error('Error obteniendo position_types:', posError)
    }

    // Extraer valores únicos de position_type
    const uniquePositions = [...new Set(positions?.map(p => p.position_type) || [])]

    // Si no hay position seleccionado, devolver solo la lista de oposiciones
    if (!positionType) {
      return Response.json({
        success: true,
        positions: uniquePositions,
        topics: []
      })
    }

    // 2. Obtener temas de la oposición seleccionada
    const { data: topics, error: topicsError } = await supabase
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
        const { data: topicScopes } = await supabase
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
          // Obtener todos los artículos del topic_scope
          const articleNumbers = topicScopes?.flatMap(ts => ts.article_numbers || []) || []

          // Obtener artículos con sus preguntas
          const { data: articles } = await supabase
            .from('articles')
            .select('id')
            .in('law_id', lawIds)
            .in('article_number', articleNumbers)

          const articleIds = articles?.map(a => a.id) || []

          if (articleIds.length > 0) {
            // Obtener preguntas vinculadas a esos artículos
            const { data: questions } = await supabase
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
      blocks = [
        {
          id: 'block1',
          title: 'Bloque I: Organización del Estado (11 temas)',
          topics: topicsWithStats.filter(t => t.topic_number >= 1 && t.topic_number <= 11)
        },
        {
          id: 'block2',
          title: 'Bloque II: Organización de Oficinas Públicas (4 temas)',
          topics: topicsWithStats.filter(t => t.topic_number >= 12 && t.topic_number <= 15)
        },
        {
          id: 'block3',
          title: 'Bloque III: Derecho Administrativo General (7 temas)',
          topics: topicsWithStats.filter(t => t.topic_number >= 16 && t.topic_number <= 22)
        },
        {
          id: 'block4',
          title: 'Bloque IV: Gestión de Personal (9 temas)',
          topics: topicsWithStats.filter(t => t.topic_number >= 23 && t.topic_number <= 31)
        },
        {
          id: 'block5',
          title: 'Bloque V: Gestión Financiera (6 temas)',
          topics: topicsWithStats.filter(t => t.topic_number >= 32 && t.topic_number <= 37)
        },
        {
          id: 'block6',
          title: 'Bloque VI: Informática Básica y Ofimática (8 temas)',
          topics: topicsWithStats.filter(t => t.topic_number >= 38 && t.topic_number <= 45)
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
