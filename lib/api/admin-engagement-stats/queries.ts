// lib/api/admin-engagement-stats/queries.ts - Server-side engagement stats via Drizzle raw SQL
import { getDb } from '@/db/client'
import { sql } from 'drizzle-orm'
import type { EngagementStatsResponse } from './schemas'

const TZ = 'Europe/Madrid'

// ============================================
// 1. CORE METRICS
// ============================================

async function getCoreMetrics() {
  const db = getDb()

  const result = await db.execute(sql`
    WITH total AS (
      SELECT COUNT(*)::int AS total_users FROM user_profiles
    ),
    dau_7d AS (
      SELECT
        (started_at AT TIME ZONE ${TZ})::date AS day,
        COUNT(DISTINCT user_id)::int AS dau
      FROM tests
      WHERE started_at IS NOT NULL
        AND started_at >= NOW() - INTERVAL '7 days'
      GROUP BY (started_at AT TIME ZONE ${TZ})::date
    ),
    mau AS (
      SELECT COUNT(DISTINCT user_id)::int AS mau
      FROM tests
      WHERE started_at IS NOT NULL
        AND started_at >= NOW() - INTERVAL '30 days'
    )
    SELECT
      t.total_users,
      COALESCE(ROUND(AVG(d.dau))::int, 0) AS average_dau,
      m.mau,
      CASE WHEN m.mau > 0 THEN ROUND(COALESCE(AVG(d.dau), 0) / m.mau * 100)::int ELSE 0 END AS dau_mau_ratio,
      CASE WHEN t.total_users > 0 THEN ROUND(m.mau::numeric / t.total_users * 100)::int ELSE 0 END AS registered_active_ratio
    FROM total t, mau m
    LEFT JOIN dau_7d d ON TRUE
    GROUP BY t.total_users, m.mau
  `)

  const row = result[0] as any
  return {
    totalUsers: row?.total_users ?? 0,
    averageDAU: row?.average_dau ?? 0,
    MAU: row?.mau ?? 0,
    dauMauRatio: row?.dau_mau_ratio ?? 0,
    registeredActiveRatio: row?.registered_active_ratio ?? 0,
  }
}

// ============================================
// 2. DAU/MAU HISTORY (14 days)
// ============================================

async function getDauMauHistory() {
  const db = getDb()

  // Get the fixed MAU (30d) and daily DAU for 14 days
  const result = await db.execute(sql`
    WITH mau_fixed AS (
      SELECT COUNT(DISTINCT user_id)::int AS mau
      FROM tests
      WHERE started_at IS NOT NULL
        AND started_at >= NOW() - INTERVAL '30 days'
    ),
    days AS (
      SELECT d::date AS day
      FROM generate_series(
        (NOW() AT TIME ZONE ${TZ})::date - 13,
        (NOW() AT TIME ZONE ${TZ})::date,
        '1 day'::interval
      ) d
    ),
    daily_dau AS (
      SELECT
        (started_at AT TIME ZONE ${TZ})::date AS day,
        COUNT(DISTINCT user_id)::int AS dau
      FROM tests
      WHERE started_at IS NOT NULL
        AND started_at >= NOW() - INTERVAL '14 days'
      GROUP BY (started_at AT TIME ZONE ${TZ})::date
    )
    SELECT
      d.day::text AS date,
      COALESCE(dd.dau, 0)::int AS dau,
      m.mau,
      CASE WHEN m.mau > 0 THEN ROUND(COALESCE(dd.dau, 0)::numeric / m.mau * 100)::int ELSE 0 END AS ratio
    FROM days d
    CROSS JOIN mau_fixed m
    LEFT JOIN daily_dau dd ON dd.day = d.day
    ORDER BY d.day ASC
  `)

  return (result as any[]).map((row: any) => {
    const d = new Date(row.date + 'T12:00:00')
    return {
      date: row.date,
      dau: row.dau,
      mau: row.mau,
      ratio: row.ratio,
      formattedDate: d.toLocaleDateString('es-ES', { month: 'short', day: 'numeric' }),
      weekday: d.toLocaleDateString('es-ES', { weekday: 'short' }),
    }
  })
}

// ============================================
// 3. ACTIVATION DATA (same-day activation)
// ============================================

async function getActivationData() {
  const db = getDb()

  // Activation history: users who registered AND did first test on the same day, by day
  const historyResult = await db.execute(sql`
    WITH days AS (
      SELECT d::date AS day
      FROM generate_series(
        (NOW() AT TIME ZONE ${TZ})::date - 13,
        (NOW() AT TIME ZONE ${TZ})::date,
        '1 day'::interval
      ) d
    ),
    activated AS (
      SELECT
        (created_at AT TIME ZONE ${TZ})::date AS reg_day,
        COALESCE(registration_source, 'organic') AS source
      FROM user_profiles
      WHERE first_test_completed_at IS NOT NULL
        AND (created_at AT TIME ZONE ${TZ})::date = (first_test_completed_at AT TIME ZONE ${TZ})::date
    )
    SELECT
      d.day::text AS date,
      COUNT(a.reg_day)::int AS total,
      COUNT(CASE WHEN a.source IN ('organic', '') THEN 1 END)::int AS organic,
      COUNT(CASE WHEN a.source = 'meta' THEN 1 END)::int AS meta,
      COUNT(CASE WHEN a.source = 'google' THEN 1 END)::int AS google
    FROM days d
    LEFT JOIN activated a ON a.reg_day = d.day
    GROUP BY d.day
    ORDER BY d.day ASC
  `)

  const activationHistory = (historyResult as any[]).map((row: any) => {
    const d = new Date(row.date + 'T12:00:00')
    return {
      date: row.date,
      formattedDate: d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }),
      weekday: d.toLocaleDateString('es-ES', { weekday: 'short' }),
      total: row.total,
      organic: row.organic,
      meta: row.meta,
      google: row.google,
    }
  })

  // Activation summary: totals by source (all time)
  const summaryResult = await db.execute(sql`
    WITH all_users AS (
      SELECT
        COALESCE(registration_source, 'organic') AS source
      FROM user_profiles
    ),
    activated_users AS (
      SELECT
        COALESCE(registration_source, 'organic') AS source
      FROM user_profiles
      WHERE first_test_completed_at IS NOT NULL
        AND (created_at AT TIME ZONE ${TZ})::date = (first_test_completed_at AT TIME ZONE ${TZ})::date
    )
    SELECT
      (SELECT COUNT(*)::int FROM all_users WHERE source IN ('organic', '')) AS total_organic,
      (SELECT COUNT(*)::int FROM all_users WHERE source = 'meta') AS total_meta,
      (SELECT COUNT(*)::int FROM all_users WHERE source = 'google') AS total_google,
      (SELECT COUNT(*)::int FROM activated_users WHERE source IN ('organic', '')) AS activated_organic,
      (SELECT COUNT(*)::int FROM activated_users WHERE source = 'meta') AS activated_meta,
      (SELECT COUNT(*)::int FROM activated_users WHERE source = 'google') AS activated_google,
      (SELECT COUNT(*)::int FROM activated_users) AS total_activated
  `)

  const s = (summaryResult[0] as any) ?? {}
  const activationSummary = {
    totalOrganic: s.total_organic ?? 0,
    totalMeta: s.total_meta ?? 0,
    totalGoogle: s.total_google ?? 0,
    activatedOrganic: s.activated_organic ?? 0,
    activatedMeta: s.activated_meta ?? 0,
    activatedGoogle: s.activated_google ?? 0,
    totalActivated: s.total_activated ?? 0,
  }

  return { activationHistory, activationSummary }
}

// ============================================
// 4. ENGAGEMENT DEPTH + 6-month history
// ============================================

async function getEngagementDepthData() {
  const db = getDb()

  // Current month engagement depth
  const depthResult = await db.execute(sql`
    WITH active_users AS (
      SELECT
        user_id,
        COUNT(*)::int AS test_count,
        COUNT(DISTINCT (started_at AT TIME ZONE ${TZ})::date)::int AS days_active
      FROM tests
      WHERE started_at IS NOT NULL
        AND started_at >= NOW() - INTERVAL '30 days'
      GROUP BY user_id
    ),
    streaks AS (
      SELECT
        user_id,
        MAX(streak_len)::int AS longest_streak
      FROM (
        SELECT
          user_id,
          COUNT(*)::int AS streak_len
        FROM (
          SELECT
            user_id,
            day,
            day - (ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY day))::int * INTERVAL '1 day' AS grp
          FROM (
            SELECT DISTINCT
              user_id,
              (started_at AT TIME ZONE ${TZ})::date AS day
            FROM tests
            WHERE started_at IS NOT NULL
              AND started_at >= NOW() - INTERVAL '90 days'
          ) unique_days
        ) grouped
        GROUP BY user_id, grp
      ) streak_groups
      GROUP BY user_id
    )
    SELECT
      COUNT(*)::int AS mau,
      CASE WHEN COUNT(*) > 0
        THEN ROUND(SUM(au.test_count)::numeric / COUNT(*), 1)
        ELSE 0 END AS tests_per_active_user,
      CASE WHEN COUNT(*) > 0
        THEN ROUND(AVG(au.days_active)::numeric, 1)
        ELSE 0 END AS avg_days_active,
      COALESCE(ROUND(AVG(s.longest_streak)::numeric, 1), 0) AS avg_longest_streak,
      COUNT(CASE WHEN au.test_count BETWEEN 1 AND 3 THEN 1 END)::int AS casual,
      COUNT(CASE WHEN au.test_count BETWEEN 4 AND 10 THEN 1 END)::int AS regular,
      COUNT(CASE WHEN au.test_count >= 11 THEN 1 END)::int AS power
    FROM active_users au
    LEFT JOIN streaks s ON s.user_id = au.user_id
  `)

  const dr = (depthResult[0] as any) ?? {}

  // Distribution of days active
  const distResult = await db.execute(sql`
    SELECT
      days_active::text AS days,
      COUNT(*)::int AS count
    FROM (
      SELECT
        user_id,
        COUNT(DISTINCT (started_at AT TIME ZONE ${TZ})::date)::int AS days_active
      FROM tests
      WHERE started_at IS NOT NULL
        AND started_at >= NOW() - INTERVAL '30 days'
      GROUP BY user_id
    ) per_user
    GROUP BY days_active
    ORDER BY days_active
  `)

  const distributionDaysActive: Record<string, number> = {}
  for (const row of distResult as any[]) {
    distributionDaysActive[row.days] = row.count
  }

  const engagementDepth = {
    testsPerActiveUser: Number(dr.tests_per_active_user) || 0,
    avgDaysActivePerMonth: Number(dr.avg_days_active) || 0,
    avgLongestStreak: Number(dr.avg_longest_streak) || 0,
    userEngagementLevels: {
      casual: dr.casual ?? 0,
      regular: dr.regular ?? 0,
      power: dr.power ?? 0,
    },
    distributionDaysActive,
  }

  // 6-month history
  const historyResult = await db.execute(sql`
    WITH months AS (
      SELECT
        date_trunc('month', d)::date AS month_start,
        (date_trunc('month', d) + INTERVAL '1 month' - INTERVAL '1 day')::date AS month_end
      FROM generate_series(
        date_trunc('month', NOW()) - INTERVAL '5 months',
        date_trunc('month', NOW()),
        '1 month'::interval
      ) d
    ),
    monthly_data AS (
      SELECT
        m.month_start,
        COUNT(DISTINCT t.user_id)::int AS active_users,
        COUNT(*)::int AS total_tests
      FROM months m
      LEFT JOIN tests t
        ON t.started_at IS NOT NULL
        AND (t.started_at AT TIME ZONE ${TZ})::date >= m.month_start
        AND (t.started_at AT TIME ZONE ${TZ})::date <= m.month_end
      GROUP BY m.month_start
    ),
    monthly_days AS (
      SELECT
        m.month_start,
        COALESCE(ROUND(AVG(days_active)::numeric, 1), 0) AS avg_days_active
      FROM months m
      LEFT JOIN (
        SELECT
          (started_at AT TIME ZONE ${TZ})::date AS day,
          user_id,
          date_trunc('month', (started_at AT TIME ZONE ${TZ})::date)::date AS month_start,
          COUNT(DISTINCT (started_at AT TIME ZONE ${TZ})::date)::int OVER (
            PARTITION BY user_id, date_trunc('month', (started_at AT TIME ZONE ${TZ})::date)
          ) AS days_active
        FROM tests
        WHERE started_at IS NOT NULL
          AND started_at >= NOW() - INTERVAL '6 months'
      ) sub ON sub.month_start = m.month_start
      GROUP BY m.month_start
    )
    SELECT
      TO_CHAR(md.month_start, 'Mon YYYY') AS month,
      md.active_users,
      md.total_tests,
      CASE WHEN md.active_users > 0
        THEN ROUND(md.total_tests::numeric / md.active_users, 1)
        ELSE 0 END AS tests_per_user,
      COALESCE(mdy.avg_days_active, 0) AS avg_days_active
    FROM monthly_data md
    LEFT JOIN monthly_days mdy ON mdy.month_start = md.month_start
    ORDER BY md.month_start ASC
  `)

  const engagementDepthHistory = (historyResult as any[]).map((row: any) => ({
    month: row.month,
    testsPerUser: Number(row.tests_per_user) || 0,
    avgDaysActive: Number(row.avg_days_active) || 0,
    activeUsers: row.active_users ?? 0,
  }))

  return { engagementDepth, engagementDepthHistory }
}

// ============================================
// 5. HABIT FORMATION + 6-month history
// ============================================

async function getHabitFormationData() {
  const db = getDb()

  const result = await db.execute(sql`
    WITH active_users AS (
      SELECT
        user_id,
        COUNT(*)::int AS test_count,
        COUNT(DISTINCT (started_at AT TIME ZONE ${TZ})::date)::int AS days_active
      FROM tests
      WHERE started_at IS NOT NULL
        AND started_at >= NOW() - INTERVAL '30 days'
      GROUP BY user_id
    ),
    mau AS (
      SELECT COUNT(*)::int AS mau FROM active_users
    )
    SELECT
      m.mau,
      COUNT(CASE WHEN (au.days_active::numeric / 30 * 7) >= 3 THEN 1 END)::int AS power_users,
      COUNT(CASE WHEN au.test_count >= 7 THEN 1 END)::int AS weekly_active_users,
      COUNT(CASE WHEN (au.days_active::numeric / 30 * 7) >= 5 THEN 1 END)::int AS habitual,
      COUNT(CASE WHEN (au.days_active::numeric / 30 * 7) >= 3 AND (au.days_active::numeric / 30 * 7) < 5 THEN 1 END)::int AS regular,
      COUNT(CASE WHEN (au.days_active::numeric / 30 * 7) < 3 THEN 1 END)::int AS occasional,
      CASE WHEN m.mau > 0 THEN ROUND(SUM(au.test_count)::numeric / (30.0 / 7), 1) ELSE 0 END AS total_sessions_per_week
    FROM active_users au, mau m
    GROUP BY m.mau
  `)

  const row = (result[0] as any) ?? { mau: 0 }
  const mau = row.mau ?? 0

  const habitFormation = {
    powerUsers: row.power_users ?? 0,
    powerUsersPercentage: mau > 0 ? Math.round((row.power_users ?? 0) / mau * 100) : 0,
    weeklyActiveUsers: row.weekly_active_users ?? 0,
    weeklyActivePercentage: mau > 0 ? Math.round((row.weekly_active_users ?? 0) / mau * 100) : 0,
    habitDistribution: {
      occasional: row.occasional ?? 0,
      regular: row.regular ?? 0,
      habitual: row.habitual ?? 0,
    },
    avgSessionsPerWeek: mau > 0 ? Math.round(Number(row.total_sessions_per_week ?? 0) / mau * 10) / 10 : 0,
  }

  // 6-month history
  const historyResult = await db.execute(sql`
    WITH months AS (
      SELECT
        date_trunc('month', d)::date AS month_start,
        (date_trunc('month', d) + INTERVAL '1 month' - INTERVAL '1 day')::date AS month_end,
        EXTRACT(DAY FROM (date_trunc('month', d) + INTERVAL '1 month' - INTERVAL '1 day'))::int AS days_in_month
      FROM generate_series(
        date_trunc('month', NOW()) - INTERVAL '5 months',
        date_trunc('month', NOW()),
        '1 month'::interval
      ) d
    ),
    monthly_users AS (
      SELECT
        m.month_start,
        m.days_in_month,
        t.user_id,
        COUNT(*)::int AS test_count,
        COUNT(DISTINCT (t.started_at AT TIME ZONE ${TZ})::date)::int AS days_active
      FROM months m
      JOIN tests t
        ON t.started_at IS NOT NULL
        AND (t.started_at AT TIME ZONE ${TZ})::date >= m.month_start
        AND (t.started_at AT TIME ZONE ${TZ})::date <= m.month_end
      GROUP BY m.month_start, m.days_in_month, t.user_id
    )
    SELECT
      TO_CHAR(mu.month_start, 'Mon YYYY') AS month,
      mu.month_start,
      COUNT(*)::int AS active_users,
      COUNT(CASE WHEN (mu.days_active::numeric / mu.days_in_month * 7) >= 3 THEN 1 END)::int AS power_users,
      COUNT(CASE WHEN mu.test_count >= 7 THEN 1 END)::int AS weekly_active
    FROM monthly_users mu
    GROUP BY mu.month_start
    ORDER BY mu.month_start ASC
  `)

  const habitFormationHistory = (historyResult as any[]).map((row: any) => ({
    month: row.month,
    powerUsersPercent: row.active_users > 0 ? Math.round(row.power_users / row.active_users * 100) : 0,
    weeklyActivePercent: row.active_users > 0 ? Math.round(row.weekly_active / row.active_users * 100) : 0,
    activeUsers: row.active_users,
  }))

  return { habitFormation, habitFormationHistory }
}

// ============================================
// 6. RETENTION DATA (4 weeks + 8 periods + 8 cohorts)
// ============================================

async function getRetentionData() {
  const db = getDb()

  // Retention analysis: 4 weeks of cohorts with D1/D7/D30 retention
  const retentionResult = await db.execute(sql`
    WITH weeks AS (
      SELECT
        generate_series AS week_offset
      FROM generate_series(1, 4)
    ),
    cohorts AS (
      SELECT
        w.week_offset,
        up.id AS user_id,
        up.created_at
      FROM weeks w
      JOIN user_profiles up
        ON (up.created_at AT TIME ZONE ${TZ})::date >= (NOW() AT TIME ZONE ${TZ})::date - (w.week_offset * 7)
        AND (up.created_at AT TIME ZONE ${TZ})::date < (NOW() AT TIME ZONE ${TZ})::date - ((w.week_offset - 1) * 7)
    )
    SELECT
      c.week_offset,
      COUNT(DISTINCT c.user_id)::int AS registered,
      TO_CHAR(MIN(c.created_at AT TIME ZONE ${TZ}), 'Mon DD') AS week_label,
      COUNT(DISTINCT CASE
        WHEN EXISTS (
          SELECT 1 FROM tests t
          WHERE t.user_id = c.user_id
            AND t.started_at IS NOT NULL
            AND (t.started_at AT TIME ZONE ${TZ})::date >= (c.created_at AT TIME ZONE ${TZ})::date + 1
            AND (t.started_at AT TIME ZONE ${TZ})::date < (c.created_at AT TIME ZONE ${TZ})::date + 2
        ) THEN c.user_id END)::int AS day1_retained,
      COUNT(DISTINCT CASE
        WHEN EXISTS (
          SELECT 1 FROM tests t
          WHERE t.user_id = c.user_id
            AND t.started_at IS NOT NULL
            AND (t.started_at AT TIME ZONE ${TZ})::date >= (c.created_at AT TIME ZONE ${TZ})::date + 6
            AND (t.started_at AT TIME ZONE ${TZ})::date < (c.created_at AT TIME ZONE ${TZ})::date + 9
        ) THEN c.user_id END)::int AS day7_retained,
      COUNT(DISTINCT CASE
        WHEN EXISTS (
          SELECT 1 FROM tests t
          WHERE t.user_id = c.user_id
            AND t.started_at IS NOT NULL
            AND (t.started_at AT TIME ZONE ${TZ})::date >= (c.created_at AT TIME ZONE ${TZ})::date + 27
            AND (t.started_at AT TIME ZONE ${TZ})::date < (c.created_at AT TIME ZONE ${TZ})::date + 33
        ) THEN c.user_id END)::int AS day30_retained
    FROM cohorts c
    GROUP BY c.week_offset
    ORDER BY c.week_offset ASC
  `)

  const retentionAnalysis = (retentionResult as any[]).map((row: any) => ({
    week: `Semana ${row.week_offset}`,
    weekLabel: row.week_label ?? '',
    registered: row.registered,
    day1Retention: row.registered > 0 ? Math.round(row.day1_retained / row.registered * 100) : 0,
    day7Retention: row.registered > 0 ? Math.round(row.day7_retained / row.registered * 100) : 0,
    day30Retention: row.registered > 0 ? Math.round(row.day30_retained / row.registered * 100) : 0,
  }))

  // Pad to 4 weeks if some are missing
  while (retentionAnalysis.length < 4) {
    retentionAnalysis.push({
      week: `Semana ${retentionAnalysis.length + 1}`,
      weekLabel: '',
      registered: 0,
      day1Retention: 0,
      day7Retention: 0,
      day30Retention: 0,
    })
  }

  // Retention rate history: 8 periods of 2 weeks each
  const retentionHistoryResult = await db.execute(sql`
    WITH periods AS (
      SELECT
        generate_series AS period_offset
      FROM generate_series(1, 8)
    ),
    period_users AS (
      SELECT
        p.period_offset,
        up.id AS user_id,
        up.created_at
      FROM periods p
      JOIN user_profiles up
        ON (up.created_at AT TIME ZONE ${TZ})::date >= (NOW() AT TIME ZONE ${TZ})::date - ((p.period_offset + 1) * 7)
        AND (up.created_at AT TIME ZONE ${TZ})::date < (NOW() AT TIME ZONE ${TZ})::date - (p.period_offset * 7)
    )
    SELECT
      pu.period_offset,
      TO_CHAR(MIN(pu.created_at AT TIME ZONE ${TZ}), 'Mon DD') AS period_label,
      COUNT(DISTINCT pu.user_id)::int AS registered,
      COUNT(DISTINCT CASE
        WHEN EXISTS (
          SELECT 1 FROM tests t
          WHERE t.user_id = pu.user_id
            AND t.started_at IS NOT NULL
            AND (t.started_at AT TIME ZONE ${TZ})::date >= (pu.created_at AT TIME ZONE ${TZ})::date + 1
            AND (t.started_at AT TIME ZONE ${TZ})::date <= (pu.created_at AT TIME ZONE ${TZ})::date + 2
        ) THEN pu.user_id END)::int AS day1_retained,
      COUNT(DISTINCT CASE
        WHEN EXISTS (
          SELECT 1 FROM tests t
          WHERE t.user_id = pu.user_id
            AND t.started_at IS NOT NULL
            AND (t.started_at AT TIME ZONE ${TZ})::date >= (pu.created_at AT TIME ZONE ${TZ})::date + 2
            AND (t.started_at AT TIME ZONE ${TZ})::date <= (pu.created_at AT TIME ZONE ${TZ})::date + 7
        ) THEN pu.user_id END)::int AS day7_retained,
      COUNT(DISTINCT CASE
        WHEN EXISTS (
          SELECT 1 FROM tests t
          WHERE t.user_id = pu.user_id
            AND t.started_at IS NOT NULL
            AND (t.started_at AT TIME ZONE ${TZ})::date >= (pu.created_at AT TIME ZONE ${TZ})::date + 7
            AND (t.started_at AT TIME ZONE ${TZ})::date <= (pu.created_at AT TIME ZONE ${TZ})::date + 30
        ) THEN pu.user_id END)::int AS day30_retained
    FROM period_users pu
    GROUP BY pu.period_offset
    ORDER BY pu.period_offset ASC
  `)

  const retentionRateHistory = (retentionHistoryResult as any[]).map((row: any) => ({
    period: `P${row.period_offset}`,
    periodLabel: row.period_label ?? '',
    registered: row.registered,
    day1Retention: row.registered > 0 ? Math.round(row.day1_retained / row.registered * 100) : 0,
    day7Retention: row.registered > 0 ? Math.round(row.day7_retained / row.registered * 100) : 0,
    day30Retention: row.registered > 0 ? Math.round(row.day30_retained / row.registered * 100) : 0,
  }))

  // Reverse to have oldest first (like unshift in the original)
  retentionRateHistory.reverse()

  // Pad to 8 periods if some are missing
  while (retentionRateHistory.length < 8) {
    retentionRateHistory.unshift({
      period: `P${retentionRateHistory.length + 1}`,
      periodLabel: '',
      registered: 0,
      day1Retention: 0,
      day7Retention: 0,
      day30Retention: 0,
    })
  }

  // Cohort analysis: 8 weeks
  const cohortResult = await db.execute(sql`
    WITH weeks AS (
      SELECT generate_series AS week_offset FROM generate_series(0, 7)
    ),
    week_users AS (
      SELECT
        w.week_offset,
        up.id AS user_id
      FROM weeks w
      JOIN user_profiles up
        ON (up.created_at AT TIME ZONE ${TZ})::date >= (NOW() AT TIME ZONE ${TZ})::date - ((w.week_offset + 1) * 7)
        AND (up.created_at AT TIME ZONE ${TZ})::date < (NOW() AT TIME ZONE ${TZ})::date - (w.week_offset * 7)
    )
    SELECT
      wu.week_offset,
      COUNT(DISTINCT wu.user_id)::int AS registered,
      COUNT(DISTINCT CASE
        WHEN EXISTS (
          SELECT 1 FROM tests t
          WHERE t.user_id = wu.user_id
            AND t.started_at IS NOT NULL
            AND t.started_at >= NOW() - INTERVAL '30 days'
        ) THEN wu.user_id END)::int AS active
    FROM week_users wu
    GROUP BY wu.week_offset
    ORDER BY wu.week_offset ASC
  `)

  const cohortAnalysis = (cohortResult as any[]).map((row: any) => ({
    week: `Semana ${row.week_offset + 1}`,
    registered: row.registered,
    active: row.active,
    retentionRate: row.registered > 0 ? Math.round(row.active / row.registered * 100) : 0,
  }))

  // Pad to 8 cohorts
  while (cohortAnalysis.length < 8) {
    cohortAnalysis.push({
      week: `Semana ${cohortAnalysis.length + 1}`,
      registered: 0,
      active: 0,
      retentionRate: 0,
    })
  }

  return { retentionAnalysis, retentionRateHistory, cohortAnalysis }
}

// ============================================
// MAIN: Execute all in parallel
// ============================================

export async function getFullEngagementStats(): Promise<EngagementStatsResponse> {
  try {
    const [
      coreMetrics,
      dauMauHistory,
      activationData,
      engagementDepthData,
      habitFormationData,
      retentionData,
    ] = await Promise.all([
      getCoreMetrics(),
      getDauMauHistory(),
      getActivationData(),
      getEngagementDepthData(),
      getHabitFormationData(),
      getRetentionData(),
    ])

    return {
      ...coreMetrics,
      dauMauHistory,
      ...activationData,
      ...engagementDepthData,
      ...habitFormationData,
      ...retentionData,
    }
  } catch (error) {
    console.error('❌ [AdminEngagement] Error fetching full engagement stats:', error)
    throw error
  }
}
