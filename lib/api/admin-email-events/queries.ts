// lib/api/admin-email-events/queries.ts - Queries para eventos de email (admin)
import { getDb } from '@/db/client'
import { emailEvents } from '@/db/schema'
import { gte, desc } from 'drizzle-orm'

// ============================================
// GET EMAIL EVENTS
// ============================================

export async function getEmailEvents(timeRangeDays: number = 30) {
  try {
    const db = getDb()

    const cutoffDate = new Date(Date.now() - timeRangeDays * 24 * 60 * 60 * 1000).toISOString()

    const events = await db
      .select()
      .from(emailEvents)
      .where(gte(emailEvents.createdAt, cutoffDate))
      .orderBy(desc(emailEvents.createdAt))

    console.log(`✅ [AdminEmailEvents] Retrieved ${events.length} email events`)

    return events
  } catch (error) {
    console.error('❌ [AdminEmailEvents] Error fetching email events:', error)
    throw error
  }
}
