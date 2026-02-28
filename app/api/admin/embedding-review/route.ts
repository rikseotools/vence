// app/api/admin/embedding-review/route.ts
// API para revisión de preguntas marcadas por embedding similarity
import { NextResponse } from 'next/server'
import { getFlaggedQuestions, markCorrect, markNeedsReview } from '@/lib/api/admin-embedding-review'
import { embeddingReviewActionSchema } from '@/lib/api/admin-embedding-review/schemas'

export async function GET() {
  try {
    const result = await getFlaggedQuestions()

    return NextResponse.json({
      success: true,
      questions: result.questions,
      stats: result.stats,
    })
  } catch (error) {
    console.error('❌ [API/admin/embedding-review] Error:', error)
    return NextResponse.json({ success: false, error: (error as Error).message })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const parsed = embeddingReviewActionSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ success: false, error: 'Faltan parámetros' })
    }

    const { questionId, action } = parsed.data

    if (action === 'mark_correct') {
      await markCorrect(questionId)
      return NextResponse.json({ success: true, message: 'Marcado como correcto' })
    } else if (action === 'needs_llm_review') {
      await markNeedsReview(questionId)
      return NextResponse.json({ success: true, message: 'Marcado para revisión LLM' })
    }

    return NextResponse.json({ success: false, error: 'Acción no válida' })
  } catch (error) {
    console.error('❌ [API/admin/embedding-review] Error:', error)
    return NextResponse.json({ success: false, error: (error as Error).message })
  }
}
