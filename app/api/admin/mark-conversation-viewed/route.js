// app/api/admin/mark-conversation-viewed/route.js
import { NextResponse } from 'next/server'
import { markConversationAsViewed } from '@/lib/adminConversationTracking'

export async function POST(request) {
  try {
    const { conversationId } = await request.json()
    
    if (!conversationId) {
      return NextResponse.json(
        { error: 'conversationId es requerido' },
        { status: 400 }
      )
    }
    
    const result = await markConversationAsViewed(conversationId)
    
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