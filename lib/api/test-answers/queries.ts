// lib/api/test-answers/queries.ts - Insert de respuestas via Drizzle
// CANARY pooler (sweep masivo oleada 5 — todos user-facing 2026-05-10):
import { getDb, getPoolerDb } from '@/db/client'

function getTestAnswersDb() {
  return process.env.USE_SELF_HOSTED_POOLER === 'true' ? getPoolerDb() : getDb()
}
import { testQuestions, userProfiles } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { resolveTemaNumber } from '@/lib/api/tema-resolver/queries'
import { ALL_OPOSICION_IDS } from '@/lib/config/oposiciones'
import type { SaveAnswerRequest, SaveAnswerResponse, DeviceInfo } from './schemas'
import { normalizeDifficulty } from '@/lib/api/shared/difficulty'

// ============================================
// HELPERS PRIVADOS
// ============================================

/**
 * Mapea selectedAnswer numerico a letra A-D. Casos:
 * - 0..3 → 'A'..'D' (respuesta normal)
 * - -1 con wasBlank=true → 'BLANK' (usuario dejó la pregunta en blanco)
 * - -1 sin wasBlank → devuelve una letra incorrecta (legacy: safety-net
 *   para batches que llegan sin respuesta por pérdida de conexión)
 */
function mapAnswerToLetter(selected: number, correct: number, wasBlank = false): string {
  if (selected >= 0 && selected <= 3) {
    return String.fromCharCode(65 + selected)
  }
  if (wasBlank) return 'BLANK'
  // -1 = no respondio -> devolver una opcion incorrecta
  return String.fromCharCode(65 + ((correct + 1) % 4))
}

/** Hash simple del contenido de la pregunta para IDs generados */
function generateContentHash(questionText: string, options: string[]): string {
  const fullText = questionText + (options || []).join('')
  let hash = 0
  for (let i = 0; i < fullText.length; i++) {
    hash = ((hash << 5) - hash + fullText.charCodeAt(i)) & 0xffffffff
  }
  return Math.abs(hash).toString(36)
}

/** Construye el campo JSONB full_question_context */
function buildQuestionContext(
  req: SaveAnswerRequest,
  questionId: string,
  articleId: string | null,
): Record<string, unknown> {
  return {
    options: req.questionData.options || [],
    explanation: req.questionData.explanation || '',
    article_full: req.questionData.article || {},
    difficulty_meta: req.questionData.metadata || {},
    generated_ids: {
      question_id: questionId,
      article_id: articleId,
      generation_method: req.questionData.metadata?.id ? 'metadata' : 'generated',
    },
  }
}

/** Construye el campo JSONB user_behavior_data */
function buildBehaviorData(req: SaveAnswerRequest): Record<string, unknown> {
  return {
    interaction_events: (req.interactionEvents || []).slice(-10),
    mouse_activity: (req.mouseEvents || []).length,
    scroll_activity: (req.scrollEvents || []).length,
    confidence_evolution: req.confidenceLevel || 'unknown',
    answer_changes: Math.max(0, (req.interactionCount || 1) - 1),
  }
}

/** Construye el campo JSONB learning_analytics */
function buildLearningAnalytics(req: SaveAnswerRequest): Record<string, unknown> {
  const timeSpent = req.answerData.timeSpent || 0
  const hesitationTime = req.firstInteractionTime
    ? Math.max(0, req.firstInteractionTime - req.questionStartTime)
    : 0

  return {
    response_pattern: req.answerData.isCorrect ? 'correct' : 'incorrect',
    time_efficiency:
      timeSpent <= 30 ? 'fast' : timeSpent <= 60 ? 'normal' : 'slow',
    confidence_accuracy_match:
      (req.confidenceLevel === 'very_sure' || req.confidenceLevel === 'sure') ===
      req.answerData.isCorrect,
    hesitation_pattern:
      hesitationTime > 10 ? 'high' : hesitationTime > 5 ? 'medium' : 'low',
    interaction_pattern:
      (req.interactionCount || 1) > 2
        ? 'hesitant'
        : (req.interactionCount || 1) === 1
          ? 'decisive'
          : 'normal',
  }
}

/**
 * Resuelve el tema number: si el cliente lo pasa > 0 lo usa; si es 0 intenta
 * resolverlo via resolveTemaNumber. Extraído para poder cachear por userId
 * en inserciones batch.
 */
async function computeTema(
  req: SaveAnswerRequest,
  userId: string,
  resolvedOposicionCache?: { current: string | null },
): Promise<number> {
  let calculatedTema = parseInt(String(req.questionData.tema || req.tema)) || 0

  if (calculatedTema === 0 && req.questionData.id) {
    try {
      let oposicionId = req.oposicionId || ''

      if (!oposicionId || !ALL_OPOSICION_IDS.includes(oposicionId)) {
        // Usar caché si se pasó (batch) para evitar N queries al userProfiles
        if (resolvedOposicionCache && resolvedOposicionCache.current) {
          oposicionId = resolvedOposicionCache.current
        } else {
          const db = getTestAnswersDb()
          const result = await db
            .select({ targetOposicion: userProfiles.targetOposicion })
            .from(userProfiles)
            .where(eq(userProfiles.id, userId))
            .limit(1)
          const userOposicion = result[0]?.targetOposicion
          if (!userOposicion) {
            console.warn(`⚠️ [insertTestAnswer] Fallback a auxiliar: userId=${userId} sin target_oposicion`)
          }
          oposicionId = (userOposicion && ALL_OPOSICION_IDS.includes(userOposicion))
            ? userOposicion
            : 'auxiliar_administrativo_estado'
          if (resolvedOposicionCache) resolvedOposicionCache.current = oposicionId
        }
      }
      const resolved = await resolveTemaNumber(
        req.questionData.id,
        req.questionData.article?.id,
        req.questionData.article?.number,
        req.questionData.article?.law_id,
        req.questionData.article?.law_short_name,
        oposicionId as any,
      )
      if (resolved) {
        calculatedTema = resolved
      }
    } catch {
      // graceful degradation - keep tema as 0
    }
  }
  return calculatedTema
}

/**
 * Construye el objeto de row listo para insertar en test_questions.
 * Función pura excepto por la resolución de tema. Usada tanto por inserción
 * individual como por batch.
 */
async function buildTestAnswerRow(
  req: SaveAnswerRequest,
  userId: string,
  resolvedOposicionCache?: { current: string | null },
) {
  const isPsychometric = req.questionData.questionType === 'psychometric'
  const calculatedTema = await computeTema(req, userId, resolvedOposicionCache)

  // Determinar question_id
  const questionId =
    req.questionData.id ||
    req.questionData.metadata?.id ||
    `tema-${calculatedTema}-art-${req.questionData.article?.number || 'unknown'}-${req.questionData.article?.law_short_name || 'unknown'}-${generateContentHash(req.questionData.question, req.questionData.options)}`

  const articleId = req.questionData.article?.id || null

  const hesitationTime = req.firstInteractionTime
    ? Math.max(0, req.firstInteractionTime - req.questionStartTime)
    : 0

  const device: Partial<DeviceInfo> = req.deviceInfo || {}

  return {
    questionId,
    row: {
      testId: req.sessionId,
      userId,
      questionOrder: (req.answerData.questionIndex || 0) + 1,
      questionText: req.questionData.question || 'Pregunta sin texto',
      userAnswer: mapAnswerToLetter(
        req.answerData.selectedAnswer,
        req.answerData.correctAnswer,
        req.answerData.wasBlank === true,
      ),
      correctAnswer: String.fromCharCode(65 + (req.answerData.correctAnswer || 0)),
      isCorrect: req.answerData.isCorrect || false,
      wasBlank: req.answerData.wasBlank === true,

      // IDs segun tipo
      questionId: isPsychometric ? null : questionId,
      psychometricQuestionId: isPsychometric ? questionId : null,
      articleId: articleId,
      articleNumber: req.questionData.article?.number || 'unknown',
      lawName: req.questionData.article?.law_short_name || 'unknown',
      temaNumber: calculatedTema,
      questionType: isPsychometric ? 'psychometric' : 'legislative',

      // Tiempo y confianza
      confidenceLevel: req.confidenceLevel || 'unknown',
      timeSpentSeconds: Math.round(req.answerData.timeSpent || 0),
      timeToFirstInteraction: Math.round(hesitationTime),
      timeHesitation: Math.round(Math.max(0, (req.answerData.timeSpent || 0) - hesitationTime)),
      interactionCount: req.interactionCount || 1,

      // Metadata
      difficulty: normalizeDifficulty(req.questionData.metadata?.difficulty),
      tags: req.questionData.metadata?.tags || [],

      // Learning placeholders
      previousAttemptsThisArticle: 0,
      historicalAccuracyThisArticle: '0',

      // Device
      userAgent: device.userAgent || 'unknown',
      screenResolution: device.screenResolution || 'unknown',
      deviceType: device.deviceType || 'unknown',
      browserLanguage: device.browserLanguage || 'es',
      timezone: device.timezone || 'Europe/Madrid',

      // JSONB
      fullQuestionContext: buildQuestionContext(req, questionId, articleId),
      userBehaviorData: buildBehaviorData(req),
      learningAnalytics: buildLearningAnalytics(req),
    },
  }
}

// ============================================
// INSERT PRINCIPAL (1 row)
// ============================================

export async function insertTestAnswer(
  req: SaveAnswerRequest,
  userId: string,
): Promise<SaveAnswerResponse> {
  try {
    const { questionId, row } = await buildTestAnswerRow(req, userId)

    const db = getTestAnswersDb()
    await db.insert(testQuestions).values(row)

    return {
      success: true,
      question_id: questionId,
      action: 'saved_new',
    }
  } catch (error: any) {
    // Constraint unico = ya guardado (no es error)
    // El código 23505 puede estar en error.code (Postgres directo) o error.cause.code (wrapping de Drizzle)
    const pgCode = error?.code || error?.cause?.code
    if (pgCode === '23505') {
      return {
        success: true,
        question_id: req.questionData.id || null,
        action: 'already_saved',
      }
    }

    console.error('insertTestAnswer error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
      action: 'error',
    }
  }
}

// ============================================
// INSERT BATCH (N rows) — idempotente vía ON CONFLICT
// ============================================

export interface InsertBatchResult {
  /** Filas enviadas al INSERT (antes de ON CONFLICT). */
  attempted: number
  /** Filas que quedaron persistidas tras ON CONFLICT DO NOTHING. */
  inserted: number
  /** Filas descartadas por ON CONFLICT (ya existían). */
  skipped: number
  /** true si el batch completo falló (error de red, constraint distinta, etc). */
  errored: boolean
  /** Mensaje de error si errored=true. */
  error?: string
}

/**
 * Insert en batch idempotente contra test_questions.
 *
 * - Usa ON CONFLICT (test_id, question_order) DO NOTHING para que re-ejecutarlo
 *   con filas que ya existen sea un no-op (no falla).
 * - Resuelve tema una sola vez por oposición (caché para evitar N queries).
 * - Si el array viene vacío, devuelve 0/0/0 sin tocar la BD.
 * - Si alguna row individual no puede prepararse (error en buildTestAnswerRow),
 *   la salta sin abortar el batch.
 *
 * Este método NO reemplaza a insertTestAnswer (camino rápido online). Está
 * pensado para el safety-net de completeTest: rellenar huecos en test_questions
 * cuando la cola del cliente no pudo drenar a tiempo.
 */
export async function insertTestAnswersBatch(
  requests: SaveAnswerRequest[],
  userId: string,
): Promise<InsertBatchResult> {
  if (!requests || requests.length === 0) {
    return { attempted: 0, inserted: 0, skipped: 0, errored: false }
  }

  try {
    // Caché compartida de oposicionId para minimizar lookups a userProfiles
    const cache = { current: null as string | null }

    const rows: any[] = []
    for (const req of requests) {
      try {
        const { row } = await buildTestAnswerRow(req, userId, cache)
        rows.push(row)
      } catch (err) {
        console.warn('⚠️ [insertTestAnswersBatch] Fila descartada en build:', err)
      }
    }

    if (rows.length === 0) {
      return { attempted: 0, inserted: 0, skipped: 0, errored: false }
    }

    const db = getTestAnswersDb()
    const returned = await db
      .insert(testQuestions)
      .values(rows)
      .onConflictDoNothing({ target: [testQuestions.testId, testQuestions.questionOrder] })
      .returning({ id: testQuestions.id })

    const inserted = returned?.length ?? 0
    return {
      attempted: rows.length,
      inserted,
      skipped: rows.length - inserted,
      errored: false,
    }
  } catch (error) {
    console.error('❌ [insertTestAnswersBatch] Error en batch insert:', error)
    return {
      attempted: requests.length,
      inserted: 0,
      skipped: 0,
      errored: true,
      error: error instanceof Error ? error.message : 'Error desconocido',
    }
  }
}
