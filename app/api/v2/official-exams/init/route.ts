import { NextRequest, NextResponse } from 'next/server'
import { safeParseInitOfficialExam, initOfficialExam } from '@/lib/api/official-exams'

import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { verifyAuth } from '@/lib/api/auth/verifyAuth'

/**
 * POST /api/v2/official-exams/init
 *
 * Initialize an official exam session for resume functionality.
 * Creates test record and saves all questions with correct_option from DB.
 *
 * Request body:
 * - examDate: string (YYYY-MM-DD)
 * - oposicion: string
 * - questions: array of questions with questionType, id, questionOrder, etc.
 * - metadata: optional { legislativeCount, psychometricCount, reservaCount }
 *
 * Returns:
 * - success: boolean
 * - testId: string (if successful)
 * - savedCount: number (if successful)
 * - error: string (if failed)
 */
async function _POST(request: NextRequest) {
  console.log('🎯 [API/v2/official-exams/init] Request received')

  try {
    // 1. Verify authentication (wrapper Fase 0.7 — soporta off/shadow/on)
    const auth = await verifyAuth(request, '/api/v2/official-exams/init')
    if (!auth.success) {
      return NextResponse.json(
        { success: false, error: auth.reason === 'no_bearer_token' ? 'No autorizado - Token requerido' : 'No autorizado - Token inválido' },
        { status: 401 }
      )
    }
    const user = { id: auth.userId, email: auth.email }

    console.log(`🔒 [API/v2/official-exams/init] User authenticated: ${user.id}`)

    // 2. Parse and validate request body
    const body = await request.json()
    const parseResult = safeParseInitOfficialExam(body)

    if (!parseResult.success) {
      console.error('❌ [API/v2/official-exams/init] Validation error:', parseResult.error.issues)
      return NextResponse.json(
        {
          success: false,
          error: 'Datos de entrada inválidos',
          details: parseResult.error.issues.map(i => i.message),
        },
        { status: 400 }
      )
    }

    // 3. Initialize exam session
    const result = await initOfficialExam(parseResult.data, user.id)

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      )
    }

    console.log(`✅ [API/v2/official-exams/init] Session created: ${result.testId}, ${result.savedCount} questions`)

    return NextResponse.json({
      success: true,
      testId: result.testId,
      savedCount: result.savedCount,
    })
  } catch (error) {
    console.error('❌ [API/v2/official-exams/init] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Error interno del servidor',
      },
      { status: 500 }
    )
  }
}

export const POST = withErrorLogging('/api/v2/official-exams/init', _POST)
