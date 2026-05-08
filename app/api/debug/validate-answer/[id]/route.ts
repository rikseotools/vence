// app/api/debug/validate-answer/[id]/route.ts
// Validación ligera de respuestas para la página /debug/question/[id].
// 🔒 NO devuelve correct_option al cargar — solo tras recibir la respuesta del usuario.
// NO guarda nada en BD (no es un test real). Sustituye al deprecado /api/answer.

import { NextResponse } from 'next/server'
import { getDb } from '@/db/client'
import { questions, psychometricQuestions } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { withErrorLogging } from '@/lib/api/withErrorLogging'

const LETTER_TO_INDEX: Record<string, number> = { a: 0, b: 1, c: 2, d: 3, e: 4 }

function normalizeAnswer(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isInteger(raw) && raw >= 0 && raw <= 4) {
    return raw
  }
  if (typeof raw === 'string') {
    const letter = raw.trim().toLowerCase()
    if (letter in LETTER_TO_INDEX) return LETTER_TO_INDEX[letter]
  }
  return null
}

async function _POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  if (!id) {
    return NextResponse.json(
      { success: false, error: 'Question ID required' },
      { status: 400 }
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { success: false, error: 'JSON inválido' },
      { status: 400 }
    )
  }

  const userAnswerRaw = (body as { userAnswer?: unknown })?.userAnswer
  const userAnswer = normalizeAnswer(userAnswerRaw)
  if (userAnswer === null) {
    return NextResponse.json(
      { success: false, error: 'userAnswer debe ser 0..4 o letra A-E' },
      { status: 400 }
    )
  }

  const db = getDb()

  // Buscar primero en questions (legislativas)
  const [legRow] = await db
    .select({
      correctOption: questions.correctOption,
      explanation: questions.explanation,
    })
    .from(questions)
    .where(eq(questions.id, id))
    .limit(1)

  if (legRow) {
    return NextResponse.json({
      success: true,
      isCorrect: legRow.correctOption === userAnswer,
      correctAnswer: legRow.correctOption,
      explanation: legRow.explanation,
    })
  }

  // Si no, buscar en psychometric_questions
  const [psyRow] = await db
    .select({
      correctOption: psychometricQuestions.correctOption,
      explanation: psychometricQuestions.explanation,
    })
    .from(psychometricQuestions)
    .where(eq(psychometricQuestions.id, id))
    .limit(1)

  if (psyRow) {
    return NextResponse.json({
      success: true,
      isCorrect: psyRow.correctOption === userAnswer,
      correctAnswer: psyRow.correctOption,
      explanation: psyRow.explanation,
    })
  }

  return NextResponse.json(
    { success: false, error: 'Pregunta no encontrada' },
    { status: 404 }
  )
}

export const POST = withErrorLogging('/api/debug/validate-answer/[id]', _POST)
