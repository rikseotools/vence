import { NextRequest, NextResponse } from 'next/server'
import { getAdminDb } from '@/db/client'
import { tests, testQuestions, userFeedback, psychometricUserQuestionHistory } from '@/db/schema'
import { and, eq } from 'drizzle-orm'
import { safeParseSaveOfficialExamResults } from '@/lib/api/official-exams'

import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { verifyAuth } from '@/lib/api/auth/verifyAuth'

// getAdminDb() = Drizzle con DATABASE_URL, bypass RLS (equivalente al
// service_role). Agnóstico de proveedor.
const db = () => getAdminDb()

/**
 * POST /api/v2/official-exams/save-results
 *
 * Saves official exam results with proper validation and typing.
 * Uses Supabase Admin client (service role) to bypass RLS.
 *
 * Request body:
 * - examDate: string (YYYY-MM-DD)
 * - oposicion: string
 * - results: array of question results
 * - totalTimeSeconds: number
 * - metadata: optional exam metadata
 *
 * Returns:
 * - success: boolean
 * - testId: string (if successful)
 * - questionsSaved: number (if successful)
 * - error: string (if failed)
 */
async function _POST(request: NextRequest) {
  console.log('🎯 [API/v2/official-exams/save-results] Request received')

  try {
    // 1. Verify authentication (via wrapper Fase 0.7 — soporta off/shadow/on)
    const auth = await verifyAuth(request, '/api/v2/official-exams/save-results')
    if (!auth.success) {
      return NextResponse.json(
        { success: false, error: auth.reason === 'no_bearer_token' ? 'No autorizado - Token requerido' : 'No autorizado - Token inválido' },
        { status: 401 }
      )
    }
    // `user` se mantiene como objeto para compatibilidad con código posterior
    // que usa user.id en múltiples inserts (user_id columns).
    const user = { id: auth.userId, email: auth.email }

    console.log(`🔒 [API/v2/official-exams/save-results] User authenticated: ${user.id}`)

    // 2. Parse and validate request body
    const body = await request.json()
    const parseResult = safeParseSaveOfficialExamResults(body)

    if (!parseResult.success) {
      console.error('❌ [API/v2/official-exams/save-results] Validation error:', parseResult.error.issues)
      return NextResponse.json(
        {
          success: false,
          error: 'Datos de entrada inválidos',
          details: parseResult.error.issues.map(i => i.message),
        },
        { status: 400 }
      )
    }

    // 3. Save results using Supabase Admin client (bypasses RLS)
    const { examDate, oposicion, parte, results, totalTimeSeconds, metadata } = parseResult.data

    // IMPORTANT: Only count answered questions for stats (not 'sin_respuesta')
    const answeredResults = results.filter(r => r.userAnswer && r.userAnswer !== 'sin_respuesta')

    // Calculate statistics based on ANSWERED questions only
    const totalCorrect = answeredResults.filter(r => r.isCorrect).length
    const totalIncorrect = answeredResults.length - totalCorrect
    const score = totalCorrect
    const legCount = answeredResults.filter(r => r.questionType === 'legislative').length
    const psyCount = answeredResults.filter(r => r.questionType === 'psychometric').length

    console.log(`💾 [API/v2/save] Creating test: score=${score}, answered=${answeredResults.length}/${results.length}, time=${totalTimeSeconds}s`)

    // 3a. Insert test session
    // Nota: test_type usa 'exam' porque el CHECK constraint solo permite 'practice'|'exam'
    // El flag isOfficialExam en detailed_analytics indica que es un examen oficial
    let testSession: { id: string } | null = null
    let testError: Error | null = null
    try {
      const [row] = await db()
        .insert(tests)
        .values({
          userId: user.id,
          title: parte
            ? `Examen Oficial ${examDate} (${parte} parte) - ${oposicion}`
            : `Examen Oficial ${examDate} - ${oposicion}`,
          testType: 'exam',
          totalQuestions: answeredResults.length, // Only count answered questions
          score: score.toString(),
          isCompleted: true,
          completedAt: new Date().toISOString(),
          totalTimeSeconds,
          detailedAnalytics: {
            isOfficialExam: true,
            examDate,
            oposicion,
            parte: parte ?? null,
            legislativeCount: metadata?.legislativeCount ?? legCount,
            psychometricCount: metadata?.psychometricCount ?? psyCount,
            reservaCount: metadata?.reservaCount ?? 0,
            correctCount: totalCorrect,
            incorrectCount: totalIncorrect,
          },
        })
        .returning({ id: tests.id })
      testSession = row ?? null
    } catch (e) {
      testError = e instanceof Error ? e : new Error(String(e))
    }

    if (testError || !testSession?.id) {
      console.error('❌ [API/v2/save] Test insert error:', testError)
      return NextResponse.json(
        { success: false, error: `Error creando sesión: ${testError?.message || 'unknown'}` },
        { status: 500 }
      )
    }

    console.log(`✅ [API/v2/save] Test session created: ${testSession.id}`)

    // 3b. Insert individual question results (ONLY answered questions)
    const testQuestionsData = answeredResults.map((result, index) => {
      const isLegislative = result.questionType === 'legislative'
      return {
        testId: testSession!.id,
        questionId: isLegislative ? result.questionId : null,
        psychometricQuestionId: isLegislative ? null : result.questionId,
        questionOrder: index + 1,
        questionText: result.questionText,
        userAnswer: result.userAnswer,
        correctAnswer: result.correctAnswer || 'unknown',
        isCorrect: result.isCorrect,
        timeSpentSeconds: 0,
        articleNumber: isLegislative ? (result.articleNumber ?? null) : null,
        lawName: isLegislative ? (result.lawName ?? null) : null,
        difficulty: result.difficulty,
        questionType: result.questionType,
        userId: user.id,
      }
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let questionsError: any = null
    try {
      await db().insert(testQuestions).values(testQuestionsData)
    } catch (e) {
      questionsError = e
    }

    if (questionsError) {
      console.error('❌ [API/v2/save] Questions insert error:', questionsError)

      // Crear feedback automático con todos los datos para poder reconstruir el test
      try {
        await db().insert(userFeedback).values({
          userId: user.id,
          type: 'system_error_ghost_test',
          message: JSON.stringify({
            error: questionsError.message,
            errorCode: questionsError.code, // postgres-js expone .code (SQLSTATE)
            testId: testSession!.id,
            examDate,
            oposicion,
            parte: parte ?? null,
            totalQuestions: answeredResults.length,
            correctCount: totalCorrect,
            incorrectCount: totalIncorrect,
            questionsData: testQuestionsData, // Datos completos para reconstruir
          }),
          url: '/api/v2/official-exams/save-results',
          status: 'pending',
          priority: 'high',
        })
        console.log('📝 [API/v2/save] Auto-feedback created for ghost test debugging')
      } catch (feedbackError) {
        console.error('❌ [API/v2/save] Failed to create auto-feedback:', feedbackError)
      }
    }

    // NOTA 2026-05-19: el upsert manual de user_question_history para legislativas se
    // eliminó porque el trigger BD `trigger_update_user_question_history` (AFTER INSERT
    // OR UPDATE en test_questions) ya mantiene la tabla. Causaba doble contabilización:
    // +74.812 attempts inflados globalmente (medido shadow validation). Las legislativas
    // ahora las mantiene exclusivamente el trigger BD.
    // psychometric_user_question_history sigue requiriendo upsert manual (no tiene
    // trigger BD análogo).

    // 3d. Update psychometric history
    // Note: answeredResults already excludes 'sin_respuesta' questions
    const psychometricResults = answeredResults.filter(r => r.questionType === 'psychometric')
    if (psychometricResults.length > 0) {
      for (const result of psychometricResults) {
        // Check if history exists
        const [existing] = await db()
          .select({
            id: psychometricUserQuestionHistory.id,
            attempts: psychometricUserQuestionHistory.attempts,
            correct_attempts: psychometricUserQuestionHistory.correctAttempts,
          })
          .from(psychometricUserQuestionHistory)
          .where(and(
            eq(psychometricUserQuestionHistory.userId, user.id!),
            eq(psychometricUserQuestionHistory.questionId, result.questionId),
          ))
          .limit(1)

        if (existing) {
          // Update existing
          await db()
            .update(psychometricUserQuestionHistory)
            .set({
              attempts: (existing.attempts ?? 0) + 1,
              correctAttempts: result.isCorrect ? (existing.correct_attempts ?? 0) + 1 : (existing.correct_attempts ?? 0),
              lastAttemptAt: new Date().toISOString(),
            })
            .where(eq(psychometricUserQuestionHistory.id, existing.id))
        } else {
          // Insert new
          await db()
            .insert(psychometricUserQuestionHistory)
            .values({
              userId: user.id,
              questionId: result.questionId,
              attempts: 1,
              correctAttempts: result.isCorrect ? 1 : 0,
              lastAttemptAt: new Date().toISOString(),
            })
        }
      }
      console.log(`✅ [API/v2/save] ${psychometricResults.length} psychometric history records updated (answered only)`)
    }

    console.log(`✅ [API/v2/save] Results saved: ${testQuestionsData.length} questions (${legCount} leg, ${psyCount} psy)`)

    return NextResponse.json({
      success: true,
      testId: testSession.id,
      questionsSaved: testQuestionsData.length,
    })
  } catch (error) {
    console.error('❌ [API/v2/official-exams/save-results] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Error interno del servidor',
      },
      { status: 500 }
    )
  }
}

export const POST = withErrorLogging('/api/v2/official-exams/save-results', _POST)
