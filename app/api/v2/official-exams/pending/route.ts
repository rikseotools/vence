import { NextRequest, NextResponse } from 'next/server'
import { getPendingOfficialExams } from '@/lib/api/official-exams'

import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { verifyAuth } from '@/lib/api/auth/verifyAuth'

/**
 * GET /api/v2/official-exams/pending?limit=10
 *
 * Get list of pending (incomplete) official exams for authenticated user.
 * Only returns exams that have at least one answer (actually started).
 *
 * Query params:
 * - limit: number (optional, default 10, max 50)
 *
 * Returns:
 * - success: boolean
 * - exams: array of { id, examDate, oposicion, totalQuestions, answeredCount, progress, createdAt }
 * - total: number
 * - error: string (if failed)
 */
async function _GET(request: NextRequest) {
  console.log('🎯 [API/v2/official-exams/pending] Request received')

  try {
    // 1. Verify authentication (wrapper Fase 0.7 — soporta off/shadow/on)
    const auth = await verifyAuth(request, '/api/v2/official-exams/pending')
    if (!auth.success) {
      return NextResponse.json(
        { success: false, error: auth.reason === 'no_bearer_token' ? 'No autorizado - Token requerido' : 'No autorizado - Token inválido' },
        { status: 401 }
      )
    }
    const user = { id: auth.userId, email: auth.email }

    console.log(`🔒 [API/v2/official-exams/pending] User authenticated: ${user.id}`)

    // 2. Get limit from query params
    const { searchParams } = new URL(request.url)
    const limitParam = searchParams.get('limit')
    const limit = limitParam ? Math.min(Math.max(1, parseInt(limitParam, 10)), 50) : 10

    // 3. Get pending exams
    const result = await getPendingOfficialExams(user.id, limit)

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      )
    }

    console.log(`✅ [API/v2/official-exams/pending] Found ${result.total} pending exams`)

    return NextResponse.json(result)
  } catch (error) {
    console.error('❌ [API/v2/official-exams/pending] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Error interno del servidor',
      },
      { status: 500 }
    )
  }
}

export const GET = withErrorLogging('/api/v2/official-exams/pending', _GET)
