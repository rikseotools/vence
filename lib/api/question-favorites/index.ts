// lib/api/question-favorites/index.ts — superficie pública del dominio (T-261).
export {
  toggleFavoriteRequestSchema,
  toggleFavoriteResponseSchema,
  favoriteQuestionsTestRequestSchema,
  safeParseToggleFavorite,
  safeParseFavoriteQuestionsTest,
  MAX_FAVORITAS_POR_TEST,
  type ToggleFavoriteRequest,
  type ToggleFavoriteResponse,
  type FavoriteQuestionsTestRequest,
} from './schemas'

export {
  setFavorite,
  listFavoriteIds,
  getFavoriteQuestionsForUser,
  ordenarFavoritas,
  type ToggleResult,
  type FavoriteQuestionsResult,
} from './queries'
