import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { safeParseInitOfficialExam, initOfficialExam } from '@/lib/api/official-exams'

// Client with service role - bypasses RLS for server operations
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

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
export async function POST(request: NextRequest) {
  console.log('🎯 [API/v2/official-exams/init] Request received')

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
      console.error('❌ [API/v2/official-exams/init] Auth error:', authError?.message)
      return NextResponse.json(
        { success: false, error: 'No autorizado - Token inválido' },
        { status: 401 }
      )
    }

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
