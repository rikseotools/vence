// lib/api/test-favorites/schemas.ts - Schemas de validacion para favoritos de test
import { z } from 'zod'

// ============================================
// TIPOS BASE
// ============================================

export const testFavoriteDataSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  name: z.string().min(1).max(100),
  description: z.string().max(500).nullable().optional(),
  selectedLaws: z.array(z.string()),
  selectedArticlesByLaw: z.record(z.string(), z.array(z.string().or(z.number()))),
  positionType: z.string().nullable().optional(),
  createdAt: z.string().nullable().optional(),
  updatedAt: z.string().nullable().optional()
})

export type TestFavoriteData = z.infer<typeof testFavoriteDataSchema>

// ============================================
// REQUEST: GET USER FAVORITES
// ============================================

export const getUserFavoritesRequestSchema = z.object({
  userId: z.string().uuid()
})

export type GetUserFavoritesRequest = z.infer<typeof getUserFavoritesRequestSchema>

// ============================================
// RESPONSE: GET USER FAVORITES
// ============================================

export const getUserFavoritesResponseSchema = z.object({
  success: z.boolean(),
  data: z.array(testFavoriteDataSchema).optional(),
  error: z.string().optional()
})

export type GetUserFavoritesResponse = z.infer<typeof getUserFavoritesResponseSchema>

// ============================================
// REQUEST: CREATE FAVORITE
// ============================================

export const createFavoriteRequestSchema = z.object({
  userId: z.string().uuid(),
  name: z.string().min(1, 'El nombre es obligatorio').max(100, 'El nombre es demasiado largo'),
  description: z.string().max(500).nullable().optional(),
  selectedLaws: z.array(z.string()).min(1, 'Debes seleccionar al menos una ley'),
  selectedArticlesByLaw: z.record(z.string(), z.array(z.string().or(z.number()))).optional().default({}),
  positionType: z.string().nullable().optional()
})

export type CreateFavoriteRequest = z.infer<typeof createFavoriteRequestSchema>

// ============================================
// RESPONSE: CREATE FAVORITE
// ============================================

export const createFavoriteResponseSchema = z.object({
  success: z.boolean(),
  data: testFavoriteDataSchema.optional(),
  error: z.string().optional()
})

export type CreateFavoriteResponse = z.infer<typeof createFavoriteResponseSchema>

// ============================================
// REQUEST: UPDATE FAVORITE
// ============================================

export const updateFavoriteRequestSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
  selectedLaws: z.array(z.string()).optional(),
  selectedArticlesByLaw: z.record(z.string(), z.array(z.string().or(z.number()))).optional(),
  positionType: z.string().nullable().optional()
})

export type UpdateFavoriteRequest = z.infer<typeof updateFavoriteRequestSchema>

// ============================================
// REQUEST: DELETE FAVORITE
// ============================================

export const deleteFavoriteRequestSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid()
})

export type DeleteFavoriteRequest = z.infer<typeof deleteFavoriteRequestSchema>

// ============================================
// RESPONSE: DELETE FAVORITE
// ============================================

export const deleteFavoriteResponseSchema = z.object({
  success: z.boolean(),
  error: z.string().optional()
})

export type DeleteFavoriteResponse = z.infer<typeof deleteFavoriteResponseSchema>

// ============================================
// RESPONSE: ERROR
// ============================================

export const errorResponseSchema = z.object({
  success: z.literal(false),
  error: z.string()
})

export type ErrorResponse = z.infer<typeof errorResponseSchema>

// ============================================
// VALIDADORES
// ============================================

export function safeParseGetUserFavoritesRequest(data: unknown) {
  return getUserFavoritesRequestSchema.safeParse(data)
}

export function safeParseCreateFavoriteRequest(data: unknown) {
  return createFavoriteRequestSchema.safeParse(data)
}

export function safeParseUpdateFavoriteRequest(data: unknown) {
  return updateFavoriteRequestSchema.safeParse(data)
}

export function safeParseDeleteFavoriteRequest(data: unknown) {
  return deleteFavoriteRequestSchema.safeParse(data)
}

export function validateGetUserFavoritesRequest(data: unknown): GetUserFavoritesRequest {
  return getUserFavoritesRequestSchema.parse(data)
}

export function validateCreateFavoriteRequest(data: unknown): CreateFavoriteRequest {
  return createFavoriteRequestSchema.parse(data)
}

export function validateUpdateFavoriteRequest(data: unknown): UpdateFavoriteRequest {
  return updateFavoriteRequestSchema.parse(data)
}

export function validateDeleteFavoriteRequest(data: unknown): DeleteFavoriteRequest {
  return deleteFavoriteRequestSchema.parse(data)
}
