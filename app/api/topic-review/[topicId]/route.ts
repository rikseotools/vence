// app/api/topic-review/[topicId]/route.ts
import { safeParseTopicDetail, getTopicDetail } from '@/lib/api/topic-review'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ topicId: string }> },
) {
  try {
    const { topicId } = await params

    const parsed = safeParseTopicDetail({ topicId })
    if (!parsed.success) {
      return Response.json({
        success: false,
        error: parsed.error.issues[0]?.message || 'topicId inválido',
      }, { status: 400 })
    }

    const result = await getTopicDetail(parsed.data.topicId)

    if (!result.success) {
      return Response.json(
        { success: false, error: result.error },
        { status: result.status },
      )
    }

    return Response.json(result)
  } catch (error) {
    console.error('Error en topic-review/[topicId]:', error)
    return Response.json({
      success: false,
      error: 'Error interno del servidor',
      details: error instanceof Error ? error.message : String(error),
    }, { status: 500 })
  }
}
