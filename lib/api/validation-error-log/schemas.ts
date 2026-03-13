// lib/api/validation-error-log/schemas.ts
// Schemas Zod para validation_error_logs

import { z } from 'zod/v3'

export const validationErrorLogSchema = z.object({
  endpoint: z.enum(['/api/answer', '/api/exam/validate', '/api/answer/psychometric']),
  errorType: z.enum(['timeout', 'network', 'db_connection', 'validation', 'not_found', 'unknown']),
  errorMessage: z.string().max(2000),
  errorStack: z.string().max(5000).nullish(),

  userId: z.string().uuid().nullish(),
  questionId: z.string().max(500).nullish(),
  testId: z.string().max(500).nullish(),

  requestBody: z.record(z.unknown()).optional(),

  httpStatus: z.number().int().min(100).max(599).optional(),
  durationMs: z.number().int().min(0).optional(),
  userAgent: z.string().max(1000).nullish(),
})

export type ValidationErrorLogInput = z.infer<typeof validationErrorLogSchema>
