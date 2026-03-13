// app/api/profile/test-favorites/route.ts - API endpoint para favoritos de test
// Patrón consistente con otras APIs del proyecto (user-failed-questions, etc.)
import { NextRequest, NextResponse } from 'next/server'
import {
  safeParseGetUserFavoritesRequest,
  safeParseCreateFavoriteRequest,
  safeParseDeleteFavoriteRequest,
  getUserFavorites,
  createFavorite,
  deleteFavorite
} from '@/lib/api/test-favorites'

import { withErrorLogging } from '@/lib/api/withErrorLogging'
export const dynamic = 'force-dynamic'
export const revalidate = 0

// ============================================
// GET: Obtener favoritos del usuario
// ============================================

async function _GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    // Validar request
    const parseResult = safeParseGetUserFavoritesRequest({ userId })
    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, error: 'userId invalido o faltante' },
        { status: 400 }
      )
    }

    // Obtener favoritos
    const result = await getUserFavorites(parseResult.data)

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
    console.error('❌ [API/test-favorites] Error GET:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

// ============================================
// POST: Crear nuevo favorito
// ============================================

async function _POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validar request (userId viene en el body)
    const parseResult = safeParseCreateFavoriteRequest(body)

    if (!parseResult.success) {
      console.warn('⚠️ [API/test-favorites] Validacion fallida:', parseResult.error.issues)
      return NextResponse.json(
        { success: false, error: 'Datos invalidos', details: parseResult.error.issues },
        { status: 400 }
      )
    }

    // Crear favorito
    const result = await createFavorite(parseResult.data)

    if (!result.success) {
      return NextResponse.json(result, { status: 400 })
    }

    return NextResponse.json(result, { status: 201 })

  } catch (error) {
    console.error('❌ [API/test-favorites] Error POST:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

// ============================================
// DELETE: Eliminar favorito
// ============================================

async function _DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const favoriteId = searchParams.get('id')
    const userId = searchParams.get('userId')

    if (!favoriteId || !userId) {
      return NextResponse.json(
        { success: false, error: 'ID del favorito y userId requeridos' },
        { status: 400 }
      )
    }

    // Validar request
    const parseResult = safeParseDeleteFavoriteRequest({
      id: favoriteId,
      userId: userId
    })

    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, error: 'Parametros invalidos' },
        { status: 400 }
      )
    }

    // Eliminar favorito
    const result = await deleteFavorite(parseResult.data)

    if (!result.success) {
      return NextResponse.json(result, { status: 400 })
    }

    return NextResponse.json(result)

  } catch (error) {
    console.error('❌ [API/test-favorites] Error DELETE:', error)
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
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  })
}

export const GET = withErrorLogging('/api/profile/test-favorites', _GET)
export const POST = withErrorLogging('/api/profile/test-favorites', _POST)
export const DELETE = withErrorLogging('/api/profile/test-favorites', _DELETE)
