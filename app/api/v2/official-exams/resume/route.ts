import { NextRequest, NextResponse } from 'next/server'
import { getOfficialExamResume } from '@/lib/api/official-exams'

import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { verifyAuth } from '@/lib/api/auth/verifyAuth'

/**
 * GET /api/v2/official-exams/resume?testId=xxx
 *
 * Get official exam data for resuming.
 * Returns questions (WITHOUT correct_option for security) and saved answers.
 *
 * Query params:
 * - testId: string (UUID)
 *
 * Returns:
 * - success: boolean
 * - testId: string
 * - questions: array of questions (without correct_option)
 * - savedAnswers: { "0": "a", "3": "c", ... } (0-indexed)
 * - metadata: { examDate, oposicion, totalQuestions, answeredCount, ... }
 * - error: string (if failed)
 *
 * SECURITY:
 * - Requires authentication
 * - Verifies user owns the test
 * - Does NOT return correct_option - validation via /api/exam/validate
 */
async function _GET(request: NextRequest) {
  console.log('🎯 [API/v2/official-exams/resume] Request received')

  try {
    // 1. Verify authentication (wrapper Fase 0.7 — soporta off/shadow/on)
    const auth = await verifyAuth(request, '/api/v2/official-exams/resume')
    if (!auth.success) {
      return NextResponse.json(
        { success: false, error: auth.reason === 'no_bearer_token' ? 'No autorizado - Token requerido' : 'No autorizado - Token inválido' },
        { status: 401 }
      )
    }
    const user = { id: auth.userId, email: auth.email }

    console.log(`🔒 [API/v2/official-exams/resume] User authenticated: ${user.id}`)

    // 2. Get testId from query params
    const { searchParams } = new URL(request.url)
    const testId = searchParams.get('testId')

    if (!testId) {
      return NextResponse.json(
        { success: false, error: 'testId es requerido' },
        { status: 400 }
      )
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(testId)) {
      return NextResponse.json(
        { success: false, error: 'testId inválido' },
        { status: 400 }
      )
    }

    // 3. Get resume data (with ownership verification)
    const result = await getOfficialExamResume(testId, user.id)

    if (!result.success) {
      const statusMap: Record<string, number> = {
        forbidden: 403,
        not_found: 404,
        completed: 409,
      }
      return NextResponse.json(
        { success: false, error: result.error, errorType: result.errorType },
        { status: statusMap[result.errorType ?? ''] ?? 400 }
      )
    }

    console.log(`✅ [API/v2/official-exams/resume] Loaded ${result.questions?.length} questions, ${result.metadata?.answeredCount} answered`)

    return NextResponse.json(result)
  } catch (error) {
    console.error('❌ [API/v2/official-exams/resume] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Error interno del servidor',
      },
      { status: 500 }
    )
  }
}

export const GET = withErrorLogging('/api/v2/official-exams/resume', _GET)
