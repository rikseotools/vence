// lib/api/admin-delete-user/schemas.ts
import { z } from 'zod/v3'

// ============================================
// REQUEST: DELETE USER
// ============================================

export const deleteUserRequestSchema = z.object({
  userId: z.string().uuid()
})

export type DeleteUserRequest = z.infer<typeof deleteUserRequestSchema>

// ============================================
// RESPONSE: DELETE USER
// ============================================

const deletionResultSchema = z.object({
  table: z.string(),
  status: z.enum(['deleted', 'skipped', 'error', 'exception']),
  reason: z.string().optional(),
  error: z.string().optional()
})

export type DeletionResult = z.infer<typeof deletionResultSchema>

export const deleteUserResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  details: z.array(deletionResultSchema)
})

export type DeleteUserResponse = z.infer<typeof deleteUserResponseSchema>

// ============================================
// RESPONSE: ERROR
// ============================================

export const deleteUserErrorSchema = z.object({
  success: z.boolean(),
  error: z.string()
})

export type DeleteUserError = z.infer<typeof deleteUserErrorSchema>
