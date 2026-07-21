// lib/api/admin-users-count/queries.ts - Queries para conteo de usuarios con suscripciones
import { getDb } from '@/db/client'
import { userProfiles, emailPreferences } from '@/db/schema'
import { eq, sql } from 'drizzle-orm'
import type { UsersCountResponse } from './schemas'

// ============================================
// GET USERS COUNT WITH SUBSCRIPTION STATS
// ============================================

export async function getUsersCount(): Promise<UsersCountResponse> {
  try {
    const db = getDb()

    // Left join para contar suscripciones en una sola query
    // Un usuario está NO suscrito SOLO si existe el registro Y unsubscribed_all es true
    const result = await db
      .select({
        total: sql<number>`count(*)::int`,
        unsubscribed: sql<number>`count(*) filter (where ${emailPreferences.unsubscribedAll} = true)::int`,
      })
      .from(userProfiles)
      .leftJoin(emailPreferences, eq(userProfiles.id, emailPreferences.userId))

    const total = result[0]?.total ?? 0
    const unsubscribed = result[0]?.unsubscribed ?? 0
    const subscribed = total - unsubscribed
    const subscriptionRate = total > 0
      ? parseFloat(((subscribed / total) * 100).toFixed(1))
      : 0

    return {
      total,
      subscribed,
      unsubscribed,
      subscriptionRate,
    }
  } catch (error) {
    console.error('❌ [AdminUsersCount] Error fetching users count:', error)
    throw error
  }
}
