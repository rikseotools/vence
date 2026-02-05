import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  saveVideoProgress,
  getVideoProgress,
  safeParseSaveProgress,
  safeParseGetProgress,
} from '@/lib/api/video-courses'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * POST /api/cursos/progress
 * Save or update video progress
 *
 * Body:
 * - lessonId: string (required)
 * - currentTimeSeconds: number (required)
 * - completed: boolean (optional, default false)
 */
export async function POST(request: NextRequest) {
  try {
    // Auth is required
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      )
    }

    const token = authHeader.split(' ')[1]
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Token inválido' },
        { status: 401 }
      )
    }

    const body = await request.json()

    // Validate request
    const parseResult = safeParseSaveProgress(body)
    if (!parseResult.success) {
      return NextResponse.json({
        success: false,
        error: 'Parámetros inválidos',
        details: parseResult.error.issues,
      }, { status: 400 })
    }

    const { lessonId, currentTimeSeconds, completed } = parseResult.data

    // Save progress
    const result = await saveVideoProgress(user.id, lessonId, currentTimeSeconds, completed)

    if (!result.success) {
      const status = result.error === 'Lección no encontrada' ? 404 : 500
      return NextResponse.json(result, { status })
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('❌ [API/progress] Unexpected error:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/cursos/progress?lessonId=xxx
 * Get progress for a specific lesson
 */
export async function GET(request: NextRequest) {
  try {
    // Auth is required
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      )
    }

    const token = authHeader.split(' ')[1]
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Token inválido' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const lessonId = searchParams.get('lessonId')

    // Validate request
    const parseResult = safeParseGetProgress({ lessonId })
    if (!parseResult.success) {
      return NextResponse.json({
        success: false,
        error: 'Parámetros inválidos',
        details: parseResult.error.issues,
      }, { status: 400 })
    }

    // Get progress
    const result = await getVideoProgress(user.id, parseResult.data.lessonId)

    if (!result.success) {
      return NextResponse.json(result, { status: 500 })
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('❌ [API/progress] Unexpected error:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
