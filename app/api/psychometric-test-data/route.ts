// app/api/psychometric-test-data/route.ts
// GET - Devuelve categorías psicotécnicas con secciones y conteos de preguntas

import { NextResponse } from 'next/server'
import { getPsychometricCategories } from '@/lib/api/psychometric-test-data'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const result = await getPsychometricCategories()

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
