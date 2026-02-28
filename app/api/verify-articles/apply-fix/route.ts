import { NextRequest, NextResponse } from 'next/server'
import { applyFixParamsSchema } from '@/lib/api/verify-articles/schemas'
import {
  getQuestionById,
  updateQuestion,
  markVerificationFixApplied,
} from '@/lib/api/verify-articles/queries'

const OPTION_MAP: Record<string, number> = { A: 0, B: 1, C: 2, D: 3 }
const OPTION_LETTERS = ['A', 'B', 'C', 'D'] as const

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validation = applyFixParamsSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: `Datos inválidos: ${validation.error.errors.map(e => e.message).join(', ')}` },
        { status: 400 }
      )
    }

    const { questionId, newCorrectOption, newExplanation, verificationId } = validation.data

    const currentQuestion = await getQuestionById(questionId)

    if (!currentQuestion) {
      return NextResponse.json(
        { success: false, error: 'Pregunta no encontrada' },
        { status: 404 }
      )
    }

    const updateData: { correctOption?: number; explanation?: string; updatedAt: string } = {
      updatedAt: new Date().toISOString(),
    }

    if (newCorrectOption) {
      const optionIndex = OPTION_MAP[newCorrectOption.toUpperCase()]
      if (optionIndex !== undefined) {
        updateData.correctOption = optionIndex
      }
    }

    if (newExplanation) {
      updateData.explanation = newExplanation
    }

    await updateQuestion(questionId, updateData)

    if (verificationId) {
      await markVerificationFixApplied(verificationId)
    }

    return NextResponse.json({
      success: true,
      message: 'Corrección aplicada correctamente',
      changes: {
        questionId,
        previousOption: OPTION_LETTERS[currentQuestion.correctOption],
        newOption: newCorrectOption || OPTION_LETTERS[currentQuestion.correctOption],
        explanationUpdated: !!newExplanation,
      },
    })
  } catch (error) {
    console.error('Error aplicando corrección:', error)
    return NextResponse.json(
      { success: false, error: 'Error aplicando corrección', details: (error as Error).message },
      { status: 500 }
    )
  }
}
