// lib/api/email-tracking/index.ts - Barrel export
export {
  emailTrackingQuerySchema,
  emailClickQuerySchema,
  emailOpenQuerySchema,
  emailTrackClickQuerySchema,
  emailTrackOpenQuerySchema,
} from './schemas'

export type {
  EmailTrackingQuery,
  EmailClickQuery,
  EmailOpenQuery,
  EmailTrackClickQuery,
  EmailTrackOpenQuery,
} from './schemas'

export {
  getUserEmailByProfile,
  checkRecentEvent,
  recordEmailEvent,
} from './queries'

export {
  getDeviceType,
  getEmailClient,
} from './helpers'
