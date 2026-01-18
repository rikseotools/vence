// lib/api/feedback/queries.ts - Queries tipadas para feedback de usuario
import { getDb } from '@/db/client'
import { userFeedback, feedbackConversations } from '@/db/schema'
import type {
  CreateFeedbackRequest,
  CreateFeedbackResponse,
  FeedbackData
} from './schemas'

// ============================================
// CREAR FEEDBACK
// ============================================

export async function createFeedback(
  params: CreateFeedbackRequest
): Promise<CreateFeedbackResponse> {
  try {
    const db = getDb()

    // Insertar feedback
    const [feedback] = await db
      .insert(userFeedback)
      .values({
        userId: params.userId || null,
        email: params.email || null,
        type: params.type,
        message: params.message,
        url: params.url,
        userAgent: params.userAgent || null,
        viewport: params.viewport || null,
        referrer: params.referrer || null,
        wantsResponse: params.wantsResponse || false,
        status: params.status || 'pending',
        priority: params.priority || 'medium',
        questionId: params.questionId || null,
      })
      .returning({
        id: userFeedback.id,
        userId: userFeedback.userId,
        email: userFeedback.email,
        type: userFeedback.type,
        message: userFeedback.message,
        url: userFeedback.url,
        userAgent: userFeedback.userAgent,
        viewport: userFeedback.viewport,
        referrer: userFeedback.referrer,
        screenshotUrl: userFeedback.screenshotUrl,
        status: userFeedback.status,
        priority: userFeedback.priority,
        adminResponse: userFeedback.adminResponse,
        adminUserId: userFeedback.adminUserId,
        wantsResponse: userFeedback.wantsResponse,
        createdAt: userFeedback.createdAt,
        updatedAt: userFeedback.updatedAt,
        resolvedAt: userFeedback.resolvedAt,
        questionId: userFeedback.questionId,
      })

    if (!feedback) {
      return {
        success: false,
        error: 'No se pudo crear el feedback'
      }
    }

    console.log('✅ [Feedback] Feedback creado:', {
      id: feedback.id,
      type: feedback.type,
      questionId: feedback.questionId
    })

    return {
      success: true,
      data: feedback as FeedbackData
    }

  } catch (error) {
    console.error('❌ [Feedback] Error creando feedback:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    }
  }
}

// ============================================
// CREAR CONVERSACIÓN DE FEEDBACK
// ============================================

export async function createFeedbackConversation(
  feedbackId: string,
  userId: string | null
): Promise<{ success: boolean; error?: string }> {
  try {
    const db = getDb()

    await db
      .insert(feedbackConversations)
      .values({
        feedbackId,
        userId: userId || null,
        status: 'waiting_admin',
      })

    console.log('✅ [Feedback] Conversación creada para feedback:', feedbackId)

    return { success: true }

  } catch (error) {
    console.error('❌ [Feedback] Error creando conversación:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    }
  }
}
