import { getAdminDb } from '@/db/client'
import { aiChatLogs } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { withErrorLogging } from '@/lib/api/withErrorLogging'

async function _POST(request) {
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
    let error = null
    try {
      await getAdminDb()
        .update(aiChatLogs)
        .set({
          feedback,
          feedbackComment: comment || null
        })
        .where(eq(aiChatLogs.id, logId))
    } catch (e) {
      error = e
    }

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

export const POST = withErrorLogging('/api/ai/chat/feedback', _POST)
