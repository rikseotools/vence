// lib/api/admin-conversion-stats/queries.ts - Drizzle queries para conversion stats
import { getDb } from '@/db/client'
import { userProfiles, conversionEvents, tests, cancellationFeedback } from '@/db/schema'
import { sql, gte, lt, and, eq, isNotNull } from 'drizzle-orm'
import type { ConversionStatsResponse } from './schemas'

// -- Helpers --

function daysAgoISO(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString()
}

function countDistinctUsers(rows: { userId: string | null }[]): Record<string, Set<string>> {
  const byType: Record<string, Set<string>> = {}
  for (const row of rows) {
    const r = row as any
    const eventType = r.eventType
    if (!byType[eventType]) byType[eventType] = new Set()
    if (r.userId) byType[eventType].add(r.userId)
  }
  return byType
}

function setsToCountRecord(sets: Record<string, Set<string>>): Record<string, number> {
  const result: Record<string, number> = {}
  for (const [k, v] of Object.entries(sets)) {
    result[k] = v.size
  }
  return result
}

// -- Main query --

export async function getConversionStats(days: number): Promise<ConversionStatsResponse> {
  const db = getDb()

  const periodFrom = daysAgoISO(days)
  const prevFrom = daysAgoISO(days * 2)
  const sevenDaysAgoStr = daysAgoISO(7)

  // ============================================
  // Parallel queries
  // ============================================
  const [
    // 1. Registros del período
    registrations,
    // 2. Total usuarios all-time
    totalUsersRows,
    // 3. Primer test completado en período
    firstTestRows,
    // 4. Eventos de conversión del período (para dailyStats)
    events,
    // 5. DAU período
    dauPeriod,
    // 6. DAU 7 días
    dau7,
    // 7. Registros activos (tienen tests en el período)
    activeFromReg,
    // 8. Pagos del período
    paidPeriodRows,
    // 9. Pagos últimos 7 días
    paid7Rows,
    // 10. Refunds del período
    refundsPeriodRows,
    // 11. Refunds 7 días
    refunds7Rows,
    // 12. Funnel por usuario (período actual)
    funnelEvents,
    // 13. Registros período anterior
    prevRegRows,
    // 14. Primer test período anterior
    prevFirstTestRows,
    // 15. Funnel período anterior
    prevFunnelEvents,
  ] = await Promise.all([
    // 1
    db.select({
      id: userProfiles.id,
      registrationSource: userProfiles.registrationSource,
      createdAt: userProfiles.createdAt,
    })
    .from(userProfiles)
    .where(gte(userProfiles.createdAt, periodFrom)),

    // 2
    db.select({ count: sql<number>`count(*)::int` })
    .from(userProfiles),

    // 3
    db.select({ id: userProfiles.id })
    .from(userProfiles)
    .where(and(
      isNotNull(userProfiles.firstTestCompletedAt),
      gte(userProfiles.firstTestCompletedAt, periodFrom),
    )),

    // 4
    db.select({
      eventType: conversionEvents.eventType,
      userId: conversionEvents.userId,
      createdAt: conversionEvents.createdAt,
    })
    .from(conversionEvents)
    .where(gte(conversionEvents.createdAt, periodFrom)),

    // 5
    db.select({ userId: tests.userId })
    .from(tests)
    .where(gte(tests.createdAt, periodFrom)),

    // 6
    db.select({ userId: tests.userId })
    .from(tests)
    .where(gte(tests.createdAt, sevenDaysAgoStr)),

    // 7: registros del período que tienen al menos 1 test
    db.selectDistinct({ userId: tests.userId })
    .from(tests)
    .innerJoin(userProfiles, eq(tests.userId, userProfiles.id))
    .where(gte(userProfiles.createdAt, periodFrom)),

    // 8
    db.select({ count: sql<number>`count(*)::int` })
    .from(conversionEvents)
    .where(and(
      eq(conversionEvents.eventType, 'payment_completed'),
      gte(conversionEvents.createdAt, periodFrom),
    )),

    // 9
    db.select({ count: sql<number>`count(*)::int` })
    .from(conversionEvents)
    .where(and(
      eq(conversionEvents.eventType, 'payment_completed'),
      gte(conversionEvents.createdAt, sevenDaysAgoStr),
    )),

    // 10
    db.select({
      count: sql<number>`count(*)::int`,
      totalAmount: sql<number>`coalesce(sum(${cancellationFeedback.refundAmountCents}), 0)::int`,
    })
    .from(cancellationFeedback)
    .where(and(
      isNotNull(cancellationFeedback.stripeRefundId),
      gte(cancellationFeedback.createdAt, periodFrom),
    )),

    // 11
    db.select({
      count: sql<number>`count(*)::int`,
      totalAmount: sql<number>`coalesce(sum(${cancellationFeedback.refundAmountCents}), 0)::int`,
    })
    .from(cancellationFeedback)
    .where(and(
      isNotNull(cancellationFeedback.stripeRefundId),
      gte(cancellationFeedback.createdAt, sevenDaysAgoStr),
    )),

    // 12
    db.select({
      eventType: conversionEvents.eventType,
      userId: conversionEvents.userId,
    })
    .from(conversionEvents)
    .where(gte(conversionEvents.createdAt, periodFrom)),

    // 13
    db.select({ count: sql<number>`count(*)::int` })
    .from(userProfiles)
    .where(and(
      gte(userProfiles.createdAt, prevFrom),
      lt(userProfiles.createdAt, periodFrom),
    )),

    // 14
    db.select({ count: sql<number>`count(*)::int` })
    .from(userProfiles)
    .where(and(
      isNotNull(userProfiles.firstTestCompletedAt),
      gte(userProfiles.firstTestCompletedAt, prevFrom),
      lt(userProfiles.firstTestCompletedAt, periodFrom),
    )),

    // 15
    db.select({
      eventType: conversionEvents.eventType,
      userId: conversionEvents.userId,
    })
    .from(conversionEvents)
    .where(and(
      gte(conversionEvents.createdAt, prevFrom),
      lt(conversionEvents.createdAt, periodFrom),
    )),
  ])

  // ============================================
  // Post-process
  // ============================================

  const totalUsersAllTime = totalUsersRows[0]?.count || 0
  const paidInPeriod = paidPeriodRows[0]?.count || 0
  const paidIn7Days = paid7Rows[0]?.count || 0
  const refundsInPeriod = refundsPeriodRows[0]?.count || 0
  const refundsIn7Days = refunds7Rows[0]?.count || 0
  const refundAmountPeriod = refundsPeriodRows[0]?.totalAmount || 0
  const refundAmount7Days = refunds7Rows[0]?.totalAmount || 0
  const paidNetInPeriod = Math.max(0, paidInPeriod - refundsInPeriod)
  const paidNetIn7Days = Math.max(0, paidIn7Days - refundsIn7Days)

  // DAU únicos
  const dauPeriodIds = [...new Set(dauPeriod.map(t => t.userId).filter(Boolean))]
  const dau7Ids = [...new Set(dau7.map(t => t.userId).filter(Boolean))]
  const activeRegUserCount = activeFromReg.length

  const dauTotal = dauPeriodIds.length
  const dau7Days = dau7Ids.length

  // Free vs Premium
  let dauFree = 0, dauPremium = 0
  let dau7DaysFree = 0, dau7DaysPremium = 0

  if (dauPeriodIds.length > 0) {
    const planData = await db
      .select({ id: userProfiles.id, planType: userProfiles.planType })
      .from(userProfiles)
      .where(sql`${userProfiles.id} = ANY(${dauPeriodIds.slice(0, 1000)}::uuid[])`)
    dauPremium = planData.filter(u => u.planType === 'premium').length
    dauFree = planData.filter(u => u.planType !== 'premium').length
  }

  if (dau7Ids.length > 0) {
    const plan7Data = await db
      .select({ id: userProfiles.id, planType: userProfiles.planType })
      .from(userProfiles)
      .where(sql`${userProfiles.id} = ANY(${dau7Ids.slice(0, 1000)}::uuid[])`)
    dau7DaysPremium = plan7Data.filter(u => u.planType === 'premium').length
    dau7DaysFree = plan7Data.filter(u => u.planType !== 'premium').length
  }

  // Registros por fuente
  const bySource: Record<string, number> = {}
  registrations.forEach(u => {
    const source = u.registrationSource || 'organic'
    bySource[source] = (bySource[source] || 0) + 1
  })

  // dailyStats: agrupar eventos por día
  const dailyMap: Record<string, Record<string, number>> = {}
  events.forEach(e => {
    const day = new Date(e.createdAt!).toLocaleDateString('es-ES')
    if (!dailyMap[day]) dailyMap[day] = {}
    const et = e.eventType
    dailyMap[day][et] = (dailyMap[day][et] || 0) + 1
  })
  const dailyStats = Object.entries(dailyMap)
    .map(([date, evts]) => ({ date, ...evts }))
    .sort((a, b) => {
      const [da, ma, ya] = a.date.split('/').map(Number)
      const [db2, mb, yb] = b.date.split('/').map(Number)
      return new Date(yb, mb - 1, db2).getTime() - new Date(ya, ma - 1, da).getTime()
    })

  // Funnel counts (distinct users)
  const funnelCounts = setsToCountRecord(countDistinctUsers(funnelEvents as any))
  const prevFunnelCounts = setsToCountRecord(countDistinctUsers(prevFunnelEvents as any))

  // Tasas
  const activationRate = registrations.length > 0
    ? (activeRegUserCount / registrations.length) * 100
    : 0
  const monetizationRate = dauTotal > 0 ? (dauPremium / dauTotal) * 100 : 0
  const monetizationRate7Days = dau7Days > 0 ? (dau7DaysPremium / dau7Days) * 100 : 0
  const freeToPayRate = dauFree > 0 ? (paidNetInPeriod / dauFree) * 100 : 0
  const freeToPayRate7Days = dau7DaysFree > 0 ? (paidNetIn7Days / dau7DaysFree) * 100 : 0

  const round1 = (n: number) => Math.round(n * 10) / 10

  return {
    registrations: {
      total: registrations.length,
      totalAllTime: totalUsersAllTime,
      bySource,
      firstTestCompleted: firstTestRows.length,
      activeUsers: activeRegUserCount,
      activationRate: round1(activationRate),
    },
    activeUserMetrics: {
      dauTotal,
      dauFree,
      dauPremium,
      monetizationRate: round1(monetizationRate),
      paidInPeriod,
      refundsInPeriod,
      paidNetInPeriod,
      refundAmountPeriod,
      freeToPayRate: round1(freeToPayRate),
      dau7Days,
      dau7DaysFree,
      dau7DaysPremium,
      monetizationRate7Days: round1(monetizationRate7Days),
      paidIn7Days,
      refundsIn7Days,
      paidNetIn7Days,
      refundAmount7Days,
      freeToPayRate7Days: round1(freeToPayRate7Days),
    },
    dailyStats,
    funnelCounts,
    previousPeriod: {
      registrations: prevRegRows[0]?.count || 0,
      firstTestCompleted: prevFirstTestRows[0]?.count || 0,
      funnelCounts: prevFunnelCounts,
    },
    period: {
      days,
      from: periodFrom,
      to: new Date().toISOString(),
    },
  }
}
