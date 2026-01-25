import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getPendingOfficialExams } from '@/lib/api/official-exams'

// Client with service role - bypasses RLS for server operations
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

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
export async function GET(request: NextRequest) {
  console.log('🎯 [API/v2/official-exams/pending] Request received')

  try {
    // 1. Verify authentication
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'No autorizado - Token requerido' },
        { status: 401 }
      )
    }

    const token = authHeader.split(' ')[1]
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)

    if (authError || !user) {
      console.error('❌ [API/v2/official-exams/pending] Auth error:', authError?.message)
      return NextResponse.json(
        { success: false, error: 'No autorizado - Token inválido' },
        { status: 401 }
      )
    }

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
