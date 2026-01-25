import { NextRequest, NextResponse } from 'next/server'
import { getAvailableOfficialExams } from '@/lib/api/official-exams'

/**
 * GET /api/v2/official-exams/list
 *
 * Query params:
 * - oposicion: string - Optional filter by oposicion
 *
 * Returns list of available official exams
 */
export async function GET(request: NextRequest) {
  console.log('🎯 [API/v2/official-exams/list] Request received')

  try {
    const { searchParams } = new URL(request.url)
    const oposicion = searchParams.get('oposicion') || undefined

    const result = await getAvailableOfficialExams(oposicion)

    if (!result.success) {
      return NextResponse.json(result, { status: 500 })
    }

    console.log(`✅ [API/v2/official-exams/list] Returning ${result.exams?.length || 0} exams`)

    return NextResponse.json(result)

  } catch (error) {
    console.error('❌ [API/v2/official-exams/list] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
