// lib/api/admin-setup-test-users/schemas.ts
import { z } from 'zod/v3'

// ============================================
// REQUEST: SETUP TEST USERS
// ============================================

export const setupTestUsersRequestSchema = z.object({
  adminEmail: z.string().email()
})

export type SetupTestUsersRequest = z.infer<typeof setupTestUsersRequestSchema>

// ============================================
// RESPONSE: SETUP TEST USERS
// ============================================

const testUserResultSchema = z.object({
  email: z.string(),
  status: z.enum(['success', 'not_found', 'error']),
  user_id: z.string().uuid().optional(),
  name: z.string().nullable().optional(),
  error: z.string().optional()
})

export type TestUserResult = z.infer<typeof testUserResultSchema>

export const setupTestUsersResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  results: z.array(testUserResultSchema)
})

export type SetupTestUsersResponse = z.infer<typeof setupTestUsersResponseSchema>

// ============================================
// RESPONSE: ERROR
// ============================================

export const setupTestUsersErrorSchema = z.object({
  error: z.string()
})

export type SetupTestUsersError = z.infer<typeof setupTestUsersErrorSchema>
