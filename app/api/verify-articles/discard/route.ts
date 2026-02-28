import { NextRequest, NextResponse } from 'next/server'
import { discardParamsSchema } from '@/lib/api/verify-articles/schemas'
import { updateVerificationDiscard } from '@/lib/api/verify-articles/queries'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validation = discardParamsSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: `Datos inválidos: ${validation.error.errors.map(e => e.message).join(', ')}` },
        { status: 400 }
      )
    }

    const { questionId, discarded } = validation.data

    const result = await updateVerificationDiscard(questionId, discarded)

    return NextResponse.json({
      success: true,
      discarded,
      questionId,
      updated: result?.length || 0,
    })
  } catch (error) {
    console.error('Error actualizando estado de descarte:', error)
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    )
  }
}
