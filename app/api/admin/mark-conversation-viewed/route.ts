// app/api/admin/mark-conversation-viewed/route.ts
import { NextResponse } from 'next/server'
import { z } from 'zod/v3'
import { markConversationAsViewed } from '@/lib/adminConversationTracking'

import { withErrorLogging } from '@/lib/api/withErrorLogging'
const requestSchema = z.object({
  conversationId: z.string().uuid()
})

async function _POST(request: Request) {
  try {
    const body = await request.json()
    const parsed = requestSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'conversationId es requerido' },
        { status: 400 }
      )
    }

    const result = await markConversationAsViewed(parsed.data.conversationId)

    if (result.success) {
      return NextResponse.json({ success: true })
    } else {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      )
    }

  } catch (error) {
    console.error('❌ Error en API mark-conversation-viewed:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

export const POST = withErrorLogging('/api/admin/mark-conversation-viewed', _POST)
