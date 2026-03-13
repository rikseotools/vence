// lib/api/admin-validation-errors/schemas.ts
import { z } from 'zod/v3'

export const validationErrorsQuerySchema = z.object({
  timeRange: z.coerce.number().int().min(1).max(90).default(7),
  endpoint: z.string().max(200).default('all'),
  errorType: z.enum(['timeout', 'network', 'db_connection', 'validation', 'not_found', 'unknown', 'all']).default('all'),
  userId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
})

export type ValidationErrorsQuery = z.infer<typeof validationErrorsQuerySchema>

export const validationErrorEntrySchema = z.object({
  id: z.string().uuid(),
  endpoint: z.string(),
  errorType: z.string(),
  errorMessage: z.string(),
  userId: z.string().uuid().nullable(),
  questionId: z.string().nullable(),
  testId: z.string().nullable(),
  deployVersion: z.string().nullable(),
  vercelRegion: z.string().nullable(),
  httpStatus: z.number().nullable(),
  durationMs: z.number().nullable(),
  userAgent: z.string().nullable(),
  severity: z.enum(['critical', 'warning', 'info']),
  createdAt: z.string(),
  reviewedAt: z.string().nullable().optional(),
})

export type ValidationErrorEntry = z.infer<typeof validationErrorEntrySchema>

export const validationErrorsSummarySchema = z.object({
  totalErrors: z.number(),
  byEndpoint: z.record(z.string(), z.number()),
  byErrorType: z.record(z.string(), z.number()),
  byDeployVersion: z.record(z.string(), z.number()),
  affectedUsers: z.number(),
  avgDurationMs: z.number().nullable(),
})

export type ValidationErrorsSummary = z.infer<typeof validationErrorsSummarySchema>

export const validationErrorsResponseSchema = z.object({
  errors: z.array(validationErrorEntrySchema),
  summary: validationErrorsSummarySchema,
  unreviewedCount: z.number(),
  timeRange: z.number(),
  timestamp: z.string(),
})

export type ValidationErrorsResponse = z.infer<typeof validationErrorsResponseSchema>
