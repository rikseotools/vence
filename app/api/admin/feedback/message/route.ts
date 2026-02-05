// app/api/admin/feedback/message/route.ts
// API para que admins envíen mensajes en conversaciones de feedback
// Usa Drizzle + Zod para tipado robusto

import { NextRequest, NextResponse } from 'next/server'
import {
  adminSendMessage,
  markMessagesAsRead,
  createConversation,
  safeParseAdminSendMessage,
  safeParseMarkMessagesRead,
  safeParseCreateConversation
} from '@/lib/api/admin-feedback'

// ============================================
// POST - Admin envia mensaje o crea conversación
// ============================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const action = body.action || 'send_message'

    // Handle different actions
    switch (action) {
      case 'send_message': {
        const validation = safeParseAdminSendMessage(body)
        if (!validation.success) {
          console.error('❌ [API/admin/feedback/message] Validation error:', validation.error.flatten())
          return NextResponse.json(
            {
              success: false,
              error: 'Datos inválidos',
              details: validation.error.flatten()
            },
            { status: 400 }
          )
        }

        const result = await adminSendMessage(validation.data)

        if (!result.success) {
          const status = result.error === 'Conversación no encontrada' ? 404 : 500
          return NextResponse.json(
            { success: false, error: result.error },
            { status }
          )
        }

        return NextResponse.json(result)
      }

      case 'mark_read': {
        const validation = safeParseMarkMessagesRead(body)
        if (!validation.success) {
          return NextResponse.json(
            {
              success: false,
              error: 'Datos inválidos',
              details: validation.error.flatten()
            },
            { status: 400 }
          )
        }

        const result = await markMessagesAsRead(validation.data)
        return NextResponse.json(result)
      }

      case 'create_conversation': {
        const validation = safeParseCreateConversation(body)
        if (!validation.success) {
          return NextResponse.json(
            {
              success: false,
              error: 'Datos inválidos',
              details: validation.error.flatten()
            },
            { status: 400 }
          )
        }

        const result = await createConversation(validation.data)

        if (!result.success) {
          const status = result.error === 'Feedback no encontrado' ? 404
            : result.error === 'Ya existe una conversación para este feedback' ? 409
            : 500
          return NextResponse.json(
            { success: false, error: result.error },
            { status }
          )
        }

        return NextResponse.json(result)
      }

      default:
        return NextResponse.json(
          { success: false, error: `Acción desconocida: ${action}` },
          { status: 400 }
        )
    }

  } catch (error) {
    console.error('❌ [API/admin/feedback/message] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Error interno del servidor'
      },
      { status: 500 }
    )
  }
}

// Bloquear GET
export async function GET() {
  return NextResponse.json(
    { success: false, error: 'Método no permitido. Usa POST.' },
    { status: 405 }
  )
}
