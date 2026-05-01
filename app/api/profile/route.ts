// app/api/profile/route.ts - API endpoint para perfil de usuario
import { NextRequest, NextResponse } from 'next/server'
import {
  safeParseGetProfileRequest,
  safeParseUpdateProfileRequest,
  getProfile,
  updateProfile
} from '@/lib/api/profile'
import { getAuthenticatedUser, isAdminEmail } from '@/lib/api/shared/auth'

import { withErrorLogging } from '@/lib/api/withErrorLogging'
export const dynamic = 'force-dynamic'
export const revalidate = 0

// ============================================
// SHADOW-MODE AUTH CHECK (paso 3/7)
// ============================================
// Sólo loguea. NO bloquea. Permite identificar callers sin Bearer y posibles
// IDOR antes de activar el enforcement (paso 5). Envuelto en try/catch para
// que ningún fallo del auth pueda romper el endpoint.

async function shadowAuthCheck(
  request: NextRequest,
  requestedUserId: string,
  opType: 'GET' | 'PUT'
): Promise<void> {
  try {
    const auth = await getAuthenticatedUser(request)
    if (!auth.ok) {
      console.warn(`🔍 [shadow] /api/profile ${opType} sin auth válido`, {
        requestedUserId,
        ua: request.headers.get('user-agent')?.slice(0, 100) ?? 'unknown',
      })
      return
    }
    if (auth.user.id !== requestedUserId && !isAdminEmail(auth.user.email)) {
      console.warn(`🔍 [shadow] /api/profile ${opType} IDOR potencial`, {
        sessionUserId: auth.user.id,
        sessionEmail: auth.user.email,
        requestedUserId,
      })
    }
    // Caso correcto: caller autenticado y dueño (o admin) — silencio.
  } catch (err) {
    // Nunca dejar que el shadow check rompa el endpoint
    console.warn('🔍 [shadow] excepción en auth check:', err)
  }
}

// ============================================
// GET: Obtener perfil de usuario
// ============================================

async function _GET(request: NextRequest) {
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

    // Shadow-mode auth check (paso 3/7) — sólo loguea, no bloquea
    await shadowAuthCheck(request, parseResult.data.userId, 'GET')

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

async function _PUT(request: NextRequest) {
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

    // Shadow-mode auth check (paso 3/7) — sólo loguea, no bloquea
    await shadowAuthCheck(request, parseResult.data.userId, 'PUT')

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

export const GET = withErrorLogging('/api/profile', _GET)
export const PUT = withErrorLogging('/api/profile', _PUT)
