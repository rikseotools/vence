// lib/api/test-favorites/queries.ts - Queries tipadas para favoritos de test
import { getDb } from '@/db/client'
import { userTestFavorites } from '@/db/schema'
import { eq, and, desc } from 'drizzle-orm'
import type {
  GetUserFavoritesRequest,
  GetUserFavoritesResponse,
  CreateFavoriteRequest,
  CreateFavoriteResponse,
  UpdateFavoriteRequest,
  DeleteFavoriteRequest,
  DeleteFavoriteResponse,
  TestFavoriteData
} from './schemas'

// ============================================
// OBTENER TODOS LOS FAVORITOS DE UN USUARIO
// ============================================

export async function getUserFavorites(
  params: GetUserFavoritesRequest
): Promise<GetUserFavoritesResponse> {
  try {
    const db = getDb()

    const favorites = await db
      .select({
        id: userTestFavorites.id,
        userId: userTestFavorites.userId,
        name: userTestFavorites.name,
        description: userTestFavorites.description,
        selectedLaws: userTestFavorites.selectedLaws,
        selectedArticlesByLaw: userTestFavorites.selectedArticlesByLaw,
        positionType: userTestFavorites.positionType,
        createdAt: userTestFavorites.createdAt,
        updatedAt: userTestFavorites.updatedAt
      })
      .from(userTestFavorites)
      .where(eq(userTestFavorites.userId, params.userId))
      .orderBy(desc(userTestFavorites.updatedAt))

    console.log('📋 [TestFavorites] Favoritos obtenidos:', {
      userId: params.userId,
      count: favorites.length
    })

    return {
      success: true,
      data: favorites as TestFavoriteData[]
    }

  } catch (error) {
    console.error('❌ [TestFavorites] Error obteniendo favoritos:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    }
  }
}

// ============================================
// CREAR NUEVO FAVORITO
// ============================================

export async function createFavorite(
  params: CreateFavoriteRequest
): Promise<CreateFavoriteResponse> {
  try {
    const db = getDb()

    // Convertir artículos a strings para compatibilidad con el schema de BD
    const normalizedArticlesByLaw: Record<string, string[]> = {}
    if (params.selectedArticlesByLaw) {
      Object.entries(params.selectedArticlesByLaw).forEach(([lawId, articles]) => {
        normalizedArticlesByLaw[lawId] = articles.map(a => String(a))
      })
    }

    const [favorite] = await db
      .insert(userTestFavorites)
      .values({
        userId: params.userId,
        name: params.name,
        description: params.description || null,
        selectedLaws: params.selectedLaws,
        selectedArticlesByLaw: normalizedArticlesByLaw,
        positionType: params.positionType || null
      })
      .returning({
        id: userTestFavorites.id,
        userId: userTestFavorites.userId,
        name: userTestFavorites.name,
        description: userTestFavorites.description,
        selectedLaws: userTestFavorites.selectedLaws,
        selectedArticlesByLaw: userTestFavorites.selectedArticlesByLaw,
        positionType: userTestFavorites.positionType,
        createdAt: userTestFavorites.createdAt,
        updatedAt: userTestFavorites.updatedAt
      })

    if (!favorite) {
      return {
        success: false,
        error: 'No se pudo crear el favorito'
      }
    }

    console.log('✅ [TestFavorites] Favorito creado:', {
      userId: favorite.userId,
      name: favorite.name,
      lawsCount: params.selectedLaws.length
    })

    return {
      success: true,
      data: favorite as TestFavoriteData
    }

  } catch (error: any) {
    console.error('❌ [TestFavorites] Error creando favorito:', error)

    // Manejar error de nombre duplicado
    if (error.code === '23505' && error.constraint === 'user_test_favorites_user_name_unique') {
      return {
        success: false,
        error: 'Ya existe un favorito con ese nombre. Elige otro nombre.'
      }
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    }
  }
}

// ============================================
// ACTUALIZAR FAVORITO EXISTENTE
// ============================================

export async function updateFavorite(
  params: UpdateFavoriteRequest
): Promise<CreateFavoriteResponse> {
  try {
    const db = getDb()

    // Construir objeto de actualización dinámicamente
    const updateData: Record<string, unknown> = {
      updatedAt: new Date().toISOString()
    }

    if (params.name !== undefined) updateData.name = params.name
    if (params.description !== undefined) updateData.description = params.description
    if (params.selectedLaws !== undefined) updateData.selectedLaws = params.selectedLaws
    if (params.selectedArticlesByLaw !== undefined) {
      // Convertir artículos a strings para compatibilidad con el schema de BD
      const normalizedArticlesByLaw: Record<string, string[]> = {}
      Object.entries(params.selectedArticlesByLaw).forEach(([lawId, articles]) => {
        normalizedArticlesByLaw[lawId] = articles.map(a => String(a))
      })
      updateData.selectedArticlesByLaw = normalizedArticlesByLaw
    }
    if (params.positionType !== undefined) updateData.positionType = params.positionType

    const [favorite] = await db
      .update(userTestFavorites)
      .set(updateData)
      .where(and(
        eq(userTestFavorites.id, params.id),
        eq(userTestFavorites.userId, params.userId)
      ))
      .returning({
        id: userTestFavorites.id,
        userId: userTestFavorites.userId,
        name: userTestFavorites.name,
        description: userTestFavorites.description,
        selectedLaws: userTestFavorites.selectedLaws,
        selectedArticlesByLaw: userTestFavorites.selectedArticlesByLaw,
        positionType: userTestFavorites.positionType,
        createdAt: userTestFavorites.createdAt,
        updatedAt: userTestFavorites.updatedAt
      })

    if (!favorite) {
      return {
        success: false,
        error: 'Favorito no encontrado o no tienes permisos para modificarlo'
      }
    }

    console.log('✅ [TestFavorites] Favorito actualizado:', {
      id: favorite.id,
      name: favorite.name
    })

    return {
      success: true,
      data: favorite as TestFavoriteData
    }

  } catch (error: any) {
    console.error('❌ [TestFavorites] Error actualizando favorito:', error)

    if (error.code === '23505' && error.constraint === 'user_test_favorites_user_name_unique') {
      return {
        success: false,
        error: 'Ya existe un favorito con ese nombre. Elige otro nombre.'
      }
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    }
  }
}

// ============================================
// ELIMINAR FAVORITO
// ============================================

export async function deleteFavorite(
  params: DeleteFavoriteRequest
): Promise<DeleteFavoriteResponse> {
  try {
    const db = getDb()

    const result = await db
      .delete(userTestFavorites)
      .where(and(
        eq(userTestFavorites.id, params.id),
        eq(userTestFavorites.userId, params.userId)
      ))
      .returning({ id: userTestFavorites.id })

    if (result.length === 0) {
      return {
        success: false,
        error: 'Favorito no encontrado o no tienes permisos para eliminarlo'
      }
    }

    console.log('✅ [TestFavorites] Favorito eliminado:', params.id)

    return {
      success: true
    }

  } catch (error) {
    console.error('❌ [TestFavorites] Error eliminando favorito:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    }
  }
}
