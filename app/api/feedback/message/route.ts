// app/api/feedback/message/route.ts
// API para que usuarios envíen mensajes en conversaciones de feedback
// Migrada a TypeScript + Zod + Drizzle

import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/db/client'
import { feedbackConversations, feedbackMessages, userFeedback } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { z } from 'zod/v3'

// ============================================
// SCHEMAS DE VALIDACIÓN
// ============================================

const sendMessageRequestSchema = z.object({
  conversationId: z.string().uuid('ID de conversación inválido'),
  message: z.string().min(1, 'El mensaje no puede estar vacío').max(5000, 'Mensaje demasiado largo'),
  userId: z.string().uuid('ID de usuario inválido')
})

type SendMessageRequest = z.infer<typeof sendMessageRequestSchema>

interface SendMessageResponse {
  success: boolean
  message?: {
    id: string
    conversation_id: string
    message: string
    is_admin: boolean
    created_at: string
  }
  error?: string
}

// ============================================
// FUNCIÓN PRINCIPAL
// ============================================

async function sendUserMessage(params: SendMessageRequest): Promise<SendMessageResponse> {
  try {
    const db = getDb()

    // Verificar que la conversación existe y pertenece al usuario
    const conversationResult = await db
      .select({
        id: feedbackConversations.id,
        userId: feedbackConversations.userId
      })
      .from(feedbackConversations)
      .where(eq(feedbackConversations.id, params.conversationId))
      .limit(1)

    const conversation = conversationResult[0]

    if (!conversation) {
      console.error('❌ [API/feedback/message] Conversación no encontrada:', params.conversationId)
      return {
        success: false,
        error: 'Conversación no encontrada'
      }
    }

    if (conversation.userId !== params.userId) {
      console.error('❌ [API/feedback/message] Usuario no autorizado:', {
        conversationUserId: conversation.userId,
        requestUserId: params.userId
      })
      return {
        success: false,
        error: 'No tienes permiso para esta conversación'
      }
    }

    // Insertar mensaje
    const insertResult = await db
      .insert(feedbackMessages)
      .values({
        conversationId: params.conversationId,
        senderId: params.userId,
        message: params.message.trim(),
        isAdmin: false
      })
      .returning({
        id: feedbackMessages.id,
        conversationId: feedbackMessages.conversationId,
        message: feedbackMessages.message,
        isAdmin: feedbackMessages.isAdmin,
        createdAt: feedbackMessages.createdAt
      })

    const newMessage = insertResult[0]

    if (!newMessage) {
      console.error('❌ [API/feedback/message] Error insertando mensaje')
      return {
        success: false,
        error: 'Error al guardar el mensaje'
      }
    }

    // Actualizar estado de conversación a waiting_admin
    await db
      .update(feedbackConversations)
      .set({
        status: 'waiting_admin',
        lastMessageAt: new Date().toISOString()
      })
      .where(eq(feedbackConversations.id, params.conversationId))

    // Reabrir feedback si estaba resuelto/descartado
    const convData = await db
      .select({ feedbackId: feedbackConversations.feedbackId })
      .from(feedbackConversations)
      .where(eq(feedbackConversations.id, params.conversationId))
      .limit(1)

    if (convData[0]?.feedbackId) {
      const fbData = await db
        .select({ status: userFeedback.status })
        .from(userFeedback)
        .where(eq(userFeedback.id, convData[0].feedbackId))
        .limit(1)

      if (fbData[0]?.status === 'resolved' || fbData[0]?.status === 'dismissed') {
        await db
          .update(userFeedback)
          .set({
            status: 'pending',
            resolvedAt: null
          })
          .where(eq(userFeedback.id, convData[0].feedbackId))

        console.log('🔄 [API/feedback/message] Feedback reabierto:', convData[0].feedbackId)
      }
    }

    console.log('✅ [API/feedback/message] Mensaje enviado:', {
      messageId: newMessage.id,
      conversationId: params.conversationId
    })

    return {
      success: true,
      message: {
        id: newMessage.id,
        conversation_id: newMessage.conversationId!,
        message: newMessage.message,
        is_admin: newMessage.isAdmin!,
        created_at: newMessage.createdAt!
      }
    }

  } catch (error) {
    console.error('❌ [API/feedback/message] Error:', error)
    return {
      success: false,
      error: 'Error interno del servidor'
    }
  }
}

// ============================================
// ENDPOINT POST
// ============================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validar request con Zod
    const validation = sendMessageRequestSchema.safeParse(body)

    if (!validation.success) {
      console.error('❌ [API/feedback/message] Validación fallida:', validation.error.flatten())
      return NextResponse.json(
        {
          success: false,
          error: 'Datos inválidos',
          details: validation.error.flatten()
        },
        { status: 400 }
      )
    }

    // Enviar mensaje
    const result = await sendUserMessage(validation.data)

    if (!result.success) {
      const status = result.error === 'Conversación no encontrada' ? 404
        : result.error === 'No tienes permiso para esta conversación' ? 403
        : 500

      return NextResponse.json(
        {
          success: false,
          error: result.error
        },
        { status }
      )
    }

    return NextResponse.json(result)

  } catch (error) {
    console.error('❌ [API/feedback/message] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Error interno del servidor'
      },
      { status: 500 }
    )
  }
}

// Bloquear GET para evitar accesos accidentales
export async function GET() {
  return NextResponse.json(
    { error: 'Método no permitido. Usa POST.' },
    { status: 405 }
  )
}
