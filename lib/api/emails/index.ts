// lib/api/emails/index.ts - Public API for v2 email module
export {
  getEmailPreferencesV2,
  canSendEmail,
  sendEmailV2,
  generateUnsubscribeToken,
  getUnsubscribeUrl,
} from './queries'

export {
  EMAIL_CATEGORIES,
  EMAIL_TYPES,
  EMAIL_TYPE_TO_CATEGORY,
  emailTypeSchema,
  sendEmailRequestSchema,
  sendEmailResponseSchema,
  canSendResultSchema,
  emailPreferencesSchema,
  sendDisputeEmailRequestSchema,
  safeParseSendEmailRequest,
  validateSendEmailRequest,
  safeParseSendDisputeEmailRequest,
  validateSendDisputeEmailRequest,
  getEmailCategory,
} from './schemas'

export type {
  EmailCategory,
  EmailType,
  EmailPreferences,
  SendEmailRequest,
  SendEmailResponse,
  CanSendResult,
  SendDisputeEmailRequest,
} from './schemas'
