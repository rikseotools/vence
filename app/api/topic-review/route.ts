// app/api/topic-review/route.ts
import {
  safeParseListRequest,
  getPositions,
  getTopicsWithStats,
  groupTopicsIntoBlocks,
  getPsychometricTopics,
  getTopicQuestions,
} from '@/lib/api/topic-review'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const positionType = searchParams.get('position')
    const topicId = searchParams.get('topic_id')

    // Si se solicita un topic_id específico, devolver las preguntas de ese tema
    if (topicId) {
      const result = await getTopicQuestions(topicId)
      if (!result.success) {
        return Response.json({ success: false, error: result.error }, { status: result.status })
      }
      return Response.json(result)
    }

    // Obtener oposiciones disponibles
    const positions = await getPositions()

    // Si no hay position seleccionado, devolver solo la lista de oposiciones
    if (!positionType) {
      return Response.json({
        success: true,
        positions,
        topics: [],
      })
    }

    // Si es psicotécnicos, usar lógica especial
    if (positionType === 'psicotecnicos') {
      const blocks = await getPsychometricTopics()
      return Response.json({
        success: true,
        positions: ['psicotecnicos'],
        blocks,
      })
    }

    // Obtener temas con stats y agrupar en bloques
    const topicsArr = await getTopicsWithStats(positionType)
    const blocks = groupTopicsIntoBlocks(positionType, topicsArr)

    return Response.json({
      success: true,
      positions,
      blocks,
    })
  } catch (error) {
    console.error('Error en topic-review:', error)
    return Response.json({
      success: false,
      error: 'Error interno del servidor',
      details: error instanceof Error ? error.message : String(error),
    }, { status: 500 })
  }
}
