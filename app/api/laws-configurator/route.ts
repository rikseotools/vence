// app/api/laws-configurator/route.ts - API endpoint para configurador de leyes
import { NextResponse } from 'next/server'
import { getAllLawsWithStats } from '@/lib/api/laws-configurator'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ============================================
// GET: Obtener todas las leyes con estadísticas
// ============================================

export async function GET() {
  try {
    const result = await getAllLawsWithStats()

    if (!result.success) {
      return NextResponse.json(result, { status: 500 })
    }

    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'public, max-age=300, stale-while-revalidate=600'
      }
    })

  } catch (error) {
    console.error('❌ [API/laws-configurator] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
