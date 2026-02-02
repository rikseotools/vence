import { getDb } from '@/db/client'
import { questions, psychometricQuestions, articles, laws, tests, testQuestions, psychometricUserQuestionHistory } from '@/db/schema'
import { eq, and, like, sql, inArray, desc, count } from 'drizzle-orm'
import type {
  GetOfficialExamQuestionsRequest,
  GetOfficialExamQuestionsResponse,
  OfficialExamQuestion,
  SaveOfficialExamResultsRequest,
  SaveOfficialExamResultsResponse,
  InitOfficialExamRequest,
  InitOfficialExamResponse,
  SaveOfficialExamAnswerRequest,
  SaveOfficialExamAnswerResponse,
  ResumeOfficialExamResponse,
  GetPendingOfficialExamsResponse,
  GetOfficialExamFailedQuestionsRequest,
  GetOfficialExamFailedQuestionsResponse,
  OfficialExamFailedQuestion,
} from './schemas'

// Map oposicion slug to exam_source pattern
const oposicionToExamSourcePattern: Record<string, string> = {
  'auxiliar-administrativo-estado': '%Auxiliar Administrativo Estado%',
  'tramitacion-procesal': '%Tramitación Procesal%',
  'auxilio-judicial': '%Auxilio Judicial%',
}

/**
 * Determina la parte del examen basándose en el exam_source
 * El script mark_exam_parts.cjs añade " - Primera parte" o " - Segunda parte" al exam_source
 */
function getExamPart(examSource: string | null): 'primera' | 'segunda' | null {
  if (!examSource) return null
  if (examSource.includes('Primera parte')) return 'primera'
  if (examSource.includes('Segunda parte')) return 'segunda'
  return null
}

/**
 * Get all questions for a specific official exam
 * Combines questions from both `questions` and `psychometric_questions` tables
 * SECURITY: Does NOT return correct_option - validation done via separate API
 */
export async function getOfficialExamQuestions(
  params: GetOfficialExamQuestionsRequest
): Promise<GetOfficialExamQuestionsResponse> {
  const { examDate, oposicion, parte, includeReservas = true } = params

  try {
    const db = getDb()
    const examSourcePattern = oposicionToExamSourcePattern[oposicion]

    if (!examSourcePattern) {
      return {
        success: false,
        error: `Oposición no soportada: ${oposicion}`,
      }
    }

    console.log(`🎯 [OfficialExams] Fetching exam: ${examDate} - ${oposicion}${parte ? ` (${parte} parte)` : ''}`)

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
    let allQuestions = [...formattedLegislative, ...formattedPsychometric]

    // Filter by parte if specified
    // Las preguntas tienen " - Primera parte" o " - Segunda parte" en exam_source
    if (parte) {
      allQuestions = allQuestions.filter(q => {
        const questionParte = getExamPart(q.examSource)
        // Si la pregunta tiene parte marcada, filtrar por ella
        if (questionParte) {
          return questionParte === parte
        }
        // Fallback: psychometric questions son segunda parte
        if (q.questionType === 'psychometric') {
          return parte === 'segunda'
        }
        // Si no tiene parte marcada, incluir en ambas (no debería pasar)
        return true
      })
      console.log(`🔍 [OfficialExams] Filtered to ${parte} parte: ${allQuestions.length} questions`)
    }

    // Sort: non-reserva first, then reserva
    allQuestions.sort((a, b) => {
      if (a.isReserva === b.isReserva) return 0
      return a.isReserva ? 1 : -1
    })

    const reservaCount = allQuestions.filter(q => q.isReserva).length
    const legislativeInResult = allQuestions.filter(q => q.questionType === 'legislative').length
    const psychometricInResult = allQuestions.filter(q => q.questionType === 'psychometric').length

    // Preguntas anuladas conocidas por examen (no se insertan en BD)
    // Solo contar anuladas si no se filtra por parte (o ajustar según la parte)
    const anuladasByExam: Record<string, { primera?: number; segunda?: number; total: number }> = {
      '2024-07-09': { primera: 1, segunda: 0, total: 1 }, // P23 anulada en primera parte
    }
    const examAnuladas = anuladasByExam[examDate]
    const anuladasCount = parte
      ? (parte === 'primera' ? examAnuladas?.primera : examAnuladas?.segunda) || 0
      : examAnuladas?.total || 0

    console.log(`✅ [OfficialExams] Total: ${allQuestions.length} questions (${reservaCount} reservas, ${anuladasCount} anuladas)`)

    return {
      success: true,
      questions: allQuestions,
      metadata: {
        examDate,
        oposicion,
        parte: parte || null,
        totalQuestions: allQuestions.length,
        legislativeCount: legislativeInResult,
        psychometricCount: psychometricInResult,
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

// =====================================================
// INIT OFFICIAL EXAM SESSION (for resume functionality)
// =====================================================

/**
 * Initialize official exam session - creates test record and saves all questions
 * with correct_option from DB (for later validation)
 */
export async function initOfficialExam(
  params: InitOfficialExamRequest,
  userId: string
): Promise<InitOfficialExamResponse> {
  const { examDate, oposicion, parte, questions: questionsData, metadata } = params

  try {
    const db = getDb()

    console.log(`🎯 [initOfficialExam] Starting for user ${userId}: ${questionsData.length} questions`)

    // Separate legislative and psychometric question IDs
    const legislativeIds = questionsData
      .filter(q => q.questionType === 'legislative')
      .map(q => q.id)
    const psychometricIds = questionsData
      .filter(q => q.questionType === 'psychometric')
      .map(q => q.id)

    // Fetch correct_option from questions table for legislative
    const legislativeCorrectMap = new Map<string, number>()
    if (legislativeIds.length > 0) {
      const legResults = await db
        .select({
          id: questions.id,
          correctOption: questions.correctOption,
        })
        .from(questions)
        .where(inArray(questions.id, legislativeIds))

      for (const q of legResults) {
        legislativeCorrectMap.set(q.id, q.correctOption)
      }
      console.log(`✅ [initOfficialExam] Got ${legislativeCorrectMap.size} legislative correct_options`)
    }

    // Fetch correct_option from psychometric_questions table
    const psychometricCorrectMap = new Map<string, number>()
    if (psychometricIds.length > 0) {
      const psyResults = await db
        .select({
          id: psychometricQuestions.id,
          correctOption: psychometricQuestions.correctOption,
        })
        .from(psychometricQuestions)
        .where(inArray(psychometricQuestions.id, psychometricIds))

      for (const q of psyResults) {
        psychometricCorrectMap.set(q.id, q.correctOption)
      }
      console.log(`✅ [initOfficialExam] Got ${psychometricCorrectMap.size} psychometric correct_options`)
    }

    // Create test session
    // totalQuestions = all questions (including unanswered, which count as failed)
    const [testSession] = await db.insert(tests).values({
      userId,
      title: parte
        ? `Examen Oficial ${examDate} (${parte} parte) - ${oposicion}`
        : `Examen Oficial ${examDate} - ${oposicion}`,
      testType: 'exam',
      totalQuestions: questionsData.length,
      score: '0',
      isCompleted: false,
      totalTimeSeconds: 0,
      detailedAnalytics: {
        isOfficialExam: true,
        examDate,
        oposicion,
        parte: parte ?? null,
        legislativeCount: metadata?.legislativeCount ?? legislativeIds.length,
        psychometricCount: metadata?.psychometricCount ?? psychometricIds.length,
        reservaCount: metadata?.reservaCount ?? 0,
      },
    }).returning({ id: tests.id })

    if (!testSession?.id) {
      throw new Error('Failed to create test session')
    }

    console.log(`✅ [initOfficialExam] Test session created: ${testSession.id}`)

    // Prepare test_questions records
    const testQuestionsData = questionsData.map((q) => {
      const isLegislative = q.questionType === 'legislative'
      const correctOption = isLegislative
        ? legislativeCorrectMap.get(q.id)
        : psychometricCorrectMap.get(q.id)

      // Convert index to letter
      const correctLetter = correctOption !== undefined
        ? String.fromCharCode(97 + correctOption)
        : 'x' // Error flag

      return {
        testId: testSession.id,
        questionId: isLegislative ? q.id : null,
        psychometricQuestionId: isLegislative ? null : q.id,
        questionOrder: q.questionOrder,
        questionText: q.questionText,
        userAnswer: '', // Empty = not answered
        correctAnswer: correctLetter,
        isCorrect: false,
        articleNumber: q.articleNumber ?? null,
        lawName: q.lawName ?? null,
        difficulty: q.difficulty ?? null,
        questionType: q.questionType,
        timeSpentSeconds: 0,
      }
    })

    // Insert all questions
    await db.insert(testQuestions).values(testQuestionsData)

    console.log(`✅ [initOfficialExam] ${testQuestionsData.length} questions saved`)

    return {
      success: true,
      testId: testSession.id,
      savedCount: testQuestionsData.length,
    }
  } catch (error) {
    console.error('❌ [initOfficialExam] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    }
  }
}

// =====================================================
// SAVE INDIVIDUAL ANSWER (for auto-save during exam)
// =====================================================

/**
 * Save individual answer during official exam
 * Updates test_questions where test_id and question_order match
 */
export async function saveOfficialExamAnswer(
  params: SaveOfficialExamAnswerRequest
): Promise<SaveOfficialExamAnswerResponse> {
  const { testId, questionOrder, userAnswer } = params

  try {
    const db = getDb()

    // Find existing question record
    const existing = await db
      .select({
        id: testQuestions.id,
        correctAnswer: testQuestions.correctAnswer,
      })
      .from(testQuestions)
      .where(
        and(
          eq(testQuestions.testId, testId),
          eq(testQuestions.questionOrder, questionOrder)
        )
      )
      .limit(1)

    if (existing.length === 0) {
      return {
        success: false,
        error: `Question at order ${questionOrder} not found for test ${testId}`,
      }
    }

    const record = existing[0]
    const isCorrect = record.correctAnswer
      ? userAnswer.toLowerCase() === record.correctAnswer.toLowerCase()
      : false

    // Update the answer
    await db
      .update(testQuestions)
      .set({
        userAnswer,
        isCorrect,
      })
      .where(eq(testQuestions.id, record.id))

    return {
      success: true,
      answerId: record.id,
    }
  } catch (error) {
    console.error('❌ [saveOfficialExamAnswer] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    }
  }
}

// =====================================================
// RESUME OFFICIAL EXAM (get questions with saved answers)
// =====================================================

/**
 * Get official exam data for resuming
 * Returns questions (WITHOUT correct_option) and saved answers
 */
export async function getOfficialExamResume(
  testId: string,
  userId: string
): Promise<ResumeOfficialExamResponse> {
  try {
    const db = getDb()

    // Verify test ownership and get metadata
    const testResult = await db
      .select({
        id: tests.id,
        userId: tests.userId,
        totalQuestions: tests.totalQuestions,
        isCompleted: tests.isCompleted,
        createdAt: tests.createdAt,
        detailedAnalytics: tests.detailedAnalytics,
      })
      .from(tests)
      .where(eq(tests.id, testId))
      .limit(1)

    if (testResult.length === 0) {
      return { success: false, error: 'Test no encontrado' }
    }

    const test = testResult[0]

    if (test.userId !== userId) {
      return { success: false, error: 'No tienes acceso a este test' }
    }

    if (test.isCompleted) {
      return { success: false, error: 'Este examen ya está completado' }
    }

    // Get saved answers from test_questions
    const savedQuestionsResult = await db
      .select({
        questionOrder: testQuestions.questionOrder,
        questionId: testQuestions.questionId,
        psychometricQuestionId: testQuestions.psychometricQuestionId,
        userAnswer: testQuestions.userAnswer,
        questionType: testQuestions.questionType,
        questionText: testQuestions.questionText,
      })
      .from(testQuestions)
      .where(eq(testQuestions.testId, testId))
      .orderBy(testQuestions.questionOrder)

    // Collect question IDs by type
    const legIds = savedQuestionsResult
      .filter(q => q.questionId)
      .map(q => q.questionId!)
    const psyIds = savedQuestionsResult
      .filter(q => q.psychometricQuestionId)
      .map(q => q.psychometricQuestionId!)

    // Fetch full question data from questions table (WITHOUT correct_option)
    const legislativeQuestionsMap = new Map<string, {
      id: string
      questionText: string
      optionA: string
      optionB: string
      optionC: string
      optionD: string
      explanation: string | null
      difficulty: string | null
      examSource: string | null
      articleNumber: string | null
      lawName: string | null
    }>()

    if (legIds.length > 0) {
      const legResults = await db
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
        .where(inArray(questions.id, legIds))

      for (const q of legResults) {
        legislativeQuestionsMap.set(q.id, q)
      }
    }

    // Fetch full question data from psychometric_questions table (WITHOUT correct_option)
    const psychometricQuestionsMap = new Map<string, {
      id: string
      questionText: string
      optionA: string | null
      optionB: string | null
      optionC: string | null
      optionD: string | null
      explanation: string | null
      difficulty: string | null
      examSource: string | null
      questionSubtype: string | null
      contentData: Record<string, unknown> | null
    }>()

    if (psyIds.length > 0) {
      const psyResults = await db
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
        })
        .from(psychometricQuestions)
        .where(inArray(psychometricQuestions.id, psyIds))

      for (const q of psyResults) {
        psychometricQuestionsMap.set(q.id, {
          ...q,
          contentData: q.contentData as Record<string, unknown> | null,
        })
      }
    }

    // Build response questions and savedAnswers map
    const responseQuestions: ResumeOfficialExamResponse['questions'] = []
    const savedAnswers: Record<string, string> = {}

    for (const sq of savedQuestionsResult) {
      const isLegislative = !!sq.questionId
      const qId = sq.questionId || sq.psychometricQuestionId!

      let questionData

      if (isLegislative) {
        const leg = legislativeQuestionsMap.get(qId)
        if (!leg) continue

        questionData = {
          id: leg.id,
          questionOrder: sq.questionOrder,
          questionText: leg.questionText,
          optionA: leg.optionA,
          optionB: leg.optionB,
          optionC: leg.optionC,
          optionD: leg.optionD,
          explanation: leg.explanation,
          difficulty: leg.difficulty,
          questionType: 'legislative' as const,
          questionSubtype: null,
          contentData: null,
          isReserva: leg.examSource?.includes('Reserva') || false,
          articleNumber: leg.articleNumber,
          lawName: leg.lawName,
          savedAnswer: sq.userAnswer || null,
        }
      } else {
        const psy = psychometricQuestionsMap.get(qId)
        if (!psy) continue

        questionData = {
          id: psy.id,
          questionOrder: sq.questionOrder,
          questionText: psy.questionText,
          optionA: psy.optionA || '',
          optionB: psy.optionB || '',
          optionC: psy.optionC || '',
          optionD: psy.optionD || '',
          explanation: psy.explanation,
          difficulty: psy.difficulty,
          questionType: 'psychometric' as const,
          questionSubtype: psy.questionSubtype,
          contentData: psy.contentData,
          isReserva: psy.examSource?.includes('Reserva') || false,
          articleNumber: null,
          lawName: null,
          savedAnswer: sq.userAnswer || null,
        }
      }

      responseQuestions.push(questionData)

      // Build savedAnswers map (0-indexed)
      if (sq.userAnswer && sq.userAnswer.trim() !== '') {
        savedAnswers[String(sq.questionOrder - 1)] = sq.userAnswer
      }
    }

    // Sort by questionOrder
    responseQuestions.sort((a, b) => a.questionOrder - b.questionOrder)

    // Extract metadata
    const analytics = test.detailedAnalytics as {
      examDate?: string
      oposicion?: string
      legislativeCount?: number
      psychometricCount?: number
      reservaCount?: number
    } | null

    const answeredCount = Object.keys(savedAnswers).length

    console.log(`✅ [getOfficialExamResume] Loaded ${responseQuestions.length} questions, ${answeredCount} answered`)

    return {
      success: true,
      testId: test.id,
      questions: responseQuestions,
      savedAnswers,
      metadata: {
        examDate: analytics?.examDate || '',
        oposicion: analytics?.oposicion || '',
        totalQuestions: test.totalQuestions,
        answeredCount,
        legislativeCount: analytics?.legislativeCount || 0,
        psychometricCount: analytics?.psychometricCount || 0,
        reservaCount: analytics?.reservaCount || 0,
        createdAt: test.createdAt || new Date().toISOString(),
      },
    }
  } catch (error) {
    console.error('❌ [getOfficialExamResume] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    }
  }
}

// =====================================================
// GET PENDING OFFICIAL EXAMS
// =====================================================

/**
 * Get list of pending (incomplete) official exams for user
 */
export async function getPendingOfficialExams(
  userId: string,
  limit: number = 10
): Promise<GetPendingOfficialExamsResponse> {
  try {
    const db = getDb()

    // Query tests with isOfficialExam flag in detailed_analytics
    const pendingTests = await db
      .select({
        id: tests.id,
        totalQuestions: tests.totalQuestions,
        createdAt: tests.createdAt,
        detailedAnalytics: tests.detailedAnalytics,
      })
      .from(tests)
      .where(
        and(
          eq(tests.userId, userId),
          eq(tests.isCompleted, false),
          sql`${tests.detailedAnalytics}->>'isOfficialExam' = 'true'`
        )
      )
      .orderBy(desc(tests.createdAt))
      .limit(limit)

    // For each test, count answered questions
    const pendingExams = await Promise.all(
      pendingTests.map(async (test) => {
        const answersCount = await db
          .select({ count: count() })
          .from(testQuestions)
          .where(
            and(
              eq(testQuestions.testId, test.id),
              sql`${testQuestions.userAnswer} IS NOT NULL AND ${testQuestions.userAnswer} != ''`
            )
          )

        const answeredCount = answersCount[0]?.count ?? 0
        const progress = test.totalQuestions > 0
          ? Math.round((answeredCount / test.totalQuestions) * 100)
          : 0

        const analytics = test.detailedAnalytics as {
          examDate?: string
          oposicion?: string
        } | null

        return {
          id: test.id,
          examDate: analytics?.examDate || 'Unknown',
          oposicion: analytics?.oposicion || 'Unknown',
          totalQuestions: test.totalQuestions,
          answeredCount,
          progress,
          createdAt: test.createdAt || new Date().toISOString(),
        }
      })
    )

    // Filter only those with at least one answer (actually started)
    const startedExams = pendingExams.filter(e => e.answeredCount > 0)

    console.log(`✅ [getPendingOfficialExams] Found ${startedExams.length} pending official exams for user ${userId}`)

    return {
      success: true,
      exams: startedExams,
      total: startedExams.length,
    }
  } catch (error) {
    console.error('❌ [getPendingOfficialExams] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    }
  }
}

// =====================================================
// GET FAILED QUESTIONS FROM COMPLETED OFFICIAL EXAM
// =====================================================

/**
 * Get failed questions from a completed official exam
 * Returns full question data for both viewing failures and retrying
 */
export async function getOfficialExamFailedQuestions(
  params: GetOfficialExamFailedQuestionsRequest
): Promise<GetOfficialExamFailedQuestionsResponse> {
  const { userId, examDate, parte, oposicion } = params

  try {
    const db = getDb()

    console.log(`🔍 [getOfficialExamFailedQuestions] Looking for failed questions: ${examDate} ${parte || 'all'} - ${oposicion}`)

    // Find completed test matching the exam criteria
    // The test title follows pattern: "Examen Oficial {examDate} ({parte} parte) - {oposicion}"
    // or without parte: "Examen Oficial {examDate} - {oposicion}"
    const testResults = await db
      .select({
        id: tests.id,
        detailedAnalytics: tests.detailedAnalytics,
      })
      .from(tests)
      .where(
        and(
          eq(tests.userId, userId),
          eq(tests.isCompleted, true),
          sql`${tests.detailedAnalytics}->>'isOfficialExam' = 'true'`,
          sql`${tests.detailedAnalytics}->>'examDate' = ${examDate}`,
          sql`${tests.detailedAnalytics}->>'oposicion' = ${oposicion}`,
          // If parte is specified, filter by it
          parte
            ? sql`${tests.detailedAnalytics}->>'parte' = ${parte}`
            : sql`true`
        )
      )
      .orderBy(desc(tests.completedAt))
      .limit(1)

    if (testResults.length === 0) {
      console.log(`⚠️ [getOfficialExamFailedQuestions] No completed exam found`)
      return {
        success: false,
        error: 'No se encontró ningún examen completado con esos criterios',
      }
    }

    const testId = testResults[0].id
    console.log(`✅ [getOfficialExamFailedQuestions] Found test: ${testId}`)

    // Get failed questions from test_questions (includes unanswered)
    const failedQuestionsResult = await db
      .select({
        questionId: testQuestions.questionId,
        psychometricQuestionId: testQuestions.psychometricQuestionId,
        userAnswer: testQuestions.userAnswer,
        correctAnswer: testQuestions.correctAnswer,
        questionType: testQuestions.questionType,
      })
      .from(testQuestions)
      .where(
        and(
          eq(testQuestions.testId, testId),
          eq(testQuestions.isCorrect, false)
          // Note: includes unanswered questions (empty userAnswer) as failures
        )
      )

    console.log(`✅ [getOfficialExamFailedQuestions] Found ${failedQuestionsResult.length} failed questions`)

    if (failedQuestionsResult.length === 0) {
      return {
        success: true,
        questions: [],
        totalFailed: 0,
        examDate,
        parte: parte || null,
        oposicion,
      }
    }

    // Separate question IDs by type
    const legislativeIds = failedQuestionsResult
      .filter(q => q.questionId)
      .map(q => q.questionId!)
    const psychometricIds = failedQuestionsResult
      .filter(q => q.psychometricQuestionId)
      .map(q => q.psychometricQuestionId!)

    // Fetch full legislative question data
    const legislativeQuestionsMap = new Map<string, {
      id: string
      questionText: string
      optionA: string
      optionB: string
      optionC: string
      optionD: string
      explanation: string | null
      difficulty: string | null
      articleNumber: string | null
      lawName: string | null
      primaryArticleId: string | null
    }>()

    if (legislativeIds.length > 0) {
      const legResults = await db
        .select({
          id: questions.id,
          questionText: questions.questionText,
          optionA: questions.optionA,
          optionB: questions.optionB,
          optionC: questions.optionC,
          optionD: questions.optionD,
          explanation: questions.explanation,
          difficulty: questions.difficulty,
          articleNumber: articles.articleNumber,
          lawName: laws.shortName,
          primaryArticleId: questions.primaryArticleId,
        })
        .from(questions)
        .leftJoin(articles, eq(questions.primaryArticleId, articles.id))
        .leftJoin(laws, eq(articles.lawId, laws.id))
        .where(inArray(questions.id, legislativeIds))

      for (const q of legResults) {
        legislativeQuestionsMap.set(q.id, q)
      }
    }

    // Fetch full psychometric question data
    const psychometricQuestionsMap = new Map<string, {
      id: string
      questionText: string
      optionA: string | null
      optionB: string | null
      optionC: string | null
      optionD: string | null
      explanation: string | null
      difficulty: string | null
      questionSubtype: string | null
      contentData: Record<string, unknown> | null
    }>()

    if (psychometricIds.length > 0) {
      const psyResults = await db
        .select({
          id: psychometricQuestions.id,
          questionText: psychometricQuestions.questionText,
          optionA: psychometricQuestions.optionA,
          optionB: psychometricQuestions.optionB,
          optionC: psychometricQuestions.optionC,
          optionD: psychometricQuestions.optionD,
          explanation: psychometricQuestions.explanation,
          difficulty: psychometricQuestions.difficulty,
          questionSubtype: psychometricQuestions.questionSubtype,
          contentData: psychometricQuestions.contentData,
        })
        .from(psychometricQuestions)
        .where(inArray(psychometricQuestions.id, psychometricIds))

      for (const q of psyResults) {
        psychometricQuestionsMap.set(q.id, {
          ...q,
          contentData: q.contentData as Record<string, unknown> | null,
        })
      }
    }

    // Build response with full question data
    const failedQuestions: OfficialExamFailedQuestion[] = []

    for (const fq of failedQuestionsResult) {
      const isLegislative = !!fq.questionId
      const qId = fq.questionId || fq.psychometricQuestionId!

      if (isLegislative) {
        const legQ = legislativeQuestionsMap.get(qId)
        if (legQ) {
          failedQuestions.push({
            id: legQ.id,
            questionText: legQ.questionText,
            optionA: legQ.optionA,
            optionB: legQ.optionB,
            optionC: legQ.optionC,
            optionD: legQ.optionD,
            userAnswer: fq.userAnswer,
            correctAnswer: fq.correctAnswer,
            explanation: legQ.explanation,
            questionType: 'legislative',
            questionSubtype: null,
            contentData: null,
            articleNumber: legQ.articleNumber,
            lawName: legQ.lawName,
            difficulty: legQ.difficulty,
            primaryArticleId: legQ.primaryArticleId,
          })
        }
      } else {
        const psyQ = psychometricQuestionsMap.get(qId)
        if (psyQ) {
          failedQuestions.push({
            id: psyQ.id,
            questionText: psyQ.questionText,
            optionA: psyQ.optionA || '',
            optionB: psyQ.optionB || '',
            optionC: psyQ.optionC || '',
            optionD: psyQ.optionD || '',
            userAnswer: fq.userAnswer,
            correctAnswer: fq.correctAnswer,
            explanation: psyQ.explanation,
            questionType: 'psychometric',
            questionSubtype: psyQ.questionSubtype,
            contentData: psyQ.contentData,
            articleNumber: null,
            lawName: null,
            difficulty: psyQ.difficulty,
            primaryArticleId: null,
          })
        }
      }
    }

    console.log(`✅ [getOfficialExamFailedQuestions] Returning ${failedQuestions.length} failed questions with full data`)

    return {
      success: true,
      questions: failedQuestions,
      totalFailed: failedQuestions.length,
      examDate,
      parte: parte || null,
      oposicion,
    }
  } catch (error) {
    console.error('❌ [getOfficialExamFailedQuestions] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    }
  }
}
