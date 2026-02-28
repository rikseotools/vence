// lib/api/admin-ai-usage/schemas.ts
import { z } from 'zod/v3'

// ============================================
// QUERY PARAMS
// ============================================

export const aiUsageQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
  provider: z.enum(['openai', 'anthropic', 'google']).optional()
})

export type AiUsageQuery = z.infer<typeof aiUsageQuerySchema>

// ============================================
// RESPONSE: AI USAGE STATS
// ============================================

const modelStatsSchema = z.object({
  requests: z.number().int().min(0),
  tokens: z.number().int().min(0),
  estimated_cost_usd: z.number().optional()
})

const providerStatsSchema = z.object({
  provider: z.string(),
  total_requests: z.number().int().min(0),
  total_input_tokens: z.number().int().min(0),
  total_output_tokens: z.number().int().min(0),
  total_tokens: z.number().int().min(0),
  total_questions_verified: z.number().int().min(0),
  by_model: z.record(z.string(), modelStatsSchema),
  by_feature: z.record(z.string(), z.object({
    requests: z.number().int().min(0),
    tokens: z.number().int().min(0)
  })),
  by_day: z.record(z.string(), z.object({
    requests: z.number().int().min(0),
    tokens: z.number().int().min(0)
  })),
  estimated_total_cost_usd: z.number().optional()
})

export type ProviderStats = z.infer<typeof providerStatsSchema>

export const aiUsageResponseSchema = z.object({
  success: z.boolean(),
  period: z.object({
    days: z.number().int(),
    from: z.string(),
    to: z.string()
  }),
  stats: z.array(providerStatsSchema),
  total_records: z.number().int().min(0)
})

export type AiUsageResponse = z.infer<typeof aiUsageResponseSchema>

// ============================================
// RESPONSE: ERROR
// ============================================

export const aiUsageErrorSchema = z.object({
  success: z.literal(false),
  error: z.string()
})

export type AiUsageError = z.infer<typeof aiUsageErrorSchema>
