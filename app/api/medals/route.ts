// app/api/medals/route.ts - API endpoint para medallas de ranking
import { NextRequest, NextResponse } from 'next/server'
import {
  safeParseGetMedalsRequest,
  safeParseCheckMedalsRequest,
  getUserMedals,
  checkAndSaveNewMedals,
} from '@/lib/api/medals'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ============================================
// GET: Obtener medallas del usuario
// ============================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    const parseResult = safeParseGetMedalsRequest({ userId })
    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, error: 'userId invalido o faltante' },
        { status: 400 }
      )
    }

    const result = await getUserMedals(parseResult.data.userId)

    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    })
  } catch (error) {
    console.error('❌ [API/medals] Error GET:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

// ============================================
// POST: Verificar y guardar medallas nuevas
// ============================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const parseResult = safeParseCheckMedalsRequest(body)
    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, error: 'userId invalido o faltante' },
        { status: 400 }
      )
    }

    const result = await checkAndSaveNewMedals(parseResult.data.userId)

    return NextResponse.json(result)
  } catch (error) {
    console.error('❌ [API/medals] Error POST:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
