import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { safeParseSaveOfficialExamResults } from '@/lib/api/official-exams'

// Cliente con service role - bypasa RLS para operaciones de servidor
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

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
export async function POST(request: NextRequest) {
  console.log('🎯 [API/v2/official-exams/save-results] Request received')

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
      console.error('❌ [API/v2/official-exams/save-results] Auth error:', authError?.message)
      return NextResponse.json(
        { success: false, error: 'No autorizado - Token inválido' },
        { status: 401 }
      )
    }

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
    const score = answeredResults.length > 0
      ? Math.round((totalCorrect / answeredResults.length) * 100)
      : 0
    const legCount = answeredResults.filter(r => r.questionType === 'legislative').length
    const psyCount = answeredResults.filter(r => r.questionType === 'psychometric').length

    console.log(`💾 [API/v2/save] Creating test: score=${score}, answered=${answeredResults.length}/${results.length}, time=${totalTimeSeconds}s`)

    // 3a. Insert test session
    // Nota: test_type usa 'exam' porque el CHECK constraint solo permite 'practice'|'exam'
    // El flag isOfficialExam en detailed_analytics indica que es un examen oficial
    const { data: testSession, error: testError } = await supabaseAdmin
      .from('tests')
      .insert({
        user_id: user.id,
        title: parte
          ? `Examen Oficial ${examDate} (${parte} parte) - ${oposicion}`
          : `Examen Oficial ${examDate} - ${oposicion}`,
        test_type: 'exam',
        total_questions: answeredResults.length, // Only count answered questions
        score: score.toString(),
        is_completed: true,
        completed_at: new Date().toISOString(),
        total_time_seconds: totalTimeSeconds,
        detailed_analytics: {
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
      .select('id')
      .single()

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
        test_id: testSession.id,
        question_id: isLegislative ? result.questionId : null,
        psychometric_question_id: isLegislative ? null : result.questionId,
        question_order: index + 1,
        question_text: result.questionText,
        user_answer: result.userAnswer,
        correct_answer: result.correctAnswer || 'unknown',
        is_correct: result.isCorrect,
        time_spent_seconds: 0,
        article_number: isLegislative ? (result.articleNumber ?? null) : null,
        law_name: isLegislative ? (result.lawName ?? null) : null,
        difficulty: result.difficulty,
        question_type: result.questionType,
      }
    })

    const { error: questionsError } = await supabaseAdmin
      .from('test_questions')
      .insert(testQuestionsData)

    if (questionsError) {
      console.error('❌ [API/v2/save] Questions insert error:', questionsError)

      // Crear feedback automático con todos los datos para poder reconstruir el test
      try {
        await supabaseAdmin.from('user_feedback').insert({
          user_id: user.id,
          type: 'system_error_ghost_test',
          message: JSON.stringify({
            error: questionsError.message,
            errorCode: questionsError.code,
            testId: testSession.id,
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

    // 3c. Update user_question_history for legislative questions (needed for stats)
    // Note: answeredResults already excludes 'sin_respuesta' questions
    const legislativeResults = answeredResults.filter(r => r.questionType === 'legislative')
    if (legislativeResults.length > 0) {
      for (const result of legislativeResults) {
        // Check if history exists
        const { data: existing } = await supabaseAdmin
          .from('user_question_history')
          .select('id, total_attempts, correct_attempts')
          .eq('user_id', user.id)
          .eq('question_id', result.questionId)
          .single()

        if (existing) {
          // Update existing
          const newTotal = existing.total_attempts + 1
          const newCorrect = result.isCorrect ? existing.correct_attempts + 1 : existing.correct_attempts
          const successRate = newTotal > 0 ? (newCorrect / newTotal).toFixed(2) : '0.00'

          await supabaseAdmin
            .from('user_question_history')
            .update({
              total_attempts: newTotal,
              correct_attempts: newCorrect,
              success_rate: successRate,
              last_attempt_at: new Date().toISOString(),
            })
            .eq('id', existing.id)
        } else {
          // Insert new
          await supabaseAdmin
            .from('user_question_history')
            .insert({
              user_id: user.id,
              question_id: result.questionId,
              total_attempts: 1,
              correct_attempts: result.isCorrect ? 1 : 0,
              success_rate: result.isCorrect ? '1.00' : '0.00',
              first_attempt_at: new Date().toISOString(),
              last_attempt_at: new Date().toISOString(),
            })
        }
      }
      console.log(`✅ [API/v2/save] ${legislativeResults.length} legislative history records updated (answered only)`)
    }

    // 3d. Update psychometric history
    // Note: answeredResults already excludes 'sin_respuesta' questions
    const psychometricResults = answeredResults.filter(r => r.questionType === 'psychometric')
    if (psychometricResults.length > 0) {
      for (const result of psychometricResults) {
        // Check if history exists
        const { data: existing } = await supabaseAdmin
          .from('psychometric_user_question_history')
          .select('id, attempts, correct_attempts')
          .eq('user_id', user.id)
          .eq('question_id', result.questionId)
          .single()

        if (existing) {
          // Update existing
          await supabaseAdmin
            .from('psychometric_user_question_history')
            .update({
              attempts: existing.attempts + 1,
              correct_attempts: result.isCorrect ? existing.correct_attempts + 1 : existing.correct_attempts,
              last_attempt_at: new Date().toISOString(),
            })
            .eq('id', existing.id)
        } else {
          // Insert new
          await supabaseAdmin
            .from('psychometric_user_question_history')
            .insert({
              user_id: user.id,
              question_id: result.questionId,
              attempts: 1,
              correct_attempts: result.isCorrect ? 1 : 0,
              last_attempt_at: new Date().toISOString(),
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
