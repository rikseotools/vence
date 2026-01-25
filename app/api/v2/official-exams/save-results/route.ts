import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  saveOfficialExamResults,
  safeParseSaveOfficialExamResults,
} from '@/lib/api/official-exams'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * POST /api/v2/official-exams/save-results
 *
 * Saves official exam results with proper validation and typing.
 * Uses Drizzle ORM for database operations.
 *
 * Request body:
 * - examDate: string (YYYY-MM-DD)
 * - oposicion: string
 * - results: array of question results
 * - totalTimeSeconds: number
 * - metadata: optional exam metadata
 *
 * Returns:
 * - success: boolean
 * - testId: string (if successful)
 * - questionsSaved: number (if successful)
 * - error: string (if failed)
 */
export async function POST(request: NextRequest) {
  console.log('🎯 [API/v2/official-exams/save-results] Request received')

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
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      console.error('❌ [API/v2/official-exams/save-results] Auth error:', authError?.message)
      return NextResponse.json(
        { success: false, error: 'No autorizado - Token inválido' },
        { status: 401 }
      )
    }

    console.log(`🔒 [API/v2/official-exams/save-results] User authenticated: ${user.id}`)

    // 2. Parse and validate request body
    const body = await request.json()
    const parseResult = safeParseSaveOfficialExamResults(body)

    if (!parseResult.success) {
      console.error('❌ [API/v2/official-exams/save-results] Validation error:', parseResult.error.issues)
      return NextResponse.json(
        {
          success: false,
          error: 'Datos de entrada inválidos',
          details: parseResult.error.issues.map(i => i.message),
        },
        { status: 400 }
      )
    }

    // 3. Save results using Drizzle
    const result = await saveOfficialExamResults(parseResult.data, user.id)

    if (!result.success) {
      return NextResponse.json(result, { status: 500 })
    }

    console.log(`✅ [API/v2/official-exams/save-results] Results saved: ${result.questionsSaved} questions`)

    return NextResponse.json(result)
  } catch (error) {
    console.error('❌ [API/v2/official-exams/save-results] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Error interno del servidor',
      },
      { status: 500 }
    )
  }
}
