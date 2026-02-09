import { createClient } from '@supabase/supabase-js'

const getSupabase = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

/**
 * POST /api/verify-articles/apply-fix
 * Aplica la corrección sugerida por la IA a una pregunta
 */
export async function POST(request) {
  try {
    const {
      questionId,
      newCorrectOption,
      newExplanation,
      verificationId,
      appliedBy = 'admin'
    } = await request.json()

    if (!questionId) {
      return Response.json({
        success: false,
        error: 'Se requiere questionId'
      }, { status: 400 })
    }

    // Obtener la pregunta actual para guardar historial
    const { data: currentQuestion, error: fetchError } = await getSupabase()
      .from('questions')
      .select('id, correct_option, explanation, question_text')
      .eq('id', questionId)
      .single()

    if (fetchError || !currentQuestion) {
      return Response.json({
        success: false,
        error: 'Pregunta no encontrada'
      }, { status: 404 })
    }

    // Preparar datos de actualización
    const updateData = {
      updated_at: new Date().toISOString()
    }

    // Convertir letra a índice (A=0, B=1, C=2, D=3)
    if (newCorrectOption) {
      const optionMap = { 'A': 0, 'B': 1, 'C': 2, 'D': 3 }
      const optionIndex = optionMap[newCorrectOption.toUpperCase()]
      if (optionIndex !== undefined) {
        updateData.correct_option = optionIndex
      }
    }

    if (newExplanation) {
      updateData.explanation = newExplanation
    }

    // Guardar en historial de cambios antes de actualizar
    await getSupabase().from('question_corrections').insert({
      question_id: questionId,
      previous_correct_option: currentQuestion.correct_option,
      new_correct_option: updateData.correct_option ?? currentQuestion.correct_option,
      previous_explanation: currentQuestion.explanation,
      new_explanation: updateData.explanation ?? currentQuestion.explanation,
      verification_id: verificationId,
      applied_by: appliedBy,
      applied_at: new Date().toISOString(),
      source: 'ai_verification'
    }).then(() => {}).catch(err => {
      // Si la tabla no existe, ignoramos el error
      console.log('Nota: tabla question_corrections no existe, continuando sin historial')
    })

    // Actualizar la pregunta
    const { error: updateError } = await getSupabase()
      .from('questions')
      .update(updateData)
      .eq('id', questionId)

    if (updateError) {
      throw updateError
    }

    // Marcar la verificación como aplicada
    if (verificationId) {
      await getSupabase()
        .from('ai_verification_results')
        .update({
          fix_applied: true,
          fix_applied_at: new Date().toISOString()
        })
        .eq('id', verificationId)
    }

    return Response.json({
      success: true,
      message: 'Corrección aplicada correctamente',
      changes: {
        questionId,
        previousOption: ['A', 'B', 'C', 'D'][currentQuestion.correct_option],
        newOption: newCorrectOption || ['A', 'B', 'C', 'D'][currentQuestion.correct_option],
        explanationUpdated: !!newExplanation
      }
    })

  } catch (error) {
    console.error('Error aplicando corrección:', error)
    return Response.json({
      success: false,
      error: 'Error aplicando corrección',
      details: error.message
    }, { status: 500 })
  }
}
