import { NextResponse } from 'next/server'
import { getVideoCourses } from '@/lib/api/video-courses'

export const dynamic = 'force-dynamic'

/**
 * GET /api/cursos
 * Returns list of all active video courses
 */
export async function GET() {
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
