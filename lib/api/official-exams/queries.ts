import { getDb } from '@/db/client'
import { questions, psychometricQuestions, articles, laws } from '@/db/schema'
import { eq, and, like, sql } from 'drizzle-orm'
import type {
  GetOfficialExamQuestionsRequest,
  GetOfficialExamQuestionsResponse,
  OfficialExamQuestion,
  GetAvailableExamsResponse,
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
