// lib/api/admin/salesBadge.ts - Queries para badge de ventas no leídas
import { getAdminDb as getDb } from '@/db/client'
import { adminReadMarkers, conversionEvents } from '@/db/schema'
import { eq, and, gt, sql } from 'drizzle-orm'

/**
 * Cuenta ventas (payment_completed) posteriores a la última lectura del admin
 * y suma el importe total.
 */
export async function getUnreadSalesCount(): Promise<{ count: number; totalAmount: number }> {
  const db = getDb()

  const result = await db
    .select({
      count: sql<number>`count(${conversionEvents.id})::int`,
      totalAmount: sql<number>`coalesce(sum((${conversionEvents.eventData}->>'amount')::numeric), 0)::float`,
    })
    .from(conversionEvents)
    .innerJoin(
      adminReadMarkers,
      eq(adminReadMarkers.id, sql`'sales'`)
    )
    .where(
      and(
        eq(conversionEvents.eventType, 'payment_completed'),
        gt(conversionEvents.createdAt, adminReadMarkers.lastReadAt)
      )
    )

  return { count: result[0]?.count ?? 0, totalAmount: result[0]?.totalAmount ?? 0 }
}

/**
 * Marca las ventas como leídas (actualiza last_read_at a now()).
 */
export async function markSalesAsRead(): Promise<void> {
  const db = getDb()

  await db
    .update(adminReadMarkers)
    .set({ lastReadAt: sql`now()` })
    .where(eq(adminReadMarkers.id, 'sales'))
}
