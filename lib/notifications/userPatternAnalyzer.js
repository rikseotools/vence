// Analizador de patrones de usuario para notificaciones inteligentes
// Sistema para oposiciones - ilovetest

import { getSupabaseClient } from '../supabase'

export class UserPatternAnalyzer {
  constructor(userId) {
    this.userId = userId
    this.analysisCache = new Map()
    this.cacheTimeout = 30 * 60 * 1000 // 30 minutos
    this.supabase = getSupabaseClient()
  }

  // Análisis completo de patrones del usuario
  async analyzeUserPatterns() {
    const cacheKey = `patterns_${this.userId}`
    const cached = this.analysisCache.get(cacheKey)
    
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data
    }

    try {
      const [
        timePatterns,
        streakPatterns,
        performancePatterns,
        riskAssessment,
        motivationProfile
      ] = await Promise.all([
        this.analyzeTimePatterns(),
        this.analyzeStreakPatterns(),
        this.analyzePerformancePatterns(),
        this.assessRiskLevel(),
        this.buildMotivationProfile()
      ])

      const patterns = {
        timePatterns,
        streakPatterns,
        performancePatterns,
        riskAssessment,
        motivationProfile,
        lastAnalyzed: new Date().toISOString()
      }

      // Guardar en cache
      this.analysisCache.set(cacheKey, {
        data: patterns,
        timestamp: Date.now()
      })

      // Actualizar en base de datos
      await this.savePatternsToDB(patterns)

      return patterns
    } catch (error) {
      console.error('Error analyzing user patterns:', error)
      return this.getDefaultPatterns()
    }
  }

  // Analizar patrones temporales
  async analyzeTimePatterns() {
    const { data: sessions } = await this.supabase
      .from('test_sessions')
      .select('created_at, duration')
      .eq('user_id', this.userId)
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })

    if (!sessions || sessions.length === 0) {
      return this.getDefaultTimePatterns()
    }

    // Analizar horarios preferidos
    const hourCounts = {}
    const dayCounts = {}
    const weekdayPatterns = Array(7).fill(0)
    
    sessions.forEach(session => {
      const date = new Date(session.created_at)
      const hour = date.getHours()
      const day = date.getDate()
      const weekday = date.getDay()

      hourCounts[hour] = (hourCounts[hour] || 0) + 1
      dayCounts[day] = (dayCounts[day] || 0) + 1
      weekdayPatterns[weekday]++
    })

    // Encontrar horas pico
    const preferredHours = Object.entries(hourCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([hour]) => parseInt(hour))
      .sort((a, b) => a - b)

    // Encontrar días más activos
    const activeDays = weekdayPatterns
      .map((count, index) => ({ day: index, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .map(item => item.day)
      .sort()

    // Determinar patrón de estudio
    const morningCount = sessions.filter(s => new Date(s.created_at).getHours() < 12).length
    const afternoonCount = sessions.filter(s => {
      const hour = new Date(s.created_at).getHours()
      return hour >= 12 && hour < 18
    }).length
    const eveningCount = sessions.filter(s => new Date(s.created_at).getHours() >= 18).length

    let studyPattern = 'mixed'
    if (morningCount > afternoonCount && morningCount > eveningCount) {
      studyPattern = 'morning_focused'
    } else if (afternoonCount > morningCount && afternoonCount > eveningCount) {
      studyPattern = 'afternoon_focused'
    } else if (eveningCount > morningCount && eveningCount > afternoonCount) {
      studyPattern = 'evening_focused'
    }

    // Calcular duración promedio
    const avgDuration = sessions.reduce((sum, s) => sum + (s.duration || 15), 0) / sessions.length

    return {
      preferredHours,
      activeDays,
      studyPattern,
      avgSessionDuration: Math.round(avgDuration),
      totalSessions: sessions.length,
      peakHour: preferredHours[0] || 9,
      consistency: this.calculateConsistency(sessions)
    }
  }

  // Analizar patrones de racha
  async analyzeStreakPatterns() {
    const { data: sessions } = await this.supabase
      .from('test_sessions')
      .select('created_at, score')
      .eq('user_id', this.userId)
      .order('created_at', { ascending: false })
.limit(500)

    if (!sessions || sessions.length === 0) {
      return { currentStreak: 0, maxStreak: 0, avgBreakLength: 0, streakStability: 'unknown' }
    }

    const streaks = this.calculateStreaks(sessions)
    const currentStreak = this.calculateCurrentStreak(sessions)

    return {
      currentStreak,
      maxStreak: Math.max(...streaks, 0),
      avgStreakLength: streaks.length ? streaks.reduce((a, b) => a + b) / streaks.length : 0,
      streakStability: this.assessStreakStability(streaks),
      riskOfBreaking: this.assessStreakRisk(currentStreak, sessions)
    }
  }

  // Analizar patrones de rendimiento
  async analyzePerformancePatterns() {
    const { data: answers } = await this.supabase
      .from('detailed_answers')
      .select('question_id, is_correct, response_time, confidence_level, topic, created_at')
      .eq('user_id', this.userId)
      .gte('created_at', new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })

    if (!answers || answers.length === 0) {
      return this.getDefaultPerformancePatterns()
    }

    // Calcular métricas de rendimiento
    const correctAnswers = answers.filter(a => a.is_correct).length
    const accuracy = (correctAnswers / answers.length) * 100
    const avgResponseTime = answers.reduce((sum, a) => sum + (a.response_time || 30), 0) / answers.length

    // Analizar por temas
    const topicPerformance = {}
    answers.forEach(answer => {
      const topic = answer.topic || 'general'
      if (!topicPerformance[topic]) {
        topicPerformance[topic] = { correct: 0, total: 0, avgTime: 0 }
      }
      topicPerformance[topic].total++
      if (answer.is_correct) topicPerformance[topic].correct++
      topicPerformance[topic].avgTime += answer.response_time || 30
    })

    // Identificar fortalezas y debilidades
    const topicStats = Object.entries(topicPerformance).map(([topic, stats]) => ({
      topic,
      accuracy: (stats.correct / stats.total) * 100,
      avgTime: stats.avgTime / stats.total,
      sampleSize: stats.total
    }))

    const weakAreas = topicStats
      .filter(t => t.sampleSize >= 3)
      .sort((a, b) => a.accuracy - b.accuracy)
      .slice(0, 2)

    const strongAreas = topicStats
      .filter(t => t.sampleSize >= 3)
      .sort((a, b) => b.accuracy - a.accuracy)
      .slice(0, 2)

    return {
      accuracy: Math.round(accuracy),
      avgResponseTime: Math.round(avgResponseTime),
      totalAnswers: answers.length,
      weakAreas: weakAreas.map(a => a.topic),
      strongAreas: strongAreas.map(a => a.topic),
      improvementTrend: this.calculateImprovementTrend(answers),
      confidenceLevel: this.calculateAvgConfidence(answers)
    }
  }

  // Evaluar nivel de riesgo de abandono
  async assessRiskLevel() {
    const now = new Date()
    const { data: lastSession } = await this.supabase
      .from('test_sessions')
      .select('created_at, score')
      .eq('user_id', this.userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (!lastSession) {
      return { level: 'new_user', score: 0, factors: ['no_sessions'] }
    }

    const daysSinceLastSession = Math.floor(
      (now - new Date(lastSession.created_at)) / (1000 * 60 * 60 * 24)
    )

    let riskScore = 0
    const riskFactors = []

    // Factor: días sin actividad
    if (daysSinceLastSession >= 7) {
      riskScore += 4
      riskFactors.push('long_inactivity')
    } else if (daysSinceLastSession >= 3) {
      riskScore += 2
      riskFactors.push('medium_inactivity')
    } else if (daysSinceLastSession >= 1) {
      riskScore += 1
      riskFactors.push('short_inactivity')
    }

    // Factor: rendimiento reciente
    const { data: recentSessions } = await this.supabase
      .from('test_sessions')
      .select('score')
      .eq('user_id', this.userId)
      .order('created_at', { ascending: false })
      .limit(5)

    if (recentSessions && recentSessions.length > 0) {
      const avgRecentScore = recentSessions.reduce((sum, s) => sum + (s.score || 0), 0) / recentSessions.length
      if (avgRecentScore < 50) {
        riskScore += 2
        riskFactors.push('low_performance')
      }
    }

    // Factor: consistencia
    const patterns = await this.analyzeTimePatterns()
    if (patterns.consistency < 0.3) {
      riskScore += 1
      riskFactors.push('low_consistency')
    }

    // Determinar nivel de riesgo
    let riskLevel = 'low'
    if (riskScore >= 6) riskLevel = 'critical'
    else if (riskScore >= 4) riskLevel = 'high'
    else if (riskScore >= 2) riskLevel = 'medium'

    return {
      level: riskLevel,
      score: riskScore,
      factors: riskFactors,
      daysSinceLastSession
    }
  }

  // Construir perfil motivacional
  async buildMotivationProfile() {
    const patterns = await Promise.all([
      this.analyzeTimePatterns(),
      this.analyzeStreakPatterns(),
      this.analyzePerformancePatterns()
    ])

    const [timePatterns, streakPatterns, performancePatterns] = patterns

    // Determinar tipo motivacional basado en comportamiento
    let motivationType = 'balanced'
    
    if (streakPatterns.currentStreak > 10 && performancePatterns.accuracy > 80) {
      motivationType = 'high_achiever'
    } else if (streakPatterns.currentStreak > 5 && timePatterns.consistency > 0.7) {
      motivationType = 'consistent_learner'
    } else if (performancePatterns.accuracy < 60 || streakPatterns.currentStreak < 3) {
      motivationType = 'needs_support'
    } else if (timePatterns.consistency < 0.3) {
      motivationType = 'irregular_learner'
    }

    // Determinar preferencias de mensaje
    const messagePreferences = {
      urgency: motivationType === 'needs_support' ? 'high' : 'medium',
      tone: motivationType === 'high_achiever' ? 'achievement' : 'encouraging',
      frequency: motivationType === 'consistent_learner' ? 'regular' : 'adaptive',
      context: 'oposicion_focused'
    }

    return {
      type: motivationType,
      preferences: messagePreferences,
      bestTimeForNotifications: timePatterns.peakHour,
      responseToUrgency: this.assessUrgencyResponse(streakPatterns, performancePatterns)
    }
  }

  // Métodos de cálculo auxiliares
  calculateConsistency(sessions) {
    if (sessions.length < 3) return 0

    const dates = sessions.map(s => new Date(s.created_at).toDateString())
    const uniqueDates = new Set(dates).size
    const daySpan = Math.max(1, (new Date(sessions[0].created_at) - new Date(sessions[sessions.length - 1].created_at)) / (1000 * 60 * 60 * 24))
    
    return Math.min(uniqueDates / daySpan, 1)
  }

  calculateStreaks(sessions) {
    const streaks = []
    let currentStreak = 0
    let lastDate = null

    sessions.reverse().forEach(session => {
      const sessionDate = new Date(session.created_at).toDateString()
      
      if (lastDate && sessionDate !== lastDate) {
        const dayDiff = Math.floor((new Date(sessionDate) - new Date(lastDate)) / (1000 * 60 * 60 * 24))
        
        if (dayDiff === 1) {
          currentStreak++
        } else {
          if (currentStreak > 0) streaks.push(currentStreak)
          currentStreak = 1
        }
      } else if (!lastDate) {
        currentStreak = 1
      }
      
      lastDate = sessionDate
    })

    if (currentStreak > 0) streaks.push(currentStreak)
    return streaks
  }

  calculateCurrentStreak(sessions) {
    if (!sessions.length) return 0

    const today = new Date().toDateString()
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toDateString()
    
    let streak = 0
    let checkDate = new Date()
    
    for (const session of sessions) {
      const sessionDate = new Date(session.created_at).toDateString()
      const targetDate = checkDate.toDateString()
      
      if (sessionDate === targetDate) {
        streak++
        checkDate.setDate(checkDate.getDate() - 1)
      } else if (sessionDate < targetDate) {
        break
      }
    }

    return streak
  }

  calculateImprovementTrend(answers) {
    if (answers.length < 10) return 'insufficient_data'

    const first5 = answers.slice(-5).filter(a => a.is_correct).length / 5
    const last5 = answers.slice(0, 5).filter(a => a.is_correct).length / 5
    
    const improvement = last5 - first5
    
    if (improvement > 0.2) return 'improving'
    if (improvement < -0.2) return 'declining'
    return 'stable'
  }

  calculateAvgConfidence(answers) {
    const confidenceAnswers = answers.filter(a => a.confidence_level !== null)
    if (confidenceAnswers.length === 0) return 'unknown'
    
    const avgConfidence = confidenceAnswers.reduce((sum, a) => sum + a.confidence_level, 0) / confidenceAnswers.length
    
    if (avgConfidence >= 4) return 'high'
    if (avgConfidence >= 3) return 'medium'
    return 'low'
  }

  assessStreakStability(streaks) {
    if (streaks.length < 3) return 'unknown'
    
    const variance = this.calculateVariance(streaks)
    const mean = streaks.reduce((a, b) => a + b) / streaks.length
    
    const stabilityRatio = variance / (mean || 1)
    
    if (stabilityRatio < 0.5) return 'very_stable'
    if (stabilityRatio < 1) return 'stable'
    if (stabilityRatio < 2) return 'moderate'
    return 'unstable'
  }

  assessStreakRisk(currentStreak, sessions) {
    if (currentStreak === 0) return 'no_risk'
    if (currentStreak < 3) return 'low_risk'
    
    const lastSessionTime = new Date(sessions[0]?.created_at || Date.now())
    const hoursSinceLastSession = (Date.now() - lastSessionTime) / (1000 * 60 * 60)
    
    if (hoursSinceLastSession > 48) return 'high_risk'
    if (hoursSinceLastSession > 24) return 'medium_risk'
    return 'low_risk'
  }

  assessUrgencyResponse(streakPatterns, performancePatterns) {
    if (streakPatterns.currentStreak > 10 && performancePatterns.accuracy > 80) {
      return 'responds_well_to_achievement'
    }
    if (streakPatterns.currentStreak < 3 || performancePatterns.accuracy < 60) {
      return 'needs_gentle_encouragement'
    }
    return 'responds_to_standard_motivation'
  }

  calculateVariance(numbers) {
    const mean = numbers.reduce((a, b) => a + b) / numbers.length
    return numbers.reduce((sum, num) => sum + Math.pow(num - mean, 2), 0) / numbers.length
  }

  // Guardar patrones en base de datos
  async savePatternsToDB(patterns) {
    try {
      await this.supabase
        .from('user_activity_patterns')
        .upsert({
          user_id: this.userId,
          preferred_hours: patterns.timePatterns.preferredHours,
          active_days: patterns.timePatterns.activeDays,
          avg_session_duration: patterns.timePatterns.avgSessionDuration,
          peak_performance_time: `${patterns.timePatterns.peakHour}:00:00`,
          streak_pattern: patterns.timePatterns.studyPattern,
          last_calculated: new Date().toISOString()
        }, { onConflict: 'user_id' })

      // Actualizar smart scheduling
      await this.supabase
        .from('user_smart_scheduling')
        .upsert({
          user_id: this.userId,
          streak_status: patterns.streakPatterns.currentStreak,
          risk_level: patterns.riskAssessment.level,
          last_risk_calculation: new Date().toISOString()
        }, { onConflict: 'user_id' })

    } catch (error) {
      console.error('Error saving patterns to DB:', error)
    }
  }

  // Patrones por defecto
  getDefaultPatterns() {
    return {
      timePatterns: this.getDefaultTimePatterns(),
      streakPatterns: { currentStreak: 0, maxStreak: 0, avgBreakLength: 0, streakStability: 'unknown' },
      performancePatterns: this.getDefaultPerformancePatterns(),
      riskAssessment: { level: 'medium', score: 2, factors: ['new_user'] },
      motivationProfile: {
        type: 'balanced',
        preferences: { urgency: 'medium', tone: 'encouraging', frequency: 'regular' },
        bestTimeForNotifications: 9
      }
    }
  }

  getDefaultTimePatterns() {
    return {
      preferredHours: [9, 14, 20],
      activeDays: [1, 2, 3, 4, 5],
      studyPattern: 'mixed',
      avgSessionDuration: 15,
      totalSessions: 0,
      peakHour: 9,
      consistency: 0
    }
  }

  getDefaultPerformancePatterns() {
    return {
      accuracy: 0,
      avgResponseTime: 30,
      totalAnswers: 0,
      weakAreas: [],
      strongAreas: [],
      improvementTrend: 'unknown',
      confidenceLevel: 'unknown'
    }
  }
}

export default UserPatternAnalyzer