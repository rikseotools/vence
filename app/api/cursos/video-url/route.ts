import { NextRequest, NextResponse } from 'next/server'
import { getVideoSignedUrl, safeParseGetVideoUrl } from '@/lib/api/video-courses'

import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { verifyAuth } from '@/lib/api/auth/verifyAuth'
export const dynamic = 'force-dynamic'

/**
 * POST /api/cursos/video-url
 * Returns a signed URL for video playback
 *
 * Body:
 * - lessonId: string (required)
 *
 * Returns:
 * - signedUrl: string (URL valid for 1 hour)
 * - previewOnly: boolean (true if user is not premium)
 * - previewSeconds: number (max seconds allowed for preview)
 */
async function _POST(request: NextRequest) {
  try {
    // Auth required (wrapper Fase 0.7 — soporta off/shadow/on)
    const auth = await verifyAuth(request, '/api/cursos/video-url')
    if (!auth.success) {
      return NextResponse.json(
        { success: false, error: auth.reason === 'no_bearer_token' ? 'No autorizado' : 'Token inválido' },
        { status: 401 }
      )
    }
    const user = { id: auth.userId, email: auth.email }

    const body = await request.json()

    // Validate request
    const parseResult = safeParseGetVideoUrl(body)
    if (!parseResult.success) {
      return NextResponse.json({
        success: false,
        error: 'Parámetros inválidos',
        details: parseResult.error.issues,
      }, { status: 400 })
    }

    const { lessonId } = parseResult.data

    // Get signed URL
    const result = await getVideoSignedUrl(lessonId, user.id)

    if (!result.success) {
      const status = result.error === 'Lección no encontrada' ? 404 : 500
      return NextResponse.json(result, { status })
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('❌ [API/video-url] Unexpected error:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

export const POST = withErrorLogging('/api/cursos/video-url', _POST)
