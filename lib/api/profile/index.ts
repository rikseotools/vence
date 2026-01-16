// lib/api/profile/index.ts - Exports del módulo de perfil

// Schemas y tipos
export {
  genderOptions,
  languageOptions,
  getProfileRequestSchema,
  profileDataSchema,
  getProfileResponseSchema,
  updateProfileRequestSchema,
  updateProfileResponseSchema,
  errorResponseSchema,
  safeParseGetProfileRequest,
  safeParseUpdateProfileRequest,
  validateGetProfileRequest,
  validateUpdateProfileRequest,
  type Gender,
  type Language,
  type GetProfileRequest,
  type ProfileData,
  type GetProfileResponse,
  type UpdateProfileRequest,
  type UpdateProfileResponse,
  type ErrorResponse
} from './schemas'

// Queries
export {
  getProfile,
  updateProfile,
  profileExists
} from './queries'
