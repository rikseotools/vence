// lib/api/v2/dispute/queries.ts
// Queries Drizzle unificadas para impugnaciones (legislativas y psicotécnicas)

// CANARY pooler (sweep masivo oleada 5 — todos user-facing 2026-05-10):
import { getDb, getPoolerDb } from '@/db/client'

function getV2DisputeDb() {
  return process.env.USE_SELF_HOSTED_POOLER === 'true' ? getPoolerDb() : getDb()
}
import {
  questionDisputes,
  psychometricQuestionDisputes,
  questions,
  psychometricQuestions,
  userProfiles,
  notificationLogs,
} from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import type {
  QuestionType,
  CreateDisputeRequest,
  CreateDisputeResponse,
  GetDisputeResponse,
  ExistingDispute,
  DisputeError,
  ResolveDisputeRequest,
  ResolveDisputeResponse,
} from './schemas'
import { sendEmailV2 } from '@/lib/api/emails'

/**
 * Obtiene una impugnación existente del usuario para una pregunta.
 */
export async function getExistingDispute(
  questionId: string,
  userId: string,
  questionType: QuestionType
): Promise<GetDisputeResponse | DisputeError> {
  try {
    const db = getV2DisputeDb()

    if (questionType === 'psychometric') {
      const [existing] = await db
        .select({
          id: psychometricQuestionDisputes.id,
          status: psychometricQuestionDisputes.status,
          disputeType: psychometricQuestionDisputes.disputeType,
          description: psychometricQuestionDisputes.description,
          adminResponse: psychometricQuestionDisputes.adminResponse,
          createdAt: psychometricQuestionDisputes.createdAt,
          resolvedAt: psychometricQuestionDisputes.resolvedAt,
        })
        .from(psychometricQuestionDisputes)
        .where(
          and(
            eq(psychometricQuestionDisputes.questionId, questionId),
            eq(psychometricQuestionDisputes.userId, userId)
          )
        )
        .limit(1)

      return {
        success: true,
        dispute: existing ? {
          id: existing.id,
          status: existing.status,
          disputeType: existing.disputeType,
          description: existing.description,
          adminResponse: existing.adminResponse,
          createdAt: existing.createdAt,
          resolvedAt: existing.resolvedAt,
        } : null,
      }
    } else {
      const [existing] = await db
        .select({
          id: questionDisputes.id,
          status: questionDisputes.status,
          disputeType: questionDisputes.disputeType,
          description: questionDisputes.description,
          adminResponse: questionDisputes.adminResponse,
          createdAt: questionDisputes.createdAt,
          resolvedAt: questionDisputes.resolvedAt,
        })
        .from(questionDisputes)
        .where(
          and(
            eq(questionDisputes.questionId, questionId),
            eq(questionDisputes.userId, userId)
          )
        )
        .limit(1)

      return {
        success: true,
        dispute: existing ? {
          id: existing.id,
          status: existing.status,
          disputeType: existing.disputeType,
          description: existing.description,
          adminResponse: existing.adminResponse,
          createdAt: existing.createdAt,
          resolvedAt: existing.resolvedAt,
        } : null,
      }
    }
  } catch (error) {
    console.error('Error obteniendo impugnacion existente:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
  }
}

/**
 * Crea una nueva impugnación. Verifica que la pregunta existe y no hay duplicado.
 */
export async function createDispute(
  params: CreateDisputeRequest,
  userId: string
): Promise<CreateDisputeResponse | DisputeError> {
  try {
    const db = getV2DisputeDb()
    const { questionId, questionType, disputeType, description } = params

    // 1. Verificar que la pregunta existe
    if (questionType === 'psychometric') {
      const [question] = await db
        .select({ id: psychometricQuestions.id })
        .from(psychometricQuestions)
        .where(eq(psychometricQuestions.id, questionId))
        .limit(1)

      if (!question) {
        return { success: false, error: 'Pregunta psicotecnica no encontrada' }
      }
    } else {
      const [question] = await db
        .select({ id: questions.id })
        .from(questions)
        .where(eq(questions.id, questionId))
        .limit(1)

      if (!question) {
        return { success: false, error: 'Pregunta no encontrada' }
      }
    }

    // 2. Verificar duplicado
    const existingResult = await getExistingDispute(questionId, userId, questionType)
    if ('dispute' in existingResult && existingResult.dispute) {
      return { success: false, error: 'Ya has impugnado esta pregunta anteriormente' }
    }

    // 3. Insertar
    if (questionType === 'psychometric') {
      const [result] = await db
        .insert(psychometricQuestionDisputes)
        .values({
          questionId,
          userId,
          disputeType,
          description,
          status: 'pending',
          source: 'user',
        })
        .returning({ id: psychometricQuestionDisputes.id })

      if (!result?.id) {
        return { success: false, error: 'Error creando impugnacion' }
      }

      console.log(`\u2705 [Dispute] Psicotecnica creada: ${result.id}`)
      return { success: true, disputeId: result.id }
    } else {
      const [result] = await db
        .insert(questionDisputes)
        .values({
          questionId,
          userId,
          disputeType,
          description,
          status: 'pending',
          source: 'user',
        })
        .returning({ id: questionDisputes.id })

      if (!result?.id) {
        return { success: false, error: 'Error creando impugnacion' }
      }

      console.log(`\u2705 [Dispute] Legislativa creada: ${result.id}`)
      return { success: true, disputeId: result.id }
    }
  } catch (error) {
    console.error('Error creando impugnacion:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
  }
}

/**
 * Resuelve (o rechaza) una impugnación y notifica al usuario por email en el mismo flujo.
 *
 * Sustituye al patrón antiguo basado en trigger PG → http_post (frágil ante cold starts
 * de Vercel; ver docs/maintenance/impugnaciones-claude-code.md para historial del bug).
 *
 * Garantías:
 *  - El UPDATE de la disputa es la única operación crítica. Si tiene éxito, la función
 *    devuelve `success: true` aunque el envío de email falle posteriormente.
 *  - Idempotente respecto al estado: si la disputa ya está en `resolved`/`rejected`,
 *    devuelve error sin tocar nada (no re-envía email).
 *  - El email solo se envía si `adminResponse` no está vacío (cierre con mensaje real).
 *  - Si `sendEmailV2` falla, se registra en la respuesta para que el caller pueda
 *    mostrarlo en `/admin/dispute-emails-fallidos` y reintentar.
 */
export async function resolveDispute(
  params: ResolveDisputeRequest
): Promise<ResolveDisputeResponse | DisputeError> {
  try {
    const db = getV2DisputeDb()
    const { disputeId, questionType, status, adminResponse } = params
    const trimmedResponse = adminResponse.trim()
    const now = new Date().toISOString()

    // 1. Cargar disputa + datos del usuario y pregunta en una sola pasada por tabla
    let userId: string | null = null
    let questionId: string | null = null
    let userEmail: string | null = null
    let userName: string | null = null
    let questionText: string | null = null
    let currentStatus: string | null = null

    if (questionType === 'psychometric') {
      const [row] = await db
        .select({
          dId: psychometricQuestionDisputes.id,
          dStatus: psychometricQuestionDisputes.status,
          dUserId: psychometricQuestionDisputes.userId,
          dQuestionId: psychometricQuestionDisputes.questionId,
          uEmail: userProfiles.email,
          uName: userProfiles.fullName,
          qText: psychometricQuestions.questionText,
        })
        .from(psychometricQuestionDisputes)
        .leftJoin(userProfiles, eq(userProfiles.id, psychometricQuestionDisputes.userId))
        .leftJoin(
          psychometricQuestions,
          eq(psychometricQuestions.id, psychometricQuestionDisputes.questionId)
        )
        .where(eq(psychometricQuestionDisputes.id, disputeId))
        .limit(1)

      if (!row) {
        return { success: false, error: 'Impugnacion psicotecnica no encontrada' }
      }
      currentStatus = row.dStatus ?? null
      userId = row.dUserId ?? null
      questionId = row.dQuestionId ?? null
      userEmail = row.uEmail ?? null
      userName = row.uName ?? null
      questionText = row.qText ?? null
    } else {
      const [row] = await db
        .select({
          dId: questionDisputes.id,
          dStatus: questionDisputes.status,
          dUserId: questionDisputes.userId,
          dQuestionId: questionDisputes.questionId,
          uEmail: userProfiles.email,
          uName: userProfiles.fullName,
          qText: questions.questionText,
        })
        .from(questionDisputes)
        .leftJoin(userProfiles, eq(userProfiles.id, questionDisputes.userId))
        .leftJoin(questions, eq(questions.id, questionDisputes.questionId))
        .where(eq(questionDisputes.id, disputeId))
        .limit(1)

      if (!row) {
        return { success: false, error: 'Impugnacion no encontrada' }
      }
      currentStatus = row.dStatus ?? null
      userId = row.dUserId ?? null
      questionId = row.dQuestionId ?? null
      userEmail = row.uEmail ?? null
      userName = row.uName ?? null
      questionText = row.qText ?? null
    }

    // 2. Idempotencia: no re-resolver
    if (currentStatus === 'resolved' || currentStatus === 'rejected') {
      return {
        success: false,
        error: `La impugnacion ya estaba ${currentStatus} y no se puede re-resolver`,
      }
    }

    if (!userId) {
      return { success: false, error: 'La impugnacion no tiene usuario asociado' }
    }

    // 3. UPDATE atomico de la disputa
    if (questionType === 'psychometric') {
      const result = await db
        .update(psychometricQuestionDisputes)
        .set({
          status,
          adminResponse: trimmedResponse || null,
          resolvedAt: now,
          updatedAt: now,
        })
        .where(eq(psychometricQuestionDisputes.id, disputeId))
        .returning({ id: psychometricQuestionDisputes.id })
      if (!result[0]?.id) {
        return { success: false, error: 'Error actualizando impugnacion psicotecnica' }
      }
    } else {
      const result = await db
        .update(questionDisputes)
        .set({
          status,
          adminResponse: trimmedResponse || null,
          resolvedAt: now,
          updatedAt: now,
        })
        .where(eq(questionDisputes.id, disputeId))
        .returning({ id: questionDisputes.id })
      if (!result[0]?.id) {
        return { success: false, error: 'Error actualizando impugnacion legislativa' }
      }
    }

    console.log(`\u2705 [Dispute] ${questionType} ${disputeId} → ${status}`)

    // 3.4 Invalidar cache server-side de validation queries (tag 'questions').
    // Usa la API interna /api/admin/revalidate en vez de revalidateTag directo
    // para que funcione tanto desde Next.js como desde npx tsx (CLI).
    try {
      const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.vence.es'
      await fetch(`${baseUrl}/api/admin/revalidate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-cron-secret': process.env.CRON_SECRET || '',
        },
        body: JSON.stringify({ tag: 'questions' }),
      })
    } catch (revalidateError) {
      console.warn(`[Dispute] Cache revalidation failed (non-critical):`, revalidateError)
    }

    // 3.5 INSERT campana en notification_logs
    let bellSent = false
    if (trimmedResponse) {
      try {
        const preview =
          trimmedResponse.length > 100
            ? trimmedResponse.slice(0, 100) + '...'
            : trimmedResponse
        await db.insert(notificationLogs).values({
          userId: userId!,
          messageSent: `El equipo de Vence: "${preview}"`,
          deliveryStatus: 'sent',
          contextData: {
            type: 'dispute_response',
            title: 'Respuesta a tu impugnación',
            dispute_id: disputeId,
          },
        })
        bellSent = true
      } catch (bellError) {
        console.error(`[Dispute] Error insertando campana para ${disputeId}:`, bellError)
      }
    }

    // 4. Enviar email solo si hay respuesta real
    if (!trimmedResponse) {
      return {
        success: true,
        disputeId,
        status,
        bellSent,
        emailSent: false,
        emailId: null,
        emailError: null,
        emailSkipReason: 'empty_response',
      }
    }

    if (!userEmail) {
      console.warn(`[Dispute] Sin email de usuario para ${disputeId} (userId=${userId})`)
      return {
        success: true,
        disputeId,
        status,
        bellSent,
        emailSent: false,
        emailId: null,
        emailError: null,
        emailSkipReason: 'no_user_email',
      }
    }

    // 5. Enviar via sendEmailV2 (sin saltar a HTTP — corre en el mismo proceso)
    const disputeUrl = `https://www.vence.es/soporte?tab=impugnaciones&dispute_id=${disputeId}`

    try {
      const emailResult = await sendEmailV2({
        userId,
        emailType: 'impugnacion_respuesta',
        customData: {
          to: userEmail,
          userName: userName || 'Usuario',
          status,
          adminResponse: trimmedResponse,
          questionText: questionText || '',
          disputeUrl,
        },
      })

      if (emailResult.success) {
        return {
          success: true,
          disputeId,
          status,
          bellSent,
          emailSent: true,
          emailId: emailResult.emailId ?? null,
          emailError: null,
          emailSkipReason: null,
        }
      }

      if ('cancelled' in emailResult && emailResult.cancelled) {
        return {
          success: true,
          disputeId,
          status,
          bellSent,
          emailSent: false,
          emailId: null,
          emailError: null,
          emailSkipReason: 'user_preferences',
        }
      }

      return {
        success: true,
        disputeId,
        status,
        bellSent,
        emailSent: false,
        emailId: null,
        emailError: ('error' in emailResult && emailResult.error) || 'Error desconocido enviando email',
        emailSkipReason: null,
      }
    } catch (emailError) {
      console.error(`[Dispute] Excepcion enviando email para ${disputeId}:`, emailError)
      return {
        success: true,
        disputeId,
        status,
        bellSent,
        emailSent: false,
        emailId: null,
        emailError: emailError instanceof Error ? emailError.message : 'Excepcion desconocida enviando email',
        emailSkipReason: null,
      }
    }
  } catch (error) {
    console.error('Error en resolveDispute:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
  }
}
