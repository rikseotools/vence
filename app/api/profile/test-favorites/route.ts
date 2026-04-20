// app/api/profile/test-favorites/route.ts - API endpoint para favoritos de test
// Patrón consistente con otras APIs del proyecto (user-failed-questions, etc.)
import { NextRequest, NextResponse } from 'next/server'
import {
  safeParseGetUserFavoritesRequest,
  safeParseCreateFavoriteRequest,
  safeParseDeleteFavoriteRequest,
  getUserFavorites,
  createFavorite,
  updateFavorite,
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
// PUT: Sobreescribir favorito existente (busca por userId + name)
// ============================================

async function _PUT(request: NextRequest) {
  try {
    const body = await request.json()

    const parseResult = safeParseCreateFavoriteRequest(body)
    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, error: 'Datos invalidos', details: parseResult.error.issues },
        { status: 400 }
      )
    }

    // Buscar el favorito existente por userId + name
    const existingResult = await getUserFavorites({ userId: parseResult.data.userId })
    const existing = existingResult.success && Array.isArray(existingResult.data)
      ? existingResult.data.find((f: { name: string }) => f.name === parseResult.data.name)
      : null

    if (!existing) {
      // No existe — crear nuevo
      const result = await createFavorite(parseResult.data)
      return NextResponse.json(result, { status: result.success ? 201 : 400 })
    }

    // Existe — actualizar
    const result = await updateFavorite({
      id: existing.id,
      userId: parseResult.data.userId,
      name: parseResult.data.name,
      description: parseResult.data.description,
      selectedLaws: parseResult.data.selectedLaws,
      selectedArticlesByLaw: parseResult.data.selectedArticlesByLaw,
      positionType: parseResult.data.positionType,
    })

    return NextResponse.json(result, { status: result.success ? 200 : 400 })

  } catch (error) {
    console.error('❌ [API/test-favorites] Error PUT:', error)
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
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  })
}

export const GET = withErrorLogging('/api/profile/test-favorites', _GET)
export const POST = withErrorLogging('/api/profile/test-favorites', _POST)
export const PUT = withErrorLogging('/api/profile/test-favorites', _PUT)
export const DELETE = withErrorLogging('/api/profile/test-favorites', _DELETE)
