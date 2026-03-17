// app/api/psychometric-test-data/route.ts
// GET - Devuelve categorías psicotécnicas con secciones y conteos de preguntas

import { NextRequest, NextResponse } from 'next/server'
import { getPsychometricCategories } from '@/lib/api/psychometric-test-data'

import { withErrorLogging } from '@/lib/api/withErrorLogging'
export const dynamic = 'force-dynamic'

async function _GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId') || undefined

    const result = await getPsychometricCategories(userId)

    if (!result.success) {
      return NextResponse.json(result, { status: 500 })
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error en API /api/psychometric-test-data:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Error interno del servidor',
      },
      { status: 500 }
    )
  }
}

export const GET = withErrorLogging('/api/psychometric-test-data', _GET)
