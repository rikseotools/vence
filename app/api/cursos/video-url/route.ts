import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getVideoSignedUrl, safeParseGetVideoUrl } from '@/lib/api/video-courses'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

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
