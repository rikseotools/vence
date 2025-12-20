'use client'
import { useState, useEffect } from 'react'
import { getSupabaseClient } from '@/lib/supabase'

const supabase = getSupabaseClient()

export default function PsychometricWeakAreasAnalysis({ userId }) {
  const [analysis, setAnalysis] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selectedTimeframe, setSelectedTimeframe] = useState('month') // week, month, all

  useEffect(() => {
    if (userId) {
      analyzePsychometricWeakAreas()
    }
  }, [userId, selectedTimeframe])

  const analyzePsychometricWeakAreas = async () => {
    try {
      setLoading(true)

      // Calcular fecha límite según timeframe
      let dateFilter = null
      const now = new Date()
      if (selectedTimeframe === 'week') {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        dateFilter = weekAgo.toISOString()
      } else if (selectedTimeframe === 'month') {
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        dateFilter = monthAgo.toISOString()
      }

      // Query para obtener todas las respuestas psicotécnicas del usuario
      let query = supabase
        .from('psychometric_test_answers')
        .select(`
          *,
          psychometric_questions!inner(
            id,
            question_text,
            difficulty_level,
            estimated_time_seconds,
            psychometric_sections!inner(
              section_key,
              display_name,
              question_type,
              psychometric_categories!inner(
                category_key,
                display_name
              )
            )
          ),
          psychometric_test_sessions!inner(
            session_type,
            total_questions,
            score
          )
        `)
        .eq('user_id', userId)

      if (dateFilter) {
        query = query.gte('created_at', dateFilter)
      }

      const { data: answers, error } = await query.order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching psychometric answers:', error)
        return
      }

      // Analizar áreas débiles
      const weakAreasAnalysis = analyzeWeakAreas(answers)
      setAnalysis(weakAreasAnalysis)

    } catch (error) {
      console.error('Error in analyzePsychometricWeakAreas:', error)
    } finally {
      setLoading(false)
    }
  }

  const analyzeWeakAreas = (answers) => {
    if (!answers || answers.length === 0) {
      return {
        weakSections: [],
        weakCategories: [],
        timeProblems: [],
        difficultyAnalysis: {},
        improvementRecommendations: [],
        progressTrends: {}
      }
    }

    // Análisis por sección
    const sectionStats = {}
    answers.forEach(answer => {
      const section = answer.psychometric_questions?.psychometric_sections
      if (section) {
        const key = section.section_key
        if (!sectionStats[key]) {
          sectionStats[key] = {
            display_name: section.display_name,
            question_type: section.question_type,
            category: section.psychometric_categories?.display_name,
            total: 0,
            correct: 0,
            totalTime: 0,
            timeouts: 0,
            difficultySum: 0,
            recentAnswers: [],
            estimatedTimeSum: 0
          }
        }
        
        const stats = sectionStats[key]
        stats.total++
        if (answer.is_correct) stats.correct++
        if (answer.time_taken_seconds) stats.totalTime += answer.time_taken_seconds
        if (answer.psychometric_questions?.difficulty_level) {
          stats.difficultySum += answer.psychometric_questions.difficulty_level
        }
        if (answer.psychometric_questions?.estimated_time_seconds) {
          stats.estimatedTimeSum += answer.psychometric_questions.estimated_time_seconds
        }
        
        // Track recent answers for trend analysis
        stats.recentAnswers.push({
          is_correct: answer.is_correct,
          answered_at: answer.created_at,
          time_taken: answer.time_taken_seconds
        })
        
        // Check for timeouts (taking much longer than estimated)
        const estimatedTime = answer.psychometric_questions?.estimated_time_seconds || 120
        if (answer.time_taken_seconds > estimatedTime * 1.5) {
          stats.timeouts++
        }
      }
    })

    // Calcular métricas finales por sección
    Object.keys(sectionStats).forEach(key => {
      const stats = sectionStats[key]
      stats.accuracy = Math.round((stats.correct / stats.total) * 100)
      stats.averageTime = Math.round(stats.totalTime / stats.total)
      stats.averageDifficulty = stats.difficultySum / stats.total
      stats.averageEstimatedTime = stats.estimatedTimeSum / stats.total
      stats.timeoutRate = Math.round((stats.timeouts / stats.total) * 100)
      
      // Calcular tendencia de los últimos 5 intentos
      const recent = stats.recentAnswers.slice(0, 5)
      if (recent.length >= 3) {
        const recentCorrect = recent.filter(r => r.is_correct).length
        const recentAccuracy = (recentCorrect / recent.length) * 100
        stats.recentTrend = recentAccuracy >= stats.accuracy ? 'improving' : 'declining'
      } else {
        stats.recentTrend = 'insufficient_data'
      }
    })

    // Identificar secciones débiles (< 70% acierto y al menos 3 intentos)
    const weakSections = Object.entries(sectionStats)
      .filter(([key, stats]) => stats.accuracy < 70 && stats.total >= 3)
      .sort(([,a], [,b]) => a.accuracy - b.accuracy)
      .slice(0, 8)
      .map(([key, stats]) => ({
        key,
        ...stats,
        severityScore: calculateSeverityScore(stats)
      }))

    // Análisis por categoría
    const categoryStats = {}
    answers.forEach(answer => {
      const category = answer.psychometric_questions?.psychometric_sections?.psychometric_categories
      if (category) {
        const key = category.category_key
        if (!categoryStats[key]) {
          categoryStats[key] = {
            display_name: category.display_name,
            total: 0,
            correct: 0,
            totalTime: 0
          }
        }
        categoryStats[key].total++
        if (answer.is_correct) categoryStats[key].correct++
        if (answer.time_taken_seconds) categoryStats[key].totalTime += answer.time_taken_seconds
      }
    })

    Object.keys(categoryStats).forEach(key => {
      const stats = categoryStats[key]
      stats.accuracy = Math.round((stats.correct / stats.total) * 100)
      stats.averageTime = Math.round(stats.totalTime / stats.total)
    })

    const weakCategories = Object.entries(categoryStats)
      .filter(([key, stats]) => stats.accuracy < 75 && stats.total >= 5)
      .sort(([,a], [,b]) => a.accuracy - b.accuracy)
      .map(([key, stats]) => ({ key, ...stats }))

    // Identificar problemas de tiempo
    const timeProblems = Object.entries(sectionStats)
      .filter(([key, stats]) => stats.timeoutRate > 30 && stats.total >= 3)
      .sort(([,a], [,b]) => b.timeoutRate - a.timeoutRate)
      .map(([key, stats]) => ({
        key,
        section: stats.display_name,
        category: stats.category,
        timeoutRate: stats.timeoutRate,
        averageTime: stats.averageTime,
        estimatedTime: stats.averageEstimatedTime
      }))

    // Análisis por dificultad
    const difficultyAnalysis = {}
    answers.forEach(answer => {
      const difficulty = answer.psychometric_questions?.difficulty_level || 3
      if (!difficultyAnalysis[difficulty]) {
        difficultyAnalysis[difficulty] = { total: 0, correct: 0 }
      }
      difficultyAnalysis[difficulty].total++
      if (answer.is_correct) difficultyAnalysis[difficulty].correct++
    })

    Object.keys(difficultyAnalysis).forEach(level => {
      const stats = difficultyAnalysis[level]
      stats.accuracy = Math.round((stats.correct / stats.total) * 100)
    })

    // Generar recomendaciones de mejora
    const recommendations = generateRecommendations(weakSections, timeProblems, difficultyAnalysis)

    // Análisis de tendencias de progreso
    const progressTrends = analyzeProgressTrends(sectionStats)

    return {
      weakSections,
      weakCategories,
      timeProblems,
      difficultyAnalysis,
      improvementRecommendations: recommendations,
      progressTrends
    }
  }

  const calculateSeverityScore = (stats) => {
    // Score basado en precisión, cantidad de intentos y tendencia
    let score = 0
    
    // Precisión (0-40 puntos)
    score += Math.max(0, 40 - Math.round(stats.accuracy * 0.4))
    
    // Cantidad de intentos (más intentos = más grave, 0-30 puntos)
    score += Math.min(30, stats.total * 2)
    
    // Tendencia (0-30 puntos)
    if (stats.recentTrend === 'declining') score += 30
    else if (stats.recentTrend === 'insufficient_data') score += 15
    
    return score
  }

  const generateRecommendations = (weakSections, timeProblems, difficultyAnalysis) => {
    const recommendations = []

    // Recomendaciones basadas en secciones débiles
    weakSections.forEach(section => {
      if (section.question_type === 'pie_chart') {
        recommendations.push({
          type: 'skill_improvement',
          priority: 'high',
          title: `Mejorar interpretación de gráficos`,
          description: `Tienes ${section.accuracy}% de acierto en gráficos de tarta. Practica técnicas de cálculo mental y estimación rápida.`,
          actions: [
            'Practica cálculo del 10%, 25% y 50% mentalmente',
            'Usa técnicas de descarte por aproximación',
            'Revisa patrones comunes en gráficos de sectores'
          ],
          section: section.display_name
        })
      } else if (section.question_type === 'data_tables') {
        recommendations.push({
          type: 'skill_improvement',
          priority: 'high',
          title: `Mejorar análisis de tablas`,
          description: `Precisión del ${section.accuracy}% en tablas de datos. Enfócate en lectura rápida y cross-referencing.`,
          actions: [
            'Practica localización rápida de datos en tablas',
            'Mejora técnicas de filtrado mental',
            'Trabaja en precisión bajo presión de tiempo'
          ],
          section: section.display_name
        })
      } else if (section.question_type === 'sequence_numeric') {
        recommendations.push({
          type: 'skill_improvement',
          priority: 'high',
          title: `Fortalecer series numéricas`,
          description: `${section.accuracy}% de acierto en secuencias. Domina patrones aritméticos y geométricos.`,
          actions: [
            'Identifica patrones aritméticos (suma/resta constante)',
            'Reconoce progresiones geométricas (multiplicación/división)',
            'Practica series combinadas y alternantes'
          ],
          section: section.display_name
        })
      }
    })

    // Recomendaciones basadas en problemas de tiempo
    timeProblems.forEach(problem => {
      recommendations.push({
        type: 'time_management',
        priority: 'medium',
        title: `Optimizar tiempo en ${problem.section}`,
        description: `${problem.timeoutRate}% de timeout rate. Promedio ${problem.averageTime}s vs ${problem.estimatedTime}s esperado.`,
        actions: [
          'Practica con cronómetro para mejorar velocidad',
          'Aplica técnicas de descarte rápido',
          'No te quedes bloqueado, sigue adelante'
        ],
        section: problem.section
      })
    })

    // Recomendaciones basadas en dificultad
    const highDifficultyLow = Object.entries(difficultyAnalysis)
      .filter(([level, stats]) => parseInt(level) >= 4 && stats.accuracy < 60 && stats.total >= 3)
    
    if (highDifficultyLow.length > 0) {
      recommendations.push({
        type: 'difficulty_adjustment',
        priority: 'medium',
        title: 'Construir base sólida con preguntas más fáciles',
        description: 'Bajo rendimiento en preguntas difíciles. Refuerza fundamentos primero.',
        actions: [
          'Practica más preguntas de nivel medio antes que difíciles',
          'Asegúrate de dominar conceptos básicos',
          'Incrementa dificultad gradualmente'
        ]
      })
    }

    return recommendations.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 }
      return priorityOrder[b.priority] - priorityOrder[a.priority]
    })
  }

  const analyzeProgressTrends = (sectionStats) => {
    const trends = {}
    
    Object.entries(sectionStats).forEach(([key, stats]) => {
      if (stats.total >= 5) {
        trends[key] = {
          section: stats.display_name,
          currentAccuracy: stats.accuracy,
          recentTrend: stats.recentTrend,
          totalAttempts: stats.total,
          timeImprovement: stats.averageTime < stats.averageEstimatedTime ? 'faster' : 'slower'
        }
      }
    })

    return trends
  }

  const formatTimeframe = (timeframe) => {
    switch (timeframe) {
      case 'week': return 'Última semana'
      case 'month': return 'Último mes'
      case 'all': return 'Todo el tiempo'
      default: return 'Período seleccionado'
    }
  }

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700'
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-700'
      case 'low': return 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700'
      default: return 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-900/30 dark:text-gray-300 dark:border-gray-700'
    }
  }

  const getTrendIcon = (trend) => {
    switch (trend) {
      case 'improving': return '📈'
      case 'declining': return '📉'
      case 'insufficient_data': return '❓'
      default: return '📊'
    }
  }

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-4/6"></div>
          </div>
        </div>
      </div>
    )
  }

  if (!analysis) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 text-center">
        <div className="text-gray-500 dark:text-gray-400">
          No se pudo cargar el análisis de áreas débiles
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with timeframe selector */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
              🎯 Análisis de Áreas Débiles - Psicotécnicos
            </h3>
            <select
              value={selectedTimeframe}
              onChange={(e) => setSelectedTimeframe(e.target.value)}
              className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            >
              <option value="week">Última semana</option>
              <option value="month">Último mes</option>
              <option value="all">Todo el tiempo</option>
            </select>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Análisis detallado para {formatTimeframe(selectedTimeframe).toLowerCase()}
          </p>
        </div>

        {/* Weak Sections */}
        {analysis.weakSections.length > 0 && (
          <div className="p-6">
            <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">
              📉 Secciones que requieren atención
            </h4>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {analysis.weakSections.map((section, index) => (
                <div key={section.key} className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h5 className="font-medium text-gray-900 dark:text-gray-100">{section.display_name}</h5>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{section.category}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-red-600 dark:text-red-400">{section.accuracy}%</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{section.total} intentos</div>
                    </div>
                  </div>

                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Tendencia:</span>
                      <span className="flex items-center">
                        {getTrendIcon(section.recentTrend)}
                        <span className="ml-1 capitalize">{section.recentTrend.replace('_', ' ')}</span>
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Tiempo promedio:</span>
                      <span>{section.averageTime}s</span>
                    </div>
                    {section.timeoutRate > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Rate timeout:</span>
                        <span className="text-orange-600 dark:text-orange-400">{section.timeoutRate}%</span>
                      </div>
                    )}
                  </div>

                  {/* Severity indicator */}
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                      <span>Prioridad:</span>
                      <span>
                        {section.severityScore > 70 ? 'Alta' : 
                         section.severityScore > 40 ? 'Media' : 'Baja'}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                      <div 
                        className={`h-1.5 rounded-full ${
                          section.severityScore > 70 ? 'bg-red-600' :
                          section.severityScore > 40 ? 'bg-yellow-600' : 'bg-blue-600'
                        }`}
                        style={{ width: `${Math.min(100, section.severityScore)}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Improvement Recommendations */}
      {analysis.improvementRecommendations.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
              💡 Recomendaciones de Mejora
            </h3>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {analysis.improvementRecommendations.map((rec, index) => (
                <div key={index} className={`border rounded-lg p-4 ${getPriorityColor(rec.priority)}`}>
                  <div className="flex items-start justify-between mb-3">
                    <h4 className="font-semibold">{rec.title}</h4>
                    <span className="text-xs font-medium px-2 py-1 bg-white/20 rounded">
                      {rec.priority === 'high' ? 'ALTA' : rec.priority === 'medium' ? 'MEDIA' : 'BAJA'}
                    </span>
                  </div>
                  <p className="text-sm mb-3">{rec.description}</p>
                  {rec.actions && (
                    <div>
                      <p className="text-xs font-medium mb-2">Plan de acción:</p>
                      <ul className="text-xs space-y-1">
                        {rec.actions.map((action, actionIndex) => (
                          <li key={actionIndex} className="flex items-start">
                            <span className="mr-2">•</span>
                            <span>{action}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Time Problems */}
      {analysis.timeProblems.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
              ⏱️ Problemas de Tiempo
            </h3>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {analysis.timeProblems.map((problem, index) => (
                <div key={problem.key} className="border border-orange-200 dark:border-orange-700 bg-orange-50 dark:bg-orange-900/20 rounded-lg p-4">
                  <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">{problem.section}</h4>
                  <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                    <div className="flex justify-between">
                      <span>Timeout rate:</span>
                      <span className="font-bold text-orange-600 dark:text-orange-400">{problem.timeoutRate}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Tiempo promedio:</span>
                      <span>{problem.averageTime}s</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Tiempo estimado:</span>
                      <span>{Math.round(problem.estimatedTime)}s</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* No issues found */}
      {analysis.weakSections.length === 0 && analysis.timeProblems.length === 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 text-center">
          <div className="text-6xl mb-4">🎉</div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2">
            ¡Excelente rendimiento!
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            No se detectaron áreas débiles significativas en tus tests psicotécnicos para {formatTimeframe(selectedTimeframe).toLowerCase()}.
          </p>
        </div>
      )}
    </div>
  )
}