// lib/api/medals/index.ts - Exports del modulo de medallas

// Schemas y tipos
export {
  RANKING_MEDALS,
  userMedalSchema,
  checkMedalsRequestSchema,
  getMedalsRequestSchema,
  getMedalsResponseSchema,
  checkMedalsResponseSchema,
  safeParseGetMedalsRequest,
  safeParseCheckMedalsRequest,
  type MedalDefinition,
  type UserMedal,
  type CheckMedalsRequest,
  type GetMedalsRequest,
  type GetMedalsResponse,
  type CheckMedalsResponse,
} from './schemas'

// Queries
export {
  getMedalPeriods,
  assignMedalsForPeriod,
  getUserMedals,
  checkAndSaveNewMedals,
} from './queries'
