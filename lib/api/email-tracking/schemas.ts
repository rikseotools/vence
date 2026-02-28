// lib/api/email-tracking/schemas.ts - Schemas para tracking de emails
import { z } from 'zod/v3'

// ============================================
// QUERY PARAMS — email-tracking/click & open
// ============================================

export const emailTrackingQuerySchema = z.object({
  user_id: z.string().uuid().optional(),
  email_type: z.string().min(1).default('motivation'),
  campaign_id: z.string().optional(),
  template_id: z.string().optional(),
})

export type EmailTrackingQuery = z.infer<typeof emailTrackingQuerySchema>

// ============================================
// CLICK — email-tracking/click
// ============================================

export const emailClickQuerySchema = emailTrackingQuerySchema.extend({
  email_id: z.string().optional(),
  action: z.string().default('unknown'),
  redirect: z.string().url().optional(),
})

export type EmailClickQuery = z.infer<typeof emailClickQuerySchema>

// ============================================
// OPEN — email-tracking/open
// ============================================

export const emailOpenQuerySchema = emailTrackingQuerySchema.extend({
  email_id: z.string().optional(),
  timestamp: z.string().optional(),
})

export type EmailOpenQuery = z.infer<typeof emailOpenQuerySchema>

// ============================================
// CLICK v2 — email/track-click (con UA info)
// ============================================

export const emailTrackClickQuerySchema = z.object({
  user_id: z.string().uuid().optional(),
  email_type: z.string().min(1).optional(),
  campaign_id: z.string().optional(),
  template_id: z.string().optional(),
  url: z.string().optional(),
  redirect: z.string().optional(),
})

export type EmailTrackClickQuery = z.infer<typeof emailTrackClickQuerySchema>

// ============================================
// OPEN v2 — email/track-open (con UA info)
// ============================================

export const emailTrackOpenQuerySchema = z.object({
  user_id: z.string().uuid().optional(),
  email_type: z.string().min(1).optional(),
  campaign_id: z.string().optional(),
  template_id: z.string().optional(),
  timestamp: z.string().optional(),
})

export type EmailTrackOpenQuery = z.infer<typeof emailTrackOpenQuerySchema>
