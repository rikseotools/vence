// app/api/verification-queue/route.js
// Endpoint para gestionar la cola de verificaciones

import { createClient } from '@supabase/supabase-js'

const getSupabase = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

/**
 * GET /api/verification-queue
 * Obtiene el estado de las verificaciones en cola/proceso
 *
 * Query params:
 * - topic_id: filtrar por tema específico
 * - status: filtrar por estado (pending, processing, completed, failed)
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const topicId = searchParams.get('topic_id')
    const status = searchParams.get('status')

    let query = getSupabase()
      .from('verification_queue')
      .select('*')
      .order('created_at', { ascending: false })

    if (topicId) {
      query = query.eq('topic_id', topicId)
    }

    if (status) {
      query = query.eq('status', status)
    } else {
      // Por defecto, mostrar pending y processing
      query = query.in('status', ['pending', 'processing'])
    }

    const { data, error } = await query.limit(50)

    if (error) {
      return Response.json({
        success: false,
        error: error.message
      }, { status: 500 })
    }

    return Response.json({
      success: true,
      queue: data
    })

  } catch (error) {
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}

/**
 * POST /api/verification-queue
 * Encola una verificación de tema
 *
 * Body:
 * - topic_id: UUID del tema a verificar
 * - provider: proveedor de IA (openai, anthropic, google)
 * - model: modelo a usar
 * - question_ids: (opcional) IDs específicos a verificar
 */
export async function POST(request) {
  try {
    const { topic_id, provider = 'openai', model = 'gpt-4o-mini', question_ids } = await request.json()

    if (!topic_id) {
      return Response.json({
        success: false,
        error: 'Se requiere topic_id'
      }, { status: 400 })
    }

    // Verificar que el tema existe
    const { data: topic, error: topicError } = await getSupabase()
      .from('topics')
      .select('id, title, topic_number')
      .eq('id', topic_id)
      .single()

    if (topicError || !topic) {
      return Response.json({
        success: false,
        error: 'Tema no encontrado'
      }, { status: 404 })
    }

    // Verificar si ya hay una verificación pendiente o en proceso para este tema
    const { data: existing } = await getSupabase()
      .from('verification_queue')
      .select('id, status')
      .eq('topic_id', topic_id)
      .in('status', ['pending', 'processing'])
      .single()

    if (existing) {
      return Response.json({
        success: false,
        error: `Ya hay una verificación ${existing.status === 'pending' ? 'pendiente' : 'en proceso'} para este tema`,
        existing_id: existing.id
      }, { status: 409 })
    }

    // Contar preguntas pendientes si no se especifican IDs
    let totalQuestions = question_ids?.length || 0

    if (!question_ids || question_ids.length === 0) {
      // Obtener preguntas pendientes del tema usando la misma lógica que la API de detalle
      const { data: topicScopes } = await getSupabase()
        .from('topic_scope')
        .select('article_numbers, laws(id)')
        .eq('topic_id', topic_id)

      let articleIds = []
      for (const scope of topicScopes || []) {
        if (!scope.laws?.id || !scope.article_numbers?.length) continue

        const { data: articles } = await getSupabase()
          .from('articles')
          .select('id')
          .eq('law_id', scope.laws.id)
          .in('article_number', scope.article_numbers)

        if (articles) {
          articleIds.push(...articles.map(a => a.id))
        }
      }

      if (articleIds.length > 0) {
        const { count } = await getSupabase()
          .from('questions')
          .select('id', { count: 'exact', head: true })
          .in('primary_article_id', articleIds)
          .eq('is_active', true)
          .or('topic_review_status.is.null,topic_review_status.eq.pending')

        totalQuestions = count || 0
      }
    }

    if (totalQuestions === 0) {
      return Response.json({
        success: false,
        error: 'No hay preguntas pendientes de verificar en este tema'
      }, { status: 400 })
    }

    // Crear entrada en la cola
    const { data: queueEntry, error: insertError } = await getSupabase()
      .from('verification_queue')
      .insert({
        topic_id,
        ai_provider: provider,
        ai_model: model,
        question_ids: question_ids || [],
        total_questions: totalQuestions,
        status: 'pending'
      })
      .select()
      .single()

    if (insertError) {
      return Response.json({
        success: false,
        error: 'Error al encolar verificación',
        details: insertError.message
      }, { status: 500 })
    }

    return Response.json({
      success: true,
      message: `Verificación encolada: ${totalQuestions} preguntas pendientes`,
      queue_entry: queueEntry,
      topic: {
        id: topic.id,
        title: topic.title,
        topic_number: topic.topic_number
      }
    })

  } catch (error) {
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}

/**
 * DELETE /api/verification-queue
 * Cancela una verificación pendiente
 *
 * Query params:
 * - id: UUID de la entrada a cancelar
 */
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return Response.json({
        success: false,
        error: 'Se requiere id'
      }, { status: 400 })
    }

    const { data, error } = await getSupabase()
      .from('verification_queue')
      .update({ status: 'cancelled' })
      .eq('id', id)
      .eq('status', 'pending') // Solo se pueden cancelar las pendientes
      .select()
      .single()

    if (error || !data) {
      return Response.json({
        success: false,
        error: 'No se pudo cancelar (puede que ya esté procesándose)'
      }, { status: 400 })
    }

    return Response.json({
      success: true,
      message: 'Verificación cancelada',
      cancelled: data
    })

  } catch (error) {
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}
