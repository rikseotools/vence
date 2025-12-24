// app/api/topic-review/update-status/route.js
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

/**
 * POST /api/topic-review/update-status
 * Actualizar manualmente el estado de revisión de una pregunta
 */
export async function POST(request) {
  try {
    const { questionId, status } = await request.json()

    if (!questionId) {
      return Response.json({
        success: false,
        error: 'Se requiere questionId'
      }, { status: 400 })
    }

    // Estados válidos
    const validStatuses = [
      'perfect', 'bad_explanation', 'bad_answer', 'bad_answer_and_explanation',
      'wrong_article', 'wrong_article_bad_explanation', 'wrong_article_bad_answer', 'all_wrong',
      'tech_perfect', 'tech_bad_explanation', 'tech_bad_answer', 'tech_bad_answer_and_explanation',
      'pending'
    ]

    if (!validStatuses.includes(status)) {
      return Response.json({
        success: false,
        error: 'Estado no válido'
      }, { status: 400 })
    }

    // Actualizar el estado en la tabla questions
    const { error: updateError } = await supabase
      .from('questions')
      .update({
        topic_review_status: status,
        verified_at: new Date().toISOString()
      })
      .eq('id', questionId)

    if (updateError) {
      return Response.json({
        success: false,
        error: 'Error actualizando pregunta',
        details: updateError.message
      }, { status: 500 })
    }

    // Si existe verificación IA, marcarla como descartada (override manual)
    const { data: aiVerification } = await supabase
      .from('ai_verification_results')
      .select('id')
      .eq('question_id', questionId)
      .single()

    if (aiVerification) {
      await supabase
        .from('ai_verification_results')
        .update({
          discarded: true,
          discarded_reason: 'Manual override by admin'
        })
        .eq('question_id', questionId)
    }

    return Response.json({
      success: true,
      message: `Estado actualizado a "${status}"`,
      questionId,
      newStatus: status
    })

  } catch (error) {
    console.error('Error en update-status:', error)
    return Response.json({
      success: false,
      error: 'Error interno del servidor',
      details: error.message
    }, { status: 500 })
  }
}
