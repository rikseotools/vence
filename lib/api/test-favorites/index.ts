// lib/api/test-favorites/index.ts - Exports del modulo de favoritos de test

// Schemas y tipos
export {
  testFavoriteDataSchema,
  getUserFavoritesRequestSchema,
  getUserFavoritesResponseSchema,
  createFavoriteRequestSchema,
  createFavoriteResponseSchema,
  updateFavoriteRequestSchema,
  deleteFavoriteRequestSchema,
  deleteFavoriteResponseSchema,
  errorResponseSchema,
  safeParseGetUserFavoritesRequest,
  safeParseCreateFavoriteRequest,
  safeParseUpdateFavoriteRequest,
  safeParseDeleteFavoriteRequest,
  validateGetUserFavoritesRequest,
  validateCreateFavoriteRequest,
  validateUpdateFavoriteRequest,
  validateDeleteFavoriteRequest,
  type TestFavoriteData,
  type GetUserFavoritesRequest,
  type GetUserFavoritesResponse,
  type CreateFavoriteRequest,
  type CreateFavoriteResponse,
  type UpdateFavoriteRequest,
  type DeleteFavoriteRequest,
  type DeleteFavoriteResponse,
  type ErrorResponse
} from './schemas'

// Queries
export {
  getUserFavorites,
  createFavorite,
  updateFavorite,
  deleteFavorite
} from './queries'
