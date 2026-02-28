// app/api/admin/ai-chat-logs/route.ts
import { NextResponse } from 'next/server'
import { aiChatLogsQuerySchema } from '@/lib/api/admin-ai-chat-logs/schemas'
import { getAiChatLogs } from '@/lib/api/admin-ai-chat-logs'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const parsed = aiChatLogsQuerySchema.safeParse({
      page: searchParams.get('page') || '1',
      limit: searchParams.get('limit') || '20',
      feedback: searchParams.get('feedback') || undefined
    })

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Parámetros inválidos: ' + parsed.error.message },
        { status: 400 }
      )
    }

    const { page, limit, feedback } = parsed.data
    const result = await getAiChatLogs(page, limit, feedback)
    return NextResponse.json(result)

  } catch (error) {
    console.error('Error en ai-chat-logs:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
