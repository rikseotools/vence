// lib/api/admin-dashboard/schemas.ts - Schemas Zod para Admin Dashboard v2
import { z } from 'zod'

export const registrationBySourceSchema = z.record(z.string(), z.number())

export const testsByModeSchema = z.object({
  practice: z.number(),
  exam: z.number(),
})

export const testsByStudyTypeSchema = z.object({
  aleatorio: z.number(),
  porTema: z.number(),
  porLey: z.number(),
  personalizado: z.number(),
})

export const dauMauEntrySchema = z.object({
  date: z.string(),
  dau: z.number(),
  mau: z.number(),
  ratio: z.number(),
  formattedDate: z.string(),
})

export const emailStatsByTypeSchema = z.record(z.string(), z.object({
  sent: z.number(),
  opened: z.number(),
  clicked: z.number(),
  openRate: z.number(),
  clickRate: z.number(),
  name: z.string(),
}))

export const emailStatsSchema = z.object({
  totalSent: z.number(),
  totalOpened: z.number(),
  totalClicked: z.number(),
  openRate: z.number(),
  clickRate: z.number(),
  byType: emailStatsByTypeSchema,
})

export const onlineUserSchema = z.object({
  user_id: z.string(),
  full_name: z.string().nullable(),
  email: z.string().nullable(),
  is_premium: z.boolean(),
  last_seen: z.string(),
})

export const todayTestSchema = z.object({
  id: z.string(),
  started_at: z.string().nullable(),
  completed_at: z.string().nullable(),
  score: z.number().nullable(),
  total_questions: z.number(),
  user_id: z.string().nullable(),
  created_at: z.string().nullable(),
  is_completed: z.boolean(),
  user_profiles: z.object({
    full_name: z.string().nullable(),
    email: z.string().nullable(),
    is_premium: z.boolean(),
  }).nullable(),
})

export const recentUserSchema = z.object({
  user_id: z.string().nullable(),
  email: z.string().nullable(),
  full_name: z.string().nullable(),
  plan_type: z.string().nullable(),
  registration_source: z.string().nullable(),
  user_created_at: z.string().nullable(),
  is_active_student: z.boolean().nullable(),
  total_tests_30d: z.number().nullable(),
  completed_tests_30d: z.number().nullable(),
  abandoned_tests_30d: z.number().nullable(),
  last_test_date: z.string().nullable(),
  avg_score_30d: z.string().nullable(),
})

export const dashboardResponseSchema = z.object({
  stats: z.object({
    totalUsers: z.number(),
    activeUsers: z.number(),
    engagementRate: z.number(),
    testsCompletedToday: z.number(),
    testsThisWeek: z.number(),
    testsLast30Days: z.number(),
    averageAccuracy: z.number(),
    completionRate: z.number(),
    activeUsersThisWeek: z.number(),
    activeUsersLast30Days: z.number(),
    newUsersThisWeek: z.number(),
    newUsersThisWeekBySource: registrationBySourceSchema,
    newUsersToday: z.number(),
    newUsersYesterday: z.number(),
    newUsersLastWeekAtThisHour: z.number(),
    newUsersTodayBySource: registrationBySourceSchema,
    abandonedTests: z.number(),
    totalTestsAttempted: z.number(),
    usersWhoCompletedTests: z.number(),
    averageDAU: z.number(),
    MAU: z.number(),
    dauMauRatio: z.number(),
    dauMauHistory: z.array(dauMauEntrySchema),
    projectedUsersNextYear: z.number(),
    averageUsersPerDay: z.number(),
    projectedUsersPerWeek: z.number(),
    daysPassedThisWeek: z.number(),
    newUsersLastWeek: z.number(),
    weeklyGrowthRate: z.number(),
    isGrowing: z.boolean(),
    newUsersLast30Days: z.number(),
    newUsersPrevious30Days: z.number(),
    monthlyGrowthRate: z.number(),
    isGrowingMonthly: z.boolean(),
    projectedUsersNextYearMonthly: z.number(),
    testsByMode: testsByModeSchema,
    testsByStudyType: testsByStudyTypeSchema,
    testsLast15Days: z.number(),
    testsByMode15Days: testsByModeSchema,
    testsByStudyType15Days: testsByStudyTypeSchema,
  }),
  emailStats: emailStatsSchema,
  users: z.array(recentUserSchema),
  recentActivity: z.array(todayTestSchema),
  activeUsersLastWeekAtThisHour: z.number(),
  activeUsersYesterday: z.number(),
  onlineUsers: z.array(onlineUserSchema),
})

export type DashboardResponse = z.infer<typeof dashboardResponseSchema>
