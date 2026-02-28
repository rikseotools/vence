// lib/api/admin-funnel-users/queries.ts
import { getDb, type DbClient } from '@/db/client'
import { userProfiles, conversionEvents } from '@/db/schema'
import { gte, desc, isNotNull, inArray } from 'drizzle-orm'
import type { FunnelStage, FunnelUser, FunnelUsersResponse } from './schemas'

// Mapeo de stage → event_type(s) en conversion_events
const STAGE_EVENT_MAP: Partial<Record<FunnelStage, string | string[]>> = {
  hit_limit: 'limit_reached',
  saw_modal: 'upgrade_modal_viewed',
  clicked_upgrade: ['upgrade_button_clicked', 'upgrade_banner_clicked'],
  visited_premium: 'premium_page_viewed',
  started_checkout: 'checkout_started',
  paid: 'payment_completed'
}

// ============================================
// HELPER: OBTENER USUARIOS POR EVENTO
// ============================================

async function getUsersByEvent(
  db: DbClient,
  eventTypes: string[],
  cutoffDate: string,
  limit: number
): Promise<FunnelUser[]> {
  // Obtener eventos
  const events = await db
    .select({
      userId: conversionEvents.userId,
      eventType: conversionEvents.eventType,
      createdAt: conversionEvents.createdAt
    })
    .from(conversionEvents)
    .where(
      inArray(conversionEvents.eventType, eventTypes)
    )
    .orderBy(desc(conversionEvents.createdAt))

  // Filtrar por fecha en JS (gte con string timestamp)
  const filteredEvents = events.filter(e =>
    e.createdAt && e.createdAt >= cutoffDate
  )

  // Obtener user_ids únicos
  const userIdSet = new Set<string>()
  const eventsByUser: Record<string, { createdAt: string | null; eventType: string }> = {}

  for (const e of filteredEvents) {
    if (e.userId && !eventsByUser[e.userId]) {
      userIdSet.add(e.userId)
      eventsByUser[e.userId] = { createdAt: e.createdAt, eventType: e.eventType }
    }
  }

  const userIds = [...userIdSet].slice(0, limit)
  if (userIds.length === 0) return []

  // Obtener perfiles
  const profiles = await db
    .select({
      id: userProfiles.id,
      email: userProfiles.email,
      fullName: userProfiles.fullName,
      planType: userProfiles.planType,
      registrationSource: userProfiles.registrationSource,
      createdAt: userProfiles.createdAt
    })
    .from(userProfiles)
    .where(inArray(userProfiles.id, userIds))

  const profileMap = new Map(profiles.map(p => [p.id, p]))

  // Combinar con eventos
  const result: FunnelUser[] = []
  for (const userId of userIds) {
    const profile = profileMap.get(userId)
    const event = eventsByUser[userId]
    if (!profile?.email) continue
    result.push({
      id: profile.id,
      email: profile.email,
      fullName: profile.fullName,
      planType: profile.planType,
      registrationSource: profile.registrationSource,
      createdAt: profile.createdAt,
      eventAt: event.createdAt,
      eventType: event.eventType
    })
  }
  return result
}

// ============================================
// OBTENER USUARIOS POR STAGE DEL FUNNEL
// ============================================

export async function getFunnelUsers(
  stage: FunnelStage,
  days: number,
  limit: number
): Promise<FunnelUsersResponse> {
  const db = getDb()

  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - days)
  const cutoffISO = cutoffDate.toISOString()

  let users: FunnelUser[]

  switch (stage) {
    case 'registrations': {
      const rows = await db
        .select({
          id: userProfiles.id,
          email: userProfiles.email,
          fullName: userProfiles.fullName,
          planType: userProfiles.planType,
          registrationSource: userProfiles.registrationSource,
          createdAt: userProfiles.createdAt
        })
        .from(userProfiles)
        .where(gte(userProfiles.createdAt, cutoffISO))
        .orderBy(desc(userProfiles.createdAt))
        .limit(limit)

      users = rows
      break
    }

    case 'completed_first_test': {
      const rows = await db
        .select({
          id: userProfiles.id,
          email: userProfiles.email,
          fullName: userProfiles.fullName,
          planType: userProfiles.planType,
          registrationSource: userProfiles.registrationSource,
          createdAt: userProfiles.createdAt,
          firstTestCompletedAt: userProfiles.firstTestCompletedAt
        })
        .from(userProfiles)
        .where(
          isNotNull(userProfiles.firstTestCompletedAt)
        )
        .orderBy(desc(userProfiles.firstTestCompletedAt))
        .limit(limit)

      // Filter by date in JS (firstTestCompletedAt >= cutoffISO)
      users = rows.filter(r =>
        r.firstTestCompletedAt && r.firstTestCompletedAt >= cutoffISO
      )
      break
    }

    default: {
      // Event-based stages
      const eventTypes = STAGE_EVENT_MAP[stage]
      if (!eventTypes) {
        users = []
        break
      }
      const types = Array.isArray(eventTypes) ? eventTypes : [eventTypes]
      users = await getUsersByEvent(db, types, cutoffISO, limit)
      break
    }
  }

  return {
    stage,
    count: users.length,
    users,
    period: { days, from: cutoffISO }
  }
}
