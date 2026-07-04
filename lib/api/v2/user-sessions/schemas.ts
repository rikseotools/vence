// lib/api/v2/user-sessions/schemas.ts
// Zod + tipos SIN dependencias de servidor (Drizzle/postgres) — importable
// desde el cliente sin arrastrar `fs`. La query vive en ./queries.ts.
import { z } from 'zod'

export const createUserSessionRequestSchema = z.object({
  userAgent: z.string().max(1000).optional(),
  screenResolution: z.string().max(50).optional(),
  viewportSize: z.string().max(50).optional(),
  deviceModel: z.string().max(50).optional(),
  browserLanguage: z.string().max(20).optional(),
  timezone: z.string().max(100).optional(),
  colorDepth: z.number().int().optional(),
  pixelRatio: z.number().optional(),
  connectionType: z.string().max(50).optional(),
})
export type CreateUserSessionRequest = z.infer<typeof createUserSessionRequestSchema>

export const createUserSessionResponseSchema = z.object({
  success: z.boolean(),
  id: z.string().uuid().optional(),
  error: z.string().optional(),
})
export type CreateUserSessionResponse = z.infer<typeof createUserSessionResponseSchema>

export function safeParseCreateUserSessionRequest(input: unknown) {
  return createUserSessionRequestSchema.safeParse(input)
}
