// lib/api/test-answers/queries.ts - Insert de respuestas via Drizzle
import { getDb } from '@/db/client'
import { testQuestions } from '@/db/schema'
import { resolveTemaNumber } from '@/lib/api/tema-resolver/queries'
import type { SaveAnswerRequest, SaveAnswerResponse, DeviceInfo } from './schemas'

// ============================================
// HELPERS PRIVADOS
// ============================================

/** Mapea selectedAnswer numerico a letra A-D. -1 (sin respuesta) genera una letra incorrecta */
function mapAnswerToLetter(selected: number, correct: number): string {
  if (selected >= 0 && selected <= 3) {
    return String.fromCharCode(65 + selected)
  }
  // -1 = no respondio -> devolver una opcion incorrecta
  return String.fromCharCode(65 + ((correct + 1) % 4))
}

/** Normaliza dificultad al enum valido de la BD */
function mapDifficulty(raw: string | null | undefined): string {
  const valid = ['easy', 'medium', 'hard', 'extreme']
  if (raw && valid.includes(raw)) return raw
  if (raw === 'auto') return 'medium'
  return 'medium'
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

// ============================================
// INSERT PRINCIPAL
// ============================================

export async function insertTestAnswer(
  req: SaveAnswerRequest,
  userId: string,
): Promise<SaveAnswerResponse> {
  try {
    const isPsychometric = req.questionData.questionType === 'psychometric'

    // Resolver tema server-side si es 0
    let calculatedTema = parseInt(String(req.questionData.tema || req.tema)) || 0

    if (calculatedTema === 0 && req.questionData.id) {
      try {
        const oposicionId = req.oposicionId || 'auxiliar_administrativo_estado'
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

    // Determinar question_id
    const questionId =
      req.questionData.id ||
      req.questionData.metadata?.id ||
      `tema-${calculatedTema}-art-${req.questionData.article?.number || 'unknown'}-${req.questionData.article?.law_short_name || 'unknown'}-${generateContentHash(req.questionData.question, req.questionData.options)}`

    // article_id solo si es UUID valido
    const articleId = req.questionData.article?.id || null

    // Calcular hesitation
    const hesitationTime = req.firstInteractionTime
      ? Math.max(0, req.firstInteractionTime - req.questionStartTime)
      : 0

    // Device info (del body o defaults)
    const device: Partial<DeviceInfo> = req.deviceInfo || {}

    const insertData = {
      testId: req.sessionId,
      questionOrder: (req.answerData.questionIndex || 0) + 1,
      questionText: req.questionData.question || 'Pregunta sin texto',
      userAnswer: mapAnswerToLetter(req.answerData.selectedAnswer, req.answerData.correctAnswer),
      correctAnswer: String.fromCharCode(65 + (req.answerData.correctAnswer || 0)),
      isCorrect: req.answerData.isCorrect || false,

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
      difficulty: mapDifficulty(req.questionData.metadata?.difficulty),
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
    }

    const db = getDb()
    await db.insert(testQuestions).values(insertData)

    return {
      success: true,
      question_id: questionId,
      action: 'saved_new',
    }
  } catch (error: any) {
    // Constraint unico = ya guardado (no es error)
    if (error?.code === '23505') {
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
