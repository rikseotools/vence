// lib/api/psychometric-session/queries.ts
// Queries Drizzle server-side para sesiones psicotécnicas (pending/resume/discard)

import { getDb } from '@/db/client'
import {
  psychometricTestSessions,
  psychometricTestAnswers,
  psychometricQuestions,
  psychometricCategories,
} from '@/db/schema'
import { eq, and, gt, isNull, inArray, sql } from 'drizzle-orm'
import type {
  GetPendingPsychometricSessionsResponse,
  ResumePsychometricSessionResponse,
  DiscardPsychometricSessionResponse,
  PsychometricSessionError,
  CreatePsychometricSessionRequest,
  CompletePsychometricSessionRequest,
} from './schemas'

/**
 * Obtiene sesiones psicotécnicas incompletas con progreso real.
 * Solo últimos 7 días, con al menos 1 pregunta respondida.
 */
export async function getPendingPsychometricSessions(
  userId: string,
  limit: number = 10
): Promise<GetPendingPsychometricSessionsResponse | PsychometricSessionError> {
  try {
    const db = getDb()
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

    const sessions = await db
      .select({
        id: psychometricTestSessions.id,
        categoryId: psychometricTestSessions.categoryId,
        categoryName: psychometricCategories.displayName,
        totalQuestions: psychometricTestSessions.totalQuestions,
        questionsAnswered: psychometricTestSessions.questionsAnswered,
        correctAnswers: psychometricTestSessions.correctAnswers,
        accuracyPercentage: psychometricTestSessions.accuracyPercentage,
        startedAt: psychometricTestSessions.startedAt,
      })
      .from(psychometricTestSessions)
      .leftJoin(psychometricCategories, eq(psychometricTestSessions.categoryId, psychometricCategories.id))
      .where(and(
        eq(psychometricTestSessions.userId, userId),
        eq(psychometricTestSessions.isCompleted, false),
        isNull(psychometricTestSessions.completedAt),
        gt(psychometricTestSessions.questionsAnswered, 0),
        gt(psychometricTestSessions.createdAt, sevenDaysAgo),
      ))
      .orderBy(sql`${psychometricTestSessions.createdAt} DESC`)
      .limit(limit)

    return {
      success: true,
      sessions: sessions.map(s => ({
        id: s.id,
        categoryName: s.categoryName ?? null,
        totalQuestions: s.totalQuestions,
        questionsAnswered: s.questionsAnswered ?? 0,
        correctAnswers: s.correctAnswers ?? 0,
        accuracyPercentage: Number(s.accuracyPercentage ?? 0),
        startedAt: s.startedAt ?? null,
      })),
    }
  } catch (error) {
    console.error('Error obteniendo sesiones psicotécnicas pendientes:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    }
  }
}

/**
 * Carga datos de una sesión psicotécnica para reanudarla.
 * Devuelve preguntas SIN correctOption (seguridad anti-scraping).
 */
export async function getResumedPsychometricSessionData(
  sessionId: string,
  userId?: string
): Promise<ResumePsychometricSessionResponse | PsychometricSessionError> {
  try {
    const db = getDb()

    // 1. Verify session exists and get metadata
    const [session] = await db
      .select({
        id: psychometricTestSessions.id,
        userId: psychometricTestSessions.userId,
        totalQuestions: psychometricTestSessions.totalQuestions,
        questionsAnswered: psychometricTestSessions.questionsAnswered,
        correctAnswers: psychometricTestSessions.correctAnswers,
        isCompleted: psychometricTestSessions.isCompleted,
        questionsData: psychometricTestSessions.questionsData,
      })
      .from(psychometricTestSessions)
      .where(eq(psychometricTestSessions.id, sessionId))
      .limit(1)

    if (!session) {
      return { success: false, error: 'Sesión no encontrada' }
    }

    // Verify ownership if userId provided
    if (userId && session.userId !== userId) {
      return { success: false, error: 'No tienes permiso para acceder a esta sesión' }
    }

    if (session.isCompleted) {
      return { success: false, error: 'Esta sesión ya está completada' }
    }

    // 2. Get question IDs from session metadata
    const questionsData = session.questionsData as { question_ids?: string[] } | null
    const questionIds = questionsData?.question_ids

    if (!questionIds || questionIds.length === 0) {
      return { success: false, error: 'No se encontraron preguntas en la sesión' }
    }

    // 3. Fetch questions WITHOUT correctOption (security)
    const questions = await db
      .select({
        id: psychometricQuestions.id,
        categoryId: psychometricQuestions.categoryId,
        sectionId: psychometricQuestions.sectionId,
        questionSubtype: psychometricQuestions.questionSubtype,
        questionText: psychometricQuestions.questionText,
        optionA: psychometricQuestions.optionA,
        optionB: psychometricQuestions.optionB,
        optionC: psychometricQuestions.optionC,
        optionD: psychometricQuestions.optionD,
        // correctOption: OMITIDO - seguridad anti-scraping
        contentData: psychometricQuestions.contentData,
        difficulty: psychometricQuestions.difficulty,
        timeLimitSeconds: psychometricQuestions.timeLimitSeconds,
        cognitiveSkills: psychometricQuestions.cognitiveSkills,
        isOfficialExam: psychometricQuestions.isOfficialExam,
        examSource: psychometricQuestions.examSource,
      })
      .from(psychometricQuestions)
      .where(inArray(psychometricQuestions.id, questionIds))

    // 4. Preserve original order from session
    const questionMap = new Map(questions.map(q => [q.id, q]))
    const orderedQuestions = questionIds
      .map(id => questionMap.get(id))
      .filter((q): q is NonNullable<typeof q> => q !== undefined)

    // 5. Get answered question IDs
    const answers = await db
      .select({
        questionId: psychometricTestAnswers.questionId,
      })
      .from(psychometricTestAnswers)
      .where(eq(psychometricTestAnswers.testSessionId, sessionId))

    const answeredQuestionIds = answers.map(a => a.questionId)

    return {
      success: true,
      sessionId: session.id,
      totalQuestions: session.totalQuestions,
      questionsAnswered: session.questionsAnswered ?? 0,
      correctAnswers: session.correctAnswers ?? 0,
      questions: orderedQuestions,
      answeredQuestionIds,
    }
  } catch (error) {
    console.error('Error cargando sesión psicotécnica para resume:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    }
  }
}

/**
 * Descarta una sesión psicotécnica (marca completed_at sin is_completed).
 */
export async function discardPsychometricSession(
  sessionId: string,
  userId: string
): Promise<DiscardPsychometricSessionResponse | PsychometricSessionError> {
  try {
    const db = getDb()

    // Verify ownership + not already completed
    const [session] = await db
      .select({
        id: psychometricTestSessions.id,
        userId: psychometricTestSessions.userId,
        isCompleted: psychometricTestSessions.isCompleted,
      })
      .from(psychometricTestSessions)
      .where(eq(psychometricTestSessions.id, sessionId))
      .limit(1)

    if (!session) {
      return { success: false, error: 'Sesión no encontrada' }
    }

    if (session.userId !== userId) {
      return { success: false, error: 'No tienes permiso para descartar esta sesión' }
    }

    if (session.isCompleted) {
      return { success: false, error: 'Esta sesión ya está completada' }
    }

    // Mark as discarded: set completed_at but keep is_completed = false
    await db
      .update(psychometricTestSessions)
      .set({ completedAt: new Date().toISOString() })
      .where(eq(psychometricTestSessions.id, sessionId))

    return {
      success: true,
      message: 'Sesión descartada correctamente',
    }
  } catch (error) {
    console.error('Error descartando sesión psicotécnica:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    }
  }
}

/**
 * Crea una nueva sesión psicotécnica (server-side, bypasses RLS).
 */
export async function createPsychometricSession(
  params: CreatePsychometricSessionRequest
): Promise<{ success: true; sessionId: string } | PsychometricSessionError> {
  try {
    const db = getDb()
    const [result] = await db
      .insert(psychometricTestSessions)
      .values({
        userId: params.userId,
        categoryId: params.categoryId || null,
        sessionType: 'psychometric',
        totalQuestions: params.totalQuestions,
        questionsData: { question_ids: params.questionIds },
        startedAt: new Date().toISOString(),
      })
      .returning({ id: psychometricTestSessions.id })

    if (!result?.id) {
      return { success: false, error: 'No se pudo crear la sesión' }
    }

    console.log(`✅ [PsychoSession] Created: ${result.id}`)
    return { success: true, sessionId: result.id }
  } catch (error) {
    console.error('Error creando sesión psicotécnica:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    }
  }
}

/**
 * Marca una sesión psicotécnica como completada (server-side, bypasses RLS).
 */
export async function completePsychometricSession(
  params: CompletePsychometricSessionRequest
): Promise<{ success: true; message: string } | PsychometricSessionError> {
  try {
    const db = getDb()

    // Verificar propiedad
    const [session] = await db
      .select({ id: psychometricTestSessions.id, userId: psychometricTestSessions.userId })
      .from(psychometricTestSessions)
      .where(eq(psychometricTestSessions.id, params.sessionId))
      .limit(1)

    if (!session) {
      return { success: false, error: 'Sesión no encontrada' }
    }

    if (session.userId !== params.userId) {
      return { success: false, error: 'No autorizado' }
    }

    const accuracy = Math.round((params.correctAnswers / params.totalQuestions) * 100)

    await db
      .update(psychometricTestSessions)
      .set({
        isCompleted: true,
        correctAnswers: params.correctAnswers,
        questionsAnswered: params.totalQuestions,
        accuracyPercentage: String(accuracy),
        completedAt: new Date().toISOString(),
      })
      .where(eq(psychometricTestSessions.id, params.sessionId))

    console.log(`✅ [PsychoSession] Completed: ${params.sessionId} (${accuracy}%)`)
    return { success: true, message: 'Sesión completada' }
  } catch (error) {
    console.error('Error completando sesión psicotécnica:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    }
  }
}
