// lib/api/admin-newsletters-history/queries.ts - Queries para historial de newsletters
import { getDb } from '@/db/client'
import { emailEvents, adminUsersWithRoles } from '@/db/schema'
import { eq, and, gte, lte, inArray, sql } from 'drizzle-orm'

// ============================================
// GET NEWSLETTER HISTORY (all events grouped by template+date)
// ============================================

export async function getNewsletterHistory() {
  const db = getDb()

  const events = await db
    .select()
    .from(emailEvents)
    .where(eq(emailEvents.emailType, 'newsletter'))
    .orderBy(sql`${emailEvents.createdAt} DESC`)

  return events
}

// ============================================
// GET USER ACTIVITY DATA (for enrichment)
// ============================================

export async function getUserActivity(userIds: string[]) {
  if (userIds.length === 0) return []
  const db = getDb()

  const data = await db
    .select({
      userId: adminUsersWithRoles.userId,
      lastTestDate: adminUsersWithRoles.lastTestDate,
    })
    .from(adminUsersWithRoles)
    .where(inArray(adminUsersWithRoles.userId, userIds))

  return data
}

// ============================================
// GET CAMPAIGN USERS (specific template + date + eventType)
// ============================================

export async function getCampaignEvents(
  templateId: string,
  startDate: string,
  endDate: string,
  eventType: string
) {
  const db = getDb()

  const events = await db
    .select({
      userId: emailEvents.userId,
      emailAddress: emailEvents.emailAddress,
      createdAt: emailEvents.createdAt,
    })
    .from(emailEvents)
    .where(
      and(
        eq(emailEvents.emailType, 'newsletter'),
        eq(emailEvents.templateId, templateId),
        eq(emailEvents.eventType, eventType),
        gte(emailEvents.createdAt, startDate),
        lte(emailEvents.createdAt, endDate)
      )
    )
    .orderBy(sql`${emailEvents.createdAt} DESC`)

  return events
}

// ============================================
// GET USER PROFILES FOR CAMPAIGN (enrichment)
// ============================================

export async function getCampaignUserProfiles(userIds: string[]) {
  if (userIds.length === 0) return []
  const db = getDb()

  const data = await db
    .select({
      userId: adminUsersWithRoles.userId,
      email: adminUsersWithRoles.email,
      fullName: adminUsersWithRoles.fullName,
      avgScore30D: adminUsersWithRoles.avgScore30D,
      userCreatedAt: adminUsersWithRoles.userCreatedAt,
      lastTestDate: adminUsersWithRoles.lastTestDate,
    })
    .from(adminUsersWithRoles)
    .where(inArray(adminUsersWithRoles.userId, userIds))

  return data
}
