// utils/testAnalytics.ts - Completar test + util de formato.
// ============================================================================
// MIGRADO (04/07): cero Supabase. `completeDetailedTest` delega en el endpoint
// server-side POST /api/v2/complete-test (RDS/Drizzle, agnóstico de proveedor).
// Borradas `updateUserProgressDirect` y `registerQuestionsInHistory` (0 callers,
// código muerto — la completación/progreso/historial los hace el endpoint v2).
// ============================================================================
import { getDeviceInfo } from './testSession'
import { completeTestOnServer } from '@/lib/api/v2/complete-test/client'
import type { CompleteTestRequest } from '@/lib/api/v2/complete-test/schemas'

// ============================================
// TIPOS (firma pública que consume ExamLayout)
// ============================================

interface AnswerQuestionData {
  id?: string
  question?: string
  options?: unknown
  question_type?: string
  explanation?: string
  tema?: unknown
  metadata?: {
    difficulty?: string
    question_type?: string
    tags?: string[]
    [key: string]: unknown
  }
  article?: {
    id?: string
    number?: string | number
    law_short_name?: string
    law_id?: string
    [key: string]: unknown
  }
  [key: string]: unknown
}

interface DetailedAnswer {
  isCorrect: boolean
  timeSpent?: number
  confidence?: string
  interactions?: number
  questionIndex?: number
  selectedAnswer?: number | null
  questionData?: AnswerQuestionData
  [key: string]: unknown
}

interface Question {
  length?: number
  [key: string]: unknown
}

interface UserSession {
  user_id?: string
  id?: string
}

interface InteractionEvent {
  [key: string]: unknown
}

interface CompleteTestResult {
  success: boolean
  status: string
}

// ============================================
// COMPLETAR TEST (delega en RDS)
// ============================================

export const completeDetailedTest = async (
  sessionId: string,
  finalScore: number,
  allAnswers: DetailedAnswer[],
  questions: Question[],
  startTime: number,
  interactionEvents: InteractionEvent[],
  userSession?: UserSession | null,
): Promise<CompleteTestResult> => {
  try {
    console.log('🏁 Completando test (server-side, RDS)...', sessionId)

    if (!sessionId) {
      console.error('❌ No se puede completar: sessionId faltante')
      return { success: false, status: 'error' }
    }
    if (!allAnswers || allAnswers.length === 0) {
      console.error('❌ No se puede completar: sin respuestas')
      return { success: false, status: 'error' }
    }

    const deviceInfoRaw = getDeviceInfo() as {
      user_agent?: string
      screen_resolution?: string
      device_model?: string
      browser_language?: string
      timezone?: string
    }

    // Mapear respuestas al shape del endpoint (mismo mapeo que TestLayout).
    const detailedAnswers = allAnswers.map((a) => {
      const qd = a.questionData
      const difficultyRaw = qd?.metadata?.difficulty
      const safeDifficulty = (['easy', 'medium', 'hard', 'extreme'].includes(difficultyRaw as string)
        ? difficultyRaw
        : null) as 'easy' | 'medium' | 'hard' | 'extreme' | null
      const tagsRaw = qd?.metadata?.tags
      const safeTags = Array.isArray(tagsRaw) ? (tagsRaw as string[]) : null
      const questionTema = qd?.tema
      return {
        questionIndex: a.questionIndex ?? 0,
        selectedAnswer: a.selectedAnswer ?? -1,
        isCorrect: !!a.isCorrect,
        timeSpent: a.timeSpent ?? 0,
        confidence: (['very_sure', 'sure', 'unsure', 'guessing', 'unknown'].includes(a.confidence as string)
          ? a.confidence
          : 'unknown') as 'very_sure' | 'sure' | 'unsure' | 'guessing' | 'unknown',
        interactions: a.interactions ?? 1,
        questionData: qd
          ? {
              id: qd.id ?? null,
              metadata: { difficulty: safeDifficulty, tags: safeTags },
              article: qd.article
                ? {
                    id: qd.article.id ?? null,
                    number: qd.article.number != null ? String(qd.article.number) : null,
                    law_short_name: qd.article.law_short_name ?? null,
                    law_id: qd.article.law_id ?? null,
                  }
                : null,
              question: qd.question ?? null,
              options: Array.isArray(qd.options) ? (qd.options as string[]) : null,
              questionType: (qd.question_type === 'psychometric' ? 'psychometric' : 'legislative') as
                | 'legislative'
                | 'psychometric',
              tema: typeof questionTema === 'number' && questionTema >= 0 ? questionTema : null,
              explanation: qd.explanation ?? null,
            }
          : null,
      }
    })

    const request = {
      sessionId,
      finalScore,
      totalQuestions: questions.length || allAnswers.length,
      detailedAnswers,
      startTime,
      interactionEvents: (interactionEvents || []).slice(-500),
      userSessionId: userSession?.id ?? null,
      deviceInfo: {
        userAgent: deviceInfoRaw.user_agent,
        screenResolution: deviceInfoRaw.screen_resolution,
        browserLanguage: deviceInfoRaw.browser_language,
        timezone: deviceInfoRaw.timezone,
      },
    } as unknown as CompleteTestRequest

    const result = await completeTestOnServer(request)
    return { success: result.success, status: result.success ? 'completed' : 'error' }
  } catch (error) {
    console.error('❌ Error en completeDetailedTest:', error)
    return { success: false, status: 'error' }
  }
}

// ============================================
// UTILIDADES
// ============================================

export const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  if (mins === 0) return `${secs} segundo${secs !== 1 ? 's' : ''}`
  if (secs === 0) return `${mins} minuto${mins !== 1 ? 's' : ''}`
  return `${mins}m ${secs}s`
}
