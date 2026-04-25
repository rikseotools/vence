// app/api/admin/graduated-limits/route.ts
// Admin endpoint: shows graduated limit status for all affected users
// Useful for monitoring the impact of the graduated limit system
import { NextResponse } from 'next/server'
import { getDb } from '@/db/client'
import { userProfiles, conversionEvents } from '@/db/schema'
import { eq, and, sql, desc, count, gte } from 'drizzle-orm'
import { calculateDynamicLimit } from '@/lib/api/daily-limit/queries'
import { GRADUATED_LIMIT_CONFIG } from '@/lib/api/daily-limit/config'
import type { UserLimitProfile } from '@/lib/api/daily-limit/schemas'

export const dynamic = 'force-dynamic'

export async function GET() {
  const db = getDb()

  // Get all free users who have hit the limit at least once, with their hit count
  const usersWithHits = await db
    .select({
      userId: userProfiles.id,
      email: userProfiles.email,
      planType: userProfiles.planType,
      createdAt: userProfiles.createdAt,
      targetOposicion: userProfiles.targetOposicion,
      totalLimitHits: count(conversionEvents.id),
    })
    .from(userProfiles)
    .innerJoin(
      conversionEvents,
      and(
        eq(conversionEvents.userId, userProfiles.id),
        eq(conversionEvents.eventType, 'limit_reached'),
      ),
    )
    .where(eq(userProfiles.planType, 'free'))
    .groupBy(
      userProfiles.id,
      userProfiles.email,
      userProfiles.planType,
      userProfiles.createdAt,
      userProfiles.targetOposicion,
    )
    .having(
      gte(count(conversionEvents.id), GRADUATED_LIMIT_CONFIG.minLimitHitsRequired),
    )
    .orderBy(desc(count(conversionEvents.id)))

  // Calculate the dynamic limit for each user
  const now = Date.now()
  const results = usersWithHits.map(row => {
    const createdAt = row.createdAt || new Date().toISOString()
    const registrationAgeDays = Math.floor((now - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24))

    const profile: UserLimitProfile = {
      userId: row.userId,
      planType: row.planType,
      createdAt,
      registrationAgeDays,
      totalLimitHits: Number(row.totalLimitHits),
      isPremium: false,
    }

    const limit = calculateDynamicLimit(profile)

    return {
      email: row.email,
      registrationAgeDays,
      totalLimitHits: Number(row.totalLimitHits),
      dailyLimit: limit.dailyLimit,
      tierLabel: limit.tierLabel,
      isGraduated: limit.isGraduated,
      targetOposicion: row.targetOposicion,
      registeredAt: createdAt.slice(0, 10),
    }
  })

  // Summary stats
  const summary = {
    totalAffected: results.filter(r => r.isGraduated).length,
    totalWithHits: results.length,
    byTier: {
      onboarding: results.filter(r => r.tierLabel === 'onboarding').length,
      'first-reduction': results.filter(r => r.tierLabel === 'first-reduction').length,
      'second-reduction': results.filter(r => r.tierLabel === 'second-reduction').length,
      veteran: results.filter(r => r.tierLabel === 'veteran').length,
    },
    config: {
      defaultLimit: GRADUATED_LIMIT_CONFIG.defaultLimit,
      minLimitHitsRequired: GRADUATED_LIMIT_CONFIG.minLimitHitsRequired,
      tiers: GRADUATED_LIMIT_CONFIG.tiers.map(t => ({
        label: t.label,
        days: `${t.minDaysRegistered}-${t.maxDaysRegistered ?? '∞'}`,
        limit: t.dailyLimit,
      })),
    },
  }

  return NextResponse.json({ summary, users: results })
}
