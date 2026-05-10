import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  saveVideoProgress,
  getVideoProgress,
  safeParseSaveProgress,
  safeParseGetProgress,
} from '@/lib/api/video-courses'

import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { withDbTimeout, isDbTimeoutError } from '@/lib/db/timeout'

export const dynamic = 'force-dynamic'

const getSupabase = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Quick-fail timeouts (Phase 3): si el pooler parpadea, devolver 503 en
// vez de mantener el lambda 30s. Reads más permisivos que writes.
const READ_TIMEOUT_MS = 8000
const WRITE_TIMEOUT_MS = 12000  // los UPSERTs son escrituras + lookup

function timeoutResponse() {
  return NextResponse.json(
    { success: false, error: 'Servicio saturado momentáneamente. Reintenta en 5 minutos.', retryable: true },
    { status: 503, headers: { 'Retry-After': '300' } },
  )
}

/**
 * POST /api/cursos/progress
 * Save or update video progress
 *
 * Body:
 * - lessonId: string (required)
 * - currentTimeSeconds: number (required)
 * - completed: boolean (optional, default false)
 */
async function _POST(request: NextRequest) {
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
    const { data: { user }, error: authError } = await getSupabase().auth.getUser(token)

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
    const result = await withDbTimeout(
      () => saveVideoProgress(user.id, lessonId, currentTimeSeconds, completed),
      WRITE_TIMEOUT_MS,
    )

    if (!result.success) {
      const status = result.error === 'Lección no encontrada' ? 404 : 500
      return NextResponse.json(result, { status })
    }

    return NextResponse.json(result)
  } catch (error) {
    if (isDbTimeoutError(error)) {
      console.warn('⏱️ [API/progress POST] Timeout (quick-fail):', error.timeoutMs, 'ms')
      return timeoutResponse()
    }
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
async function _GET(request: NextRequest) {
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
    const { data: { user }, error: authError } = await getSupabase().auth.getUser(token)

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
    const result = await withDbTimeout(
      () => getVideoProgress(user.id, parseResult.data.lessonId),
      READ_TIMEOUT_MS,
    )

    if (!result.success) {
      return NextResponse.json(result, { status: 500 })
    }

    return NextResponse.json(result)
  } catch (error) {
    if (isDbTimeoutError(error)) {
      console.warn('⏱️ [API/progress GET] Timeout (quick-fail):', error.timeoutMs, 'ms')
      return timeoutResponse()
    }
    console.error('❌ [API/progress] Unexpected error:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

export const POST = withErrorLogging('/api/cursos/progress', _POST)
export const GET = withErrorLogging('/api/cursos/progress', _GET)
