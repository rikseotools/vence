// lib/api/admin-engagement-stats/queries.ts - Queries para estadísticas de engagement
import { getDb } from '@/db/client'
import { tests, userProfiles } from '@/db/schema'
import { eq, sql, gte, and } from 'drizzle-orm'
import type { EngagementStatsResponse } from './schemas'

// ============================================
// GET ENGAGEMENT STATS (MAU)
// ============================================

export async function getEngagementStats(days: number = 30): Promise<EngagementStatsResponse> {
  try {
    const db = getDb()

    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

    // Ejecutar ambas queries en paralelo
    const [activeResult, totalResult] = await Promise.all([
      // Usuarios únicos con tests completados en el período
      db
        .select({ count: sql<number>`count(distinct ${tests.userId})::int` })
        .from(tests)
        .where(
          and(
            eq(tests.isCompleted, true),
            gte(tests.completedAt, cutoffDate)
          )
        ),
      // Total de usuarios
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(userProfiles),
    ])

    const activeUsers = activeResult[0]?.count ?? 0
    const totalUsers = totalResult[0]?.count ?? 0
    const mauPercentage = totalUsers > 0
      ? Math.round((activeUsers / totalUsers) * 100)
      : 0

    return {
      activeUsers,
      totalUsers,
      mauPercentage,
    }
  } catch (error) {
    console.error('❌ [AdminEngagement] Error fetching engagement stats:', error)
    throw error
  }
}
