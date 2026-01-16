// lib/api/email-preferences/index.ts - Exports del módulo de preferencias de email

// Schemas y tipos
export {
  getEmailPreferencesRequestSchema,
  emailPreferencesDataSchema,
  getEmailPreferencesResponseSchema,
  upsertEmailPreferencesRequestSchema,
  upsertEmailPreferencesResponseSchema,
  errorResponseSchema,
  safeParseGetEmailPreferencesRequest,
  safeParseUpsertEmailPreferencesRequest,
  validateGetEmailPreferencesRequest,
  validateUpsertEmailPreferencesRequest,
  type GetEmailPreferencesRequest,
  type EmailPreferencesData,
  type GetEmailPreferencesResponse,
  type UpsertEmailPreferencesRequest,
  type UpsertEmailPreferencesResponse,
  type ErrorResponse
} from './schemas'

// Queries
export {
  getEmailPreferences,
  upsertEmailPreferences
} from './queries'
