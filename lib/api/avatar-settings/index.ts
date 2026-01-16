// lib/api/avatar-settings/index.ts - Exports del módulo de configuración de avatares

// Schemas y tipos
export {
  avatarModeOptions,
  avatarProfileIds,
  avatarProfileSchema,
  userAvatarSettingsDataSchema,
  getAvatarSettingsRequestSchema,
  getAvatarSettingsResponseSchema,
  updateAvatarSettingsRequestSchema,
  updateAvatarSettingsResponseSchema,
  studyMetricsSchema,
  calculateProfileRequestSchema,
  calculateProfileResponseSchema,
  errorResponseSchema,
  safeParseGetAvatarSettingsRequest,
  safeParseUpdateAvatarSettingsRequest,
  safeParseCalculateProfileRequest,
  validateGetAvatarSettingsRequest,
  validateUpdateAvatarSettingsRequest,
  validateCalculateProfileRequest,
  type AvatarMode,
  type AvatarProfileId,
  type AvatarProfile,
  type UserAvatarSettingsData,
  type GetAvatarSettingsRequest,
  type GetAvatarSettingsResponse,
  type UpdateAvatarSettingsRequest,
  type UpdateAvatarSettingsResponse,
  type StudyMetrics,
  type CalculateProfileRequest,
  type CalculateProfileResponse,
  type ErrorResponse
} from './schemas'

// Queries
export {
  getAllAvatarProfiles,
  getAvatarProfileById,
  getAvatarSettings,
  updateAvatarSettings,
  getUsersWithAutomaticAvatar,
  updateAvatarRotation
} from './queries'

// Lógica de perfiles
export {
  getStudyMetrics,
  determineProfile,
  calculateUserProfile,
  previewUserProfile
} from './profiles'
