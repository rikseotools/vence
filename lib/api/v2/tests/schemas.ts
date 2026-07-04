// lib/api/v2/tests/schemas.ts
// Zod para POST /api/v2/tests — crear sesión de test en RDS (AWS).
// Reemplaza la escritura directa a Supabase de utils/testSession.ts.
import { z } from 'zod'

export const createTestRequestSchema = z.object({
  tema: z.number().int().min(0).default(0),
  testNumber: z.number().int().min(0).default(1),
  totalQuestions: z.number().int().min(1),
  testType: z.enum(['practice', 'exam']).default('practice'),
  title: z.string().min(1).max(120),
  testUrl: z.string().max(500).nullable().optional(),
  timeLimitMinutes: z.number().int().min(0).nullable().optional(),
  deployVersion: z.string().max(100).nullable().optional(),
  // JSON opacos (analytics) — se guardan tal cual en jsonb.
  questionsMetadata: z.record(z.string(), z.unknown()).optional().default({}),
  performanceMetrics: z.record(z.string(), z.unknown()).optional().default({}),
  userSessionData: z.record(z.string(), z.unknown()).optional().default({}),
})

export type CreateTestRequest = z.infer<typeof createTestRequestSchema>

export const createTestResponseSchema = z.object({
  success: z.boolean(),
  id: z.string().uuid().optional(),
  reused: z.boolean().optional(),
  error: z.string().optional(),
})

export type CreateTestResponse = z.infer<typeof createTestResponseSchema>

export function safeParseCreateTestRequest(input: unknown) {
  return createTestRequestSchema.safeParse(input)
}
