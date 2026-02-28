// lib/api/exam/queries.ts - Queries tipadas para el módulo de exámenes
import { getDb } from '@/db/client'
import { testQuestions, tests, questions, userProfiles } from '@/db/schema'
import { eq, and, desc, sql, count, isNull, inArray } from 'drizzle-orm'
import { resolveTemaByArticle, resolveTemasBatchByQuestionIds } from '@/lib/api/tema-resolver'
import type { OposicionId } from '@/lib/api/tema-resolver'
import { ALL_OPOSICION_IDS } from '@/lib/config/oposiciones'
import type {
  SaveAnswerRequest,
  SaveAnswerResponse,
  GetExamProgressResponse,
  GetPendingExamsResponse,
  CompleteExamResponse,
} from './schemas'

// ============================================
// OBTENER OPOSICIÓN DEL USUARIO
// ============================================

/**
 * Obtiene el target_oposicion del usuario desde user_profiles
 * Retorna el valor o 'auxiliar_administrativo_estado' como default
 */
async function getUserOposicion(userId: string): Promise<OposicionId> {
  try {
    const db = getDb()

    const result = await db
      .select({ targetOposicion: userProfiles.targetOposicion })
      .from(userProfiles)
      .where(eq(userProfiles.id, userId))
      .limit(1)

    const oposicion = result[0]?.targetOposicion

    // Validar que sea una oposición conocida (desde config central)
    if (oposicion && ALL_OPOSICION_IDS.includes(oposicion)) {
      return oposicion as OposicionId
    }

    return 'auxiliar_administrativo_estado'
  } catch (error) {
    console.warn('⚠️ [getUserOposicion] Error obteniendo oposición:', error)
    return 'auxiliar_administrativo_estado'
  }
}

/**
 * Resuelve el tema_number para una pregunta usando el módulo centralizado
 */
async function resolveTemaForQuestion(
  questionId: string | null | undefined,
  articleId: string | null | undefined,
  oposicionId: OposicionId
): Promise<number | null> {
  if (!questionId && !articleId) return null

  try {
    const result = await resolveTemaByArticle({
      questionId: questionId || undefined,
      articleId: articleId || undefined,
      oposicionId,
    })

    if (result.success && result.temaNumber) {
      console.log(`🎯 [V2 TemaResolver] Tema resuelto: ${result.temaNumber} via ${result.resolvedVia}`)
      return result.temaNumber
    }

    return null
  } catch (error) {
    console.warn('⚠️ [V2 TemaResolver] Error resolviendo tema:', error)
    return null
  }
}

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
        correctAnswer: testQuestions.correctAnswer,
        temaNumber: testQuestions.temaNumber,
      })
      .from(testQuestions)
      .where(and(
        eq(testQuestions.testId, params.testId),
        eq(testQuestions.questionOrder, params.questionOrder)
      ))
      .limit(1)

    let answerId: string
    let correctAnswer = params.correctAnswer
    let temaNumber = params.temaNumber

    // Si no hay temaNumber, intentar resolverlo
    if (temaNumber == null && (params.questionId || params.articleId)) {
      // Obtener userId del test para determinar la oposición
      const testInfo = await db
        .select({ userId: tests.userId })
        .from(tests)
        .where(eq(tests.id, params.testId))
        .limit(1)

      if (testInfo[0]?.userId) {
        const oposicionId = await getUserOposicion(testInfo[0].userId)
        temaNumber = await resolveTemaForQuestion(params.questionId, params.articleId, oposicionId)
      }
    }

    if (existing.length > 0) {
      // Usar correctAnswer del registro existente si no se proporcionó
      if (!correctAnswer && existing[0].correctAnswer) {
        correctAnswer = existing[0].correctAnswer
      }

      // Usar temaNumber existente si no se resolvió uno nuevo
      if (temaNumber == null && existing[0].temaNumber != null) {
        temaNumber = existing[0].temaNumber
      }

      const isCorrect = correctAnswer
        ? params.userAnswer.toLowerCase() === correctAnswer.toLowerCase()
        : false

      // Actualizar respuesta existente (incluir temaNumber si se resolvió)
      const updateData: Record<string, unknown> = {
        userAnswer: params.userAnswer,
        isCorrect,
        timeSpentSeconds: params.timeSpentSeconds ?? 0,
        confidenceLevel: params.confidenceLevel,
      }

      // Solo actualizar temaNumber si estaba null y ahora tenemos uno
      if (existing[0].temaNumber == null && temaNumber != null) {
        updateData.temaNumber = temaNumber
        console.log(`📝 [saveAnswer] Actualizando temaNumber a ${temaNumber} para pregunta existente`)
      }

      await db
        .update(testQuestions)
        .set(updateData)
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
      // Si no tenemos correctAnswer, intentar obtenerlo de la BD
      // Esto maneja la condición de carrera donde el usuario responde antes de que /api/exam/init complete
      if (!correctAnswer && params.questionId) {
        console.log(`🔍 [saveAnswer] Pregunta no existe en test_questions, obteniendo correctAnswer de BD para ${params.questionId}`)
        const questionResult = await db
          .select({ correctOption: questions.correctOption })
          .from(questions)
          .where(eq(questions.id, params.questionId))
          .limit(1)

        if (questionResult[0]?.correctOption != null) {
          const optionMap: Record<number, string> = { 0: 'a', 1: 'b', 2: 'c', 3: 'd' }
          correctAnswer = optionMap[questionResult[0].correctOption]
          console.log(`✅ [saveAnswer] correctAnswer obtenido de BD: ${correctAnswer}`)
        }
      }

      // Si aún no tenemos correctAnswer, no podemos continuar
      if (!correctAnswer) {
        console.error(`❌ [saveAnswer] No se pudo obtener correctAnswer para questionId=${params.questionId}`)
        return {
          success: false,
          error: 'correctAnswer es requerido para nuevas preguntas',
        }
      }

      const isCorrect = params.userAnswer.toLowerCase() === correctAnswer.toLowerCase()

      // Insertar o actualizar respuesta (UPSERT para manejar race conditions con /api/exam/init)
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
          temaNumber: temaNumber,
          difficulty: params.difficulty,
          timeSpentSeconds: params.timeSpentSeconds ?? 0,
          confidenceLevel: params.confidenceLevel,
        })
        .onConflictDoUpdate({
          target: [testQuestions.testId, testQuestions.questionOrder],
          set: {
            userAnswer: params.userAnswer,
            isCorrect,
            timeSpentSeconds: params.timeSpentSeconds ?? 0,
            confidenceLevel: params.confidenceLevel,
          },
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

    // 🔴 FIX: Calcular fecha límite (7 días atrás)
    // Exámenes más antiguos se consideran "abandonados" y no se muestran
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    // Construir condiciones
    // FIX: También verificar completed_at IS NULL para evitar mostrar tests
    // que ya finalizaron pero tienen is_completed=false (finalizados incompletos)
    const conditions = [
      eq(tests.userId, userId),
      eq(tests.isCompleted, false),
      isNull(tests.completedAt),
      // 🔴 FIX: Solo mostrar exámenes de los últimos 7 días
      sql`${tests.createdAt} > ${sevenDaysAgo.toISOString()}`,
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
  questionsData: InitExamQuestion[]
): Promise<InitExamResponse> {
  try {
    const db = getDb()

    // Obtener userId del test para resolver temas
    const testInfo = await db
      .select({ userId: tests.userId })
      .from(tests)
      .where(eq(tests.id, testId))
      .limit(1)

    const userId = testInfo[0]?.userId
    let oposicionId: OposicionId = 'auxiliar_administrativo_estado'

    if (userId) {
      oposicionId = await getUserOposicion(userId)
    }

    // Identificar questionIds sin temaNumber que necesitan resolución
    const questionIdsNeedingTema = questionsData
      .filter(q => q.temaNumber == null && q.questionId)
      .map(q => q.questionId)

    // OPTIMIZADO: Resolver todos los temas en UN SOLO query SQL
    let resolvedTemas = new Map<string, number>()
    if (questionIdsNeedingTema.length > 0 && userId) {
      console.log(`🔍 [initExamQuestions] Resolviendo ${questionIdsNeedingTema.length} temas en batch...`)
      resolvedTemas = await resolveTemasBatchByQuestionIds(questionIdsNeedingTema, oposicionId)
    }

    // Preparar datos para inserción batch, usando temas resueltos
    const values = questionsData.map(q => {
      let temaNumber = q.temaNumber
      if (temaNumber == null && q.questionId && resolvedTemas.has(q.questionId)) {
        temaNumber = resolvedTemas.get(q.questionId) ?? null
      }

      return {
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
        temaNumber,
        difficulty: q.difficulty,
        timeSpentSeconds: 0,
      }
    })

    // Insertar todas las preguntas
    await db.insert(testQuestions).values(values)

    return {
      success: true,
      savedCount: questionsData.length,
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

// ============================================
// OBTENER CORRECT_OPTION DE PREGUNTAS DESDE BD
// ============================================

export type QuestionCorrectAnswer = {
  id: string
  correctOption: number
}

export async function getQuestionsCorrectAnswers(
  questionIds: string[]
): Promise<Map<string, string>> {
  try {
    const db = getDb()

    if (questionIds.length === 0) {
      return new Map()
    }

    // Filtrar IDs válidos (UUIDs)
    const validIds = questionIds.filter(id =>
      id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
    )

    if (validIds.length === 0) {
      return new Map()
    }

    // Consultar la BD para obtener correct_option
    const result = await db
      .select({
        id: questions.id,
        correctOption: questions.correctOption,
      })
      .from(questions)
      .where(inArray(questions.id, validIds))

    // Crear mapa de id -> letra correcta (a, b, c, d)
    const correctAnswersMap = new Map<string, string>()
    for (const q of result) {
      // Convertir índice (0, 1, 2, 3) a letra (a, b, c, d)
      const correctLetter = String.fromCharCode(97 + q.correctOption)
      correctAnswersMap.set(q.id, correctLetter)
    }

    console.log(`✅ [getQuestionsCorrectAnswers] Obtenidas ${correctAnswersMap.size} respuestas correctas de BD`)

    return correctAnswersMap
  } catch (error) {
    console.error('❌ [getQuestionsCorrectAnswers] Error:', error)
    return new Map()
  }
}
