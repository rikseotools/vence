// app/api/exam/validate/route.ts
// API para validar todas las respuestas de un examen de forma segura
// La respuesta correcta SOLO se revela después de que el usuario envía sus respuestas
// 🔴 FIX: Ahora también marca el test como completado para evitar "exámenes fantasma"

import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/db/client'
import { questions, tests } from '@/db/schema'
import { inArray, eq } from 'drizzle-orm'
import { z } from 'zod/v3'

// ============================================
// SCHEMAS DE VALIDACIÓN
// ============================================

const examAnswerSchema = z.object({
  questionId: z.string().uuid('ID de pregunta inválido'),
  userAnswer: z.string().length(1).nullable() // 'a', 'b', 'c', 'd' o null
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

    // Consultar respuestas correctas de la BD
    const dbQuestions = await db
      .select({
        id: questions.id,
        correctOption: questions.correctOption,
        explanation: questions.explanation
      })
      .from(questions)
      .where(inArray(questions.id, questionIds))

    // Crear mapa de respuestas correctas
    const correctAnswersMap = new Map<string, { correct: number; explanation: string | null }>()
    for (const q of dbQuestions) {
      correctAnswersMap.set(q.id, {
        correct: q.correctOption,
        explanation: q.explanation
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

    // 🔴 FIX: Marcar test como completado ANTES de devolver la respuesta
    // Esto evita el bug de "exámenes fantasma" cuando el usuario navega fuera
    if (testId) {
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

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
export async function GET() {
  return NextResponse.json(
    { error: 'Método no permitido. Usa POST.' },
    { status: 405 }
  )
}
