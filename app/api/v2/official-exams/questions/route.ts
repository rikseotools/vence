import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  getOfficialExamQuestions,
  safeParseGetOfficialExamQuestions,
} from '@/lib/api/official-exams'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * GET /api/v2/official-exams/questions
 *
 * Query params:
 * - examDate: string (YYYY-MM-DD) - Required
 * - oposicion: string - Required (auxiliar-administrativo-estado, tramitacion-procesal, auxilio-judicial)
 * - parte: string - Optional (primera, segunda)
 * - includeReservas: boolean - Optional (default: true)
 *
 * Returns questions from both `questions` and `psychometric_questions` tables
 * SECURITY: Does NOT return correct_option - use /api/answer or /api/answer/psychometric to validate
 */
export async function GET(request: NextRequest) {
  console.log('🎯 [API/v2/official-exams/questions] Request received')

  try {
    // Auth verification (optional for now, but recommended)
    const authHeader = request.headers.get('authorization')
    let userId: string | null = null

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1]
      const { data: { user }, error: authError } = await supabase.auth.getUser(token)

      if (!authError && user) {
        userId = user.id
        console.log(`🔒 [API/v2/official-exams/questions] Authenticated user: ${userId}`)
      }
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const examDate = searchParams.get('examDate')
    const oposicion = searchParams.get('oposicion')
    const parte = searchParams.get('parte')
    const includeReservas = searchParams.get('includeReservas') !== 'false'

    // Validate request
    const parseResult = safeParseGetOfficialExamQuestions({
      examDate,
      oposicion,
      parte: parte || undefined,
      includeReservas,
    })

    if (!parseResult.success) {
      console.log('❌ [API/v2/official-exams/questions] Validation failed:', parseResult.error.issues)
      return NextResponse.json({
        success: false,
        error: 'Parámetros inválidos',
        details: parseResult.error.issues.map(e => ({
          field: e.path.join('.'),
          message: e.message,
        })),
      }, { status: 400 })
    }

    // Execute query
    const result = await getOfficialExamQuestions(parseResult.data)

    if (!result.success) {
      return NextResponse.json(result, { status: 500 })
    }

    console.log(`✅ [API/v2/official-exams/questions] Returning ${result.questions?.length || 0} questions`)

    return NextResponse.json(result)

  } catch (error) {
    console.error('❌ [API/v2/official-exams/questions] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
