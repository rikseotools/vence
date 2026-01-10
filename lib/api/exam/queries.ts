// lib/api/exam/queries.ts - Queries tipadas para el módulo de exámenes
import { getDb } from '@/db/client'
import { testQuestions, tests } from '@/db/schema'
import { eq, and, desc, sql, count, isNull } from 'drizzle-orm'
import type {
  SaveAnswerRequest,
  SaveAnswerResponse,
  GetExamProgressResponse,
  GetPendingExamsResponse,
  CompleteExamResponse,
} from './schemas'

// ============================================
// GUARDAR RESPUESTA INDIVIDUAL
// ============================================

export type SaveAnswerParams = {
  testId: string
  questionId?: string | null
  questionOrder: number
  userAnswer: string
  // correctAnswer es opcional - se recupera del registro existente si no se proporciona
  correctAnswer?: string
  questionText?: string
  articleId?: string | null
  articleNumber?: string | null
  lawName?: string | null
  temaNumber?: number | null
  difficulty?: string | null
  timeSpentSeconds?: number
  confidenceLevel?: string | null
}

export async function saveAnswer(params: SaveAnswerParams): Promise<SaveAnswerResponse> {
  try {
    const db = getDb()

    // Verificar si ya existe una respuesta para esta pregunta en este test
    const existing = await db
      .select({
        id: testQuestions.id,
        correctAnswer: testQuestions.correctAnswer
      })
      .from(testQuestions)
      .where(and(
        eq(testQuestions.testId, params.testId),
        eq(testQuestions.questionOrder, params.questionOrder)
      ))
      .limit(1)

    let answerId: string
    let correctAnswer = params.correctAnswer

    if (existing.length > 0) {
      // Usar correctAnswer del registro existente si no se proporcionó
      if (!correctAnswer && existing[0].correctAnswer) {
        correctAnswer = existing[0].correctAnswer
      }

      const isCorrect = correctAnswer
        ? params.userAnswer.toLowerCase() === correctAnswer.toLowerCase()
        : false

      // Actualizar respuesta existente
      await db
        .update(testQuestions)
        .set({
          userAnswer: params.userAnswer,
          isCorrect,
          timeSpentSeconds: params.timeSpentSeconds ?? 0,
          confidenceLevel: params.confidenceLevel,
        })
        .where(eq(testQuestions.id, existing[0].id))

      answerId = existing[0].id

      // Actualizar score del test
      await updateTestScore(params.testId)

      return {
        success: true,
        answerId,
        isCorrect,
      }
    } else {
      // Solo insertar si tenemos correctAnswer (para nuevas preguntas)
      if (!correctAnswer) {
        return {
          success: false,
          error: 'correctAnswer es requerido para nuevas preguntas',
        }
      }

      const isCorrect = params.userAnswer.toLowerCase() === correctAnswer.toLowerCase()

      // Insertar nueva respuesta
      const result = await db
        .insert(testQuestions)
        .values({
          testId: params.testId,
          questionId: params.questionId,
          questionOrder: params.questionOrder,
          questionText: params.questionText || '',
          userAnswer: params.userAnswer,
          correctAnswer: correctAnswer,
          isCorrect,
          articleId: params.articleId,
          articleNumber: params.articleNumber,
          lawName: params.lawName,
          temaNumber: params.temaNumber,
          difficulty: params.difficulty,
          timeSpentSeconds: params.timeSpentSeconds ?? 0,
          confidenceLevel: params.confidenceLevel,
        })
        .returning({ id: testQuestions.id })

      answerId = result[0].id

      // Actualizar score del test
      await updateTestScore(params.testId)

      return {
        success: true,
        answerId,
        isCorrect,
      }
    }
  } catch (error) {
    console.error('Error guardando respuesta:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    }
  }
}

// ============================================
// ACTUALIZAR SCORE DEL TEST
// ============================================

export async function updateTestScore(testId: string): Promise<void> {
  const db = getDb()

  // Contar respuestas correctas
  const result = await db
    .select({
      total: count(),
      correct: sql<number>`sum(case when ${testQuestions.isCorrect} = true then 1 else 0 end)`,
    })
    .from(testQuestions)
    .where(eq(testQuestions.testId, testId))

  const total = result[0]?.total ?? 0
  const correct = Number(result[0]?.correct) ?? 0

  // Actualizar test
  await db
    .update(tests)
    .set({
      score: correct.toString(),
      totalQuestions: total,
    })
    .where(eq(tests.id, testId))
}

// ============================================
// OBTENER PROGRESO DE EXAMEN
// ============================================

export async function getExamProgress(testId: string): Promise<GetExamProgressResponse> {
  try {
    const db = getDb()

    // Obtener info del test
    const testResult = await db
      .select({
        id: tests.id,
        totalQuestions: tests.totalQuestions,
        score: tests.score,
        isCompleted: tests.isCompleted,
      })
      .from(tests)
      .where(eq(tests.id, testId))
      .limit(1)

    if (testResult.length === 0) {
      return {
        success: false,
        error: 'Test no encontrado',
      }
    }

    const test = testResult[0]

    // Obtener respuestas guardadas
    const answers = await db
      .select({
        questionOrder: testQuestions.questionOrder,
        userAnswer: testQuestions.userAnswer,
        correctAnswer: testQuestions.correctAnswer,
        isCorrect: testQuestions.isCorrect,
        questionId: testQuestions.questionId,
        timeSpentSeconds: testQuestions.timeSpentSeconds,
      })
      .from(testQuestions)
      .where(eq(testQuestions.testId, testId))
      .orderBy(testQuestions.questionOrder)

    return {
      success: true,
      testId: test.id,
      totalQuestions: test.totalQuestions,
      answeredQuestions: answers.length,
      score: Number(test.score) || 0,
      isCompleted: test.isCompleted ?? false,
      answers: answers.map(a => ({
        questionOrder: a.questionOrder,
        userAnswer: a.userAnswer,
        correctAnswer: a.correctAnswer,
        isCorrect: a.isCorrect,
        questionId: a.questionId,
        timeSpentSeconds: a.timeSpentSeconds,
      })),
    }
  } catch (error) {
    console.error('Error obteniendo progreso:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    }
  }
}

// ============================================
// OBTENER EXÁMENES PENDIENTES
// ============================================

export async function getPendingExams(
  userId: string,
  testType?: 'exam' | 'practice',
  limit: number = 10
): Promise<GetPendingExamsResponse> {
  try {
    const db = getDb()

    // Construir condiciones
    // FIX: También verificar completed_at IS NULL para evitar mostrar tests
    // que ya finalizaron pero tienen is_completed=false (finalizados incompletos)
    const conditions = [
      eq(tests.userId, userId),
      eq(tests.isCompleted, false),
      isNull(tests.completedAt),
    ]

    if (testType) {
      conditions.push(eq(tests.testType, testType))
    }

    // Obtener tests pendientes
    const pendingTests = await db
      .select({
        id: tests.id,
        title: tests.title,
        testType: tests.testType,
        totalQuestions: tests.totalQuestions,
        score: tests.score,
        createdAt: tests.createdAt,
        temaNumber: tests.temaNumber,
      })
      .from(tests)
      .where(and(...conditions))
      .orderBy(desc(tests.createdAt))
      .limit(limit)

    // Para cada test, contar las preguntas respondidas (userAnswer no vacío)
    const examsWithProgress = await Promise.all(
      pendingTests.map(async (test) => {
        const answersCount = await db
          .select({ count: count() })
          .from(testQuestions)
          .where(and(
            eq(testQuestions.testId, test.id),
            sql`${testQuestions.userAnswer} IS NOT NULL AND ${testQuestions.userAnswer} != ''`
          ))

        const answered = answersCount[0]?.count ?? 0
        const total = test.totalQuestions
        const progress = total > 0 ? Math.round((answered / total) * 100) : 0

        return {
          id: test.id,
          title: test.title,
          testType: test.testType ?? 'exam',
          totalQuestions: total,
          answeredQuestions: answered,
          score: Number(test.score) || 0,
          createdAt: test.createdAt ?? new Date().toISOString(),
          temaNumber: test.temaNumber,
          progress,
        }
      })
    )

    // Filtrar solo los que tienen al menos una respuesta (exámenes realmente empezados)
    const startedExams = examsWithProgress.filter(e => e.answeredQuestions > 0)

    return {
      success: true,
      exams: startedExams,
      total: startedExams.length,
    }
  } catch (error) {
    console.error('Error obteniendo exámenes pendientes:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    }
  }
}

// ============================================
// COMPLETAR EXAMEN
// ============================================

export async function completeExam(
  testId: string,
  force: boolean = false
): Promise<CompleteExamResponse> {
  try {
    const db = getDb()

    // Obtener info del test
    const testResult = await db
      .select({
        id: tests.id,
        totalQuestions: tests.totalQuestions,
        isCompleted: tests.isCompleted,
      })
      .from(tests)
      .where(eq(tests.id, testId))
      .limit(1)

    if (testResult.length === 0) {
      return {
        success: false,
        error: 'Test no encontrado',
      }
    }

    const test = testResult[0]

    if (test.isCompleted) {
      return {
        success: false,
        error: 'El test ya está completado',
      }
    }

    // Contar respuestas
    const answersResult = await db
      .select({
        total: count(),
        correct: sql<number>`sum(case when ${testQuestions.isCorrect} = true then 1 else 0 end)`,
      })
      .from(testQuestions)
      .where(eq(testQuestions.testId, testId))

    const answeredCount = answersResult[0]?.total ?? 0
    const correctCount = Number(answersResult[0]?.correct) ?? 0
    const expectedCount = test.totalQuestions

    // Verificar si se respondieron todas las preguntas
    if (!force && answeredCount < expectedCount) {
      return {
        success: false,
        error: `Faltan ${expectedCount - answeredCount} preguntas por responder`,
        totalQuestions: expectedCount,
        correctAnswers: correctCount,
        unanswered: expectedCount - answeredCount,
      }
    }

    // Marcar como completado
    await db
      .update(tests)
      .set({
        isCompleted: true,
        completedAt: new Date().toISOString(),
        score: correctCount.toString(),
        totalQuestions: answeredCount, // Usar las que realmente se respondieron
      })
      .where(eq(tests.id, testId))

    return {
      success: true,
      testId,
      finalScore: correctCount,
      totalQuestions: answeredCount,
      correctAnswers: correctCount,
      incorrectAnswers: answeredCount - correctCount,
      unanswered: expectedCount - answeredCount,
      isCompleted: true,
    }
  } catch (error) {
    console.error('Error completando examen:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    }
  }
}

// ============================================
// VERIFICAR PROPIEDAD DEL TEST
// ============================================

export async function verifyTestOwnership(
  testId: string,
  userId: string
): Promise<boolean> {
  try {
    const db = getDb()

    const result = await db
      .select({ id: tests.id })
      .from(tests)
      .where(and(
        eq(tests.id, testId),
        eq(tests.userId, userId)
      ))
      .limit(1)

    return result.length > 0
  } catch (error) {
    console.error('Error verificando propiedad:', error)
    return false
  }
}

// ============================================
// OBTENER TEST POR ID
// ============================================

export async function getTestById(testId: string) {
  try {
    const db = getDb()

    const result = await db
      .select()
      .from(tests)
      .where(eq(tests.id, testId))
      .limit(1)

    return result[0] ?? null
  } catch (error) {
    console.error('Error obteniendo test:', error)
    return null
  }
}

// ============================================
// GUARDAR TODAS LAS PREGUNTAS AL INICIAR EXAMEN
// ============================================

export type InitExamQuestion = {
  questionId: string
  questionOrder: number
  questionText: string
  correctAnswer: string
  articleId?: string | null
  articleNumber?: string | null
  lawName?: string | null
  temaNumber?: number | null
  difficulty?: string | null
}

export type InitExamResponse = {
  success: boolean
  savedCount?: number
  error?: string
}

export async function initExamQuestions(
  testId: string,
  questions: InitExamQuestion[]
): Promise<InitExamResponse> {
  try {
    const db = getDb()

    // Preparar datos para inserción batch
    const values = questions.map(q => ({
      testId,
      questionId: q.questionId,
      questionOrder: q.questionOrder,
      questionText: q.questionText,
      userAnswer: '', // Vacío = no respondida
      correctAnswer: q.correctAnswer,
      isCorrect: false,
      articleId: q.articleId,
      articleNumber: q.articleNumber,
      lawName: q.lawName,
      temaNumber: q.temaNumber,
      difficulty: q.difficulty,
      timeSpentSeconds: 0,
    }))

    // Insertar todas las preguntas
    await db.insert(testQuestions).values(values)

    return {
      success: true,
      savedCount: questions.length,
    }
  } catch (error) {
    console.error('Error guardando preguntas iniciales:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    }
  }
}

// ============================================
// OBTENER DATOS PARA REANUDAR EXAMEN
// ============================================

export type ResumedExamQuestion = {
  questionOrder: number
  questionId: string | null
  userAnswer: string | null
  correctAnswer: string
  questionText: string
}

export type GetResumedExamResponse = {
  success: boolean
  testId?: string
  temaNumber?: number | null
  totalQuestions?: number
  answeredCount?: number
  isCompleted?: boolean
  questions?: ResumedExamQuestion[]
  error?: string
}

export async function getResumedExamData(testId: string): Promise<GetResumedExamResponse> {
  try {
    const db = getDb()

    // Obtener info del test
    const testResult = await db
      .select({
        id: tests.id,
        temaNumber: tests.temaNumber,
        totalQuestions: tests.totalQuestions,
        isCompleted: tests.isCompleted,
      })
      .from(tests)
      .where(eq(tests.id, testId))
      .limit(1)

    if (testResult.length === 0) {
      return {
        success: false,
        error: 'Test no encontrado',
      }
    }

    const test = testResult[0]

    if (test.isCompleted) {
      return {
        success: false,
        error: 'Este examen ya está completado',
      }
    }

    // Obtener preguntas y respuestas guardadas
    const questionsResult = await db
      .select({
        questionOrder: testQuestions.questionOrder,
        questionId: testQuestions.questionId,
        userAnswer: testQuestions.userAnswer,
        correctAnswer: testQuestions.correctAnswer,
        questionText: testQuestions.questionText,
      })
      .from(testQuestions)
      .where(eq(testQuestions.testId, testId))
      .orderBy(testQuestions.questionOrder)

    // Contar solo las que tienen respuesta (no vacía)
    const answeredCount = questionsResult.filter(q => q.userAnswer && q.userAnswer.trim() !== '').length

    return {
      success: true,
      testId: test.id,
      temaNumber: test.temaNumber,
      totalQuestions: test.totalQuestions,
      answeredCount,
      isCompleted: test.isCompleted ?? false,
      questions: questionsResult.map(q => ({
        questionOrder: q.questionOrder,
        questionId: q.questionId,
        userAnswer: q.userAnswer,
        correctAnswer: q.correctAnswer,
        questionText: q.questionText,
      })),
    }
  } catch (error) {
    console.error('Error obteniendo datos para reanudar:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    }
  }
}
