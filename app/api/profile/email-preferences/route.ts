// app/api/profile/email-preferences/route.ts - API endpoint para preferencias de email
import { NextRequest, NextResponse } from 'next/server'
import {
  safeParseGetEmailPreferencesRequest,
  safeParseUpsertEmailPreferencesRequest,
  getEmailPreferences,
  upsertEmailPreferences
} from '@/lib/api/email-preferences'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ============================================
// GET: Obtener preferencias de email
// ============================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    // Validar request con Zod
    const parseResult = safeParseGetEmailPreferencesRequest({ userId })
    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, error: 'userId inválido o faltante' },
        { status: 400 }
      )
    }

    // Obtener preferencias
    const result = await getEmailPreferences(parseResult.data)

    if (!result.success) {
      return NextResponse.json(result, { status: 500 })
    }

    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache'
      }
    })

  } catch (error) {
    console.error('❌ [API/email-preferences] Error GET:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

// ============================================
// PUT: Actualizar preferencias de email
// ============================================

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()

    // Validar request con Zod
    const parseResult = safeParseUpsertEmailPreferencesRequest(body)
    if (!parseResult.success) {
      console.warn('⚠️ [API/email-preferences] Validación fallida:', parseResult.error.issues)
      return NextResponse.json(
        { success: false, error: 'Datos de preferencias inválidos', details: parseResult.error.issues },
        { status: 400 }
      )
    }

    // Actualizar preferencias
    const result = await upsertEmailPreferences(parseResult.data)

    if (!result.success) {
      return NextResponse.json(result, { status: 400 })
    }

    return NextResponse.json(result)

  } catch (error) {
    console.error('❌ [API/email-preferences] Error PUT:', error)
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
