// lib/api/admin-load-users-with-push/schemas.ts
import { z } from 'zod/v3'

// ============================================
// RESPONSE: LOAD USERS WITH PUSH
// ============================================

export const loadUsersWithPushResponseSchema = z.object({
  success: z.boolean(),
  users: z.array(z.object({
    id: z.string().uuid(),
    email: z.string(),
    fullName: z.string().nullable(),
    createdAt: z.string().nullable(),
    userNotificationSettings: z.object({
      userId: z.string().uuid(),
      pushEnabled: z.boolean(),
      pushSubscription: z.unknown().nullable(),
      createdAt: z.string().nullable(),
      updatedAt: z.string().nullable()
    })
  })),
  stats: z.object({
    totalUsers: z.number().int().min(0),
    usersWithSettings: z.number().int().min(0),
    usersWithPushEnabled: z.number().int().min(0)
  }),
  message: z.string()
})

export type LoadUsersWithPushResponse = z.infer<typeof loadUsersWithPushResponseSchema>

// ============================================
// RESPONSE: ERROR
// ============================================

export const loadUsersWithPushErrorSchema = z.object({
  error: z.string()
})

export type LoadUsersWithPushError = z.infer<typeof loadUsersWithPushErrorSchema>
