// app/api/admin/graduated-limits/route.ts
// Admin endpoint: graduated limit status + conversion comparison (before vs after)
import { NextResponse } from 'next/server'
import { getDb } from '@/db/client'
import { userProfiles, conversionEvents, userSubscriptions } from '@/db/schema'
import { eq, and, sql, desc, count, gte, isNotNull } from 'drizzle-orm'
import { calculateDynamicLimit } from '@/lib/api/daily-limit/queries'
import { GRADUATED_LIMIT_CONFIG } from '@/lib/api/daily-limit/config'
import type { UserLimitProfile } from '@/lib/api/daily-limit/schemas'
import { withErrorLogging } from '@/lib/api/withErrorLogging'

export const dynamic = 'force-dynamic'

async function _GET() {
  const db = getDb()

  // ============================================================
  // 1. Current graduated limit status per user
  // ============================================================
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

  // ============================================================
  // 2. Conversion comparison: before vs after graduated system
  // ============================================================

  // Get all unique users who ever hit the limit
  const allLimitHitters = await db
    .select({
      userId: conversionEvents.userId,
      eventData: conversionEvents.eventData,
      createdAt: conversionEvents.createdAt,
    })
    .from(conversionEvents)
    .where(eq(conversionEvents.eventType, 'limit_reached'))

  // Get all subscription user IDs (= converted)
  const allSubscriptions = await db
    .select({
      userId: userSubscriptions.userId,
      subscriptionCreatedAt: userSubscriptions.createdAt,
    })
    .from(userSubscriptions)
    .where(isNotNull(userSubscriptions.userId))

  const subscribedUserIds = new Set(allSubscriptions.map(s => s.userId))

  // Split events into pre-graduation (no is_graduated field) and post-graduation
  const preGraduationUsers = new Set<string>()
  const postGraduatedUsers = new Set<string>()
  const postNormalUsers = new Set<string>()

  for (const event of allLimitHitters) {
    if (!event.userId) continue
    const data = event.eventData as Record<string, unknown> | null

    if (data && 'is_graduated' in data) {
      // Post-deployment event (has the new field)
      if (data.is_graduated) {
        postGraduatedUsers.add(event.userId)
      } else {
        postNormalUsers.add(event.userId)
      }
    } else {
      // Pre-deployment event (no is_graduated field)
      preGraduationUsers.add(event.userId)
    }
  }

  // Remove overlap: if a user appears in both pre and post, keep them in post only
  for (const uid of postGraduatedUsers) preGraduationUsers.delete(uid)
  for (const uid of postNormalUsers) preGraduationUsers.delete(uid)

  const conversionComparison = {
    preGraduation: {
      label: 'Antes del sistema graduado',
      description: 'Eventos limit_reached sin campo is_graduated (sistema anterior con 25/dia fijo)',
      usersWhoHitLimit: preGraduationUsers.size,
      usersWhoConverted: [...preGraduationUsers].filter(uid => subscribedUserIds.has(uid)).length,
      conversionRate: preGraduationUsers.size > 0
        ? Math.round([...preGraduationUsers].filter(uid => subscribedUserIds.has(uid)).length / preGraduationUsers.size * 100)
        : 0,
    },
    postGraduated: {
      label: 'Despues - usuarios con limite reducido',
      description: 'Eventos limit_reached con is_graduated=true (15/10/5 preguntas/dia)',
      usersWhoHitLimit: postGraduatedUsers.size,
      usersWhoConverted: [...postGraduatedUsers].filter(uid => subscribedUserIds.has(uid)).length,
      conversionRate: postGraduatedUsers.size > 0
        ? Math.round([...postGraduatedUsers].filter(uid => subscribedUserIds.has(uid)).length / postGraduatedUsers.size * 100)
        : 0,
    },
    postNormal: {
      label: 'Despues - usuarios con limite normal',
      description: 'Eventos limit_reached con is_graduated=false (25 preguntas/dia, usuarios nuevos/casuales)',
      usersWhoHitLimit: postNormalUsers.size,
      usersWhoConverted: [...postNormalUsers].filter(uid => subscribedUserIds.has(uid)).length,
      conversionRate: postNormalUsers.size > 0
        ? Math.round([...postNormalUsers].filter(uid => subscribedUserIds.has(uid)).length / postNormalUsers.size * 100)
        : 0,
    },
  }

  // ============================================================
  // 3. Summary
  // ============================================================
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

  return NextResponse.json({ summary, conversionComparison, users: results })
}

export const GET = withErrorLogging('/api/admin/graduated-limits', _GET)
