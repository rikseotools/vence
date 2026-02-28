// lib/api/admin-ai-chat-logs/schemas.ts
import { z } from 'zod/v3'

// ============================================
// REQUEST: AI CHAT LOGS (query params)
// ============================================

export const aiChatLogsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  feedback: z.enum(['positive', 'negative', 'none', 'all']).optional()
})

export type AiChatLogsQuery = z.infer<typeof aiChatLogsQuerySchema>

// ============================================
// RESPONSE: AI CHAT LOGS
// ============================================

const logUserSchema = z.object({
  id: z.string().optional(),
  display_name: z.string().nullable(),
  email: z.string().nullable()
})

const logEntrySchema = z.object({
  id: z.string(),
  user_id: z.string().nullable(),
  message: z.string(),
  response_preview: z.string().nullable(),
  full_response: z.string().nullable(),
  sources_used: z.any().nullable(),
  question_context_id: z.string().nullable(),
  question_context_law: z.string().nullable(),
  suggestion_used: z.string().nullable(),
  response_time_ms: z.number().nullable(),
  tokens_used: z.number().nullable(),
  had_error: z.boolean().nullable(),
  error_message: z.string().nullable(),
  feedback: z.string().nullable(),
  feedback_comment: z.string().nullable(),
  detected_laws: z.any().nullable(),
  created_at: z.string().nullable(),
  user: logUserSchema.nullable()
})

const nameCountSchema = z.object({
  name: z.string(),
  count: z.number()
})

export const aiChatLogsResponseSchema = z.object({
  success: z.boolean(),
  logs: z.array(logEntrySchema),
  stats: z.object({
    total: z.number(),
    positive: z.number(),
    negative: z.number(),
    noFeedback: z.number(),
    errors: z.number(),
    avgResponseTime: z.number(),
    satisfactionRate: z.number().nullable()
  }),
  topSuggestions: z.array(nameCountSchema),
  topLaws: z.array(nameCountSchema),
  pagination: z.object({
    page: z.number(),
    limit: z.number(),
    hasMore: z.boolean()
  })
})

export type AiChatLogsResponse = z.infer<typeof aiChatLogsResponseSchema>

// ============================================
// RESPONSE: ERROR
// ============================================

export const aiChatLogsErrorSchema = z.object({
  success: z.boolean(),
  error: z.string()
})

export type AiChatLogsError = z.infer<typeof aiChatLogsErrorSchema>
