// app/api/answer/psychometric/route.ts
// API para validar respuestas de preguntas psicotécnicas de forma segura
// La respuesta correcta SOLO se revela después de que el usuario responde

import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/db/client'
import { psychometricQuestions } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { z } from 'zod/v3'

// ============================================
// SCHEMAS DE VALIDACIÓN
// ============================================

const validatePsychometricRequestSchema = z.object({
  questionId: z.string().uuid('ID de pregunta inválido'),
  userAnswer: z.number().int().min(0).max(3).nullable() // 0=A, 1=B, 2=C, 3=D, null=sin respuesta
})

type ValidatePsychometricRequest = z.infer<typeof validatePsychometricRequestSchema>

interface ValidatePsychometricResponse {
  success: boolean
  isCorrect: boolean
  correctAnswer: number
  explanation: string | null
  solutionSteps: string | null
}

// ============================================
// FUNCIÓN DE VALIDACIÓN
// ============================================

async function validatePsychometricAnswer(
  params: ValidatePsychometricRequest
): Promise<ValidatePsychometricResponse> {
  try {
    const db = getDb()

    // Query para obtener la respuesta correcta
    const result = await db
      .select({
        correctOption: psychometricQuestions.correctOption,
        explanation: psychometricQuestions.explanation,
        solutionSteps: psychometricQuestions.solutionSteps
      })
      .from(psychometricQuestions)
      .where(eq(psychometricQuestions.id, params.questionId))
      .limit(1)

    const question = result[0]

    if (!question || question.correctOption === null) {
      console.error('❌ [API/answer/psychometric] Pregunta no encontrada:', params.questionId)
      return {
        success: false,
        isCorrect: false,
        correctAnswer: 0,
        explanation: null,
        solutionSteps: null
      }
    }

    // Si userAnswer es null, la respuesta es incorrecta (pregunta sin responder)
    const isCorrect = params.userAnswer !== null && params.userAnswer === question.correctOption

    console.log('✅ [API/answer/psychometric] Respuesta validada:', {
      questionId: params.questionId,
      userAnswer: params.userAnswer,
      correctAnswer: question.correctOption,
      isCorrect,
      wasUnanswered: params.userAnswer === null
    })

    return {
      success: true,
      isCorrect,
      correctAnswer: question.correctOption,
      explanation: question.explanation,
      solutionSteps: question.solutionSteps
    }

  } catch (error) {
    console.error('❌ [API/answer/psychometric] Error:', error)
    return {
      success: false,
      isCorrect: false,
      correctAnswer: 0,
      explanation: null,
      solutionSteps: null
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
    const validation = validatePsychometricRequestSchema.safeParse(body)

    if (!validation.success) {
      console.error('❌ [API/answer/psychometric] Validación fallida:', validation.error.flatten())
      return NextResponse.json(
        {
          success: false,
          error: 'Datos inválidos',
          details: validation.error.flatten()
        },
        { status: 400 }
      )
    }

    // Validar respuesta
    const result = await validatePsychometricAnswer(validation.data)

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Pregunta no encontrada',
          isCorrect: false,
          correctAnswer: 0
        },
        { status: 404 }
      )
    }

    return NextResponse.json(result)

  } catch (error) {
    console.error('❌ [API/answer/psychometric] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Error interno del servidor',
        isCorrect: false,
        correctAnswer: 0
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
