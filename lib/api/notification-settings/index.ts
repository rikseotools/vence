// lib/api/notification-settings/index.ts - Exports del módulo de configuración de notificaciones

// Schemas y tipos
export {
  frequencyOptions,
  motivationLevelOptions,
  getNotificationSettingsRequestSchema,
  notificationSettingsDataSchema,
  getNotificationSettingsResponseSchema,
  upsertNotificationSettingsRequestSchema,
  upsertNotificationSettingsResponseSchema,
  errorResponseSchema,
  safeParseGetNotificationSettingsRequest,
  safeParseUpsertNotificationSettingsRequest,
  validateGetNotificationSettingsRequest,
  validateUpsertNotificationSettingsRequest,
  type Frequency,
  type MotivationLevel,
  type GetNotificationSettingsRequest,
  type NotificationSettingsData,
  type GetNotificationSettingsResponse,
  type UpsertNotificationSettingsRequest,
  type UpsertNotificationSettingsResponse,
  type ErrorResponse
} from './schemas'

// Queries
export {
  getNotificationSettings,
  upsertNotificationSettings
} from './queries'
