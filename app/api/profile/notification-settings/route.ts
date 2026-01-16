// app/api/profile/notification-settings/route.ts - API endpoint para configuración de notificaciones
import { NextRequest, NextResponse } from 'next/server'
import {
  safeParseGetNotificationSettingsRequest,
  safeParseUpsertNotificationSettingsRequest,
  getNotificationSettings,
  upsertNotificationSettings
} from '@/lib/api/notification-settings'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ============================================
// GET: Obtener configuración de notificaciones
// ============================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    // Validar request con Zod
    const parseResult = safeParseGetNotificationSettingsRequest({ userId })
    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, error: 'userId inválido o faltante' },
        { status: 400 }
      )
    }

    // Obtener configuración
    const result = await getNotificationSettings(parseResult.data)

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
    console.error('❌ [API/notification-settings] Error GET:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

// ============================================
// PUT: Actualizar configuración de notificaciones
// ============================================

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()

    // Validar request con Zod
    const parseResult = safeParseUpsertNotificationSettingsRequest(body)
    if (!parseResult.success) {
      console.warn('⚠️ [API/notification-settings] Validación fallida:', parseResult.error.issues)
      return NextResponse.json(
        { success: false, error: 'Datos de configuración inválidos', details: parseResult.error.issues },
        { status: 400 }
      )
    }

    // Actualizar configuración
    const result = await upsertNotificationSettings(parseResult.data)

    if (!result.success) {
      return NextResponse.json(result, { status: 400 })
    }

    return NextResponse.json(result)

  } catch (error) {
    console.error('❌ [API/notification-settings] Error PUT:', error)
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
