// app/api/answer/psychometric/route.ts
// API unificada: validar respuesta + guardar + actualizar sesión
// Todo en una sola llamada para máxima fiabilidad en conexiones inestables (4G)

import { NextRequest, NextResponse } from 'next/server'
import {
  psychometricAnswerRequestSchema,
  validateAndSavePsychometricAnswer,
} from '@/lib/api/psychometric-answer'

// ============================================
// ENDPOINT POST
// ============================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validar request con Zod
    const validation = psychometricAnswerRequestSchema.safeParse(body)

    if (!validation.success) {
      console.error('❌ [API/psychometric-answer] Validación fallida:', validation.error.flatten())
      return NextResponse.json(
        {
          success: false,
          error: 'Datos inválidos',
          details: validation.error.flatten(),
        },
        { status: 400 }
      )
    }

    // Validar + guardar (todo en una operación)
    const result = await validateAndSavePsychometricAnswer(validation.data)

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
          isCorrect: false,
          correctAnswer: 0,
        },
        { status: 404 }
      )
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('❌ [API/psychometric-answer] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Error interno del servidor',
        isCorrect: false,
        correctAnswer: 0,
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
