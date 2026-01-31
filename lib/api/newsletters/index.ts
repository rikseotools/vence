// lib/api/newsletters/index.ts - Exports del módulo de newsletters

// Schemas y tipos
export {
  audienceTypeSchema,
  sendNewsletterRequestSchema,
  sendNewsletterResponseSchema,
  audienceStatsSchema,
  newsletterVariablesSchema,
  eligibleUserSchema,
  safeParseSendRequest,
  validateSendRequest,
  oposicionTypes,
  oposicionDisplayNames,
  type AudienceType,
  type SendNewsletterRequest,
  type SendNewsletterResponse,
  type AudienceStats,
  type NewsletterVariables,
  type EligibleUser
} from './schemas'

// Queries
export {
  getNewsletterAudience,
  getAudienceStats,
  replaceNewsletterVariables,
  getUnsubscribedCount,
  isUserUnsubscribed
} from './queries'
