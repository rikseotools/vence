// lib/api/v2/complete-test/queries.ts
// Server-side: completar test con analytics (replica completeDetailedTest + updateUserProgressDirect)
import { getDb } from '@/db/client'
import { tests, testQuestions, userSessions, userProgress, topics } from '@/db/schema'
import { eq, and, sql, count } from 'drizzle-orm'
import type { CompleteTestRequest, DetailedAnswerInput } from './schemas'

interface ArticleStat {
  article_id: string
  total: number
  correct: number
  time_spent: number
  law_name: string
}

// ============================================
// MAIN: Completar test
// ============================================

export async function completeTest(
  params: CompleteTestRequest,
  userId: string,
): Promise<{ success: boolean; status: 'saved' | 'error'; savedQuestionsCount?: number }> {
  const db = getDb()

  const {
    sessionId,
    finalScore,
    detailedAnswers,
    startTime,
    interactionEvents,
    userSessionId,
  } = params

  // 1. Verificar que el test pertenece al usuario
  const [testRow] = await db
    .select({ id: tests.id, userId: tests.userId, temaNumber: tests.temaNumber })
    .from(tests)
    .where(and(eq(tests.id, sessionId), eq(tests.userId, userId)))
    .limit(1)

  if (!testRow) {
    console.error('❌ [complete-test] Test no encontrado o no pertenece al usuario:', sessionId)
    return { success: false, status: 'error' }
  }

  // 2. Verificar preguntas guardadas en test_questions
  const [savedCountResult] = await db
    .select({ count: count() })
    .from(testQuestions)
    .where(eq(testQuestions.testId, sessionId))

  const savedQuestionsCount = Number(savedCountResult?.count ?? 0)

  // 3. Calcular analytics
  const totalTime = Math.round((Date.now() - startTime) / 1000)
  const avgTimePerQuestion = detailedAnswers.length > 0
    ? Math.round(totalTime / detailedAnswers.length)
    : 0

  const correctAnswers = detailedAnswers.filter(a => a.isCorrect)
  const incorrectAnswers = detailedAnswers.filter(a => !a.isCorrect)

  const difficultyStats: Record<string, DetailedAnswerInput[]> = {
    easy: detailedAnswers.filter(a => a.questionData?.metadata?.difficulty === 'easy'),
    medium: detailedAnswers.filter(a => a.questionData?.metadata?.difficulty === 'medium'),
    hard: detailedAnswers.filter(a => a.questionData?.metadata?.difficulty === 'hard'),
    extreme: detailedAnswers.filter(a => a.questionData?.metadata?.difficulty === 'extreme'),
  }

  const articleStats: Record<string, ArticleStat> = {}
  for (const answer of detailedAnswers) {
    const articleId = answer.questionData?.article?.id
    const articleNumber = answer.questionData?.article?.number
    if (articleId && articleNumber) {
      const key = String(articleNumber)
      if (!articleStats[key]) {
        articleStats[key] = {
          article_id: articleId,
          total: 0,
          correct: 0,
          time_spent: 0,
          law_name: answer.questionData?.article?.law_short_name || 'unknown',
        }
      }
      articleStats[key].total++
      if (answer.isCorrect) articleStats[key].correct++
      articleStats[key].time_spent += answer.timeSpent || 0
    }
  }

  const confidenceAnalysis = {
    very_sure_correct: detailedAnswers.filter(a => a.confidence === 'very_sure' && a.isCorrect).length,
    very_sure_incorrect: detailedAnswers.filter(a => a.confidence === 'very_sure' && !a.isCorrect).length,
    guessing_correct: detailedAnswers.filter(a => a.confidence === 'guessing' && a.isCorrect).length,
    guessing_incorrect: detailedAnswers.filter(a => a.confidence === 'guessing' && !a.isCorrect).length,
  }

  const speedConsistency = avgTimePerQuestion > 0
    ? Math.round((1 - (Math.sqrt(
        detailedAnswers.reduce((sum, a) => sum + Math.pow((a.timeSpent || 0) - avgTimePerQuestion, 2), 0) / detailedAnswers.length
      ) / avgTimePerQuestion)) * 100)
    : 0

  const confidenceAccuracy = detailedAnswers.length > 0
    ? Math.round(((confidenceAnalysis.very_sure_correct + confidenceAnalysis.guessing_incorrect) / detailedAnswers.length) * 100)
    : 0

  const improvementDuringTest = detailedAnswers.length >= 6
    ? detailedAnswers.slice(-3).filter(a => a.isCorrect).length > detailedAnswers.slice(0, 3).filter(a => a.isCorrect).length
    : false

  const interactionEfficiency = detailedAnswers.length > 0
    ? Math.round((detailedAnswers.filter(a => (a.interactions || 1) === 1).length / detailedAnswers.length) * 100)
    : 0

  const learningPatterns = {
    speed_consistency: speedConsistency,
    confidence_accuracy: confidenceAccuracy,
    improvement_during_test: improvementDuringTest,
    interaction_efficiency: interactionEfficiency,
  }

  const detailedAnalytics = {
    performance_summary: {
      accuracy_percentage: Math.round((finalScore / detailedAnswers.length) * 100),
      total_time_minutes: Math.round(totalTime / 60),
      avg_time_per_question: avgTimePerQuestion,
      questions_attempted: detailedAnswers.length,
    },
    difficulty_breakdown: Object.keys(difficultyStats).map(diff => ({
      difficulty: diff,
      total: difficultyStats[diff].length,
      correct: difficultyStats[diff].filter(a => a.isCorrect).length,
      accuracy: difficultyStats[diff].length > 0
        ? Math.round((difficultyStats[diff].filter(a => a.isCorrect).length / difficultyStats[diff].length) * 100)
        : 0,
      avg_time: difficultyStats[diff].length > 0
        ? Math.round(difficultyStats[diff].reduce((sum, a) => sum + (a.timeSpent || 0), 0) / difficultyStats[diff].length)
        : 0,
    })).filter(item => item.total > 0),
    article_performance: Object.keys(articleStats).map(artNum => ({
      article_number: artNum,
      article_id: articleStats[artNum].article_id,
      law_name: articleStats[artNum].law_name,
      total: articleStats[artNum].total,
      correct: articleStats[artNum].correct,
      accuracy: Math.round((articleStats[artNum].correct / articleStats[artNum].total) * 100),
      total_time: articleStats[artNum].time_spent,
      avg_time: Math.round(articleStats[artNum].time_spent / articleStats[artNum].total),
    })),
    time_analysis: {
      fastest_question: detailedAnswers.length > 0 ? Math.min(...detailedAnswers.map(a => a.timeSpent || 0)) : 0,
      slowest_question: detailedAnswers.length > 0 ? Math.max(...detailedAnswers.map(a => a.timeSpent || 0)) : 0,
      avg_correct_time: correctAnswers.length > 0
        ? Math.round(correctAnswers.reduce((sum, a) => sum + (a.timeSpent || 0), 0) / correctAnswers.length)
        : 0,
      avg_incorrect_time: incorrectAnswers.length > 0
        ? Math.round(incorrectAnswers.reduce((sum, a) => sum + (a.timeSpent || 0), 0) / incorrectAnswers.length)
        : 0,
      time_distribution: detailedAnswers.map(a => a.timeSpent || 0),
    },
    confidence_analysis: confidenceAnalysis,
    learning_patterns: learningPatterns,
    improvement_areas: incorrectAnswers.map(a => ({
      question_order: (a.questionIndex || 0) + 1,
      article_number: a.questionData?.article?.number || 'unknown',
      law_name: a.questionData?.article?.law_short_name || 'unknown',
      difficulty: a.questionData?.metadata?.difficulty || 'unknown',
      time_spent: a.timeSpent || 0,
      confidence: a.confidence || 'unknown',
      interactions: a.interactions || 1,
      priority: a.confidence === 'very_sure' ? 'high'
        : (a.timeSpent || 0) > avgTimePerQuestion * 1.5 ? 'medium' : 'low',
    })),
    session_metadata: {
      device_info: 'server-side',
      total_interactions: interactionEvents.length,
      session_quality: interactionEfficiency > 80 ? 'excellent'
        : interactionEfficiency > 60 ? 'good' : 'needs_improvement',
    },
  }

  const performanceMetrics = {
    completion_rate: 100,
    engagement_score: Math.min(100, interactionEvents.length * 2),
    focus_score: learningPatterns.speed_consistency,
    confidence_calibration: learningPatterns.confidence_accuracy,
    learning_efficiency: Math.round(
      (finalScore / detailedAnswers.length) * (100 / Math.max(1, totalTime / 60))
    ),
  }

  // 4. UPDATE tests
  const now = new Date().toISOString()
  const [updateResult] = await db
    .update(tests)
    .set({
      score: String(finalScore),
      totalQuestions: detailedAnswers.length,
      completedAt: now,
      isCompleted: true,
      totalTimeSeconds: totalTime,
      averageTimePerQuestion: String(avgTimePerQuestion),
      detailedAnalytics: detailedAnalytics,
      performanceMetrics: performanceMetrics,
    })
    .where(and(eq(tests.id, sessionId), eq(tests.userId, userId)))
    .returning({ id: tests.id })

  if (!updateResult) {
    console.error('❌ [complete-test] Error actualizando test:', sessionId)
    return { success: false, status: 'error' }
  }

  // 5. Update user_progress (background-safe, errors don't fail the whole operation)
  try {
    await updateUserProgress(db, userId, sessionId, finalScore, detailedAnswers.length, testRow.temaNumber)
  } catch (e) {
    console.warn('⚠️ [complete-test] Error actualizando user_progress (no-fatal):', e)
  }

  // 6. Update user_sessions si tenemos ID
  if (userSessionId) {
    try {
      await db
        .update(userSessions)
        .set({
          sessionEnd: now,
          totalDurationMinutes: Math.round(totalTime / 60),
          testsCompleted: 1,
          questionsAnswered: detailedAnswers.length,
          questionsCorrect: finalScore,
          sessionOutcome: finalScore >= Math.ceil(detailedAnswers.length * 0.7) ? 'successful' : 'needs_improvement',
          engagementScore: String(Math.min(100, Math.round((interactionEvents.length / detailedAnswers.length) * 10))),
          conversionEvents: ['completed_test'],
        })
        .where(eq(userSessions.id, userSessionId))
    } catch (e) {
      console.warn('⚠️ [complete-test] Error actualizando user_sessions (no-fatal):', e)
    }
  }

  console.log(`✅ [complete-test] Test ${sessionId} completado: ${finalScore}/${detailedAnswers.length}`)
  return { success: true, status: 'saved', savedQuestionsCount }
}

// ============================================
// HELPER: Update user_progress
// ============================================

async function updateUserProgress(
  db: ReturnType<typeof getDb>,
  userId: string,
  sessionId: string,
  correctAnswers: number,
  totalQuestions: number,
  temaNumber: number | null,
) {
  if (!temaNumber) return

  // Buscar topic_id para este tema
  const positionTypes = [
    'auxiliar_administrativo',
    'auxiliar_administrativo_estado',
    'administrativo_estado',
    'tramitacion_procesal',
    'auxilio_judicial',
  ]

  let topicId: string | null = null
  for (const posType of positionTypes) {
    const [row] = await db
      .select({ id: topics.id })
      .from(topics)
      .where(and(eq(topics.topicNumber, temaNumber), eq(topics.positionType, posType)))
      .limit(1)
    if (row?.id) {
      topicId = row.id
      break
    }
  }

  if (!topicId) return

  const accuracy = Math.round((correctAnswers / totalQuestions) * 100)
  const now = new Date().toISOString()

  // Check existing progress
  const [existing] = await db
    .select()
    .from(userProgress)
    .where(and(eq(userProgress.userId, userId), eq(userProgress.topicId, topicId)))
    .limit(1)

  if (existing) {
    const newTotalAttempts = (existing.totalAttempts ?? 0) + totalQuestions
    const newCorrectAttempts = (existing.correctAttempts ?? 0) + correctAnswers
    const newAccuracy = Math.round((newCorrectAttempts / newTotalAttempts) * 100)

    await db
      .update(userProgress)
      .set({
        totalAttempts: newTotalAttempts,
        correctAttempts: newCorrectAttempts,
        accuracyPercentage: String(newAccuracy),
        lastAttemptDate: now,
        updatedAt: now,
        needsReview: newAccuracy < 70,
      })
      .where(and(eq(userProgress.userId, userId), eq(userProgress.topicId, topicId)))
  } else {
    await db
      .insert(userProgress)
      .values({
        userId,
        topicId,
        totalAttempts: totalQuestions,
        correctAttempts: correctAnswers,
        accuracyPercentage: String(accuracy),
        lastAttemptDate: now,
        needsReview: accuracy < 70,
        createdAt: now,
        updatedAt: now,
      })
  }
}
