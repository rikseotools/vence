// app/api/admin/mark-messages-read/route.js
import { NextResponse } from 'next/server'
import { markMessagesAsRead } from '@/lib/adminConversationTracking'

export async function POST(request) {
  try {
    const { conversationId } = await request.json()
    
    if (!conversationId) {
      return NextResponse.json(
        { error: 'conversationId es requerido' },
        { status: 400 }
      )
    }
    
    const result = await markMessagesAsRead(conversationId)
    
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