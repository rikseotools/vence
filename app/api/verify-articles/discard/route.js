import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

/**
 * POST /api/verify-articles/discard
 * Marca o desmarca una verificación como falso positivo (descartada)
 */
export async function POST(request) {
  try {
    const { questionId, discarded } = await request.json()

    if (!questionId) {
      return Response.json({
        success: false,
        error: 'Se requiere questionId'
      }, { status: 400 })
    }

    // Actualizar el estado de descarte
    const updateData = {
      discarded: discarded === true,
      discarded_at: discarded === true ? new Date().toISOString() : null
    }

    const { data, error } = await supabase
      .from('ai_verification_results')
      .update(updateData)
      .eq('question_id', questionId)
      .select()

    if (error) {
      // Si la columna no existe, dar un mensaje claro
      if (error.message?.includes('discarded')) {
        return Response.json({
          success: false,
          error: 'La columna "discarded" no existe. Ejecuta la migración SQL en Supabase.',
          needsMigration: true
        }, { status: 500 })
      }
      throw error
    }

    return Response.json({
      success: true,
      discarded: discarded === true,
      questionId,
      updated: data?.length || 0
    })

  } catch (error) {
    console.error('Error actualizando estado de descarte:', error)
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}
