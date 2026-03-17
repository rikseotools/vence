// lib/api/admin-conversion-stats/queries.ts - Drizzle queries para conversion stats
import { getDb } from '@/db/client'
import { userProfiles, conversionEvents, cancellationFeedback } from '@/db/schema'
import { sql, gte, lt, and, eq, isNotNull } from 'drizzle-orm'
import type { ConversionStatsResponse } from './schemas'

// -- Helpers --

function daysAgoISO(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString()
}

// -- Main query --

export async function getConversionStats(days: number): Promise<ConversionStatsResponse> {
  const t0 = Date.now()
  const db = getDb()

  const periodFrom = daysAgoISO(days)
  const prevFrom = daysAgoISO(days * 2)
  const sevenDaysAgoStr = daysAgoISO(7)

  // ============================================
  // Queries en 3 lotes secuenciales (~5 por lote)
  // para no saturar el pool de conexiones de Supabase
  // ============================================

  // Lote 1: Registros, usuarios, eventos, DAU
  const [
    regCountRows,        // 1. Registros: total + por fuente
    totalUsersRows,      // 2. Total usuarios all-time
    firstTestRows,       // 3. Primer test completado en período
    dailyStatsRows,      // 4. Eventos agrupados por día+tipo
    dauPeriod,           // 5. DAU período (count distinct)
    dau7,                // 6. DAU 7 días (count distinct)
  ] = await Promise.all([
    // 1: Registros por fuente (GROUP BY, no rows individuales)
    db.execute(sql`
      SELECT
        count(*)::int as total,
        coalesce(registration_source, 'organic') as source
      FROM user_profiles
      WHERE created_at >= ${periodFrom}
      GROUP BY coalesce(registration_source, 'organic')
    `),

    // 2: Total usuarios all-time
    db.select({ count: sql<number>`count(*)::int` })
    .from(userProfiles),

    // 3: Primer test completado en período (solo count)
    db.select({ count: sql<number>`count(*)::int` })
    .from(userProfiles)
    .where(and(
      isNotNull(userProfiles.firstTestCompletedAt),
      gte(userProfiles.firstTestCompletedAt, periodFrom),
    )),

    // 4: Eventos agrupados por día + tipo (para dailyStats)
    db.execute(sql`
      SELECT
        to_char(created_at, 'DD/MM/YYYY') as date,
        event_type,
        count(*)::int as cnt
      FROM conversion_events
      WHERE created_at >= ${periodFrom}
      GROUP BY to_char(created_at, 'DD/MM/YYYY'), event_type
      ORDER BY min(created_at) DESC
    `),

    // 5: DAU período
    db.execute(sql`
      SELECT
        count(DISTINCT t.user_id)::int as dau_total,
        count(DISTINCT t.user_id) FILTER (WHERE up.plan_type = 'premium')::int as dau_premium,
        count(DISTINCT t.user_id) FILTER (WHERE up.plan_type != 'premium' OR up.plan_type IS NULL)::int as dau_free
      FROM tests t
      JOIN user_profiles up ON t.user_id = up.id
      WHERE t.created_at >= ${periodFrom}
    `),

    // 6: DAU 7 días
    db.execute(sql`
      SELECT
        count(DISTINCT t.user_id)::int as dau_total,
        count(DISTINCT t.user_id) FILTER (WHERE up.plan_type = 'premium')::int as dau_premium,
        count(DISTINCT t.user_id) FILTER (WHERE up.plan_type != 'premium' OR up.plan_type IS NULL)::int as dau_free
      FROM tests t
      JOIN user_profiles up ON t.user_id = up.id
      WHERE t.created_at >= ${sevenDaysAgoStr}
    `),
  ])

  // Lote 2: Actividad, pagos, refunds, funnel
  const [
    activeFromReg,       // 7. Registros activos
    paidPeriodRows,      // 8. Pagos del período
    paid7Rows,           // 9. Pagos 7 días
    refundsPeriodRows,   // 10. Refunds período
    refunds7Rows,        // 11. Refunds 7 días
    funnelCountsRows,    // 12. Funnel actual (count distinct por tipo)
  ] = await Promise.all([
    // 7: Registros activos (registros del período con al menos 1 test)
    db.execute(sql`
      SELECT count(DISTINCT t.user_id)::int as count
      FROM tests t
      JOIN user_profiles up ON t.user_id = up.id
      WHERE up.created_at >= ${periodFrom}
    `),

    // 8: Pagos del período
    db.select({ count: sql<number>`count(*)::int` })
    .from(conversionEvents)
    .where(and(
      eq(conversionEvents.eventType, 'payment_completed'),
      gte(conversionEvents.createdAt, periodFrom),
    )),

    // 9: Pagos 7 días
    db.select({ count: sql<number>`count(*)::int` })
    .from(conversionEvents)
    .where(and(
      eq(conversionEvents.eventType, 'payment_completed'),
      gte(conversionEvents.createdAt, sevenDaysAgoStr),
    )),

    // 10: Refunds período
    db.select({
      count: sql<number>`count(*)::int`,
      totalAmount: sql<number>`coalesce(sum(${cancellationFeedback.refundAmountCents}), 0)::int`,
    })
    .from(cancellationFeedback)
    .where(and(
      isNotNull(cancellationFeedback.stripeRefundId),
      gte(cancellationFeedback.createdAt, periodFrom),
    )),

    // 11: Refunds 7 días
    db.select({
      count: sql<number>`count(*)::int`,
      totalAmount: sql<number>`coalesce(sum(${cancellationFeedback.refundAmountCents}), 0)::int`,
    })
    .from(cancellationFeedback)
    .where(and(
      isNotNull(cancellationFeedback.stripeRefundId),
      gte(cancellationFeedback.createdAt, sevenDaysAgoStr),
    )),

    // 12: Funnel actual (count distinct users por event_type)
    db.execute(sql`
      SELECT event_type, count(DISTINCT user_id)::int as cnt
      FROM conversion_events
      WHERE created_at >= ${periodFrom}
      GROUP BY event_type
    `),
  ])

  // Lote 3: Período anterior, pagos all-time
  const [
    prevRegRows,         // 13. Registros período anterior
    prevFirstTestRows,   // 14. Primer test período anterior
    prevFunnelCountsRows,// 15. Funnel anterior (count distinct por tipo)
    paidAllTimeRows,     // 16. Pagos all-time
  ] = await Promise.all([
    // 13: Registros período anterior
    db.select({ count: sql<number>`count(*)::int` })
    .from(userProfiles)
    .where(and(
      gte(userProfiles.createdAt, prevFrom),
      lt(userProfiles.createdAt, periodFrom),
    )),

    // 14: Primer test período anterior
    db.select({ count: sql<number>`count(*)::int` })
    .from(userProfiles)
    .where(and(
      isNotNull(userProfiles.firstTestCompletedAt),
      gte(userProfiles.firstTestCompletedAt, prevFrom),
      lt(userProfiles.firstTestCompletedAt, periodFrom),
    )),

    // 15: Funnel anterior (count distinct users por event_type)
    db.execute(sql`
      SELECT event_type, count(DISTINCT user_id)::int as cnt
      FROM conversion_events
      WHERE created_at >= ${prevFrom} AND created_at < ${periodFrom}
      GROUP BY event_type
    `),

    // 16: Pagos all-time
    db.select({ count: sql<number>`count(*)::int` })
    .from(conversionEvents)
    .where(eq(conversionEvents.eventType, 'payment_completed')),
  ])

  const t1 = Date.now()
  console.log(`[conversion-stats] 16 queries en 3 lotes: ${t1 - t0}ms (days=${days})`)

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

  // DAU (COUNT DISTINCT en SQL)
  const dauRow = (dauPeriod as any).rows?.[0] || dauPeriod[0] || {}
  const dauTotal = dauRow.dau_total || 0
  const dauPremium = dauRow.dau_premium || 0
  const dauFree = dauRow.dau_free || 0

  const dau7Row = (dau7 as any).rows?.[0] || dau7[0] || {}
  const dau7Days = dau7Row.dau_total || 0
  const dau7DaysPremium = dau7Row.dau_premium || 0
  const dau7DaysFree = dau7Row.dau_free || 0

  const activeRegRow = (activeFromReg as any).rows?.[0] || activeFromReg[0] || {}
  const activeRegUserCount = activeRegRow.count || 0

  // Registros: total y por fuente (de GROUP BY)
  const regRows = (regCountRows as any).rows || regCountRows || []
  let regTotal = 0
  const bySource: Record<string, number> = {}
  for (const r of regRows) {
    const count = r.total || 0
    const source = r.source || 'organic'
    bySource[source] = count
    regTotal += count
  }

  // First test count
  const firstTestCount = firstTestRows[0]?.count || 0

  // dailyStats: ya agrupados por SQL
  const dailyMap: Record<string, Record<string, number>> = {}
  const dsRows = (dailyStatsRows as any).rows || dailyStatsRows || []
  for (const r of dsRows) {
    if (!dailyMap[r.date]) dailyMap[r.date] = {}
    dailyMap[r.date][r.event_type] = r.cnt
  }
  const dailyStats = Object.entries(dailyMap)
    .map(([date, evts]) => ({ date, ...evts }))

  // Funnel counts (ya agrupados con COUNT DISTINCT en SQL)
  const funnelCounts: Record<string, number> = {}
  const fcRows = (funnelCountsRows as any).rows || funnelCountsRows || []
  for (const r of fcRows) {
    funnelCounts[r.event_type] = r.cnt
  }

  const prevFunnelCounts: Record<string, number> = {}
  const pfcRows = (prevFunnelCountsRows as any).rows || prevFunnelCountsRows || []
  for (const r of pfcRows) {
    prevFunnelCounts[r.event_type] = r.cnt
  }

  // Tasas
  const activationRate = regTotal > 0
    ? (activeRegUserCount / regTotal) * 100
    : 0
  const monetizationRate = dauTotal > 0 ? (dauPremium / dauTotal) * 100 : 0
  const monetizationRate7Days = dau7Days > 0 ? (dau7DaysPremium / dau7Days) * 100 : 0
  const freeToPayRate = dauFree > 0 ? (paidNetInPeriod / dauFree) * 100 : 0
  const freeToPayRate7Days = dau7DaysFree > 0 ? (paidNetIn7Days / dau7DaysFree) * 100 : 0

  const round1 = (n: number) => Math.round(n * 10) / 10

  console.log(`[conversion-stats] TOTAL: ${Date.now() - t0}ms (days=${days})`)

  return {
    registrations: {
      total: regTotal,
      totalAllTime: totalUsersAllTime,
      bySource,
      firstTestCompleted: firstTestCount,
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
    paidAllTime: paidAllTimeRows[0]?.count || 0,
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
