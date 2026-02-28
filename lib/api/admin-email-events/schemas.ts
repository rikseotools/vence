// lib/api/admin-email-events/schemas.ts - Schemas para eventos de email (admin)
import { z } from 'zod/v3'

// ============================================
// QUERY PARAMS
// ============================================

export const emailEventsQuerySchema = z.object({
  timeRange: z.coerce.number().int().min(1).max(365).default(30),
})

export type EmailEventsQuery = z.infer<typeof emailEventsQuerySchema>

// ============================================
// EVENT ITEM
// ============================================

export const emailEventSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid().nullable(),
  emailType: z.string(),
  eventType: z.string(),
  emailAddress: z.string(),
  subject: z.string().nullable(),
  templateId: z.string().nullable(),
  campaignId: z.string().nullable(),
  emailContentPreview: z.string().nullable(),
  linkClicked: z.string().nullable(),
  clickCount: z.number().int().nullable(),
  openCount: z.number().int().nullable(),
  deviceType: z.string().nullable(),
  clientName: z.string().nullable(),
  ipAddress: z.string().nullable(),
  userAgent: z.string().nullable(),
  geolocation: z.unknown().nullable(),
  errorDetails: z.string().nullable(),
  createdAt: z.string().nullable(),
})

export type EmailEvent = z.infer<typeof emailEventSchema>

// ============================================
// RESPONSE
// ============================================

export const emailEventsResponseSchema = z.object({
  events: z.array(emailEventSchema),
  totalEvents: z.number().int().min(0),
  timeRange: z.string(),
  timestamp: z.string(),
})

export type EmailEventsResponse = z.infer<typeof emailEventsResponseSchema>
