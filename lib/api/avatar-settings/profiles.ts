// lib/api/avatar-settings/profiles.ts - Lógica de cálculo de perfiles de avatar
import { createClient } from '@supabase/supabase-js'
import { getAllAvatarProfiles, getAvatarProfileById } from './queries'
import type {
  CalculateProfileRequest,
  CalculateProfileResponse,
  StudyMetrics,
  AvatarProfile
} from './schemas'

// Cliente de Supabase con service role
function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Supabase environment variables')
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}

// ============================================
// OBTENER MÉTRICAS DE ESTUDIO DEL USUARIO
// ============================================

export async function getStudyMetrics(userId: string): Promise<StudyMetrics> {
  const supabase = getSupabaseAdmin()

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

  try {
    // 1. Obtener IDs de tests del usuario
    const { data: userTests, error: testsError } = await supabase
      .from('tests')
      .select('id')
      .eq('user_id', userId)

    if (testsError || !userTests || userTests.length === 0) {
      console.log('🦊 [AvatarProfiles] No se encontraron tests para usuario:', userId)
      return defaultMetrics
    }

    const userTestIds = userTests.map(t => t.id)

    // 2. Obtener respuestas de esta semana filtradas por tests del usuario
    const { data: userAnswers, error: answersError } = await supabase
      .from('test_questions')
      .select(`
        id,
        is_correct,
        difficulty,
        created_at,
        test_id
      `)
      .in('test_id', userTestIds)
      .gte('created_at', oneWeekAgo.toISOString())
      .order('created_at', { ascending: false })

    if (answersError) {
      console.error('🦊 [AvatarProfiles] Error obteniendo respuestas:', answersError)
      return defaultMetrics
    }

    if (userAnswers.length === 0) {
      console.log('🦊 [AvatarProfiles] Sin actividad esta semana para usuario:', userId)

      // Aún así obtener el streak
      const { data: streakData } = await supabase
        .from('user_streaks')
        .select('current_streak')
        .eq('user_id', userId)
        .single()

      return {
        ...defaultMetrics,
        currentStreak: streakData?.current_streak || 0
      }
    }

    // 2. Calcular porcentajes de horario
    let nightSessions = 0
    let morningSessions = 0
    let afternoonSessions = 0

    const daysWithActivity = new Set<string>()
    let totalCorrect = 0
    let hardCorrect = 0
    let hardTotal = 0

    for (const answer of userAnswers) {
      const answerDate = new Date(answer.created_at)
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
      if (answer.is_correct) {
        totalCorrect++
      }

      // Temas difíciles
      if (answer.difficulty === 'hard' || answer.difficulty === 'extreme') {
        hardTotal++
        if (answer.is_correct) {
          hardCorrect++
        }
      }
    }

    const totalAnswers = userAnswers.length

    // 3. Calcular accuracy de semana anterior para mejora
    const { data: lastWeekAnswers } = await supabase
      .from('test_questions')
      .select('id, is_correct')
      .in('test_id', userTestIds)
      .gte('created_at', twoWeeksAgo.toISOString())
      .lt('created_at', oneWeekAgo.toISOString())

    const lastWeekAccuracy = (lastWeekAnswers && lastWeekAnswers.length > 0)
      ? (lastWeekAnswers.filter(a => a.is_correct).length / lastWeekAnswers.length) * 100
      : 0

    const thisWeekAccuracy = totalAnswers > 0 ? (totalCorrect / totalAnswers) * 100 : 0

    // 4. Obtener streak actual
    const { data: streakData } = await supabase
      .from('user_streaks')
      .select('current_streak')
      .eq('user_id', userId)
      .single()

    // 5. Calcular patrones de estudio
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
      currentStreak: streakData?.current_streak || 0,
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
    return defaultMetrics
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

  // 🦁 León Campeón - Accuracy >85%
  if (metrics.weeklyAccuracy > 85 && metrics.weeklyQuestionsCount >= 20) {
    matches.push({
      profileId: 'champion',
      priority: 90,
      condition: `Accuracy ${metrics.weeklyAccuracy.toFixed(1)}% > 85%`
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
    // Obtener métricas y calcular perfil sugerido
    const metrics = await getStudyMetrics(userId)
    const { profileId, matchedConditions } = determineProfile(metrics)
    const suggestedProfile = await getAvatarProfileById(profileId)

    // Obtener configuración actual del usuario
    const supabase = getSupabaseAdmin()
    const { data: currentSettings } = await supabase
      .from('user_avatar_settings')
      .select('current_profile')
      .eq('user_id', userId)
      .single()

    let currentProfile: AvatarProfile | null = null
    if (currentSettings?.current_profile) {
      currentProfile = await getAvatarProfileById(currentSettings.current_profile)
    }

    const wouldChange = currentSettings?.current_profile !== profileId

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
