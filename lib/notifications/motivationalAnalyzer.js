// lib/notifications/motivationalAnalyzer.js
// Analizador de datos del usuario para generar notificaciones motivacionales

import { 
  MOTIVATIONAL_NOTIFICATION_TYPES, 
  MOTIVATIONAL_CONFIG,
  getRandomMessageTemplate,
  formatNotificationMessage 
} from './motivationalTypes.js'

export class MotivationalAnalyzer {
  constructor(supabase, userId) {
    this.supabase = supabase
    this.userId = userId
  }

  // Función principal para generar notificaciones motivacionales
  async generateMotivationalNotifications() {
    try {
      console.log('🌟 Generando notificaciones motivacionales para usuario:', this.userId)
      
      // 1. Verificar que el usuario tiene actividad suficiente
      const hasMinActivity = await this.checkMinimumActivity()
      if (!hasMinActivity) {
        console.log('📊 Usuario no tiene actividad mínima para notificaciones motivacionales')
        return []
      }

      // 2. Obtener datos de análisis del usuario
      const userData = await this.getUserAnalyticsData()
      if (!userData) {
        console.log('📊 No hay datos suficientes para análisis motivacional')
        return []
      }

      // 3. Evaluar cada tipo de notificación motivacional
      const notifications = []
      
      // Progreso diario
      const progressNotification = await this.analyzeDailyProgress(userData)
      if (progressNotification) notifications.push(progressNotification)

      // === SISTEMA SOLO MOTIVACIÓN+ ===
      // Progreso constructivo (reemplaza críticas de baja preparación) - DESACTIVADO
      // const constructiveProgressNotification = await this.analyzeConstructiveProgress(userData)
      // if (constructiveProgressNotification) notifications.push(constructiveProgressNotification)

      // Aceleración positiva (reemplaza "no llegarás a tiempo")
      const positiveAccelerationNotification = await this.analyzePositiveAcceleration(userData)
      if (positiveAccelerationNotification) notifications.push(positiveAccelerationNotification)

      // Ánimo constructivo (reemplaza regresiones críticas)
      const constructiveEncouragementNotification = await this.analyzeConstructiveEncouragement(userData)
      if (constructiveEncouragementNotification) notifications.push(constructiveEncouragementNotification)

      // Mejoras de precisión
      const accuracyNotification = await this.analyzeAccuracyImprovement(userData)
      if (accuracyNotification) notifications.push(accuracyNotification)

      // Mejoras de velocidad
      const speedNotification = await this.analyzeSpeedImprovement(userData)
      if (speedNotification) notifications.push(speedNotification)

      // Artículos dominados
      const masteryNotification = await this.analyzeArticlesMastery(userData)
      if (masteryNotification) notifications.push(masteryNotification)

      // Consistencia de estudio
      const consistencyNotification = await this.analyzeStudyConsistency(userData)
      if (consistencyNotification) notifications.push(consistencyNotification)

      // Variedad de aprendizaje
      const varietyNotification = await this.analyzeLearningVariety(userData)
      if (varietyNotification) notifications.push(varietyNotification)

      // Predicción positiva de examen
      const examPredictionNotification = await this.analyzePositiveExamPrediction(userData)
      if (examPredictionNotification) notifications.push(examPredictionNotification)

      // 4. Aplicar filtros de frecuencia y límites
      const filteredNotifications = await this.applyFrequencyControl(notifications)

      console.log(`✅ ${filteredNotifications.length} notificaciones motivacionales generadas`)
      return filteredNotifications

    } catch (error) {
      console.error('❌ Error generando notificaciones motivacionales:', error)
      return []
    }
  }

  // Verificar actividad mínima del usuario
  async checkMinimumActivity() {
    try {
      const { data: tests, error } = await this.supabase
        .from('tests')
        .select('completed_at')
        .eq('user_id', this.userId)
        .eq('is_completed', true)
        .gte('completed_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())

      if (error) throw error

      return tests?.length >= MOTIVATIONAL_CONFIG.min_study_sessions
    } catch (error) {
      console.error('Error verificando actividad mínima:', error)
      return false
    }
  }

  // Obtener datos analíticos del usuario
  async getUserAnalyticsData() {
    try {
      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()

      // Tests recientes (esta query es rápida, tiene índice en user_id)
      const { data: recentTests, error: testsError } = await this.supabase
        .from('tests')
        .select('*')
        .eq('user_id', this.userId)
        .eq('is_completed', true)
        .gte('completed_at', twoWeeksAgo)
        .order('completed_at', { ascending: false })

      if (testsError) throw testsError

      // 🚀 OPTIMIZADO: Usar API con Drizzle en lugar del JOIN lento
      // Antes: JOIN test_questions con tests causaba timeout
      let responses = []
      try {
        const params = new URLSearchParams({
          action: 'analytics',
          userId: this.userId,
          days: '14'
        })

        const response = await fetch(`/api/user/question-history?${params}`)
        const data = await response.json()

        if (data.success && data.responses) {
          // Transformar camelCase a snake_case para compatibilidad
          responses = data.responses.map(r => ({
            id: r.id,
            created_at: r.createdAt,
            is_correct: r.isCorrect,
            law_name: r.lawName,
            article_number: r.articleNumber,
            tema_number: r.temaNumber
          }))
          console.log(`🚀 API OPTIMIZADA (analytics): ${responses.length} respuestas obtenidas`)
        }
      } catch (apiError) {
        console.warn('⚠️ Error en API analytics, continuando sin respuestas:', apiError.message)
      }

      return {
        recentTests: recentTests || [],
        responses: responses || [],
        oneWeekAgo,
        twoWeeksAgo
      }
    } catch (error) {
      console.error('Error obteniendo datos de usuario:', error)
      return null
    }
  }

  // 🚫 ELIMINADO: Progreso diario (el usuario ya está en la app)
  async analyzeDailyProgress(userData) {
    // No generar notificaciones de "📈 Progreso Constante" - el usuario ya está en la app
    return null
  }

  // Analizar mejoras de precisión por tema
  async analyzeAccuracyImprovement(userData) {
    try {
      const { responses, oneWeekAgo } = userData
      
      // Separar respuestas por semana
      const thisWeekResponses = responses.filter(r => r.created_at >= oneWeekAgo)
      const lastWeekResponses = responses.filter(r => r.created_at < oneWeekAgo)

      if (thisWeekResponses.length < 15 || lastWeekResponses.length < 15) return null

      // Agrupar por tema y calcular accuracy
      const thisWeekByTopic = this.groupResponsesByTopic(thisWeekResponses)
      const lastWeekByTopic = this.groupResponsesByTopic(lastWeekResponses)

      let bestImprovement = null
      let bestImprovementValue = 0

      for (const [topic, thisWeekData] of Object.entries(thisWeekByTopic)) {
        // ✅ FILTRO: Solo analizar temas que han sido estudiados en ambas semanas
        const lastWeekData = lastWeekByTopic[topic]
        if (!lastWeekData || topic === 'desconocido' || !topic || topic === 'null' || topic === 'undefined') {
          continue // No generar notificaciones sobre temas no estudiados
        }
        
        // Verificar que hay suficientes datos para análisis confiable
        if (thisWeekData.total < 10 || lastWeekData.total < 10) continue

        const thisWeekAccuracy = (thisWeekData.correct / thisWeekData.total) * 100
        const lastWeekAccuracy = (lastWeekData.correct / lastWeekData.total) * 100
        const improvement = thisWeekAccuracy - lastWeekAccuracy

        if (improvement > bestImprovementValue && improvement >= 10) {
          bestImprovementValue = improvement
          bestImprovement = {
            topic: `Tema ${topic}`,
            old_accuracy: Math.round(lastWeekAccuracy),
            new_accuracy: Math.round(thisWeekAccuracy),
            improvement: Math.round(improvement)
          }
        }
      }

      if (!bestImprovement) return null

      const template = getRandomMessageTemplate('accuracy_improvement')
      const message = formatNotificationMessage(template, bestImprovement)

      return {
        id: `motivational-accuracy-improvement`, // ✅ FIX: ID estable
        type: 'accuracy_improvement',
        title: '🎯 Mejora Detectada',
        message,
        body: message, // ✅ FIX: Add body property for notification validation
        timestamp: new Date().toISOString(),
        isRead: false,
        ...bestImprovement,
        ...MOTIVATIONAL_NOTIFICATION_TYPES.accuracy_improvement
      }
    } catch (error) {
      console.error('Error analizando mejora de precisión:', error)
      return null
    }
  }

  // Analizar mejoras de velocidad
  async analyzeSpeedImprovement(userData) {
    try {
      const { responses, oneWeekAgo } = userData
      
      const thisWeekResponses = responses.filter(r => r.created_at >= oneWeekAgo)
      const lastWeekResponses = responses.filter(r => r.created_at < oneWeekAgo)

      if (thisWeekResponses.length < 20 || lastWeekResponses.length < 20) return null

      const thisWeekAvgTime = thisWeekResponses.reduce((sum, r) => sum + (r.time_taken || 0), 0) / thisWeekResponses.length
      const lastWeekAvgTime = lastWeekResponses.reduce((sum, r) => sum + (r.time_taken || 0), 0) / lastWeekResponses.length

      const improvement = lastWeekAvgTime - thisWeekAvgTime
      
      if (improvement < 2) return null // Mejora mínima de 2 segundos

      const template = getRandomMessageTemplate('speed_improvement')
      const message = formatNotificationMessage(template, {
        improvement_seconds: Math.round(improvement),
        old_time: Math.round(lastWeekAvgTime),
        new_time: Math.round(thisWeekAvgTime)
      })

      return {
        id: `motivational-speed-improvement`, // ✅ FIX: ID estable
        type: 'speed_improvement',
        title: '⚡ Más Rápido',
        message,
        body: message, // ✅ FIX: Add body property for notification validation
        timestamp: new Date().toISOString(),
        isRead: false,
        improvement_seconds: Math.round(improvement),
        old_time: Math.round(lastWeekAvgTime),
        new_time: Math.round(thisWeekAvgTime),
        ...MOTIVATIONAL_NOTIFICATION_TYPES.speed_improvement
      }
    } catch (error) {
      console.error('Error analizando mejora de velocidad:', error)
      return null
    }
  }

  // Analizar artículos dominados (nueva maestría)
  async analyzeArticlesMastery(userData) {
    try {
      const { responses } = userData
      
      if (responses.length < 50) return null // Necesitar datos suficientes
      
      // Agrupar respuestas por artículo
      const articleStats = responses.reduce((acc, response) => {
        // ✅ FILTRO: Solo incluir artículos que realmente han sido estudiados
        if (!response.tema_number || !response.article_number || !response.law_name) {
          return acc // Saltar respuestas sin información completa de tema
        }
        
        const articleKey = `${response.law_name}-${response.article_number}`
        if (!acc[articleKey]) {
          acc[articleKey] = { 
            correct: 0, 
            total: 0, 
            tema: response.tema_number, 
            article: response.article_number,
            law: response.law_name || response.law_short_name || 'Ley'
          }
        }
        acc[articleKey].total++
        if (response.is_correct) acc[articleKey].correct++
        return acc
      }, {})

      // Encontrar artículos recién dominados (>85% y al menos 10 preguntas)
      const newMasteredArticles = []
      for (const [key, stats] of Object.entries(articleStats)) {
        // ✅ FILTRO: Solo incluir artículos con datos válidos de tema
        if (!stats.tema || stats.tema === 'desconocido' || !stats.article) {
          continue // No notificar sobre artículos sin tema identificado
        }
        
        if (stats.total >= 10) {
          const accuracy = (stats.correct / stats.total) * 100
          if (accuracy >= 85) {
            newMasteredArticles.push({
              key,
              tema: stats.tema,
              article: stats.article,
              law: stats.law,
              accuracy: Math.round(accuracy),
              total: stats.total
            })
          }
        }
      }

      const conditions = MOTIVATIONAL_NOTIFICATION_TYPES.articles_mastered.conditions
      if (newMasteredArticles.length < conditions.min_new_mastered) return null

      const articleList = newMasteredArticles
        .slice(0, 3) // Máximo 3 para no saturar
        .map(a => `${a.law} Art. ${a.article} (${a.accuracy}%)`)
        .join(', ')

      const template = getRandomMessageTemplate('articles_mastered')
      const message = formatNotificationMessage(template, {
        count: newMasteredArticles.length,
        article_list: articleList
      })

      return {
        id: `motivational-articles-mastered`, // ✅ FIX: ID estable
        type: 'articles_mastered',
        title: '🏆 Nuevos Dominios',
        message,
        body: message, // ✅ FIX: Add body property for notification validation
        timestamp: new Date().toISOString(),
        isRead: false,
        count: newMasteredArticles.length,
        article_list: articleList,
        ...MOTIVATIONAL_NOTIFICATION_TYPES.articles_mastered
      }
    } catch (error) {
      console.error('Error analizando maestría de artículos:', error)
      return null
    }
  }

  // Analizar consistencia de estudio (patrones de horarios)
  async analyzeStudyConsistency(userData) {
    try {
      const { recentTests } = userData
      
      if (recentTests.length < 10) return null

      // Analizar patrones de horarios
      const hourStats = {}
      recentTests.forEach(test => {
        const hour = new Date(test.completed_at).getHours()
        if (!hourStats[hour]) {
          hourStats[hour] = { count: 0, totalAccuracy: 0 }
        }
        hourStats[hour].count++
        hourStats[hour].totalAccuracy += test.score || 0
      })

      // Encontrar hora más productiva
      let bestHour = null
      let bestAccuracy = 0
      let bestCount = 0

      for (const [hour, stats] of Object.entries(hourStats)) {
        if (stats.count >= 3) { // Al menos 3 sesiones
          const avgAccuracy = stats.totalAccuracy / stats.count
          if (avgAccuracy > bestAccuracy) {
            bestAccuracy = avgAccuracy
            bestHour = hour
            bestCount = stats.count
          }
        }
      }

      const conditions = MOTIVATIONAL_NOTIFICATION_TYPES.study_consistency.conditions
      if (!bestHour || bestCount < conditions.min_sessions_week) return null

      const optimalTime = `${bestHour}:00-${parseInt(bestHour) + 1}:00`
      
      const template = getRandomMessageTemplate('study_consistency')
      const message = formatNotificationMessage(template, {
        optimal_time: optimalTime,
        sessions_count: bestCount,
        accuracy: Math.round(bestAccuracy)
      })

      return {
        id: `motivational-consistency-pattern`, // ✅ FIX: ID estable para evitar reapariciones
        type: 'study_consistency',
        title: '📚 Patrón Óptimo',
        message,
        body: message, // ✅ FIX: Add body property for notification validation
        timestamp: new Date().toISOString(),
        isRead: false,
        optimal_time: optimalTime,
        sessions_count: bestCount,
        accuracy: Math.round(bestAccuracy),
        ...MOTIVATIONAL_NOTIFICATION_TYPES.study_consistency
      }
    } catch (error) {
      console.error('Error analizando consistencia de estudio:', error)
      return null
    }
  }

  // Analizar variedad de aprendizaje
  async analyzeLearningVariety(userData) {
    try {
      const { recentTests } = userData
      
      if (recentTests.length < 15) return null

      // Contar tipos de tests únicos y temas tocados
      const testTypes = new Set()
      const topicsTouched = new Set()

      recentTests.forEach(test => {
        // Determinar tipo de test basado en propiedades
        if (test.test_type) {
          testTypes.add(test.test_type)
        } else {
          // Inferir tipo basado en otras propiedades
          if (test.is_quick_test) testTypes.add('quick')
          else if (test.difficulty_filter) testTypes.add('difficulty_filtered')
          else if (test.tema_filter) testTypes.add('tema_specific')
          else testTypes.add('general')
        }

        // ✅ FILTRO: Solo contar temas que realmente han sido estudiados
        if (test.tema_number && test.tema_number !== 'desconocido' && test.tema_number !== null) {
          topicsTouched.add(test.tema_number)
        }
      })

      const conditions = MOTIVATIONAL_NOTIFICATION_TYPES.learning_variety.conditions
      if (testTypes.size < conditions.min_test_types || topicsTouched.size < conditions.min_topics_touched) {
        return null
      }

      const template = getRandomMessageTemplate('learning_variety')
      const message = formatNotificationMessage(template, {
        test_types: testTypes.size,
        topics: topicsTouched.size
      })

      return {
        id: `motivational-learning-variety`, // ✅ FIX: ID estable
        type: 'learning_variety',
        title: '🎪 Aprendizaje Diverso',
        message,
        body: message, // ✅ FIX: Add body property for notification validation
        timestamp: new Date().toISOString(),
        isRead: false,
        test_types: testTypes.size,
        topics: topicsTouched.size,
        ...MOTIVATIONAL_NOTIFICATION_TYPES.learning_variety
      }
    } catch (error) {
      console.error('Error analizando variedad de aprendizaje:', error)
      return null
    }
  }

  // Analizar predicción positiva de examen
  async analyzePositiveExamPrediction(userData) {
    try {
      const { responses, recentTests } = userData
      
      if (responses.length < 100) return null // Mínimo 100 preguntas para predicción confiable

      // Calcular métricas de preparación
      const totalQuestions = responses.length
      const correctAnswers = responses.filter(r => r.is_correct).length
      const currentAccuracy = (correctAnswers / totalQuestions) * 100

      // ✅ FILTRO: Calcular cobertura de temas solo con temas realmente estudiados
      const validTopics = responses
        .filter(r => r.tema_number && r.tema_number !== 'desconocido' && r.tema_number !== null)
        .map(r => r.tema_number)
      
      const topicsCovered = new Set(validTopics).size
      const totalTopics = 15 // Asumiendo 15 temas en total
      const coveragePercentage = topicsCovered > 0 ? (topicsCovered / totalTopics) * 100 : 0

      // Calcular consistencia (días de estudio en últimas 2 semanas)
      const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
      const recentStudyDates = new Set(
        recentTests
          .filter(test => new Date(test.completed_at) >= twoWeeksAgo)
          .map(test => new Date(test.completed_at).toDateString())
      )
      const consistencyScore = (recentStudyDates.size / 14) * 100

      // Calcular score de preparación estimado
      const readinessScore = Math.round(
        (currentAccuracy * 0.4) + 
        (coveragePercentage * 0.3) + 
        (consistencyScore * 0.2) + 
        (Math.min(100, totalQuestions / 5) * 0.1) // Volumen de práctica
      )

      const conditions = MOTIVATIONAL_NOTIFICATION_TYPES.positive_exam_prediction.conditions
      if (readinessScore < conditions.min_readiness_score) return null

      // Calcular días restantes hasta febrero 2026 (estimado: 15 febrero 2026)
      const examDate = new Date('2026-02-15')
      const today = new Date()
      const daysRemaining = Math.ceil((examDate - today) / (1000 * 60 * 60 * 24))

      // Solo mostrar si el examen se acerca (menos de 365 días)
      if (daysRemaining > 365 || daysRemaining < 0) return null

      const template = getRandomMessageTemplate('positive_exam_prediction')
      const message = formatNotificationMessage(template, {
        readiness_score: readinessScore,
        exam_date: '15 febrero 2026',
        days_remaining: daysRemaining
      })

      return {
        id: `motivational-exam-prediction`, // ✅ FIX: ID estable
        type: 'positive_exam_prediction',
        title: '🎯 Predicción Examen Positiva',
        message,
        body: message, // ✅ FIX: Add body property for notification validation
        timestamp: new Date().toISOString(),
        isRead: false,
        readiness_score: readinessScore,
        days_remaining: daysRemaining,
        current_accuracy: Math.round(currentAccuracy),
        topics_covered: topicsCovered,
        consistency_score: Math.round(consistencyScore),
        ...MOTIVATIONAL_NOTIFICATION_TYPES.positive_exam_prediction
      }
    } catch (error) {
      console.error('Error analizando predicción positiva de examen:', error)
      return null
    }
  }

  // === MÉTODOS SOLO MOTIVACIÓN+ ===
  // Reemplazan notificaciones críticas con mensajes constructivos

  // Progreso constructivo (en lugar de "baja preparación")
  async analyzeConstructiveProgress(userData) {
    try {
      const { responses, recentTests } = userData
      
      if (responses.length < 20) return null

      // Calcular progreso general
      const totalQuestions = responses.length
      const correctAnswers = responses.filter(r => r.is_correct).length
      const progressPercentage = Math.round((correctAnswers / totalQuestions) * 100)

      const conditions = MOTIVATIONAL_NOTIFICATION_TYPES.constructive_progress.conditions
      if (progressPercentage < conditions.progress_percentage_threshold) return null

      // Calcular objetivos alcanzables
      const dailyQuestions = Math.ceil(totalQuestions / 7) // Promedio semanal
      const nextTarget = Math.min(progressPercentage + 15, 85)

      const template = getRandomMessageTemplate('constructive_progress')
      const message = formatNotificationMessage(template, {
        progress: progressPercentage,
        daily_questions: dailyQuestions,
        next_target: nextTarget
      })

      return {
        id: `motivational-constructive-progress`, // ✅ FIX: ID estable
        type: 'constructive_progress',
        title: '🌱 Construyendo Base Sólida',
        message,
        body: message, // ✅ FIX: Add body property for notification validation
        timestamp: new Date().toISOString(),
        isRead: false,
        progress: progressPercentage,
        daily_questions: dailyQuestions,
        next_target: nextTarget,
        ...MOTIVATIONAL_NOTIFICATION_TYPES.constructive_progress
      }
    } catch (error) {
      console.error('Error analizando progreso constructivo:', error)
      return null
    }
  }

  // Aceleración positiva (en lugar de "no llegarás a tiempo")
  async analyzePositiveAcceleration(userData) {
    try {
      const { responses, recentTests } = userData
      
      if (responses.length < 30) return null

      // Detectar si necesita acelerar pero de forma positiva
      const weeklyQuestions = responses.filter(r => 
        new Date(r.created_at) >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      ).length

      const idealWeeklyQuestions = 50 // Meta semanal
      const needsAcceleration = weeklyQuestions < idealWeeklyQuestions * 0.6

      if (!needsAcceleration) return null

      // Calcular plan optimizado CON DATOS REALES
      const targetQuestions = Math.ceil((idealWeeklyQuestions - weeklyQuestions) / 5) // 5 días restantes
      const minutesPerDay = targetQuestions * 1.5 // 1.5 min por pregunta
      const weeksToTarget = Math.ceil(targetQuestions / 10)
      
      // ✅ CALCULAR PRECISIÓN ACTUAL REAL
      const correctAnswers = responses.filter(r => r.is_correct).length
      const currentAccuracy = Math.round((correctAnswers / responses.length) * 100)
      
      // ✅ CALCULAR TARGET REALISTA (no inventado)
      const realisticTarget = Math.min(currentAccuracy + 10, 90) // Máximo mejora 10% realista
      
      // 🛡️ VALIDACIÓN: No enviar si no hay datos suficientes para cálculos reales
      if (currentAccuracy < 30 || responses.length < 50) {
        console.log('⚠️ Datos insuficientes para Plan de Aceleración preciso')
        return null // Evitar emails con datos poco fiables
      }
      
      // ✅ CALCULAR MEJORA SEMANAL REAL (no inventada)
      const lastWeekResponses = responses.filter(r => 
        new Date(r.created_at) >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      )
      const twoWeeksAgoResponses = responses.filter(r => {
        const date = new Date(r.created_at)
        const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
        const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000
        return date >= new Date(twoWeeksAgo) && date < new Date(oneWeekAgo)
      })
      
      let realWeeklyGain = 5 // Conservador por defecto
      if (lastWeekResponses.length >= 5 && twoWeeksAgoResponses.length >= 5) {
        const lastWeekAccuracy = (lastWeekResponses.filter(r => r.is_correct).length / lastWeekResponses.length) * 100
        const twoWeeksAgoAccuracy = (twoWeeksAgoResponses.filter(r => r.is_correct).length / twoWeeksAgoResponses.length) * 100
        realWeeklyGain = Math.max(Math.round(lastWeekAccuracy - twoWeeksAgoAccuracy), 2) // Mínimo 2%
      }

      const template = getRandomMessageTemplate('positive_acceleration')
      const message = formatNotificationMessage(template, {
        minutes: Math.round(minutesPerDay),
        target: realisticTarget,  // ✅ DATO REAL basado en precisión actual
        questions: targetQuestions,
        weeks: weeksToTarget,
        daily_goal: `${targetQuestions} preguntas`,
        weekly_gain: realWeeklyGain  // ✅ DATO REAL basado en mejora histórica
      })

      return {
        id: `motivational-positive-acceleration`, // ✅ FIX: ID estable
        type: 'positive_acceleration',
        title: '⚡ Plan de Aceleración',
        message,
        body: message, // ✅ FIX: Add body property for notification validation
        timestamp: new Date().toISOString(),
        isRead: false,
        minutes: Math.round(minutesPerDay),
        target_questions: targetQuestions,
        weeks: weeksToTarget,
        ...MOTIVATIONAL_NOTIFICATION_TYPES.positive_acceleration
      }
    } catch (error) {
      console.error('Error analizando aceleración positiva:', error)
      return null
    }
  }

  // Ánimo constructivo (en lugar de críticas por regresión)
  async analyzeConstructiveEncouragement(userData) {
    try {
      const { responses, recentTests } = userData
      
      if (recentTests.length < 5) return null

      // Buscar logros pasados para recordar
      const allTimeResponses = responses
      const pastAchievements = this.findPastAchievements(allTimeResponses)
      
      if (!pastAchievements.bestStreak || pastAchievements.bestStreak < 3) return null

      // Calcular progreso total
      const totalProgress = Math.round(
        (allTimeResponses.filter(r => r.is_correct).length / allTimeResponses.length) * 100
      )

      // Tema recomendado (el mejor histórico)
      const topicStats = this.groupResponsesByTopic(allTimeResponses)
      const bestTopic = Object.entries(topicStats)
        .filter(([topic, stats]) => stats.total >= 10)
        .sort((a, b) => (b[1].correct / b[1].total) - (a[1].correct / a[1].total))[0]
      
      const recommendedTopic = bestTopic ? `Tema ${bestTopic[0]}` : 'tu mejor tema'

      const template = getRandomMessageTemplate('constructive_encouragement')
      const message = formatNotificationMessage(template, {
        past_achievements: `${pastAchievements.masteredArticles} artículos`,
        best_streak: pastAchievements.bestStreak,
        total_progress: totalProgress,
        recommended_topic: recommendedTopic
      })

      return {
        id: `motivational-constructive-encouragement`, // ✅ FIX: ID estable
        type: 'constructive_encouragement',
        title: '🤗 Momento de Reflexión',
        message,
        body: message, // ✅ FIX: Add body property for notification validation
        timestamp: new Date().toISOString(),
        isRead: false,
        past_achievements: pastAchievements,
        total_progress: totalProgress,
        recommended_topic: recommendedTopic,
        ...MOTIVATIONAL_NOTIFICATION_TYPES.constructive_encouragement
      }
    } catch (error) {
      console.error('Error analizando ánimo constructivo:', error)
      return null
    }
  }

  // Funciones auxiliares
  findPastAchievements(responses) {
    // Calcular mejor racha histórica
    const studyDates = [...new Set(responses.map(r => 
      new Date(r.created_at).toDateString()
    ))].sort()
    
    let bestStreak = 0
    let currentStreak = 0
    
    for (let i = 1; i < studyDates.length; i++) {
      const prevDate = new Date(studyDates[i-1])
      const currDate = new Date(studyDates[i])
      const daysDiff = (currDate - prevDate) / (1000 * 60 * 60 * 24)
      
      if (daysDiff === 1) {
        currentStreak++
      } else {
        bestStreak = Math.max(bestStreak, currentStreak)
        currentStreak = 0
      }
    }
    bestStreak = Math.max(bestStreak, currentStreak)

    // Contar artículos dominados históricos
    const articleStats = responses.reduce((acc, response) => {
      const articleKey = `${response.law_name || 'Ley'}-${response.article_number || 'Art'}`
      if (!acc[articleKey]) {
        acc[articleKey] = { correct: 0, total: 0 }
      }
      acc[articleKey].total++
      if (response.is_correct) acc[articleKey].correct++
      return acc
    }, {})

    const masteredArticles = Object.values(articleStats)
      .filter(stats => stats.total >= 10 && (stats.correct / stats.total) >= 0.85)
      .length

    return {
      bestStreak,
      masteredArticles
    }
  }

  groupResponsesByTopic(responses) {
    return responses.reduce((acc, response) => {
      // ✅ FILTRO: Solo incluir respuestas con tema válido
      const topic = response.tema_number
      if (!topic || topic === 'desconocido' || topic === null || topic === undefined) {
        return acc // Saltar respuestas sin tema válido
      }
      
      if (!acc[topic]) {
        acc[topic] = { correct: 0, total: 0 }
      }
      acc[topic].total++
      if (response.is_correct) acc[topic].correct++
      return acc
    }, {})
  }

  formatTime(seconds) {
    if (!seconds) return '0m'
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    if (hours > 0) return `${hours}h ${minutes}m`
    return minutes > 0 ? `${minutes}m` : `${seconds}s`
  }

  async applyFrequencyControl(notifications) {
    // TODO: Implementar control de frecuencia con localStorage/BD
    // Por ahora, limitar a 1 notificación
    return notifications.slice(0, 1)
  }
}