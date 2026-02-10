import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getOfficialExamResume } from '@/lib/api/official-exams'

// Client with service role - bypasses RLS for server operations
const getSupabaseAdmin = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

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
export async function GET(request: NextRequest) {
  console.log('🎯 [API/v2/official-exams/resume] Request received')

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
    const { data: { user }, error: authError } = await getSupabaseAdmin().auth.getUser(token)

    if (authError || !user) {
      console.error('❌ [API/v2/official-exams/resume] Auth error:', authError?.message)
      return NextResponse.json(
        { success: false, error: 'No autorizado - Token inválido' },
        { status: 401 }
      )
    }

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
      return NextResponse.json(
        { success: false, error: result.error },
        { status: result.error?.includes('acceso') ? 403 : 404 }
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
