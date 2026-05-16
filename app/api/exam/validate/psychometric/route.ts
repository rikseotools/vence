// app/api/exam/validate/psychometric/route.ts
//
// Validación BATCH de respuestas psicotécnicas (corrección final de examen).
// Espejo de /api/exam/validate pero contra `psychometric_questions`.
//
// Acepta `userAnswer: number | null` (índice 0-4 o "en blanco"). Devuelve
// `correctAnswer` (letra) + `correctIndex` (número) + `explanation` para
// TODAS las preguntas, incluidas las que el usuario dejó en blanco. Esto
// arregla la asimetría con legislativas: antes, una psicotécnica sin
// respuesta no enseñaba la solución tras corregir.
//
// SECURITY: NO se ejecuta cuota diaria / device limit / rate limit anon.
// Es corrección de examen ya iniciado, no respuesta en vivo. Idéntico
// comportamiento a /api/exam/validate.

import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 60

import { getDb } from '@/db/client'
import { psychometricQuestions } from '@/db/schema'
import { inArray } from 'drizzle-orm'
import { z } from 'zod/v3'
import { withErrorLogging } from '@/lib/api/withErrorLogging'

const examAnswerSchema = z.object({
  questionId: z.string().uuid('ID de pregunta inválido'),
  userAnswer: z.number().int().min(0).max(4).nullable(), // 0-4 o null
})

const validateExamRequestSchema = z.object({
  answers: z.array(examAnswerSchema).min(1, 'Debe haber al menos una respuesta'),
})

type ExamAnswer = z.infer<typeof examAnswerSchema>

function indexToLetter(i: number): string {
  return String.fromCharCode(97 + i) // 0 → 'a', 1 → 'b', ...
}

async function validateAnswers(answers: ExamAnswer[]) {
  const db = getDb()

  const questionIds = answers.map((a) => a.questionId)

  const dbQuestions = await db
    .select({
      id: psychometricQuestions.id,
      correctOption: psychometricQuestions.correctOption,
      explanation: psychometricQuestions.explanation,
    })
    .from(psychometricQuestions)
    .where(inArray(psychometricQuestions.id, questionIds))

  const correctMap = new Map<string, { correct: number | null; explanation: string | null }>()
  for (const q of dbQuestions) {
    correctMap.set(q.id, { correct: q.correctOption, explanation: q.explanation })
  }

  const results: Array<{
    questionId: string
    userAnswer: number | null
    correctAnswer: string
    correctIndex: number
    isCorrect: boolean
    explanation: string | null
  }> = []

  let totalCorrect = 0
  let totalAnswered = 0

  for (const answer of answers) {
    const data = correctMap.get(answer.questionId)

    if (!data || data.correct === null) {
      results.push({
        questionId: answer.questionId,
        userAnswer: answer.userAnswer,
        correctAnswer: '?',
        correctIndex: -1,
        isCorrect: false,
        explanation: null,
      })
      continue
    }

    const correctIndex = data.correct
    const isCorrect = answer.userAnswer !== null && answer.userAnswer === correctIndex

    if (answer.userAnswer !== null) totalAnswered++
    if (isCorrect) totalCorrect++

    results.push({
      questionId: answer.questionId,
      userAnswer: answer.userAnswer,
      correctAnswer: indexToLetter(correctIndex),
      correctIndex,
      isCorrect,
      explanation: data.explanation,
    })
  }

  const totalQuestions = answers.length
  const percentage = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0

  console.log('✅ [API/exam/validate/psychometric] Validado:', {
    totalQuestions,
    totalAnswered,
    totalCorrect,
    percentage,
  })

  return {
    success: true as const,
    results,
    summary: {
      totalQuestions,
      totalAnswered,
      totalCorrect,
      totalIncorrect: totalQuestions - totalCorrect,
      percentage,
    },
  }
}

async function _POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = validateExamRequestSchema.safeParse(body)

    if (!parsed.success) {
      console.error(
        '❌ [API/exam/validate/psychometric] Validación fallida:',
        parsed.error.flatten(),
      )
      return NextResponse.json(
        { success: false, error: 'Datos inválidos', details: parsed.error.flatten() },
        { status: 400 },
      )
    }

    const result = await validateAnswers(parsed.data.answers)
    return NextResponse.json(result)
  } catch (error) {
    console.error('❌ [API/exam/validate/psychometric] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 },
    )
  }
}

async function _GET() {
  return NextResponse.json({ error: 'Método no permitido. Usa POST.' }, { status: 405 })
}

export const POST = withErrorLogging('/api/exam/validate/psychometric', _POST)
export const GET = withErrorLogging('/api/exam/validate/psychometric', _GET)
