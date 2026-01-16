// lib/api/boe-changes/index.ts - Exports del módulo de monitoreo BOE

// Schemas y tipos
export {
  SIZE_TOLERANCE_BYTES,
  checkMethods,
  changeStatuses,
  lawForCheckSchema,
  headCheckResultSchema,
  partialCheckResultSchema,
  fullCheckResultSchema,
  detectedChangeSchema,
  checkStatsSchema,
  checkBoeChangesResponseSchema,
  lawUpdateDataSchema,
  safeParseCheckStats,
  safeParseDetectedChange,
  validateLawForCheck,
  type CheckMethod,
  type ChangeStatus,
  type LawForCheck,
  type HeadCheckResult,
  type PartialCheckResult,
  type FullCheckResult,
  type DetectedChange,
  type CheckStats,
  type CheckBoeChangesResponse,
  type LawUpdateData
} from './schemas'

// Queries y funciones
export {
  getLawsForBoeCheck,
  updateLawAfterCheck,
  extractLastUpdateFromBOE,
  checkWithContentLength,
  checkWithPartialDownload,
  checkWithFullDownload,
  sendBoeChangeNotification,
  formatBytes,
  createInitialStats
} from './queries'
