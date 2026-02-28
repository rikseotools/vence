// app/api/admin/mark-messages-read/route.ts
import { NextResponse } from 'next/server'
import { z } from 'zod/v3'
import { markMessagesAsRead } from '@/lib/adminConversationTracking'

const requestSchema = z.object({
  conversationId: z.string().uuid()
})

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const parsed = requestSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'conversationId es requerido' },
        { status: 400 }
      )
    }

    const result = await markMessagesAsRead(parsed.data.conversationId)

    if (result.success) {
      return NextResponse.json({ success: true })
    } else {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      )
    }

  } catch (error) {
    console.error('❌ Error en API mark-messages-read:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
