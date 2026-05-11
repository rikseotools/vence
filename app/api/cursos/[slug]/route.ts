import { NextRequest, NextResponse } from 'next/server'
import { getCourseBySlug, safeParseGetCourseBySlug } from '@/lib/api/video-courses'

import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { verifyAuthOptional } from '@/lib/api/auth/verifyAuth'
export const dynamic = 'force-dynamic'

/**
 * GET /api/cursos/[slug]
 * Returns course details with all lessons
 * Optionally includes user progress if authenticated
 */
async function _GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params

    // Validate slug
    const parseResult = safeParseGetCourseBySlug({ slug })
    if (!parseResult.success) {
      return NextResponse.json({
        success: false,
        error: 'Parámetros inválidos',
        details: parseResult.error.issues,
      }, { status: 400 })
    }

    // Auth opcional (wrapper Fase 0.7 — soporta off/shadow/on)
    const auth = await verifyAuthOptional(request, '/api/cursos/[slug]')
    const userId: string | null = auth?.userId ?? null

    // Get course with lessons and progress
    const result = await getCourseBySlug(slug, userId)

    if (!result.success) {
      const status = result.error === 'Curso no encontrado' ? 404 : 500
      return NextResponse.json(result, { status })
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('❌ [API/cursos/slug] Unexpected error:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

export const GET = withErrorLogging('/api/cursos/[slug]', _GET)
