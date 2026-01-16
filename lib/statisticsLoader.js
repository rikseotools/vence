// lib/statisticsLoader.js
// Carga estadísticas usando RPC optimizada (1 query en lugar de 15+)

/**
 * Carga todas las estadísticas del usuario con una sola RPC
 * @param {object} supabase - Cliente de Supabase
 * @param {string} userId - ID del usuario
 * @returns {object} Estadísticas completas procesadas
 */
export async function loadUserStatistics(supabase, userId) {
  console.log('📊 Cargando estadísticas con RPC optimizada...')

  const startTime = performance.now()

  // Una sola llamada RPC
  const { data, error } = await supabase.rpc('get_user_statistics_complete', {
    p_user_id: userId
  })

  const endTime = performance.now()
  console.log(`⚡ RPC completada en ${Math.round(endTime - startTime)}ms`)

  if (error) {
    console.error('❌ Error en RPC:', error)
    throw error
  }

  if (!data) {
    console.warn('⚠️ RPC retornó null, devolviendo stats vacías')
    return createEmptyStats()
  }

  // Procesar datos de la RPC
  return processRPCData(data)
}

/**
 * Procesa los datos crudos de la RPC al formato esperado por los componentes
 */
function processRPCData(data) {
  // Formatear tiempo
  const formatTime = (seconds) => {
    if (!seconds) return '0m'
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    if (hours > 0) return `${hours}h ${minutes}m`
    return minutes > 0 ? `${minutes}m` : `${seconds}s`
  }

  // Formatear título de tema
  const formatThemeTitle = (num) => {
    if (num === 0) return 'Tests aleatorios'
    if (num >= 101 && num <= 112) return `Bloque II Tema ${num - 100}`
    if (num >= 1 && num <= 16) return `Bloque I Tema ${num}`
    return `Tema ${num}`
  }

  // Procesar tests recientes
  const recentTests = (data.recent_tests || []).map(test => ({
    id: test.id,
    title: formatTestTitle(test),
    score: test.score || 0,
    total: test.total_questions || 0,
    percentage: test.percentage || 0,
    date: test.completed_at ? new Date(test.completed_at).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: 'Europe/Madrid'
    }) : 'N/A',
    time: formatTime(test.total_time_seconds || 0),
    avgTimePerQuestion: Math.round((test.total_time_seconds || 0) / (test.total_questions || 1))
  }))

  // Procesar progreso semanal
  const weeklyProgress = processWeeklyProgress(data.weekly_progress || [])

  // Procesar rendimiento por tema
  const themePerformance = (data.theme_performance || []).map(theme => ({
    theme: theme.tema_number,
    title: formatThemeTitle(theme.tema_number),
    total: theme.total,
    correct: theme.correct,
    accuracy: theme.accuracy,
    avgTime: theme.avg_time || 0,
    articlesCount: theme.articles_count || 0,
    status: getStatus(theme.accuracy)
  }))

  // Procesar rendimiento por artículo
  const articlePerformance = (data.article_performance || []).map(art => ({
    article: `Art. ${art.article_number}`,
    law: art.law_name,
    theme: art.tema_number,
    total: art.total,
    correct: art.correct,
    accuracy: art.accuracy,
    avgTime: art.avg_time || 0,
    status: getStatus(art.accuracy)
  }))

  // Procesar desglose por dificultad
  const difficultyBreakdown = (data.difficulty_breakdown || []).map(diff => ({
    difficulty: diff.difficulty,
    total: diff.total,
    correct: diff.correct,
    accuracy: diff.accuracy,
    avgTime: diff.avg_time || 0,
    trend: 'unknown'
  }))

  // Procesar patrones de tiempo
  const timePatterns = processTimePatterns(data.time_patterns || [])

  // Generar logros
  const achievements = generateAchievements({
    testsCompleted: data.tests_completed,
    totalQuestions: data.total_questions,
    accuracy: data.accuracy,
    totalStudyTime: data.total_study_time,
    currentStreak: data.current_streak
  })

  // Generar recomendaciones
  const recommendations = generateRecommendations({
    accuracy: data.accuracy,
    articlePerformance,
    themePerformance,
    averageTime: data.average_time
  })

  // Predicción de examen
  const examPredictionMarch2025 = generateExamPrediction({
    testsCompleted: data.tests_completed,
    totalQuestions: data.total_questions,
    accuracy: data.accuracy,
    themePerformance,
    activeDays: data.active_days,
    totalStudyTime: data.total_study_time,
    currentStreak: data.current_streak
  })

  return {
    // Básicas
    testsCompleted: data.tests_completed || 0,
    totalQuestions: data.total_questions || 0,
    correctAnswers: data.correct_answers || 0,
    accuracy: data.accuracy || 0,
    averageTime: data.average_time || 0,
    totalStudyTime: data.total_study_time || 0,
    currentStreak: data.current_streak || 0,
    bestScore: data.best_score || 0,
    questionsToday: data.questions_today || 0,

    // Análisis
    difficultyBreakdown,
    themePerformance,
    articlePerformance,
    recentTests,
    weeklyProgress,
    achievements,
    recommendations,
    timePatterns,
    examPredictionMarch2025,

    // Pendientes (calculados en cliente si es necesario)
    learningStyle: null,
    sessionAnalytics: null,
    examReadiness: null,
    knowledgeRetention: null,
    learningEfficiency: null,
    confidenceAnalysis: null,
    deviceAnalytics: null,
    engagementMetrics: null,
    aiImpactData: generateAIImpactData({
      difficultyBreakdown,
      articlePerformance,
      weeklyProgress,
      achievements,
      totalStudyTime: data.total_study_time,
      currentStreak: data.current_streak,
      accuracy: data.accuracy,
      averageTime: data.average_time
    })
  }
}

/**
 * Formatea el número de tema a nombre legible según oposición
 * @param {number} num - Número de tema interno
 * @returns {string} - Nombre formateado del tema
 */
function formatThemeTitle(num) {
  if (!num || num === 0) return 'Test aleatorio'
  // Tramitación Procesal: Bloque II (101-112)
  if (num >= 101 && num <= 112) return `Bloque II - Tema ${num - 100}`
  // Auxiliar/Administrativo: Bloque I (1-16)
  if (num >= 1 && num <= 16) return `Bloque I - Tema ${num}`
  // Administrativo: Bloques adicionales
  if (num >= 17 && num <= 22) return `Bloque III - Tema ${num}`
  if (num >= 23 && num <= 31) return `Bloque IV - Tema ${num}`
  if (num >= 32 && num <= 37) return `Bloque V - Tema ${num}`
  if (num >= 38 && num <= 45) return `Bloque VI - Tema ${num}`
  return `Tema ${num}`
}

/**
 * Formatea el título del test
 */
function formatTestTitle(test) {
  let title = (test.title || 'Test').replace(/ - \d+$/, '')

  // Si el título tiene formato "Test Tema XXX", extraer el número y formatear
  const temaMatch = title.match(/Test Tema (\d+)/)
  if (temaMatch) {
    const temaNum = parseInt(temaMatch[1])
    return formatThemeTitle(temaNum)
  }

  // Si tiene tema_number en el objeto test, usarlo
  if (test.tema_number && test.tema_number > 0) {
    return formatThemeTitle(test.tema_number)
  }

  if (title.includes('Tema X') || title === 'Test') {
    if (test.test_type === 'practice') title = 'Test de Práctica'
    else if (test.test_type === 'random') title = 'Test Aleatorio'
    else if (test.test_type === 'mixed') title = 'Test Mixto'
    else if (test.test_type === 'official_exam') title = 'Examen Oficial'
    else title = 'Test General'

    if (test.total_questions) {
      title += ` (${test.total_questions}p)`
    }
  }

  return title
}

/**
 * Procesa el progreso semanal
 */
function processWeeklyProgress(weeklyData) {
  const weeks = []
  const now = new Date()

  // Crear las últimas 4 semanas
  for (let i = 3; i >= 0; i--) {
    const weekStart = getMonday(now, i)
    const weekLabel = i === 0 ? 'Esta semana' :
                      i === 1 ? 'Semana pasada' :
                      `Hace ${i} semanas`

    // Buscar datos de esta semana
    const weekData = weeklyData.find(w => {
      const dataDate = new Date(w.week_start)
      return dataDate >= weekStart && dataDate < new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000)
    })

    weeks.push({
      week: weekLabel,
      testsCompleted: weekData?.tests_completed || 0,
      questionsAnswered: weekData?.questions_answered || 0,
      correctAnswers: weekData?.correct_answers || 0,
      accuracy: weekData?.accuracy || 0,
      studyTime: weekData?.study_time || 0,
      trend: 'unknown'
    })
  }

  return weeks
}

/**
 * Obtiene el lunes de una semana específica
 */
function getMonday(date, weeksBack = 0) {
  const target = new Date(date)
  target.setDate(date.getDate() - (weeksBack * 7))
  const dayOfWeek = target.getDay()
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
  target.setDate(target.getDate() - daysToMonday)
  target.setHours(0, 0, 0, 0)
  return target
}

/**
 * Determina el estado según la precisión
 */
function getStatus(accuracy) {
  if (accuracy >= 85) return 'dominado'
  if (accuracy >= 70) return 'bien'
  if (accuracy >= 50) return 'regular'
  return 'débil'
}

/**
 * Procesa patrones de tiempo
 */
function processTimePatterns(hourlyData) {
  if (!hourlyData || hourlyData.length < 2) return null

  const sortedByAccuracy = [...hourlyData].sort((a, b) => b.accuracy - a.accuracy)

  return {
    hourlyStats: hourlyData,
    bestHours: sortedByAccuracy.slice(0, 3).map(h => h.hour),
    worstHours: sortedByAccuracy.slice(-3).reverse().map(h => h.hour),
    peakPerformanceHour: sortedByAccuracy[0]?.hour || 10
  }
}

/**
 * Genera logros basados en datos reales
 */
function generateAchievements({ testsCompleted, totalQuestions, accuracy, totalStudyTime, currentStreak }) {
  return [
    {
      id: 'first_steps',
      title: '🎯 Primeros Pasos',
      description: 'Completaste tu primer test',
      unlocked: testsCompleted >= 1,
      progress: `${Math.min(testsCompleted, 1)}/1`,
      category: 'basic'
    },
    {
      id: 'dedicated_student',
      title: '📚 Estudiante Dedicado',
      description: 'Completaste 5 tests',
      unlocked: testsCompleted >= 5,
      progress: `${Math.min(testsCompleted, 5)}/5`,
      category: 'progress'
    },
    {
      id: 'question_master',
      title: '❓ Maestro de Preguntas',
      description: 'Respondiste 100 preguntas',
      unlocked: totalQuestions >= 100,
      progress: `${Math.min(totalQuestions, 100)}/100`,
      category: 'volume'
    },
    {
      id: 'accuracy_champion',
      title: '🎓 Campeón de Precisión',
      description: 'Alcanzaste 80% de precisión global',
      unlocked: accuracy >= 80,
      progress: `${accuracy}/80%`,
      category: 'skill'
    },
    {
      id: 'time_warrior',
      title: '⏰ Guerrero del Tiempo',
      description: 'Acumulaste 10 horas de estudio',
      unlocked: totalStudyTime >= 36000,
      progress: `${Math.min(Math.floor(totalStudyTime / 3600), 10)}/10h`,
      category: 'dedication'
    },
    {
      id: 'streak_master',
      title: '🔥 Maestro de la Constancia',
      description: 'Estudiaste 7 días seguidos',
      unlocked: currentStreak >= 7,
      progress: `${Math.min(currentStreak, 7)}/7 días`,
      category: 'habit'
    }
  ]
}

/**
 * Genera recomendaciones basadas en datos reales
 */
function generateRecommendations({ accuracy, articlePerformance, themePerformance, averageTime }) {
  const recommendations = []

  if (accuracy < 70) {
    recommendations.push({
      priority: 'high',
      title: 'Mejorar Precisión',
      description: `Tu precisión actual (${accuracy}%) está por debajo del objetivo`,
      action: 'Repasar errores frecuentes y reforzar conceptos básicos',
      type: 'accuracy',
      icon: '🎯'
    })
  }

  const weakArticles = articlePerformance?.filter(art => art.accuracy < 60) || []
  if (weakArticles.length > 0) {
    recommendations.push({
      priority: 'medium',
      title: 'Reforzar Artículos Débiles',
      description: `${weakArticles.length} artículos con menos del 60% de precisión`,
      action: `Estudiar: ${weakArticles.slice(0, 3).map(a => `${a.law} ${a.article}`).join(', ')}`,
      type: 'content',
      icon: '📚'
    })
  }

  const weakThemes = themePerformance?.filter(t => t.accuracy < 60) || []
  if (weakThemes.length > 0) {
    recommendations.push({
      priority: 'medium',
      title: 'Temas que Necesitan Atención',
      description: `${weakThemes.length} temas con precisión baja`,
      action: `Repasar: ${weakThemes.slice(0, 3).map(t => t.title).join(', ')}`,
      type: 'theme',
      icon: '📖'
    })
  }

  if (averageTime > 60) {
    recommendations.push({
      priority: 'low',
      title: 'Mejorar Velocidad',
      description: `Tiempo promedio: ${Math.round(averageTime)}s por pregunta`,
      action: 'Practicar tests cronometrados',
      type: 'speed',
      icon: '⏱️'
    })
  }

  return recommendations
}

/**
 * Genera predicción de examen
 */
function generateExamPrediction({ testsCompleted, totalQuestions, accuracy, themePerformance, activeDays, totalStudyTime, currentStreak }) {
  if (totalQuestions < 20) return null

  const examDate = new Date('2026-07-01')
  const today = new Date()
  const daysRemaining = Math.ceil((examDate - today) / (1000 * 60 * 60 * 24))

  const totalThemes = 28
  const studiedThemes = themePerformance?.length || 0
  const coveragePercentage = Math.round((studiedThemes / totalThemes) * 100)

  let readinessScore
  if (accuracy < 50) {
    readinessScore = Math.round(accuracy * 0.2)
  } else if (coveragePercentage < 50) {
    readinessScore = Math.round((accuracy + coveragePercentage) / 2 * 0.6)
  } else {
    readinessScore = Math.round((accuracy * 0.6) + (coveragePercentage * 0.4))
  }
  readinessScore = Math.max(1, readinessScore)
  if (accuracy < 30) readinessScore = Math.min(readinessScore, 5)

  const dailyQuestions = activeDays > 0 ? Math.round(totalQuestions / activeDays) : 0

  return {
    daysRemaining,
    readinessScore,
    readinessLevel: readinessScore >= 85 ? 'excellent' :
                   readinessScore >= 70 ? 'good' :
                   readinessScore >= 50 ? 'developing' : 'needs_improvement',
    coverage: {
      studiedThemes,
      totalThemes,
      percentage: coveragePercentage
    },
    accuracy: {
      current: accuracy,
      target: 85
    },
    calculations: {
      testsCompleted,
      totalQuestions,
      activeDays,
      totalStudyTime: `${Math.round(totalStudyTime / 3600)}h`,
      dailyQuestions,
      currentStreak
    }
  }
}

/**
 * Genera datos de impacto IA
 */
function generateAIImpactData({ difficultyBreakdown, articlePerformance, weeklyProgress, achievements, totalStudyTime, currentStreak, accuracy, averageTime }) {
  const problemsDetected = (difficultyBreakdown?.filter(d => d.accuracy < 70).length || 0) +
                          (articlePerformance?.filter(a => a.accuracy < 70).length || 0)
  const improvements = (weeklyProgress?.filter(w => w.accuracy > 0).length || 0) +
                      (achievements?.filter(a => a.unlocked).length || 0)

  return {
    totalInsights: problemsDetected + improvements + 3,
    problemsDetected,
    improvementsRecognized: improvements,
    timeOptimized: Math.floor(totalStudyTime / 3600 * 0.15),
    articlesImproved: Math.floor((articlePerformance?.filter(a => a.accuracy >= 70).length || 0) * 0.6),
    accuracyImprovement: Math.max(0, Math.floor((accuracy - 50) * 0.3)),
    speedImprovement: Math.max(0, Math.floor((60 - averageTime) * 0.1)),
    studyStreakHelped: Math.floor(currentStreak * 0.3)
  }
}

/**
 * Crea estadísticas vacías
 */
export function createEmptyStats() {
  return {
    testsCompleted: 0,
    totalQuestions: 0,
    correctAnswers: 0,
    accuracy: 0,
    averageTime: 0,
    totalStudyTime: 0,
    currentStreak: 0,
    bestScore: 0,
    difficultyBreakdown: [],
    articlePerformance: [],
    themePerformance: [],
    learningStyle: null,
    timePatterns: null,
    sessionAnalytics: null,
    examReadiness: null,
    recommendations: [],
    recentTests: [],
    achievements: [],
    weeklyProgress: [],
    knowledgeRetention: null,
    learningEfficiency: null,
    confidenceAnalysis: null,
    deviceAnalytics: null,
    engagementMetrics: null,
    aiImpactData: null,
    examPredictionMarch2025: null
  }
}
