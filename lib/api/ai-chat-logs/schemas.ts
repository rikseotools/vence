// lib/api/ai-chat-logs/schemas.ts
// Zod schemas para validación de datos de ai_chat_logs

import { z } from 'zod'

export const insertChatLogSchema = z.object({
  logId: z.string().uuid().optional(),
  userId: z.string().uuid().nullable().optional(),
  message: z.string().min(1, 'El mensaje no puede estar vacío'),
  response: z.string().nullable().optional(),
  sources: z.array(z.string()).default([]),
  detectedLaws: z.array(z.string()).default([]),
  tokensUsed: z.number().int().nullable().optional(),
  questionContextId: z.string().uuid().nullable().optional(),
  questionContextLaw: z.string().nullable().optional(),
  suggestionUsed: z.string().nullable().optional(),
  responseTimeMs: z.number().int().nullable().optional(),
  hadError: z.boolean().default(false),
  errorMessage: z.string().nullable().optional(),
  userOposicion: z.string().nullable().optional(),
  // Campos de discrepancia
  hadDiscrepancy: z.boolean().optional(),
  aiSuggestedAnswer: z.string().nullable().optional(),
  dbAnswer: z.string().nullable().optional(),
  reanalysisResponse: z.string().nullable().optional(),
})

// Use z.input for the function parameter type (before defaults are applied)
export type InsertChatLogInput = z.input<typeof insertChatLogSchema>
