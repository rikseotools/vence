// lib/api/admin-newsletters-history/schemas.ts - Schemas para historial de newsletters
import { z } from 'zod/v3'

// ============================================
// REQUEST: QUERY PARAMS
// ============================================

export const newsletterHistoryParamsSchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  templateId: z.string().optional(),
  date: z.string().optional(),
  eventType: z.enum(['sent', 'opened', 'clicked']).optional(),
})

export type NewsletterHistoryParams = z.infer<typeof newsletterHistoryParamsSchema>

// ============================================
// RESPONSE: NEWSLETTER HISTORY
// ============================================

const newsletterStatsSchema = z.object({
  sent: z.number().int().min(0),
  opened: z.number().int().min(0),
  clicked: z.number().int().min(0),
  bounced: z.number().int().min(0),
  openRate: z.string(),
  clickRate: z.string(),
  veryActiveOpened: z.number().int().min(0),
  activeOpened: z.number().int().min(0),
  totalActiveOpened: z.number().int().min(0),
  activeOpenRate: z.string(),
})

const newsletterItemSchema = z.object({
  campaignId: z.string(),
  subject: z.string(),
  templateId: z.string().nullable(),
  emailContent: z.string().nullable(),
  sentAt: z.string(),
  stats: newsletterStatsSchema,
  recipientCount: z.number().int().min(0),
})

export const newsletterHistoryResponseSchema = z.object({
  success: z.boolean(),
  newsletters: z.array(newsletterItemSchema).optional(),
  total: z.number().int().min(0).optional(),
  pagination: z.object({
    limit: z.number().int(),
    offset: z.number().int(),
    hasMore: z.boolean(),
  }).optional(),
  error: z.string().optional(),
})

export type NewsletterHistoryResponse = z.infer<typeof newsletterHistoryResponseSchema>

// ============================================
// RESPONSE: CAMPAIGN USERS
// ============================================

const campaignUserSchema = z.object({
  userId: z.string().uuid(),
  email: z.string(),
  fullName: z.string().nullable(),
  timestamp: z.string(),
  avgScore: z.union([z.number(), z.string()]),
  accountAgeDays: z.number().nullable(),
  lastTestDate: z.string().nullable(),
  activityLevel: z.enum(['very_active', 'active', 'dormant']),
  daysSinceLastTest: z.number().nullable(),
})

export const campaignUsersResponseSchema = z.object({
  success: z.boolean(),
  users: z.array(campaignUserSchema).optional(),
  total: z.number().int().min(0).optional(),
  metrics: z.object({
    veryActive: z.number().int().min(0),
    active: z.number().int().min(0),
    totalActive: z.number().int().min(0),
    veryActivePercentage: z.string(),
    activePercentage: z.string(),
  }).optional(),
  templateId: z.string().optional(),
  date: z.string().optional(),
  eventType: z.string().optional(),
  error: z.string().optional(),
})

export type CampaignUsersResponse = z.infer<typeof campaignUsersResponseSchema>
