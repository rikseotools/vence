// lib/api/newsletters/index.ts - Exports del módulo de newsletters

// Schemas y tipos
export {
  audienceTypeSchema,
  sendNewsletterRequestSchema,
  sendNewsletterResponseSchema,
  audienceStatsSchema,
  newsletterVariablesSchema,
  eligibleUserSchema,
  templateStatsResponseSchema,
  newsletterUsersAudienceTypes,
  newsletterUsersQuerySchema,
  newsletterUsersResponseSchema,
  safeParseSendRequest,
  validateSendRequest,
  oposicionTypes,
  oposicionDisplayNames,
  type AudienceType,
  type SendNewsletterRequest,
  type SendNewsletterResponse,
  type AudienceStats,
  type NewsletterVariables,
  type EligibleUser,
  type TemplateStat,
  type TemplateStatsResponse,
  type NewsletterUsersQuery,
  type NewsletterUser,
  type NewsletterUsersResponse
} from './schemas'

// Queries
export {
  getNewsletterAudience,
  getAudienceStats,
  replaceNewsletterVariables,
  getUnsubscribedCount,
  isUserUnsubscribed,
  getTemplateStats,
  getNewsletterUsers
} from './queries'
