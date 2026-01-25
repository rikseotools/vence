import { NextRequest, NextResponse } from 'next/server'
import { safeParseSaveOfficialExamAnswer, saveOfficialExamAnswer } from '@/lib/api/official-exams'

/**
 * POST /api/v2/official-exams/answer
 *
 * Save individual answer during official exam (auto-save).
 * Updates test_questions where test_id and question_order match.
 *
 * Request body:
 * - testId: string (UUID)
 * - questionOrder: number (1-indexed)
 * - userAnswer: string ('a', 'b', 'c', or 'd')
 *
 * Returns:
 * - success: boolean
 * - answerId: string (if successful)
 * - error: string (if failed)
 *
 * Note: This endpoint does NOT require authentication to minimize latency.
 * Security is ensured by requiring a valid testId (UUID) that was created
 * via the authenticated /init endpoint.
 */
export async function POST(request: NextRequest) {
  try {
    // Parse and validate request body
    const body = await request.json()
    const parseResult = safeParseSaveOfficialExamAnswer(body)

    if (!parseResult.success) {
      console.error('❌ [API/v2/official-exams/answer] Validation error:', parseResult.error.issues)
      return NextResponse.json(
        {
          success: false,
          error: 'Datos de entrada inválidos',
          details: parseResult.error.issues.map(i => i.message),
        },
        { status: 400 }
      )
    }

    // Save the answer
    const result = await saveOfficialExamAnswer(parseResult.data)

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      answerId: result.answerId,
    })
  } catch (error) {
    console.error('❌ [API/v2/official-exams/answer] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Error interno del servidor',
      },
      { status: 500 }
    )
  }
}
