// lib/api/feedback/queries.ts - Queries tipadas para feedback de usuario
// CANARY self-hosted pooler (Fase 4 oleada 4 — sweep masivo 2026-05-10):
// feedback migrado al pooler propio para reducir presión Supavisor.
import { getDb, getPoolerDb } from '@/db/client'

function getFeedbackDb() {
  return process.env.USE_SELF_HOSTED_POOLER === 'true' ? getPoolerDb() : getDb()
}
import { userFeedback, feedbackConversations } from '@/db/schema'
import { canonicalSubForToken } from '@/lib/auth/resolveAppUser'
import { userIdParaFeedback } from '@/lib/auth/canonicalSub'
import { emit } from '@/lib/observability/emit'
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
    const db = getFeedbackDb()

    // [T-245] EL MENSAJE NO SE PIERDE NUNCA.
    //
    // `user_feedback.user_id` tiene FK a `user_profiles`, así que un id que no existe
    // reventaba el INSERT y devolvía 500: el usuario creía habernos escrito y a nosotros
    // no nos llegaba nada. El 28/07 uno lo intentó CUATRO veces (cambiando hasta la
    // categoría, creyendo que se equivocaba él) y se perdieron los cuatro. Lo peor es que
    // el fallo se ocultaba a sí mismo: el único que podía avisarnos era justo quien no podía.
    //
    // Ahora se resuelve la identidad con el MISMO núcleo que usa el acuñado del token
    // (`canonicalSubForToken`: si el id no tiene perfil, se busca por email) y, si no hay
    // manera, se guarda con `user_id = NULL`. El email queda en la fila, así que se sabe
    // quién escribe y se le puede contestar. Preferimos un mensaje sin usuario asociado
    // a un mensaje perdido.
    let userId: string | null = params.userId || null
    if (userId) {
      const decision = await canonicalSubForToken(userId, params.email || null)
      userId = userIdParaFeedback(decision)
      if (decision.reconciliado || decision.huerfano) {
        void emit({
          source: 'vercel',
          severity: decision.huerfano ? 'error' : 'warn',
          eventType: 'feedback_identidad_irresoluble',
          endpoint: '/api/feedback',
          metadata: {
            userIdRecibido: params.userId ?? null,
            userIdGuardado: userId,
            email: params.email ?? null,
            resultado: decision.huerfano ? 'guardado_sin_usuario' : 'reconciliado',
          },
        })
      }
    }

    // Insertar feedback
    const [feedback] = await db
      .insert(userFeedback)
      .values({
        userId,
        email: params.email || null,
        type: params.type,
        message: params.message,
        url: params.url,
        userAgent: params.userAgent || null,
        viewport: params.viewport || null,
        referrer: params.referrer || null,
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
    const db = getFeedbackDb()

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
