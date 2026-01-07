import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function POST(request) {
  try {
    const { logId, feedback, comment } = await request.json()

    if (!logId) {
      return Response.json({
        success: false,
        error: 'Se requiere logId'
      }, { status: 400 })
    }

    if (!feedback || !['positive', 'negative'].includes(feedback)) {
      return Response.json({
        success: false,
        error: 'Feedback debe ser "positive" o "negative"'
      }, { status: 400 })
    }

    // Actualizar el log con el feedback
    const { error } = await supabase
      .from('ai_chat_logs')
      .update({
        feedback,
        feedback_comment: comment || null
      })
      .eq('id', logId)

    if (error) {
      console.error('Error guardando feedback:', error)
      return Response.json({
        success: false,
        error: 'Error guardando feedback'
      }, { status: 500 })
    }

    return Response.json({
      success: true,
      message: 'Feedback guardado'
    })

  } catch (error) {
    console.error('Error en feedback:', error)
    return Response.json({
      success: false,
      error: 'Error procesando feedback'
    }, { status: 500 })
  }
}
