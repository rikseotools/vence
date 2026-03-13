import { NextResponse } from 'next/server'
import { getVideoCourses } from '@/lib/api/video-courses'

import { withErrorLogging } from '@/lib/api/withErrorLogging'
export const dynamic = 'force-dynamic'

/**
 * GET /api/cursos
 * Returns list of all active video courses
 */
async function _GET() {
  try {
    const result = await getVideoCourses()

    if (!result.success) {
      return NextResponse.json(result, { status: 500 })
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('❌ [API/cursos] Unexpected error:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

export const GET = withErrorLogging('/api/cursos', _GET)
