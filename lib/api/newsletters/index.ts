// lib/api/newsletters/index.ts - Exports del módulo de newsletters

// Schemas y tipos
export {
  audienceTypeSchema,
  generalAudienceTypes,
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
  getActiveOposiciones,
  getNewsletterAudience,
  getAudienceStats,
  replaceNewsletterVariables,
  renderTemplate,
  getEmailTemplate,
  getUnsubscribedCount,
  isUserUnsubscribed,
  getTemplateStats,
  getNewsletterUsers,
  type OposicionOption
} from './queries'
