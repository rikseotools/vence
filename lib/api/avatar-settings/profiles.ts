// lib/api/avatar-settings/profiles.ts - Lógica de cálculo de perfiles de avatar
// Refactorizado para usar Drizzle ORM en lugar de Supabase JS client
import { getDb, getAdminDb } from '@/db/client'
import { tests, testQuestions, userStreaks, userAvatarSettings } from '@/db/schema'
import { eq, and, gte, lt, inArray, sql } from 'drizzle-orm'
import { getAllAvatarProfiles, getAvatarProfileById } from './queries'
import type {
  CalculateProfileRequest,
  CalculateProfileResponse,
  StudyMetrics,
  AvatarProfile
} from './schemas'

// Tipo para métricas bulk por usuario
export interface BulkUserMetrics {
  userId: string
  metrics: StudyMetrics
  profileId: string
  matchedConditions: string[]
}

// ============================================
// OBTENER MÉTRICAS DE ESTUDIO DEL USUARIO
// Usa Drizzle con JOINs para evitar límite de IDs
// ============================================

export async function getStudyMetrics(userId: string): Promise<StudyMetrics> {
  const db = getDb()

  // Fechas para los cálculos
  const now = new Date()
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)

  // Métricas por defecto
  const defaultMetrics: StudyMetrics = {
    nightHoursPercentage: 0,
    morningHoursPercentage: 0,
    weeklyAccuracy: 0,
    accuracyImprovement: 0,
    hardTopicsAccuracy: 0,
    weeklyQuestionsCount: 0,
    daysStudiedThisWeek: 0,
    currentStreak: 0,
    studiedMorning: false,
    studiedAfternoon: false,
    studiedNight: false
  }

  // Siempre intentar obtener el streak primero (query simple y rápida)
  let currentStreak = 0
  try {
    const streakResult = await db
      .select({ currentStreak: userStreaks.currentStreak })
      .from(userStreaks)
      .where(eq(userStreaks.userId, userId))
      .limit(1)

    currentStreak = streakResult[0]?.currentStreak ?? 0
  } catch (error) {
    console.error('🦊 [AvatarProfiles] Error obteniendo streak:', error)
  }

  try {
    // Query con JOIN: obtener respuestas de esta semana
    // Esto evita el problema del límite de IDs en .in()
    const thisWeekAnswers = await db
      .select({
        id: testQuestions.id,
        isCorrect: testQuestions.isCorrect,
        difficulty: testQuestions.difficulty,
        createdAt: testQuestions.createdAt,
      })
      .from(testQuestions)
      .innerJoin(tests, eq(testQuestions.testId, tests.id))
      .where(and(
        eq(tests.userId, userId),
        gte(testQuestions.createdAt, oneWeekAgo.toISOString())
      ))

    if (thisWeekAnswers.length === 0) {
      console.log('🦊 [AvatarProfiles] Sin actividad esta semana para usuario:', userId)
      return {
        ...defaultMetrics,
        currentStreak
      }
    }

    // Calcular porcentajes de horario
    let nightSessions = 0
    let morningSessions = 0
    let afternoonSessions = 0

    const daysWithActivity = new Set<string>()
    let totalCorrect = 0
    let hardCorrect = 0
    let hardTotal = 0

    for (const answer of thisWeekAnswers) {
      const answerDate = new Date(answer.createdAt!)
      const hour = answerDate.getHours()
      const dayKey = answerDate.toISOString().split('T')[0]

      daysWithActivity.add(dayKey)

      // Clasificar por horario
      if (hour >= 21 || hour < 6) {
        nightSessions++
      } else if (hour >= 6 && hour < 12) {
        morningSessions++
      } else if (hour >= 12 && hour < 18) {
        afternoonSessions++
      } else {
        // 18-21 se considera noche temprana
        nightSessions++
      }

      // Contar aciertos
      if (answer.isCorrect) {
        totalCorrect++
      }

      // Temas difíciles
      if (answer.difficulty === 'hard' || answer.difficulty === 'extreme') {
        hardTotal++
        if (answer.isCorrect) {
          hardCorrect++
        }
      }
    }

    const totalAnswers = thisWeekAnswers.length

    // Query con JOIN: obtener respuestas de semana anterior para mejora
    const lastWeekAnswers = await db
      .select({
        isCorrect: testQuestions.isCorrect,
      })
      .from(testQuestions)
      .innerJoin(tests, eq(testQuestions.testId, tests.id))
      .where(and(
        eq(tests.userId, userId),
        gte(testQuestions.createdAt, twoWeeksAgo.toISOString()),
        lt(testQuestions.createdAt, oneWeekAgo.toISOString())
      ))

    const lastWeekAccuracy = lastWeekAnswers.length > 0
      ? (lastWeekAnswers.filter(a => a.isCorrect).length / lastWeekAnswers.length) * 100
      : 0

    const thisWeekAccuracy = totalAnswers > 0 ? (totalCorrect / totalAnswers) * 100 : 0

    // Calcular patrones de estudio
    const hasStudiedMorning = morningSessions > 0
    const hasStudiedAfternoon = afternoonSessions > 0
    const hasStudiedNight = nightSessions > 0

    const metrics: StudyMetrics = {
      nightHoursPercentage: totalAnswers > 0 ? (nightSessions / totalAnswers) * 100 : 0,
      morningHoursPercentage: totalAnswers > 0 ? (morningSessions / totalAnswers) * 100 : 0,
      weeklyAccuracy: thisWeekAccuracy,
      accuracyImprovement: lastWeekAccuracy > 0 ? thisWeekAccuracy - lastWeekAccuracy : 0,
      hardTopicsAccuracy: hardTotal > 0 ? (hardCorrect / hardTotal) * 100 : 0,
      weeklyQuestionsCount: totalAnswers,
      daysStudiedThisWeek: daysWithActivity.size,
      currentStreak,
      studiedMorning: hasStudiedMorning,
      studiedAfternoon: hasStudiedAfternoon,
      studiedNight: hasStudiedNight
    }

    console.log('🦊 [AvatarProfiles] Métricas calculadas:', {
      userId,
      weeklyQuestions: metrics.weeklyQuestionsCount,
      accuracy: metrics.weeklyAccuracy.toFixed(1),
      streak: metrics.currentStreak,
      daysStudied: metrics.daysStudiedThisWeek
    })

    return metrics

  } catch (error) {
    console.error('❌ [AvatarProfiles] Error calculando métricas:', error)
    // Incluso si falla, devolver el streak que ya obtuvimos
    return {
      ...defaultMetrics,
      currentStreak
    }
  }
}

// ============================================
// DETERMINAR PERFIL BASADO EN MÉTRICAS
// ============================================

interface ProfileMatch {
  profileId: string
  priority: number
  condition: string
}

export function determineProfile(metrics: StudyMetrics): { profileId: string; matchedConditions: string[] } {
  const matches: ProfileMatch[] = []

  // Evaluamos todas las condiciones y guardamos las que se cumplen

  // 🦄 Unicornio Legendario - Accuracy >90% Y >150 preguntas/semana
  if (metrics.weeklyAccuracy > 90 && metrics.weeklyQuestionsCount > 150) {
    matches.push({
      profileId: 'unicorn',
      priority: 95,
      condition: `Élite: ${metrics.weeklyAccuracy.toFixed(1)}% accuracy con ${metrics.weeklyQuestionsCount} preguntas`
    })
  }

  // 🦁 León Campeón - Accuracy >85% Y >150 preguntas/semana
  if (metrics.weeklyAccuracy > 85 && metrics.weeklyQuestionsCount > 150) {
    matches.push({
      profileId: 'champion',
      priority: 90,
      condition: `Accuracy ${metrics.weeklyAccuracy.toFixed(1)}% > 85% con ${metrics.weeklyQuestionsCount} preguntas`
    })
  }

  // 🐢 Tortuga Constante - Streak >14 días
  if (metrics.currentStreak > 14) {
    matches.push({
      profileId: 'consistent',
      priority: 85,
      condition: `Streak ${metrics.currentStreak} > 14 días`
    })
  }

  // 🐜 Hormiga Trabajadora - Estudia todos los días
  if (metrics.daysStudiedThisWeek === 7) {
    matches.push({
      profileId: 'worker_ant',
      priority: 80,
      condition: 'Estudió los 7 días de la semana'
    })
  }

  // 🐬 Delfín Inteligente - Mejora >10%
  if (metrics.accuracyImprovement > 10 && metrics.weeklyQuestionsCount >= 20) {
    matches.push({
      profileId: 'smart_dolphin',
      priority: 75,
      condition: `Mejoró ${metrics.accuracyImprovement.toFixed(1)}% > 10%`
    })
  }

  // 🦅 Águila Veloz - >100 preguntas/semana
  if (metrics.weeklyQuestionsCount > 100) {
    matches.push({
      profileId: 'speed_eagle',
      priority: 70,
      condition: `${metrics.weeklyQuestionsCount} preguntas > 100/semana`
    })
  }

  // 🐿️ Ardilla Astuta - >70% en temas difíciles
  if (metrics.hardTopicsAccuracy > 70 && metrics.weeklyQuestionsCount >= 10) {
    matches.push({
      profileId: 'clever_squirrel',
      priority: 65,
      condition: `${metrics.hardTopicsAccuracy.toFixed(1)}% en temas difíciles > 70%`
    })
  }

  // 🦉 Búho Nocturno - >50% estudio nocturno
  if (metrics.nightHoursPercentage > 50) {
    matches.push({
      profileId: 'night_owl',
      priority: 60,
      condition: `${metrics.nightHoursPercentage.toFixed(1)}% estudio nocturno > 50%`
    })
  }

  // 🐓 Gallo Madrugador - >50% estudio matutino
  if (metrics.morningHoursPercentage > 50) {
    matches.push({
      profileId: 'early_bird',
      priority: 60,
      condition: `${metrics.morningHoursPercentage.toFixed(1)}% estudio matutino > 50%`
    })
  }

  // 🐝 Abeja Productiva - Estudia mañana, tarde y noche
  if (metrics.studiedMorning && metrics.studiedAfternoon && metrics.studiedNight) {
    matches.push({
      profileId: 'busy_bee',
      priority: 55,
      condition: 'Estudió mañana, tarde y noche'
    })
  }

  // 🐨 Koala Relajado - <20 preguntas/semana (solo si hay algo de actividad)
  if (metrics.weeklyQuestionsCount > 0 && metrics.weeklyQuestionsCount < 20) {
    matches.push({
      profileId: 'relaxed_koala',
      priority: 10,
      condition: `${metrics.weeklyQuestionsCount} preguntas < 20/semana`
    })
  }

  // Ordenar por prioridad (mayor primero) y devolver el mejor match
  matches.sort((a, b) => b.priority - a.priority)

  if (matches.length > 0) {
    return {
      profileId: matches[0].profileId,
      matchedConditions: matches.map(m => `${m.profileId}: ${m.condition}`)
    }
  }

  // Si no hay matches, devolver koala (usuario sin actividad significativa)
  return {
    profileId: 'relaxed_koala',
    matchedConditions: ['Sin actividad significativa esta semana']
  }
}

// ============================================
// CALCULAR PERFIL COMPLETO
// ============================================

export async function calculateUserProfile(
  params: CalculateProfileRequest
): Promise<CalculateProfileResponse> {
  try {
    console.log('🦊 [AvatarProfiles] Calculando perfil para usuario:', params.userId)

    // 1. Obtener métricas de estudio
    const metrics = await getStudyMetrics(params.userId)

    // 2. Determinar perfil basado en métricas
    const { profileId, matchedConditions } = determineProfile(metrics)

    // 3. Obtener datos completos del perfil
    const profile = await getAvatarProfileById(profileId)

    if (!profile) {
      console.error('❌ [AvatarProfiles] Perfil no encontrado:', profileId)
      return {
        success: false,
        error: `Perfil ${profileId} no encontrado en la base de datos`
      }
    }

    console.log('✅ [AvatarProfiles] Perfil calculado:', {
      userId: params.userId,
      profile: profile.id,
      emoji: profile.emoji,
      name: profile.nameEs,
      topCondition: matchedConditions[0]
    })

    return {
      success: true,
      profile,
      metrics,
      matchedConditions
    }

  } catch (error) {
    console.error('❌ [AvatarProfiles] Error en calculateUserProfile:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    }
  }
}

// ============================================
// OBTENER PREVIEW DE PERFIL (sin guardar)
// ============================================

export async function previewUserProfile(userId: string): Promise<{
  currentProfile: AvatarProfile | null
  suggestedProfile: AvatarProfile | null
  metrics: StudyMetrics
  matchedConditions: string[]
  wouldChange: boolean
}> {
  try {
    const db = getDb()

    // Obtener métricas y calcular perfil sugerido
    const metrics = await getStudyMetrics(userId)
    const { profileId, matchedConditions } = determineProfile(metrics)
    const suggestedProfile = await getAvatarProfileById(profileId)

    // Obtener configuración actual del usuario con Drizzle
    const currentSettings = await db
      .select({ currentProfile: userAvatarSettings.currentProfile })
      .from(userAvatarSettings)
      .where(eq(userAvatarSettings.userId, userId))
      .limit(1)

    let currentProfile: AvatarProfile | null = null
    if (currentSettings[0]?.currentProfile) {
      currentProfile = await getAvatarProfileById(currentSettings[0].currentProfile)
    }

    const wouldChange = currentSettings[0]?.currentProfile !== profileId

    return {
      currentProfile,
      suggestedProfile,
      metrics,
      matchedConditions,
      wouldChange
    }
  } catch (error) {
    console.error('❌ [AvatarProfiles] Error en previewUserProfile:', error)
    throw error
  }
}

// ============================================
// CÁLCULO BULK DE MÉTRICAS (OPTIMIZADO)
// Usa una sola query SQL agregada para todos los usuarios
// ============================================

// Tipos para las métricas agregadas
interface WeekMetricsRow {
  userId: string | null
  totalQuestions: number
  correctQuestions: number
  hardQuestions: number
  hardCorrect: number
  nightSessions: number
  morningSessions: number
  afternoonSessions: number
  daysStudied: number
}

interface LastWeekMetricsRow {
  userId: string | null
  totalQuestions: number
  correctQuestions: number
}

export async function calculateBulkUserProfiles(userIds: string[]): Promise<BulkUserMetrics[]> {
  if (userIds.length === 0) return []

  // getAdminDb (max:4) — esta función solo se llama desde cron/avatar-rotation
  // (verificado 2026-05-03). Evita serializar las 2 aggregate scans pesadas
  // por el pool max:1 de usuarios. Patrón establecido en commit 76dc3ffb
  // ("perf(crons): migrar 3 crons a getAdminDb").
  const db = getAdminDb()
  const now = new Date()
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)

  console.log(`🚀 [AvatarProfiles] Calculando métricas bulk para ${userIds.length} usuarios`)

  try {
    // Obtener streaks de todos los usuarios de una vez
    const streaksData = await db
      .select({
        userId: userStreaks.userId,
        currentStreak: userStreaks.currentStreak
      })
      .from(userStreaks)
      .where(inArray(userStreaks.userId, userIds))

    const streaksMap = new Map(streaksData.map(s => [s.userId, s.currentStreak ?? 0]))

    // Query agregada para métricas de esta semana
    const thisWeekMetrics: WeekMetricsRow[] = await db
      .select({
        userId: tests.userId,
        totalQuestions: sql<number>`count(*)::int`,
        correctQuestions: sql<number>`sum(case when ${testQuestions.isCorrect} then 1 else 0 end)::int`,
        hardQuestions: sql<number>`sum(case when ${testQuestions.difficulty} in ('hard', 'extreme') then 1 else 0 end)::int`,
        hardCorrect: sql<number>`sum(case when ${testQuestions.difficulty} in ('hard', 'extreme') and ${testQuestions.isCorrect} then 1 else 0 end)::int`,
        nightSessions: sql<number>`sum(case when extract(hour from ${testQuestions.createdAt}::timestamp) >= 21 or extract(hour from ${testQuestions.createdAt}::timestamp) < 6 or extract(hour from ${testQuestions.createdAt}::timestamp) >= 18 then 1 else 0 end)::int`,
        morningSessions: sql<number>`sum(case when extract(hour from ${testQuestions.createdAt}::timestamp) >= 6 and extract(hour from ${testQuestions.createdAt}::timestamp) < 12 then 1 else 0 end)::int`,
        afternoonSessions: sql<number>`sum(case when extract(hour from ${testQuestions.createdAt}::timestamp) >= 12 and extract(hour from ${testQuestions.createdAt}::timestamp) < 18 then 1 else 0 end)::int`,
        daysStudied: sql<number>`count(distinct date(${testQuestions.createdAt}))::int`,
      })
      .from(testQuestions)
      .innerJoin(tests, eq(testQuestions.testId, tests.id))
      .where(and(
        inArray(tests.userId, userIds),
        gte(testQuestions.createdAt, oneWeekAgo.toISOString())
      ))
      .groupBy(tests.userId)

    // Query agregada para métricas de semana anterior
    const lastWeekMetrics: LastWeekMetricsRow[] = await db
      .select({
        userId: tests.userId,
        totalQuestions: sql<number>`count(*)::int`,
        correctQuestions: sql<number>`sum(case when ${testQuestions.isCorrect} then 1 else 0 end)::int`,
      })
      .from(testQuestions)
      .innerJoin(tests, eq(testQuestions.testId, tests.id))
      .where(and(
        inArray(tests.userId, userIds),
        gte(testQuestions.createdAt, twoWeeksAgo.toISOString()),
        lt(testQuestions.createdAt, oneWeekAgo.toISOString())
      ))
      .groupBy(tests.userId)

    const thisWeekMap = new Map(thisWeekMetrics.map(m => [m.userId, m]))
    const lastWeekMap = new Map(lastWeekMetrics.map(m => [m.userId, m]))

    // Procesar resultados
    const results: BulkUserMetrics[] = []

    for (const userId of userIds) {
      const thisWeek = thisWeekMap.get(userId)
      const lastWeek = lastWeekMap.get(userId)
      const streak = streaksMap.get(userId) ?? 0

      const totalAnswers = thisWeek?.totalQuestions ?? 0
      const totalCorrect = thisWeek?.correctQuestions ?? 0
      const hardTotal = thisWeek?.hardQuestions ?? 0
      const hardCorrectCount = thisWeek?.hardCorrect ?? 0
      const nightSessions = thisWeek?.nightSessions ?? 0
      const morningSessions = thisWeek?.morningSessions ?? 0
      const afternoonSessions = thisWeek?.afternoonSessions ?? 0

      const thisWeekAccuracy = totalAnswers > 0 ? (totalCorrect / totalAnswers) * 100 : 0
      const lastWeekTotal = lastWeek?.totalQuestions ?? 0
      const lastWeekAccuracy = lastWeekTotal > 0
        ? ((lastWeek?.correctQuestions ?? 0) / lastWeekTotal) * 100
        : 0

      const metrics: StudyMetrics = {
        nightHoursPercentage: totalAnswers > 0 ? (nightSessions / totalAnswers) * 100 : 0,
        morningHoursPercentage: totalAnswers > 0 ? (morningSessions / totalAnswers) * 100 : 0,
        weeklyAccuracy: thisWeekAccuracy,
        accuracyImprovement: lastWeekAccuracy > 0 ? thisWeekAccuracy - lastWeekAccuracy : 0,
        hardTopicsAccuracy: hardTotal > 0 ? (hardCorrectCount / hardTotal) * 100 : 0,
        weeklyQuestionsCount: totalAnswers,
        daysStudiedThisWeek: thisWeek?.daysStudied ?? 0,
        currentStreak: streak,
        studiedMorning: morningSessions > 0,
        studiedAfternoon: afternoonSessions > 0,
        studiedNight: nightSessions > 0
      }

      const { profileId, matchedConditions } = determineProfile(metrics)

      results.push({
        userId,
        metrics,
        profileId,
        matchedConditions
      })
    }

    console.log(`✅ [AvatarProfiles] Métricas bulk calculadas: ${results.length} usuarios`)
    return results

  } catch (error) {
    console.error('❌ [AvatarProfiles] Error en calculateBulkUserProfiles:', error)
    // Fallback: procesar uno por uno
    return calculateBulkUserProfilesFallback(userIds)
  }
}

// Fallback: procesar en paralelo con batches
async function calculateBulkUserProfilesFallback(userIds: string[]): Promise<BulkUserMetrics[]> {
  console.log(`⚠️ [AvatarProfiles] Usando fallback paralelo para ${userIds.length} usuarios`)

  const BATCH_SIZE = 20
  const results: BulkUserMetrics[] = []

  for (let i = 0; i < userIds.length; i += BATCH_SIZE) {
    const batch = userIds.slice(i, i + BATCH_SIZE)

    const batchResults = await Promise.all(
      batch.map(async (userId) => {
        try {
          const metrics = await getStudyMetrics(userId)
          const { profileId, matchedConditions } = determineProfile(metrics)
          return { userId, metrics, profileId, matchedConditions }
        } catch {
          return {
            userId,
            metrics: {
              nightHoursPercentage: 0,
              morningHoursPercentage: 0,
              weeklyAccuracy: 0,
              accuracyImprovement: 0,
              hardTopicsAccuracy: 0,
              weeklyQuestionsCount: 0,
              daysStudiedThisWeek: 0,
              currentStreak: 0,
              studiedMorning: false,
              studiedAfternoon: false,
              studiedNight: false
            },
            profileId: 'relaxed_koala',
            matchedConditions: ['Error calculando métricas']
          }
        }
      })
    )

    results.push(...batchResults)
    console.log(`📊 [AvatarProfiles] Procesados ${Math.min(i + BATCH_SIZE, userIds.length)}/${userIds.length}`)
  }

  return results
}
