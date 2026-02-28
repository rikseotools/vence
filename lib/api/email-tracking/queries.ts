// lib/api/email-tracking/queries.ts - Queries Drizzle para email tracking
import { getDb } from '@/db/client'
import { emailEvents, userProfiles } from '@/db/schema'
import { eq, and, gte } from 'drizzle-orm'

// ============================================
// GET USER EMAIL BY PROFILE
// ============================================

export async function getUserEmailByProfile(userId: string): Promise<string | null> {
  try {
    const db = getDb()

    const result = await db
      .select({ email: userProfiles.email })
      .from(userProfiles)
      .where(eq(userProfiles.id, userId))
      .limit(1)

    return result[0]?.email ?? null
  } catch (error) {
    console.error('❌ [EmailTracking] Error fetching user email:', error)
    return null
  }
}

// ============================================
// CHECK RECENT EVENT (DEDUP)
// ============================================

export async function checkRecentEvent(
  userId: string,
  eventType: string,
  emailType: string,
  windowMinutes: number
): Promise<boolean> {
  try {
    const db = getDb()

    const cutoff = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString()

    const recent = await db
      .select({ id: emailEvents.id })
      .from(emailEvents)
      .where(
        and(
          eq(emailEvents.userId, userId),
          eq(emailEvents.eventType, eventType),
          eq(emailEvents.emailType, emailType),
          gte(emailEvents.createdAt, cutoff)
        )
      )
      .limit(1)

    return recent.length > 0
  } catch (error) {
    console.error('❌ [EmailTracking] Error checking recent event:', error)
    return false
  }
}

// ============================================
// RECORD EMAIL EVENT
// ============================================

interface RecordEmailEventData {
  userId: string
  eventType: string
  emailType: string
  emailAddress: string
  subject?: string
  templateId?: string | null
  campaignId?: string | null
  emailContentPreview?: string | null
  linkClicked?: string | null
  clickCount?: number
  openCount?: number
  deviceType?: string | null
  clientName?: string | null
  ipAddress?: string | null
  userAgent?: string | null
}

export async function recordEmailEvent(data: RecordEmailEventData): Promise<boolean> {
  try {
    const db = getDb()

    await db.insert(emailEvents).values({
      userId: data.userId,
      eventType: data.eventType,
      emailType: data.emailType,
      emailAddress: data.emailAddress,
      subject: data.subject ?? null,
      templateId: data.templateId ?? null,
      campaignId: data.campaignId ?? null,
      emailContentPreview: data.emailContentPreview ?? null,
      linkClicked: data.linkClicked ?? null,
      clickCount: data.clickCount ?? 0,
      openCount: data.openCount ?? 0,
      deviceType: data.deviceType ?? null,
      clientName: data.clientName ?? null,
      ipAddress: data.ipAddress ?? null,
      userAgent: data.userAgent ?? null,
      createdAt: new Date().toISOString(),
    })

    return true
  } catch (error) {
    console.error('❌ [EmailTracking] Error recording email event:', error)
    return false
  }
}
