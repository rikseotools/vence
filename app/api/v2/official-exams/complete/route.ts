import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getDb } from '@/db/client'
import { tests, testQuestions, psychometricUserQuestionHistory, userQuestionHistory } from '@/db/schema'
import { eq, and, sql } from 'drizzle-orm'

// Client with service role - bypasses RLS for server operations
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * POST /api/v2/official-exams/complete
 *
 * Complete an existing official exam session (created by /init).
 * Updates the test record and test_questions with validation results.
 *
 * Request body:
 * - testId: string (UUID) - The test session created by /init
 * - results: array of { questionOrder, isCorrect, correctAnswer, userAnswer }
 * - totalTimeSeconds: number
 *
 * Returns:
 * - success: boolean
 * - testId: string
 * - score: number (percentage)
 * - error: string (if failed)
 */
export async function POST(request: NextRequest) {
  console.log('🎯 [API/v2/official-exams/complete] Request received')

  try {
    // 1. Verify authentication
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'No autorizado - Token requerido' },
        { status: 401 }
      )
    }

    const token = authHeader.split(' ')[1]
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)

    if (authError || !user) {
      console.error('❌ [API/v2/official-exams/complete] Auth error:', authError?.message)
      return NextResponse.json(
        { success: false, error: 'No autorizado - Token inválido' },
        { status: 401 }
      )
    }

    console.log(`🔒 [API/v2/official-exams/complete] User authenticated: ${user.id}`)

    // 2. Parse request body
    const body = await request.json()
    const { testId, results, totalTimeSeconds } = body

    if (!testId || !results || !Array.isArray(results)) {
      return NextResponse.json(
        { success: false, error: 'testId y results son requeridos' },
        { status: 400 }
      )
    }

    const db = getDb()

    // 3. Verify test ownership and get metadata
    const testResult = await db
      .select({
        id: tests.id,
        userId: tests.userId,
        isCompleted: tests.isCompleted,
        detailedAnalytics: tests.detailedAnalytics,
      })
      .from(tests)
      .where(eq(tests.id, testId))
      .limit(1)

    if (testResult.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Test no encontrado' },
        { status: 404 }
      )
    }

    const test = testResult[0]

    if (test.userId !== user.id) {
      return NextResponse.json(
        { success: false, error: 'No tienes acceso a este test' },
        { status: 403 }
      )
    }

    if (test.isCompleted) {
      return NextResponse.json(
        { success: false, error: 'Este test ya está completado' },
        { status: 400 }
      )
    }

    console.log(`📝 [API/v2/official-exams/complete] Completing test ${testId}`)

    // 4. Update test_questions with validation results
    // Results format: { questionOrder, isCorrect, correctAnswer, userAnswer, questionType }
    let updatedCount = 0
    for (const result of results) {
      const { questionOrder, isCorrect, correctAnswer, userAnswer } = result

      await db
        .update(testQuestions)
        .set({
          isCorrect: isCorrect || false,
          correctAnswer: correctAnswer || '',
          userAnswer: userAnswer || '',
        })
        .where(
          and(
            eq(testQuestions.testId, testId),
            eq(testQuestions.questionOrder, questionOrder)
          )
        )

      updatedCount++
    }

    console.log(`✅ [API/v2/official-exams/complete] Updated ${updatedCount} questions`)

    // 5. Calculate final stats
    const answeredQuestions = results.filter(
      (r: { userAnswer?: string }) => r.userAnswer && r.userAnswer !== 'sin_respuesta' && r.userAnswer.trim() !== ''
    )
    const correctCount = answeredQuestions.filter((r: { isCorrect?: boolean }) => r.isCorrect).length
    const answeredCount = answeredQuestions.length
    const score = answeredCount > 0 ? Math.round((correctCount / answeredCount) * 100) : 0

    // 6. Update test record
    await db
      .update(tests)
      .set({
        isCompleted: true,
        completedAt: new Date().toISOString(),
        totalQuestions: answeredCount, // Only count answered questions
        score: correctCount.toString(),
        totalTimeSeconds: totalTimeSeconds || 0,
      })
      .where(eq(tests.id, testId))

    console.log(`✅ [API/v2/official-exams/complete] Test completed: ${correctCount}/${answeredCount} (${score}%)`)

    // 7. Update user history for statistics (optional but good for consistency)
    // Get question details from test_questions
    const savedQuestions = await db
      .select({
        questionId: testQuestions.questionId,
        psychometricQuestionId: testQuestions.psychometricQuestionId,
        isCorrect: testQuestions.isCorrect,
        userAnswer: testQuestions.userAnswer,
      })
      .from(testQuestions)
      .where(eq(testQuestions.testId, testId))

    // Update legislative question history
    const legislativeAnswers = savedQuestions.filter(
      q => q.questionId && q.userAnswer && q.userAnswer.trim() !== ''
    )

    for (const answer of legislativeAnswers) {
      const existing = await db
        .select({ id: userQuestionHistory.id, totalAttempts: userQuestionHistory.totalAttempts, correctAttempts: userQuestionHistory.correctAttempts })
        .from(userQuestionHistory)
        .where(
          and(
            eq(userQuestionHistory.userId, user.id),
            eq(userQuestionHistory.questionId, answer.questionId!)
          )
        )
        .limit(1)

      if (existing.length > 0) {
        const newTotal = existing[0].totalAttempts + 1
        const newCorrect = answer.isCorrect ? existing[0].correctAttempts + 1 : existing[0].correctAttempts
        await db
          .update(userQuestionHistory)
          .set({
            totalAttempts: newTotal,
            correctAttempts: newCorrect,
            successRate: (newCorrect / newTotal).toFixed(2),
            lastAttemptAt: new Date().toISOString(),
          })
          .where(eq(userQuestionHistory.id, existing[0].id))
      } else {
        await db.insert(userQuestionHistory).values({
          userId: user.id,
          questionId: answer.questionId!,
          totalAttempts: 1,
          correctAttempts: answer.isCorrect ? 1 : 0,
          successRate: answer.isCorrect ? '1.00' : '0.00',
          firstAttemptAt: new Date().toISOString(),
          lastAttemptAt: new Date().toISOString(),
        })
      }
    }

    // Update psychometric question history
    const psychometricAnswers = savedQuestions.filter(
      q => q.psychometricQuestionId && q.userAnswer && q.userAnswer.trim() !== ''
    )

    for (const answer of psychometricAnswers) {
      const existing = await db
        .select({ id: psychometricUserQuestionHistory.id, attempts: psychometricUserQuestionHistory.attempts, correctAttempts: psychometricUserQuestionHistory.correctAttempts })
        .from(psychometricUserQuestionHistory)
        .where(
          and(
            eq(psychometricUserQuestionHistory.userId, user.id),
            eq(psychometricUserQuestionHistory.questionId, answer.psychometricQuestionId!)
          )
        )
        .limit(1)

      if (existing.length > 0) {
        await db
          .update(psychometricUserQuestionHistory)
          .set({
            attempts: existing[0].attempts + 1,
            correctAttempts: answer.isCorrect ? existing[0].correctAttempts + 1 : existing[0].correctAttempts,
            lastAttemptAt: new Date().toISOString(),
          })
          .where(eq(psychometricUserQuestionHistory.id, existing[0].id))
      } else {
        await db.insert(psychometricUserQuestionHistory).values({
          userId: user.id,
          questionId: answer.psychometricQuestionId!,
          attempts: 1,
          correctAttempts: answer.isCorrect ? 1 : 0,
          lastAttemptAt: new Date().toISOString(),
        })
      }
    }

    console.log(`✅ [API/v2/official-exams/complete] History updated: ${legislativeAnswers.length} leg, ${psychometricAnswers.length} psy`)

    return NextResponse.json({
      success: true,
      testId,
      score,
      correctCount,
      answeredCount,
    })
  } catch (error) {
    console.error('❌ [API/v2/official-exams/complete] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Error interno del servidor',
      },
      { status: 500 }
    )
  }
}
