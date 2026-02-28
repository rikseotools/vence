// lib/api/admin-newsletters-history/index.ts
export {
  newsletterHistoryParamsSchema,
  newsletterHistoryResponseSchema,
  campaignUsersResponseSchema,
  type NewsletterHistoryParams,
  type NewsletterHistoryResponse,
  type CampaignUsersResponse,
} from './schemas'

export {
  getNewsletterHistory,
  getUserActivity,
  getCampaignEvents,
  getCampaignUserProfiles,
} from './queries'
