// lib/api/admin-dashboard/queries.ts - Drizzle queries para Admin Dashboard v2
// Consolida 13 queries secuenciales del cliente en ~6 queries paralelas en servidor
import { getDb } from '@/db/client'
import { userProfiles, tests, testQuestions, emailLogs, adminUsersWithRoles } from '@/db/schema'
import { eq, sql, gte, lt, lte, and, isNotNull, desc } from 'drizzle-orm'
import type { DashboardResponse } from './schemas'

// -- Helpers de fechas (zona horaria Madrid) --

function getMadridDates() {
  const now = new Date()
  const nowMadrid = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Madrid' }))

  // Madrid's UTC offset: difference between Madrid local time and actual UTC
  const madridOffsetMs = nowMadrid.getTime() - now.getTime()

  // Convert a "Madrid local" Date to correct UTC ISO string
  const toISO = (madridLocal: Date) => new Date(madridLocal.getTime() - madridOffsetMs).toISOString()

  const currentHour = nowMadrid.getHours()
  const currentMinute = nowMadrid.getMinutes()

  const startOfToday = new Date(nowMadrid)
  startOfToday.setHours(0, 0, 0, 0)

  const startOfYesterday = new Date(startOfToday)
  startOfYesterday.setDate(startOfYesterday.getDate() - 1)

  const dayOfWeek = nowMadrid.getDay()
  const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
  const thisMonday = new Date(nowMadrid)
  thisMonday.setDate(nowMadrid.getDate() - daysFromMonday)
  thisMonday.setHours(0, 0, 0, 0)

  const lastMonday = new Date(thisMonday)
  lastMonday.setDate(lastMonday.getDate() - 7)

  const startOfLastWeekSameDay = new Date(startOfToday)
  startOfLastWeekSameDay.setDate(startOfLastWeekSameDay.getDate() - 7)

  const lastWeekAtThisHour = new Date(startOfLastWeekSameDay)
  lastWeekAtThisHour.setHours(currentHour, currentMinute, 0, 0)

  const thirtyDaysAgo = new Date(startOfToday)
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const sixtyDaysAgo = new Date(startOfToday)
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60)

  const fifteenDaysAgo = new Date(nowMadrid)
  fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15)

  const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000)

  const daysPassedThisWeek = dayOfWeek === 0 ? 7 : dayOfWeek

  return {
    startOfToday: toISO(startOfToday),
    startOfYesterday: toISO(startOfYesterday),
    thisMonday: toISO(thisMonday),
    lastMonday: toISO(lastMonday),
    startOfLastWeekSameDay: toISO(startOfLastWeekSameDay),
    lastWeekAtThisHour: toISO(lastWeekAtThisHour),
    thirtyDaysAgo: toISO(thirtyDaysAgo),
    sixtyDaysAgo: toISO(sixtyDaysAgo),
    fifteenDaysAgo: toISO(fifteenDaysAgo),
    fifteenMinAgo: fifteenMinAgo.toISOString(),
    daysPassedThisWeek,
  }
}

// -- Query 1: User registration stats (reemplaza select * from admin_users_with_roles limit 5000 + JS filtering) --

async function queryUserStats(dates: ReturnType<typeof getMadridDates>) {
  const db = getDb()

  const [counts] = await db
    .select({
      totalUsers: sql<number>`count(*)::int`,
      activeUsers: sql<number>`(select count(distinct ${tests.userId})::int from ${tests})`,
      newUsersToday: sql<number>`count(*) filter (where ${userProfiles.createdAt} >= ${dates.startOfToday})::int`,
      newUsersYesterday: sql<number>`count(*) filter (where ${userProfiles.createdAt} >= ${dates.startOfYesterday} and ${userProfiles.createdAt} < ${dates.startOfToday})::int`,
      newUsersThisWeek: sql<number>`count(*) filter (where ${userProfiles.createdAt} >= ${dates.thisMonday})::int`,
      newUsersLastWeek: sql<number>`count(*) filter (where ${userProfiles.createdAt} >= ${dates.lastMonday} and ${userProfiles.createdAt} < ${dates.thisMonday})::int`,
      newUsersLast30Days: sql<number>`count(*) filter (where ${userProfiles.createdAt} >= ${dates.thirtyDaysAgo})::int`,
      newUsersPrevious30Days: sql<number>`count(*) filter (where ${userProfiles.createdAt} >= ${dates.sixtyDaysAgo} and ${userProfiles.createdAt} < ${dates.thirtyDaysAgo})::int`,
      newUsersLastWeekAtThisHour: sql<number>`count(*) filter (where ${userProfiles.createdAt} >= ${dates.startOfLastWeekSameDay} and ${userProfiles.createdAt} <= ${dates.lastWeekAtThisHour})::int`,
    })
    .from(userProfiles)

  return counts
}

// -- Query 1b: Registration by source --

async function queryRegistrationBySource(dates: ReturnType<typeof getMadridDates>) {
  const db = getDb()

  const rows = await db
    .select({
      source: sql<string>`coalesce(${userProfiles.registrationSource}, 'unknown')`,
      today: sql<number>`count(*) filter (where ${userProfiles.createdAt} >= ${dates.startOfToday})::int`,
      thisWeek: sql<number>`count(*) filter (where ${userProfiles.createdAt} >= ${dates.thisMonday})::int`,
    })
    .from(userProfiles)
    .where(gte(userProfiles.createdAt, dates.thisMonday))
    .groupBy(sql`coalesce(${userProfiles.registrationSource}, 'unknown')`)

  const todayBySource: Record<string, number> = {}
  const weekBySource: Record<string, number> = {}
  for (const row of rows) {
    if (row.today > 0) todayBySource[row.source] = row.today
    if (row.thisWeek > 0) weekBySource[row.source] = row.thisWeek
  }

  return { todayBySource, weekBySource }
}

// -- Query 2: Test stats (30 days) - reemplaza 3 queries + JS filtering --

async function queryTestStats(dates: ReturnType<typeof getMadridDates>) {
  const db = getDb()

  // Use raw SQL for this complex aggregation - single scan of tests table
  const result = await db.execute(sql`
    select
      count(*)::int as total_attempts,
      count(*) filter (where is_completed and completed_at is not null and score is not null and total_questions > 0 and score::numeric >= 0) as completed_tests,
      count(*) filter (where not is_completed) as abandoned_tests,
      coalesce(round(avg(
        case when is_completed and completed_at is not null and score is not null and total_questions > 0 and score::numeric >= 0 then
          least(100, greatest(0, case when score::numeric <= total_questions::numeric then (score::numeric / total_questions::numeric) * 100 else score::numeric end))
        end
      ))::int, 0) as avg_accuracy,
      count(*) filter (where is_completed and completed_at is not null and score is not null and total_questions > 0 and test_type = 'practice') as practice_30d,
      count(*) filter (where is_completed and completed_at is not null and score is not null and total_questions > 0 and test_type = 'exam') as exam_30d,
      count(*) filter (where is_completed and completed_at is not null and score is not null and total_questions > 0 and (test_url like '%/test-aleatorio%' or test_url like '%/test/rapido%')) as aleatorio_30d,
      count(*) filter (where is_completed and completed_at is not null and score is not null and total_questions > 0 and tema_number is not null) as por_tema_30d,
      count(*) filter (where is_completed and completed_at is not null and score is not null and total_questions > 0 and test_url like '%/leyes/%') as por_ley_30d,
      count(*) filter (where is_completed and completed_at is not null and score is not null and total_questions > 0 and test_url like '%/test-personalizado%' and tema_number is null) as personalizado_30d,
      count(*) filter (where is_completed and completed_at is not null and completed_at >= ${dates.thisMonday}) as tests_this_week,
      count(*) filter (where is_completed and completed_at is not null and score is not null and total_questions > 0 and created_at >= ${dates.fifteenDaysAgo}) as tests_15d,
      count(*) filter (where is_completed and completed_at is not null and created_at >= ${dates.fifteenDaysAgo} and test_type = 'practice') as practice_15d,
      count(*) filter (where is_completed and completed_at is not null and created_at >= ${dates.fifteenDaysAgo} and test_type = 'exam') as exam_15d,
      count(*) filter (where is_completed and completed_at is not null and created_at >= ${dates.fifteenDaysAgo} and (test_url like '%/test-aleatorio%' or test_url like '%/test/rapido%')) as aleatorio_15d,
      count(*) filter (where is_completed and completed_at is not null and created_at >= ${dates.fifteenDaysAgo} and tema_number is not null) as por_tema_15d,
      count(*) filter (where is_completed and completed_at is not null and created_at >= ${dates.fifteenDaysAgo} and test_url like '%/leyes/%') as por_ley_15d,
      count(*) filter (where is_completed and completed_at is not null and created_at >= ${dates.fifteenDaysAgo} and test_url like '%/test-personalizado%' and tema_number is null) as personalizado_15d,
      count(distinct user_id) filter (where is_completed and completed_at >= ${dates.thisMonday}) as active_users_this_week,
      count(distinct user_id) filter (where is_completed and completed_at is not null) as active_users_last_30_days
    from tests
    where created_at >= ${dates.thirtyDaysAgo}
  `)

  const s = (result[0] ?? {}) as Record<string, number>
  return {
    totalAttempts: Number(s.total_attempts) || 0,
    completedTests: Number(s.completed_tests) || 0,
    abandonedTests: Number(s.abandoned_tests) || 0,
    avgAccuracy: Number(s.avg_accuracy) || 0,
    practice30d: Number(s.practice_30d) || 0,
    exam30d: Number(s.exam_30d) || 0,
    aleatorio30d: Number(s.aleatorio_30d) || 0,
    porTema30d: Number(s.por_tema_30d) || 0,
    porLey30d: Number(s.por_ley_30d) || 0,
    personalizado30d: Number(s.personalizado_30d) || 0,
    testsThisWeek: Number(s.tests_this_week) || 0,
    tests15d: Number(s.tests_15d) || 0,
    practice15d: Number(s.practice_15d) || 0,
    exam15d: Number(s.exam_15d) || 0,
    aleatorio15d: Number(s.aleatorio_15d) || 0,
    porTema15d: Number(s.por_tema_15d) || 0,
    porLey15d: Number(s.por_ley_15d) || 0,
    personalizado15d: Number(s.personalizado_15d) || 0,
    activeUsersThisWeek: Number(s.active_users_this_week) || 0,
    activeUsersLast30Days: Number(s.active_users_last_30_days) || 0,
    usersWithTests: Number(s.active_users_last_30_days) || 0,
  }
}

// -- Query 3: Today's activity with user profiles (reemplaza 2 queries secuenciales) --

async function queryTodayActivity(dates: ReturnType<typeof getMadridDates>) {
  const db = getDb()

  const rows = await db
    .select({
      id: tests.id,
      startedAt: tests.startedAt,
      completedAt: tests.completedAt,
      score: tests.score,
      totalQuestions: tests.totalQuestions,
      userId: tests.userId,
      createdAt: tests.createdAt,
      isCompleted: tests.isCompleted,
      fullName: userProfiles.fullName,
      email: userProfiles.email,
      planType: userProfiles.planType,
    })
    .from(tests)
    .leftJoin(userProfiles, eq(userProfiles.id, tests.userId))
    .where(and(
      isNotNull(tests.startedAt),
      gte(tests.startedAt, dates.startOfToday),
    ))
    .orderBy(desc(tests.startedAt))

  return rows.map(r => ({
    id: r.id,
    started_at: r.startedAt,
    completed_at: r.completedAt,
    score: r.score ? Number(r.score) : null,
    total_questions: r.totalQuestions,
    user_id: r.userId,
    created_at: r.createdAt,
    is_completed: r.isCompleted ?? false,
    user_profiles: r.fullName || r.email ? {
      full_name: r.fullName,
      email: r.email,
      is_premium: r.planType === 'premium',
    } : null,
  }))
}

// -- Query 4: Active users yesterday + last week at this hour --

async function queryActiveUsersComparison(dates: ReturnType<typeof getMadridDates>) {
  const db = getDb()

  const [result] = await db
    .select({
      activeYesterday: sql<number>`count(distinct ${tests.userId}) filter (where ${tests.startedAt} >= ${dates.startOfYesterday} and ${tests.startedAt} < ${dates.startOfToday})::int`,
      activeLastWeekAtThisHour: sql<number>`count(distinct ${tests.userId}) filter (where ${tests.startedAt} >= ${dates.startOfLastWeekSameDay} and ${tests.startedAt} <= ${dates.lastWeekAtThisHour})::int`,
    })
    .from(tests)
    .where(and(
      isNotNull(tests.startedAt),
      gte(tests.startedAt, dates.startOfLastWeekSameDay),
    ))

  return result
}

// -- Query 5: Online users (last 15 min) --

async function queryOnlineUsers(dates: ReturnType<typeof getMadridDates>) {
  const db = getDb()

  const rows = await db
    .select({
      userId: tests.userId,
      lastSeen: sql<string>`max(${testQuestions.createdAt})`,
      fullName: userProfiles.fullName,
      email: userProfiles.email,
      planType: userProfiles.planType,
    })
    .from(testQuestions)
    .innerJoin(tests, eq(tests.id, testQuestions.testId))
    .leftJoin(userProfiles, eq(userProfiles.id, tests.userId))
    .where(gte(testQuestions.createdAt, dates.fifteenMinAgo))
    .groupBy(tests.userId, userProfiles.fullName, userProfiles.email, userProfiles.planType)

  return rows
    .filter(r => r.userId)
    .map(r => ({
      user_id: r.userId!,
      full_name: r.fullName,
      email: r.email,
      is_premium: r.planType === 'premium',
      last_seen: r.lastSeen,
    }))
}

// -- Query 6: Email stats this week --

async function queryEmailStats(dates: ReturnType<typeof getMadridDates>) {
  const db = getDb()

  const rows = await db
    .select({
      emailType: emailLogs.emailType,
      sent: sql<number>`count(*)::int`,
      opened: sql<number>`count(*) filter (where ${emailLogs.openedAt} is not null)::int`,
      clicked: sql<number>`count(*) filter (where ${emailLogs.clickedAt} is not null)::int`,
    })
    .from(emailLogs)
    .where(gte(emailLogs.sentAt, dates.thisMonday))
    .groupBy(emailLogs.emailType)

  const emailTypeNames: Record<string, string> = {
    'bienvenida_inmediato': 'Bienvenida',
    'reactivacion': 'Reactivacion',
    'urgente': 'Urgente',
    'bienvenida_motivacional': 'Motivacional',
  }

  let totalSent = 0, totalOpened = 0, totalClicked = 0
  const byType: Record<string, { sent: number; opened: number; clicked: number; openRate: number; clickRate: number; name: string }> = {}

  for (const row of rows) {
    totalSent += row.sent
    totalOpened += row.opened
    totalClicked += row.clicked
    byType[row.emailType] = {
      sent: row.sent,
      opened: row.opened,
      clicked: row.clicked,
      openRate: row.sent > 0 ? Math.round((row.opened / row.sent) * 100) : 0,
      clickRate: row.sent > 0 ? Math.round((row.clicked / row.sent) * 100) : 0,
      name: emailTypeNames[row.emailType] || row.emailType,
    }
  }

  return {
    totalSent,
    totalOpened,
    totalClicked,
    openRate: totalSent > 0 ? Math.round((totalOpened / totalSent) * 100) : 0,
    clickRate: totalSent > 0 ? Math.round((totalClicked / totalSent) * 100) : 0,
    byType,
  }
}

// -- Query 7: DAU per day (last 30 days) for DAU/MAU history --

async function queryDauHistory(dates: ReturnType<typeof getMadridDates>) {
  const db = getDb()

  const rows = await db
    .select({
      day: sql<string>`(${tests.completedAt}::timestamptz AT TIME ZONE 'Europe/Madrid')::date::text`,
      dau: sql<number>`count(distinct ${tests.userId})::int`,
    })
    .from(tests)
    .where(and(
      eq(tests.isCompleted, true),
      isNotNull(tests.completedAt),
      gte(tests.completedAt, dates.thirtyDaysAgo),
    ))
    .groupBy(sql`(${tests.completedAt}::timestamptz AT TIME ZONE 'Europe/Madrid')::date`)
    .orderBy(sql`(${tests.completedAt}::timestamptz AT TIME ZONE 'Europe/Madrid')::date`)

  // Build lookup
  const dauByDay = new Map<string, number>()
  for (const row of rows) {
    dauByDay.set(row.day, row.dau)
  }

  return dauByDay
}

// -- Query 8: Top 10 recent users (from admin view, already optimized with limit) --

async function queryRecentUsers() {
  const db = getDb()

  return db
    .select()
    .from(adminUsersWithRoles)
    .orderBy(desc(adminUsersWithRoles.userCreatedAt))
    .limit(10)
}

// -- Query 9: Engagement (total users with completed tests ever) --

async function queryEngagement() {
  const db = getDb()

  // Two simple queries instead of correlated subquery
  const [totalResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(userProfiles)

  const [withTestsResult] = await db
    .select({ count: sql<number>`count(distinct ${tests.userId})::int` })
    .from(tests)
    .where(eq(tests.isCompleted, true))

  const total = totalResult?.count ?? 0
  const withTests = withTestsResult?.count ?? 0

  return {
    totalUsers: total,
    usersWithTests: withTests,
    engagementRate: total > 0 ? Math.round((withTests / total) * 100) : 0,
  }
}

// -- Computaciones derivadas (proyecciones, DAU/MAU, etc.) --

function computeProjections(userStats: Awaited<ReturnType<typeof queryUserStats>>, dates: ReturnType<typeof getMadridDates>) {
  const { newUsersThisWeek, newUsersLastWeek, newUsersLast30Days, newUsersPrevious30Days, totalUsers } = userStats

  const averageUsersPerDay = dates.daysPassedThisWeek > 0 ? newUsersThisWeek / dates.daysPassedThisWeek : 0
  const projectedUsersPerWeek = averageUsersPerDay * 7

  // Weekly growth
  let weeklyGrowthRate = 0
  let isGrowing = true
  if (newUsersLastWeek > 0 && projectedUsersPerWeek > 0) {
    weeklyGrowthRate = ((projectedUsersPerWeek / newUsersLastWeek) - 1) * 100
    isGrowing = weeklyGrowthRate >= 0
  } else if (newUsersLastWeek === 0 && projectedUsersPerWeek > 0) {
    weeklyGrowthRate = 100; isGrowing = true
  } else if (newUsersLastWeek > 0 && projectedUsersPerWeek === 0) {
    weeklyGrowthRate = -100; isGrowing = false
  }

  // Annual projection (weekly)
  let projectedUsersNextYear = totalUsers
  if (projectedUsersPerWeek > 0) {
    if (isGrowing && weeklyGrowthRate > 0) {
      const linearProjection = projectedUsersPerWeek * 52
      const cappedGrowthRate = Math.min(weeklyGrowthRate / 100, 0.10)
      const compoundProjection = projectedUsersPerWeek * ((Math.pow(1 + cappedGrowthRate, 52) - 1) / cappedGrowthRate)
      projectedUsersNextYear = totalUsers + Math.round((linearProjection * 0.7) + (compoundProjection * 0.3))
    } else {
      const decayFactor = Math.max(0.5, 1 + (weeklyGrowthRate / 100))
      projectedUsersNextYear = totalUsers + Math.round(projectedUsersPerWeek * 52 * decayFactor)
    }
  }

  // Monthly growth
  let monthlyGrowthRate = 0
  let isGrowingMonthly = true
  if (newUsersPrevious30Days > 0 && newUsersLast30Days > 0) {
    monthlyGrowthRate = ((newUsersLast30Days / newUsersPrevious30Days) - 1) * 100
    isGrowingMonthly = monthlyGrowthRate >= 0
  } else if (newUsersPrevious30Days === 0 && newUsersLast30Days > 0) {
    monthlyGrowthRate = 100; isGrowingMonthly = true
  } else if (newUsersPrevious30Days > 0 && newUsersLast30Days === 0) {
    monthlyGrowthRate = -100; isGrowingMonthly = false
  }

  // Annual projection (monthly)
  let projectedUsersNextYearMonthly = totalUsers
  if (newUsersLast30Days > 0) {
    if (isGrowingMonthly && monthlyGrowthRate > 0) {
      const cappedMonthlyGrowth = Math.min(monthlyGrowthRate / 100, 0.30)
      const monthlyCompound = newUsersLast30Days * ((Math.pow(1 + cappedMonthlyGrowth, 12) - 1) / cappedMonthlyGrowth)
      const monthlyLinear = newUsersLast30Days * 12
      projectedUsersNextYearMonthly = totalUsers + Math.round((monthlyLinear * 0.8) + (monthlyCompound * 0.2))
    } else {
      const decayFactor = Math.max(0.5, 1 + (monthlyGrowthRate / 100))
      projectedUsersNextYearMonthly = totalUsers + Math.round(newUsersLast30Days * 12 * decayFactor)
    }
  }

  return {
    averageUsersPerDay,
    projectedUsersPerWeek,
    weeklyGrowthRate,
    isGrowing,
    projectedUsersNextYear,
    monthlyGrowthRate,
    isGrowingMonthly,
    projectedUsersNextYearMonthly,
  }
}

function computeDauMauHistory(dauByDay: Map<string, number>, mau30d: number) {
  const history = []
  const today = new Date()

  for (let i = 29; i >= 0; i--) {
    const date = new Date(today.getTime() - i * 24 * 60 * 60 * 1000)
    const dateKey = date.toISOString().split('T')[0]
    const dau = dauByDay.get(dateKey) ?? 0
    const ratio = mau30d > 0 ? Math.round((dau / mau30d) * 100) : 0

    history.push({
      date: dateKey,
      dau,
      mau: mau30d,
      ratio,
      formattedDate: date.toLocaleDateString('es-ES', { month: 'short', day: 'numeric' }),
    })
  }

  return history
}

// -- Main: ejecutar todo en paralelo --

export async function getDashboardData(): Promise<DashboardResponse> {
  const dates = getMadridDates()

  // 10 queries paralelas en vez de 13 secuenciales del cliente
  const [
    userStats,
    sourceStats,
    testStats,
    todayActivity,
    activeComparison,
    onlineUsers,
    emailStats,
    dauByDay,
    recentUsers,
    engagement,
  ] = await Promise.all([
    queryUserStats(dates),
    queryRegistrationBySource(dates),
    queryTestStats(dates),
    queryTodayActivity(dates),
    queryActiveUsersComparison(dates),
    queryOnlineUsers(dates),
    queryEmailStats(dates),
    queryDauHistory(dates),
    queryRecentUsers(),
    queryEngagement(),
  ])

  const projections = computeProjections(
    { ...userStats, totalUsers: engagement.totalUsers },
    dates,
  )

  // DAU promedio (7 dias)
  const last7Days: number[] = []
  const today = new Date()
  for (let i = 0; i < 7; i++) {
    const dateKey = new Date(today.getTime() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    last7Days.push(dauByDay.get(dateKey) ?? 0)
  }
  const averageDAU = last7Days.length > 0
    ? Math.round(last7Days.reduce((s, v) => s + v, 0) / last7Days.length)
    : 0

  const MAU = testStats.activeUsersLast30Days
  const dauMauRatio = MAU > 0 ? Math.round((averageDAU / MAU) * 100) : 0
  const dauMauHistory = computeDauMauHistory(dauByDay, MAU)

  const completionRate = testStats.totalAttempts > 0
    ? Math.min(100, Math.max(0, Math.round((testStats.completedTests / testStats.totalAttempts) * 100)))
    : 0

  return {
    stats: {
      totalUsers: engagement.totalUsers,
      activeUsers: userStats.activeUsers,
      engagementRate: engagement.engagementRate,
      testsCompletedToday: todayActivity.length,
      testsThisWeek: testStats.testsThisWeek,
      testsLast30Days: testStats.completedTests,
      averageAccuracy: testStats.avgAccuracy ?? 0,
      completionRate,
      activeUsersThisWeek: testStats.activeUsersThisWeek,
      activeUsersLast30Days: testStats.activeUsersLast30Days,
      newUsersThisWeek: userStats.newUsersThisWeek,
      newUsersThisWeekBySource: sourceStats.weekBySource,
      newUsersToday: userStats.newUsersToday,
      newUsersYesterday: userStats.newUsersYesterday,
      newUsersLastWeekAtThisHour: userStats.newUsersLastWeekAtThisHour,
      newUsersTodayBySource: sourceStats.todayBySource,
      abandonedTests: testStats.abandonedTests,
      totalTestsAttempted: testStats.totalAttempts,
      usersWhoCompletedTests: engagement.usersWithTests,
      averageDAU,
      MAU,
      dauMauRatio,
      dauMauHistory,
      ...projections,
      daysPassedThisWeek: dates.daysPassedThisWeek,
      newUsersLastWeek: userStats.newUsersLastWeek,
      newUsersLast30Days: userStats.newUsersLast30Days,
      newUsersPrevious30Days: userStats.newUsersPrevious30Days,
      testsByMode: { practice: testStats.practice30d, exam: testStats.exam30d },
      testsByStudyType: {
        aleatorio: testStats.aleatorio30d,
        porTema: testStats.porTema30d,
        porLey: testStats.porLey30d,
        personalizado: testStats.personalizado30d,
      },
      testsLast15Days: testStats.tests15d,
      testsByMode15Days: { practice: testStats.practice15d, exam: testStats.exam15d },
      testsByStudyType15Days: {
        aleatorio: testStats.aleatorio15d,
        porTema: testStats.porTema15d,
        porLey: testStats.porLey15d,
        personalizado: testStats.personalizado15d,
      },
    },
    emailStats,
    users: recentUsers.map(u => ({
      user_id: u.userId,
      email: u.email,
      full_name: u.fullName,
      plan_type: u.planType,
      registration_source: u.registrationSource,
      user_created_at: u.userCreatedAt,
      is_active_student: u.isActiveStudent,
      total_tests_30d: u.totalTests30D,
      completed_tests_30d: u.completedTests30D,
      abandoned_tests_30d: u.abandonedTests30D,
      last_test_date: u.lastTestDate,
      avg_score_30d: u.avgScore30D,
    })),
    recentActivity: todayActivity,
    activeUsersLastWeekAtThisHour: activeComparison.activeLastWeekAtThisHour,
    activeUsersYesterday: activeComparison.activeYesterday,
    onlineUsers,
  }
}
