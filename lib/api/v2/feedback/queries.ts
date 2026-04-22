// lib/api/v2/feedback/queries.ts
// Función respondFeedback(): centraliza el cierre/respuesta de feedbacks para
// sustituir el patrón antiguo basado en trigger PG + múltiples INSERTs desde
// admin UI / scripts manuales.
//
// Comportamiento:
//   - Sin `message` → solo UPDATE de status en user_feedback + conversation
//     (cierre silencioso; caso típico: spam, duplicados).
//   - Con `message` → INSERT en feedback_messages + notification_logs (campana)
//     + sendEmailV2 in-process + cierre de estado. Cada paso modulable por
//     flags o condiciones automáticas (user externo sin user_id = no campana).
//
// Documentado en docs/procedures/gestionar-feedback-bug.md §10 (post-14/04/2026)
// y en docs/maintenance/impugnaciones-claude-code.md §16 (contexto del refactor).

import { getDb } from '@/db/client'
import {
  userFeedback,
  feedbackConversations,
  feedbackMessages,
  notificationLogs,
  userProfiles,
  userSessions,
} from '@/db/schema'
import { eq, desc, and, isNull } from 'drizzle-orm'
import { sendEmailV2 } from '@/lib/api/emails'
import type {
  RespondFeedbackRequest,
  RespondFeedbackResponse,
  FeedbackError,
  EmailSkipReason,
  BellSkipReason,
} from './schemas'

// Comprueba si el usuario tiene una sesión activa (último updated_at ≤ 5s).
// Mismo umbral que usaba /api/send-support-email para evitar email redundante
// cuando el usuario está viendo la app y recibirá la campana en tiempo real.
async function isUserActivelyBrowsing(userId: string): Promise<boolean> {
  try {
    const db = getDb()
    const [row] = await db
      .select({ updatedAt: userSessions.updatedAt })
      .from(userSessions)
      .where(eq(userSessions.userId, userId))
      .orderBy(desc(userSessions.updatedAt))
      .limit(1)
    if (!row?.updatedAt) return false
    const lastActivity = new Date(row.updatedAt).getTime()
    return (Date.now() - lastActivity) / 1000 <= 5
  } catch {
    return false
  }
}

export async function respondFeedback(
  params: RespondFeedbackRequest
): Promise<RespondFeedbackResponse | FeedbackError> {
  try {
    const db = getDb()
    const { feedbackId, adminUserId } = params
    const rawMessage = params.message ?? ''
    const trimmedMessage = rawMessage.trim()
    const hasMessage = trimmedMessage.length > 0
    const now = new Date().toISOString()

    // 1. Cargar feedback + conversation + datos del usuario
    const [row] = await db
      .select({
        fbId: userFeedback.id,
        fbUserId: userFeedback.userId,
        fbEmail: userFeedback.email,
        convId: feedbackConversations.id,
        userEmail: userProfiles.email,
        userName: userProfiles.fullName,
      })
      .from(userFeedback)
      .leftJoin(
        feedbackConversations,
        eq(feedbackConversations.feedbackId, userFeedback.id)
      )
      .leftJoin(userProfiles, eq(userProfiles.id, userFeedback.userId))
      .where(eq(userFeedback.id, feedbackId))
      .limit(1)

    if (!row) {
      return { success: false, error: 'Feedback no encontrado' }
    }

    const targetUserId = row.fbUserId ?? null
    const conversationId = row.convId ?? null
    const isExternalContact = !targetUserId
    const toEmail = row.userEmail ?? row.fbEmail ?? null

    if (!conversationId && hasMessage) {
      return {
        success: false,
        error: 'El feedback no tiene conversacion abierta (crear una antes de responder)',
      }
    }

    // Determinar finalStatus y flags efectivos
    const finalStatus = params.finalStatus ?? (hasMessage ? 'resolved' : null)
    const sendEmailFlag = params.sendEmail ?? true
    const sendBellFlag = params.sendBell ?? true

    // 2. Transacción: INSERT msg + INSERT notif + UPDATE conversation + UPDATE feedback
    let messageId: string | null = null
    let bellSent = false
    let bellSkipReason: BellSkipReason = null

    await db.transaction(async (tx) => {
      if (hasMessage && conversationId) {
        // 2.1 INSERT feedback_messages
        const [inserted] = await tx
          .insert(feedbackMessages)
          .values({
            conversationId,
            senderId: adminUserId,
            message: trimmedMessage,
            isAdmin: true,
          })
          .returning({ id: feedbackMessages.id })
        messageId = inserted?.id ?? null

        // 2.2 INSERT notification_logs (campana) — skip si externo o flag false
        if (!sendBellFlag) {
          bellSkipReason = 'send_bell_false_flag'
        } else if (isExternalContact) {
          bellSkipReason = 'external_contact'
        } else {
          const preview =
            trimmedMessage.length > 100
              ? trimmedMessage.slice(0, 100) + '...'
              : trimmedMessage
          await tx.insert(notificationLogs).values({
            userId: targetUserId!,
            messageSent: `El equipo de Vence: "${preview}"`,
            deliveryStatus: 'sent',
            contextData: {
              type: 'feedback_response',
              title: 'Nueva respuesta de Vence',
              conversation_id: conversationId,
              feedback_id: feedbackId,
            },
          })
          bellSent = true
        }

        // 2.3 UPDATE conversation → 'closed' si hay finalStatus, 'waiting_user' si no.
        // Usar 'closed' (no 'resolved') porque useAdminNotifications cuenta
        // conversaciones con status != 'closed' como pendientes para el badge.
        // Bug 22/04/2026: 31 conversaciones huérfanas con status='resolved'
        // generaban badge "3 por responder" falso en el panel admin.
        await tx
          .update(feedbackConversations)
          .set({
            status: finalStatus ? 'closed' : 'waiting_user',
            adminUserId,
            adminViewedAt: now,
            lastMessageAt: now,
            ...(finalStatus ? { closedAt: now } : {}),
          })
          .where(eq(feedbackConversations.id, conversationId))
      } else if (conversationId && finalStatus) {
        // Cierre sin mensaje: UPDATE status + closedAt
        await tx
          .update(feedbackConversations)
          .set({
            status: finalStatus,
            adminUserId,
            closedAt: now,
          })
          .where(eq(feedbackConversations.id, conversationId))
      }

      // 2.3b Al cerrar (con o sin mensaje): marcar como leídos los mensajes
      // del usuario que queden pendientes. Arregla bug badge "1 por responder"
      // residual cuando el usuario había enviado un "muchas gracias" final
      // antes de que el admin cerrara.
      if (finalStatus && conversationId) {
        await tx
          .update(feedbackMessages)
          .set({ readAt: now })
          .where(
            and(
              eq(feedbackMessages.conversationId, conversationId),
              eq(feedbackMessages.isAdmin, false),
              isNull(feedbackMessages.readAt),
            ),
          )
      }

      // 2.4 UPDATE user_feedback (si hay finalStatus)
      if (finalStatus) {
        await tx
          .update(userFeedback)
          .set({
            status: finalStatus,
            adminUserId,
            adminResponse: hasMessage ? trimmedMessage : undefined,
            resolvedAt: now,
          })
          .where(eq(userFeedback.id, feedbackId))
      }
    })

    // 3. Envío de email (fuera de la transacción — no queremos rollback si falla Resend)
    let emailSent = false
    let emailId: string | null = null
    let emailError: string | null = null
    let emailSkipReason: EmailSkipReason = null

    if (!hasMessage) {
      emailSkipReason = 'empty_message'
    } else if (!sendEmailFlag) {
      emailSkipReason = 'send_email_false_flag'
    } else if (!toEmail) {
      emailSkipReason = 'no_user_email'
    } else if (targetUserId && (await isUserActivelyBrowsing(targetUserId))) {
      // Usuario registrado con sesión activa → skip email (ya verá la campana)
      emailSkipReason = 'user_actively_browsing'
    } else if (targetUserId) {
      // Registrado → sendEmailV2 (template soporte_respuesta)
      try {
        const chatUrl = `https://www.vence.es/soporte?conversation_id=${conversationId}`
        const result = await sendEmailV2({
          userId: targetUserId,
          emailType: 'soporte_respuesta',
          customData: { adminMessage: trimmedMessage, chatUrl },
        })
        if (result.success) {
          emailSent = true
          emailId = result.emailId ?? null
        } else if ('cancelled' in result && result.cancelled) {
          emailSkipReason = 'user_preferences'
        } else {
          emailError =
            ('error' in result && result.error) || 'Error desconocido enviando email'
        }
      } catch (e) {
        emailError = e instanceof Error ? e.message : 'Excepcion desconocida enviando email'
      }
    } else {
      // Contacto externo (sin user_id): delegamos en /api/send-support-email que
      // tiene sendDirectEmail (Resend directo con template hardcoded). Mantenemos
      // ese path por ahora para no duplicar lógica de email directo aquí.
      // Desde el caller: si quieres enviar email a externo, llama también a ese endpoint.
      emailSkipReason = 'no_user_email' // placeholder — externo requiere path distinto
    }

    return {
      success: true,
      feedbackId,
      conversationId: conversationId ?? '',
      messageId,
      bellSent,
      bellSkipReason,
      emailSent,
      emailId,
      emailError,
      emailSkipReason,
      finalStatus: finalStatus ?? null,
    }
  } catch (error) {
    console.error('Error en respondFeedback:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    }
  }
}
