// app/api/exam/validate/route.ts
// API para validar todas las respuestas de un examen de forma segura
// La respuesta correcta SOLO se revela después de que el usuario envía sus respuestas
// 🔴 FIX: Ahora también marca el test como completado para evitar "exámenes fantasma"

import { NextRequest, NextResponse } from 'next/server'

// Exámenes batch pueden tener 100+ preguntas, dar tiempo suficiente
export const maxDuration = 60

import { getDb } from '@/db/client'
import { questions, tests, testQuestions } from '@/db/schema'
import { inArray, eq, sql } from 'drizzle-orm'
import { z } from 'zod/v3'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
// ============================================
// SCHEMAS DE VALIDACIÓN
// ============================================

const examAnswerSchema = z.object({
  questionId: z.string().uuid('ID de pregunta inválido'),
  userAnswer: z.string().length(1).nullable(), // 'a', 'b', 'c', 'd' o null
  // Campos de enriquecimiento OPCIONALES (additivos): el cliente los manda para
  // que validate persista las filas de test_questions en bloque (fiable) en vez
  // de depender de ~50 saves fire-and-forget durante el examen. Si no llegan, el
  // servidor rellena lo que puede desde la tabla questions.
  questionOrder: z.number().int().min(1).optional(),
  questionText: z.string().optional(),
  articleId: z.string().uuid().nullable().optional(),
  articleNumber: z.string().nullable().optional(),
  lawName: z.string().nullable().optional(),
  temaNumber: z.number().int().nullable().optional(),
  difficulty: z.string().nullable().optional(),
})

const validateExamRequestSchema = z.object({
  testId: z.string().uuid('ID de test inválido').optional(), // 🔴 FIX: Ahora acepta testId para marcar como completado
  answers: z.array(examAnswerSchema).min(1, 'Debe haber al menos una respuesta')
})

type ExamAnswer = z.infer<typeof examAnswerSchema>

// ============================================
// FUNCIÓN PARA MARCAR TEST COMO COMPLETADO
// ============================================

async function markTestAsCompleted(testId: string, score: number, totalQuestions: number) {
  try {
    const db = getDb()

    await db
      .update(tests)
      .set({
        isCompleted: true,
        completedAt: new Date().toISOString(),
        score: score.toString(),
        totalQuestions: totalQuestions
      })
      .where(eq(tests.id, testId))

    console.log('✅ [API/exam/validate] Test marcado como completado:', testId)
    return true
  } catch (error) {
    console.error('❌ [API/exam/validate] Error marcando test como completado:', error)
    return false
  }
}

// ============================================
// PERSISTENCIA EN BLOQUE DE test_questions
// ============================================
//
// Escribe TODAS las preguntas del examen (respondidas + en blanco) en una sola
// query UPSERT. Idempotente vía constraint (test_id, question_order): si los
// saves en tiempo real (resume) ya escribieron alguna fila, se actualiza.
//
// Robustez: si esto falla, se loguea pero NO se aborta validate — el usuario
// debe ver su nota igualmente (score/results vienen de memoria del servidor).
// La pérdida de filas degradaría solo el detalle por-pregunta de /revisar.
type ValidatedResult = {
  questionId: string
  userAnswer: string | null
  correctAnswer: string
  correctIndex: number
  isCorrect: boolean
}
type QuestionMeta = {
  correct: number
  explanation: string | null
  questionText: string
  difficulty: string | null
  primaryArticleId: string | null
}

async function persistExamQuestions(
  testId: string,
  answers: ExamAnswer[],
  results: ValidatedResult[],
  metaMap: Map<string, QuestionMeta>
): Promise<void> {
  try {
    const db = getDb()

    // userId del test (para poblar test_questions.user_id como hacen los saves directos)
    const testRow = await db
      .select({ userId: tests.userId })
      .from(tests)
      .where(eq(tests.id, testId))
      .limit(1)
    const userId = testRow[0]?.userId ?? null

    // Construir filas. Se omiten preguntas no encontradas en BD (correctIndex -1):
    // son edge-cases (preguntas retiradas) y no tienen metadatos válidos.
    const rows = results
      .map((r, i) => {
        if (r.correctIndex < 0) return null
        const meta = metaMap.get(r.questionId)
        if (!meta) return null
        // Campos de enriquecimiento del cliente (additivos); fallback al servidor.
        const clientAnswer = answers[i]
        const answered = r.userAnswer != null && r.userAnswer !== ''
        return {
          testId,
          userId,
          questionId: r.questionId,
          articleId: clientAnswer?.articleId ?? meta.primaryArticleId ?? null,
          questionOrder: clientAnswer?.questionOrder ?? i + 1,
          questionText: clientAnswer?.questionText || meta.questionText || '',
          userAnswer: r.userAnswer ?? '',
          correctAnswer: r.correctAnswer,
          isCorrect: r.isCorrect,
          articleNumber: clientAnswer?.articleNumber ?? null,
          lawName: clientAnswer?.lawName ?? null,
          temaNumber: clientAnswer?.temaNumber ?? null,
          difficulty: clientAnswer?.difficulty ?? meta.difficulty ?? null,
          wasBlank: !answered,
        }
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)

    if (rows.length === 0) return

    // UPSERT en bloque sobre la constraint única (test_id, question_order).
    await db
      .insert(testQuestions)
      .values(rows)
      .onConflictDoUpdate({
        target: [testQuestions.testId, testQuestions.questionOrder],
        set: {
          userAnswer: sql`excluded.user_answer`,
          correctAnswer: sql`excluded.correct_answer`,
          isCorrect: sql`excluded.is_correct`,
          wasBlank: sql`excluded.was_blank`,
        },
      })

    console.log(`✅ [API/exam/validate] ${rows.length} filas persistidas en test_questions (bulk) para test ${testId}`)
  } catch (error) {
    // No abortamos validate: el usuario debe ver su nota igualmente.
    console.error('❌ [API/exam/validate] Error persistiendo test_questions en bloque:', error)
  }
}

// ============================================
// FUNCIÓN DE VALIDACIÓN
// ============================================

async function validateExamAnswers(answers: ExamAnswer[], testId?: string) {
  try {
    const db = getDb()

    // Obtener IDs de preguntas
    const questionIds = answers
      .map(a => a.questionId)
      .filter((id): id is string => id !== null)

    if (questionIds.length === 0) {
      return {
        success: false,
        error: 'No hay preguntas válidas para validar'
      }
    }

    // Consultar respuestas correctas de la BD (+ campos core para persistir
    // test_questions de forma fiable en bloque al final del examen)
    const dbQuestions = await db
      .select({
        id: questions.id,
        correctOption: questions.correctOption,
        explanation: questions.explanation,
        questionText: questions.questionText,
        difficulty: questions.difficulty,
        primaryArticleId: questions.primaryArticleId
      })
      .from(questions)
      .where(inArray(questions.id, questionIds))

    // Crear mapa de respuestas correctas (+ metadatos core de cada pregunta)
    const correctAnswersMap = new Map<string, {
      correct: number
      explanation: string | null
      questionText: string
      difficulty: string | null
      primaryArticleId: string | null
    }>()
    for (const q of dbQuestions) {
      correctAnswersMap.set(q.id, {
        correct: q.correctOption,
        explanation: q.explanation,
        questionText: q.questionText,
        difficulty: q.difficulty,
        primaryArticleId: q.primaryArticleId
      })
    }

    // Validar cada respuesta
    const results: Array<{
      questionId: string
      userAnswer: string | null
      correctAnswer: string
      correctIndex: number
      isCorrect: boolean
      explanation: string | null
    }> = []

    let totalCorrect = 0
    let totalAnswered = 0

    for (const answer of answers) {
      const questionData = correctAnswersMap.get(answer.questionId)

      if (!questionData) {
        // Pregunta no encontrada - marcar como incorrecta
        results.push({
          questionId: answer.questionId,
          userAnswer: answer.userAnswer,
          correctAnswer: '?',
          correctIndex: -1,
          isCorrect: false,
          explanation: null
        })
        continue
      }

      const correctIndex = questionData.correct
      const correctLetter = String.fromCharCode(97 + correctIndex) // 0='a', 1='b', etc.
      const isCorrect = answer.userAnswer?.toLowerCase() === correctLetter

      if (answer.userAnswer) {
        totalAnswered++
      }

      if (isCorrect) {
        totalCorrect++
      }

      results.push({
        questionId: answer.questionId,
        userAnswer: answer.userAnswer,
        correctAnswer: correctLetter,
        correctIndex: correctIndex,
        isCorrect,
        explanation: questionData.explanation
      })
    }

    const totalQuestions = answers.length
    const percentage = totalQuestions > 0
      ? Math.round((totalCorrect / totalQuestions) * 100)
      : 0

    console.log('✅ [API/exam/validate] Examen validado:', {
      totalQuestions,
      totalAnswered,
      totalCorrect,
      percentage,
      testId: testId || 'no proporcionado'
    })

    // 🔴 Persistencia autoritativa: validate recibe TODAS las respuestas de una
    // vez, así que escribe las filas de test_questions en bloque (1 query) en vez
    // de depender de ~50 saves fire-and-forget durante el examen (poco fiables
    // bajo carga → filas perdidas, bug 30/40 exámenes 08/06). markTestAsCompleted
    // fija score/total DESPUÉS, con la vista completa.
    if (testId) {
      await persistExamQuestions(testId, answers, results, correctAnswersMap)

      const completed = await markTestAsCompleted(testId, totalCorrect, totalQuestions)
      if (!completed) {
        console.warn('⚠️ [API/exam/validate] No se pudo marcar el test como completado, pero continuamos')
      }
    }

    return {
      success: true,
      results,
      summary: {
        totalQuestions,
        totalAnswered,
        totalCorrect,
        totalIncorrect: totalQuestions - totalCorrect,
        percentage
      }
    }

  } catch (error) {
    console.error('❌ [API/exam/validate] Error:', error)
return {
      success: false,
      error: 'Error interno validando examen'
    }
  }
}

// ============================================
// ENDPOINT POST
// ============================================

async function _POST(request: NextRequest) {
  const startTime = Date.now()
  let body: Record<string, unknown> | undefined

  try {
    body = await request.json()

    // Validar request con Zod
    const validation = validateExamRequestSchema.safeParse(body)

    if (!validation.success) {
      console.error('❌ [API/exam/validate] Validación fallida:', validation.error.flatten())
return NextResponse.json(
        {
          success: false,
          error: 'Datos inválidos',
          details: validation.error.flatten()
        },
        { status: 400 }
      )
    }

    // Validar examen y marcar como completado si se proporcionó testId
    const result = await validateExamAnswers(validation.data.answers, validation.data.testId)

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error
        },
        { status: 400 }
      )
    }

    return NextResponse.json(result)

  } catch (error) {
    console.error('❌ [API/exam/validate] Error:', error)
return NextResponse.json(
      {
        success: false,
        error: 'Error interno del servidor'
      },
      { status: 500 }
    )
  }
}

// Bloquear GET para evitar exposición accidental
async function _GET() {
  return NextResponse.json(
    { error: 'Método no permitido. Usa POST.' },
    { status: 405 }
  )
}

export const POST = withErrorLogging('/api/exam/validate', _POST)
export const GET = withErrorLogging('/api/exam/validate', _GET)
