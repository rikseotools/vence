// lib/api/daily-limit/queries.ts
// Drizzle queries for the graduated daily limit system
// CANARY self-hosted pooler (Fase 4 oleada 4 — sweep masivo 2026-05-10):
// daily-limit migrado al pooler propio para reducir presión Supavisor.
import { getDb, getPoolerDb } from '@/db/client'

function getDailyLimitDb() {
  return process.env.USE_SELF_HOSTED_POOLER === 'true' ? getPoolerDb() : getDb()
}
import { conversionEvents, userProfiles } from '@/db/schema'
import { eq, and, sql, count } from 'drizzle-orm'
import { GRADUATED_LIMIT_CONFIG, PREMIUM_PLAN_TYPES } from './config'
import type { UserLimitProfile, DynamicLimitResult } from './schemas'

// In-memory cache to avoid hitting DB on every single question
interface CacheEntry {
  result: DynamicLimitResult
  timestamp: number
}

const limitCache = new Map<string, CacheEntry>()
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes - limit profile changes slowly

/**
 * Get a user's limit profile: registration age + cumulative limit hits.
 * Used to calculate their personalized daily limit.
 */
export async function getUserLimitProfile(userId: string): Promise<UserLimitProfile | null> {
  const db = getDailyLimitDb()

  // Single query: join user_profiles with aggregated conversion_events
  const result = await db
    .select({
      userId: userProfiles.id,
      planType: userProfiles.planType,
      createdAt: userProfiles.createdAt,
      totalLimitHits: count(conversionEvents.id),
    })
    .from(userProfiles)
    .leftJoin(
      conversionEvents,
      and(
        eq(conversionEvents.userId, userProfiles.id),
        eq(conversionEvents.eventType, 'limit_reached'),
      ),
    )
    .where(eq(userProfiles.id, userId))
    .groupBy(userProfiles.id, userProfiles.planType, userProfiles.createdAt)
    .limit(1)

  if (!result.length) return null

  const row = result[0]
  const createdAt = row.createdAt || new Date().toISOString()
  const registrationAgeDays = Math.floor(
    (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24),
  )
  const isPremium = PREMIUM_PLAN_TYPES.includes(
    (row.planType || 'free') as (typeof PREMIUM_PLAN_TYPES)[number],
  )

  return {
    userId,
    planType: row.planType,
    createdAt,
    registrationAgeDays,
    totalLimitHits: Number(row.totalLimitHits),
    isPremium,
  }
}

/**
 * Calculate the dynamic daily limit for a user based on their profile.
 * Pure function — no DB access, easy to test.
 */
export function calculateDynamicLimit(profile: UserLimitProfile): DynamicLimitResult {
  const config = GRADUATED_LIMIT_CONFIG

  // Premium users: no limit
  if (profile.isPremium) {
    return {
      dailyLimit: 999,
      tierLabel: null,
      isGraduated: false,
      registrationAgeDays: profile.registrationAgeDays,
      totalLimitHits: profile.totalLimitHits,
    }
  }

  // Not enough limit hits to trigger graduation — full default limit
  if (profile.totalLimitHits < config.minLimitHitsRequired) {
    return {
      dailyLimit: config.defaultLimit,
      tierLabel: null,
      isGraduated: false,
      registrationAgeDays: profile.registrationAgeDays,
      totalLimitHits: profile.totalLimitHits,
    }
  }

  // Find the matching tier based on registration age
  const tier = config.tiers.find(
    (t) =>
      profile.registrationAgeDays >= t.minDaysRegistered &&
      (t.maxDaysRegistered === null || profile.registrationAgeDays < t.maxDaysRegistered),
  )

  if (!tier) {
    // Fallback: last tier (shouldn't happen with null maxDaysRegistered)
    const lastTier = config.tiers[config.tiers.length - 1]
    return {
      dailyLimit: lastTier.dailyLimit,
      tierLabel: lastTier.label,
      isGraduated: lastTier.dailyLimit < config.defaultLimit,
      registrationAgeDays: profile.registrationAgeDays,
      totalLimitHits: profile.totalLimitHits,
    }
  }

  return {
    dailyLimit: tier.dailyLimit,
    tierLabel: tier.label,
    isGraduated: tier.dailyLimit < config.defaultLimit,
    registrationAgeDays: profile.registrationAgeDays,
    totalLimitHits: profile.totalLimitHits,
  }
}

/**
 * Get the dynamic daily limit for a user, with caching.
 * Main entry point — combines DB lookup + calculation.
 */
export async function getDynamicLimit(userId: string): Promise<DynamicLimitResult> {
  // Check cache first
  const cached = limitCache.get(userId)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.result
  }

  const profile = await getUserLimitProfile(userId)

  if (!profile) {
    // User not found — return default limit (fail open)
    return {
      dailyLimit: GRADUATED_LIMIT_CONFIG.defaultLimit,
      tierLabel: null,
      isGraduated: false,
      registrationAgeDays: 0,
      totalLimitHits: 0,
    }
  }

  const result = calculateDynamicLimit(profile)

  // Cache the result
  limitCache.set(userId, { result, timestamp: Date.now() })

  return result
}

/**
 * Invalidate cache for a user (e.g., after plan change or limit hit).
 */
export function invalidateLimitCache(userId: string): void {
  limitCache.delete(userId)
}
