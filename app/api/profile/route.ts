// app/api/profile/route.ts - API endpoint para perfil de usuario
import { NextRequest, NextResponse } from 'next/server'
import {
  safeParseGetProfileRequest,
  safeParseUpdateProfileRequest,
  getProfile,
  updateProfile
} from '@/lib/api/profile'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ============================================
// GET: Obtener perfil de usuario
// ============================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    // Validar request con Zod
    const parseResult = safeParseGetProfileRequest({ userId })
    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, error: 'userId inválido o faltante' },
        { status: 400 }
      )
    }

    // Obtener perfil
    const result = await getProfile(parseResult.data)

    if (!result.success) {
      return NextResponse.json(result, { status: 404 })
    }

    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache'
      }
    })

  } catch (error) {
    console.error('❌ [API/profile] Error GET:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

// ============================================
// PUT: Actualizar perfil de usuario
// ============================================

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()

    // Validar request con Zod
    const parseResult = safeParseUpdateProfileRequest(body)
    if (!parseResult.success) {
      console.warn('⚠️ [API/profile] Validación fallida:', parseResult.error.issues)
      return NextResponse.json(
        { success: false, error: 'Datos de perfil inválidos', details: parseResult.error.issues },
        { status: 400 }
      )
    }

    // Actualizar perfil
    const result = await updateProfile(parseResult.data)

    if (!result.success) {
      return NextResponse.json(result, { status: 400 })
    }

    return NextResponse.json(result)

  } catch (error) {
    console.error('❌ [API/profile] Error PUT:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

// ============================================
// OPTIONS: CORS preflight
// ============================================

export async function OPTIONS() {
  return NextResponse.json({}, {
    headers: {
      'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  })
}
