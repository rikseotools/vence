import { getDb } from '@/db/client'
import { questions, psychometricQuestions, articles, laws, tests, testQuestions, psychometricUserQuestionHistory } from '@/db/schema'
import { eq, and, like, sql } from 'drizzle-orm'
import type {
  GetOfficialExamQuestionsRequest,
  GetOfficialExamQuestionsResponse,
  OfficialExamQuestion,
  GetAvailableExamsResponse,
  SaveOfficialExamResultsRequest,
  SaveOfficialExamResultsResponse,
} from './schemas'

// Map oposicion slug to exam_source pattern
const oposicionToExamSourcePattern: Record<string, string> = {
  'auxiliar-administrativo-estado': '%Auxiliar Administrativo Estado%',
  'tramitacion-procesal': '%Tramitación Procesal%',
  'auxilio-judicial': '%Auxilio Judicial%',
}

/**
 * Get all questions for a specific official exam
 * Combines questions from both `questions` and `psychometric_questions` tables
 * SECURITY: Does NOT return correct_option - validation done via separate API
 */
export async function getOfficialExamQuestions(
  params: GetOfficialExamQuestionsRequest
): Promise<GetOfficialExamQuestionsResponse> {
  const { examDate, oposicion, includeReservas = true } = params

  try {
    const db = getDb()
    const examSourcePattern = oposicionToExamSourcePattern[oposicion]

    if (!examSourcePattern) {
      return {
        success: false,
        error: `Oposición no soportada: ${oposicion}`,
      }
    }

    console.log(`🎯 [OfficialExams] Fetching exam: ${examDate} - ${oposicion}`)

    // Query 1: Legislative questions from `questions` table
    const legislativeQuestions = await db
      .select({
        id: questions.id,
        questionText: questions.questionText,
        optionA: questions.optionA,
        optionB: questions.optionB,
        optionC: questions.optionC,
        optionD: questions.optionD,
        explanation: questions.explanation,
        difficulty: questions.difficulty,
        examSource: questions.examSource,
        articleNumber: articles.articleNumber,
        lawName: laws.shortName,
      })
      .from(questions)
      .leftJoin(articles, eq(questions.primaryArticleId, articles.id))
      .leftJoin(laws, eq(articles.lawId, laws.id))
      .where(
        and(
          eq(questions.isActive, true),
          eq(questions.isOfficialExam, true),
          eq(questions.examDate, examDate),
          like(questions.examSource, examSourcePattern)
        )
      )

    console.log(`✅ [OfficialExams] Found ${legislativeQuestions.length} legislative questions`)

    // Query 2: Psychometric questions from `psychometric_questions` table
    const psychometricQuestionsData = await db
      .select({
        id: psychometricQuestions.id,
        questionText: psychometricQuestions.questionText,
        optionA: psychometricQuestions.optionA,
        optionB: psychometricQuestions.optionB,
        optionC: psychometricQuestions.optionC,
        optionD: psychometricQuestions.optionD,
        explanation: psychometricQuestions.explanation,
        difficulty: psychometricQuestions.difficulty,
        examSource: psychometricQuestions.examSource,
        questionSubtype: psychometricQuestions.questionSubtype,
        contentData: psychometricQuestions.contentData,
        timeLimitSeconds: psychometricQuestions.timeLimitSeconds,
      })
      .from(psychometricQuestions)
      .where(
        and(
          eq(psychometricQuestions.isActive, true),
          eq(psychometricQuestions.isOfficialExam, true),
          eq(psychometricQuestions.examDate, examDate),
          like(psychometricQuestions.examSource, examSourcePattern)
        )
      )

    console.log(`✅ [OfficialExams] Found ${psychometricQuestionsData.length} psychometric questions`)

    // Transform legislative questions
    const formattedLegislative: OfficialExamQuestion[] = legislativeQuestions
      .filter(q => includeReservas || !q.examSource?.includes('Reserva'))
      .map(q => ({
        id: q.id,
        questionText: q.questionText,
        optionA: q.optionA,
        optionB: q.optionB,
        optionC: q.optionC,
        optionD: q.optionD,
        explanation: q.explanation,
        difficulty: q.difficulty,
        questionType: 'legislative' as const,
        questionSubtype: null,
        examSource: q.examSource,
        isReserva: q.examSource?.includes('Reserva') || false,
        contentData: null,
        timeLimitSeconds: null,
        articleNumber: q.articleNumber,
        lawName: q.lawName,
      }))

    // Transform psychometric questions
    const formattedPsychometric: OfficialExamQuestion[] = psychometricQuestionsData
      .filter(q => includeReservas || !q.examSource?.includes('Reserva'))
      .map(q => ({
        id: q.id,
        questionText: q.questionText,
        optionA: q.optionA || '',
        optionB: q.optionB || '',
        optionC: q.optionC || '',
        optionD: q.optionD || '',
        explanation: q.explanation,
        difficulty: q.difficulty,
        questionType: 'psychometric' as const,
        questionSubtype: q.questionSubtype,
        examSource: q.examSource,
        isReserva: q.examSource?.includes('Reserva') || false,
        contentData: q.contentData as Record<string, unknown> | null,
        timeLimitSeconds: q.timeLimitSeconds,
        articleNumber: null,
        lawName: null,
      }))

    // Combine all questions
    const allQuestions = [...formattedLegislative, ...formattedPsychometric]

    // Sort: non-reserva first, then reserva
    allQuestions.sort((a, b) => {
      if (a.isReserva === b.isReserva) return 0
      return a.isReserva ? 1 : -1
    })

    const reservaCount = allQuestions.filter(q => q.isReserva).length

    // Preguntas anuladas conocidas por examen (no se insertan en BD)
    const anuladasByExam: Record<string, number> = {
      '2024-07-09': 1, // P23 anulada en examen julio 2024
    }
    const anuladasCount = anuladasByExam[examDate] || 0

    console.log(`✅ [OfficialExams] Total: ${allQuestions.length} questions (${reservaCount} reservas, ${anuladasCount} anuladas)`)

    return {
      success: true,
      questions: allQuestions,
      metadata: {
        examDate,
        oposicion,
        parte: null,
        totalQuestions: allQuestions.length,
        legislativeCount: formattedLegislative.length,
        psychometricCount: formattedPsychometric.length,
        reservaCount,
        anuladasCount,
      },
    }
  } catch (error) {
    console.error('❌ [OfficialExams] Error fetching questions:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    }
  }
}

/**
 * Get list of available official exams
 */
export async function getAvailableOfficialExams(
  oposicion?: string
): Promise<GetAvailableExamsResponse> {
  try {
    const db = getDb()

    // Get distinct exam dates and sources from questions table
    const legislativeExams = await db
      .selectDistinct({
        examDate: questions.examDate,
        examSource: questions.examSource,
      })
      .from(questions)
      .where(
        and(
          eq(questions.isActive, true),
          eq(questions.isOfficialExam, true),
          sql`${questions.examDate} IS NOT NULL`,
          sql`${questions.examSource} IS NOT NULL`
        )
      )

    // Get distinct exam dates and sources from psychometric_questions table
    const psychometricExams = await db
      .selectDistinct({
        examDate: psychometricQuestions.examDate,
        examSource: psychometricQuestions.examSource,
      })
      .from(psychometricQuestions)
      .where(
        and(
          eq(psychometricQuestions.isActive, true),
          eq(psychometricQuestions.isOfficialExam, true),
          sql`${psychometricQuestions.examDate} IS NOT NULL`,
          sql`${psychometricQuestions.examSource} IS NOT NULL`
        )
      )

    // Combine and deduplicate
    const allExams = [...legislativeExams, ...psychometricExams]
    const uniqueExams = new Map<string, { examDate: string; examSource: string }>()

    allExams.forEach(exam => {
      if (exam.examDate && exam.examSource) {
        const key = `${exam.examDate}-${exam.examSource.split('(')[0].trim()}`
        if (!uniqueExams.has(key)) {
          uniqueExams.set(key, {
            examDate: exam.examDate,
            examSource: exam.examSource.split('(')[0].trim(),
          })
        }
      }
    })

    // Map to oposicion
    const examSummaries = Array.from(uniqueExams.values()).map(exam => {
      let oposicionSlug = 'unknown'
      if (exam.examSource.includes('Auxiliar Administrativo Estado')) {
        oposicionSlug = 'auxiliar-administrativo-estado'
      } else if (exam.examSource.includes('Tramitación Procesal')) {
        oposicionSlug = 'tramitacion-procesal'
      } else if (exam.examSource.includes('Auxilio Judicial')) {
        oposicionSlug = 'auxilio-judicial'
      }

      return {
        examDate: exam.examDate,
        examSource: exam.examSource,
        oposicion: oposicionSlug,
        totalQuestions: 0, // Would need additional query to count
        partes: ['primera'], // Default
      }
    })

    // Filter by oposicion if provided
    const filteredExams = oposicion
      ? examSummaries.filter(e => e.oposicion === oposicion)
      : examSummaries

    // Sort by date descending
    filteredExams.sort((a, b) => b.examDate.localeCompare(a.examDate))

    return {
      success: true,
      exams: filteredExams,
    }
  } catch (error) {
    console.error('❌ [OfficialExams] Error fetching available exams:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    }
  }
}

/**
 * Save official exam results
 * Creates a test session and saves individual question results
 */
export async function saveOfficialExamResults(
  params: SaveOfficialExamResultsRequest,
  userId: string
): Promise<SaveOfficialExamResultsResponse> {
  const { examDate, oposicion, results, totalTimeSeconds, metadata } = params

  try {
    const db = getDb()

    console.log(`💾 [OfficialExams] Saving results for user ${userId}: ${results.length} questions`)
    console.log(`💾 [OfficialExams] DB connection active: ${!!db}`)

    // IMPORTANT: Only count answered questions for stats (not 'sin_respuesta')
    const answeredResults = results.filter(r => r.userAnswer && r.userAnswer !== 'sin_respuesta')

    // Calculate statistics based on ANSWERED questions only
    const totalCorrect = answeredResults.filter(r => r.isCorrect).length
    const totalIncorrect = answeredResults.length - totalCorrect
    const score = answeredResults.length > 0
      ? String(Math.round((totalCorrect / answeredResults.length) * 100))
      : '0'
    const legCount = answeredResults.filter(r => r.questionType === 'legislative').length
    const psyCount = answeredResults.filter(r => r.questionType === 'psychometric').length

    // 1. Create test session
    console.log(`💾 [OfficialExams] Insert values: score=${score}, answeredQuestions=${answeredResults.length}/${results.length}, totalTimeSeconds=${totalTimeSeconds}`)
    const [testSession] = await db.insert(tests).values({
      userId,
      title: `Examen Oficial ${examDate} - ${oposicion}`,
      testType: 'official_exam',
      totalQuestions: answeredResults.length, // Only count answered questions
      score,
      isCompleted: true,
      completedAt: new Date().toISOString(),
      totalTimeSeconds,
      detailedAnalytics: {
        isOfficialExam: true,
        examDate,
        oposicion,
        legislativeCount: metadata?.legislativeCount ?? legCount,
        psychometricCount: metadata?.psychometricCount ?? psyCount,
        reservaCount: metadata?.reservaCount ?? 0,
        correctCount: totalCorrect,
        incorrectCount: totalIncorrect,
      },
    }).returning({ id: tests.id })

    if (!testSession?.id) {
      throw new Error('No se pudo crear la sesión de test')
    }

    console.log(`✅ [OfficialExams] Test session created: ${testSession.id}`)

    // 2. Insert individual question results (ONLY answered questions)
    const testQuestionsData = answeredResults.map((result, index) => {
      const isLegislative = result.questionType === 'legislative'
      return {
        testId: testSession.id,
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
      }
    })

    await db.insert(testQuestions).values(testQuestionsData)

    console.log(`✅ [OfficialExams] ${testQuestionsData.length} questions saved (${legCount} legislative, ${psyCount} psychometric)`)

    // 3. Update psychometric history for statistics
    // Note: answeredResults already excludes 'sin_respuesta' questions
    const psychometricResults = answeredResults.filter(r => r.questionType === 'psychometric')
    if (psychometricResults.length > 0) {
      for (const result of psychometricResults) {
        // Check if history exists
        const existing = await db
          .select()
          .from(psychometricUserQuestionHistory)
          .where(
            and(
              eq(psychometricUserQuestionHistory.userId, userId),
              eq(psychometricUserQuestionHistory.questionId, result.questionId)
            )
          )
          .limit(1)

        if (existing.length > 0) {
          // Update existing
          await db
            .update(psychometricUserQuestionHistory)
            .set({
              attempts: sql`${psychometricUserQuestionHistory.attempts} + 1`,
              correctAttempts: result.isCorrect
                ? sql`${psychometricUserQuestionHistory.correctAttempts} + 1`
                : psychometricUserQuestionHistory.correctAttempts,
              lastAttemptAt: new Date().toISOString(),
            })
            .where(eq(psychometricUserQuestionHistory.id, existing[0].id))
        } else {
          // Insert new
          await db.insert(psychometricUserQuestionHistory).values({
            userId,
            questionId: result.questionId,
            attempts: 1,
            correctAttempts: result.isCorrect ? 1 : 0,
            lastAttemptAt: new Date().toISOString(),
          })
        }
      }
      console.log(`✅ [OfficialExams] ${psychometricResults.length} psychometric history records updated`)
    }

    return {
      success: true,
      testId: testSession.id,
      questionsSaved: testQuestionsData.length,
    }
  } catch (error) {
    console.error('❌ [OfficialExams] Error saving results:', error)

    // Log completo del error para debugging
    console.error('❌ [OfficialExams] Error full object:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2))

    // Capturar detalles adicionales del error de PostgreSQL
    const errorDetails = error as {
      message?: string
      code?: string
      detail?: string
      hint?: string
      constraint?: string
      cause?: { code?: string; detail?: string; message?: string }
      severity?: string
      routine?: string
    }

    // Intentar obtener error de causa (PostgreSQL subyacente)
    const pgCause = errorDetails.cause

    const fullError = [
      errorDetails.message,
      errorDetails.code && `Code: ${errorDetails.code}`,
      errorDetails.severity && `Severity: ${errorDetails.severity}`,
      errorDetails.detail && `Detail: ${errorDetails.detail}`,
      errorDetails.hint && `Hint: ${errorDetails.hint}`,
      errorDetails.constraint && `Constraint: ${errorDetails.constraint}`,
      errorDetails.routine && `Routine: ${errorDetails.routine}`,
      pgCause?.code && `PG Code: ${pgCause.code}`,
      pgCause?.detail && `PG Detail: ${pgCause.detail}`,
    ].filter(Boolean).join(' | ')

    return {
      success: false,
      error: fullError || 'Error desconocido',
    }
  }
}
