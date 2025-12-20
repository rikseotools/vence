// lib/services/adaptiveDifficulty.js
'use client'

import { getSupabaseClient } from '@/lib/supabase'

const supabase = getSupabaseClient()

export class AdaptiveDifficultyService {
  constructor() {
    this.difficultyMapping = {
      'easy': 1,
      'medium': 2,
      'hard': 3,
      'extreme': 4
    }

    this.difficultyLabels = {
      1: 'easy',
      2: 'medium',
      3: 'hard',
      4: 'extreme'
    }
  }

  /**
   * Obtiene la dificultad personal de una pregunta para un usuario
   * UPDATED: Calcula desde test_questions en lugar de user_question_history
   */
  async getPersonalDifficulty(userId, questionId) {
    try {
      // Calcular desde test_questions
      const { data, error } = await supabase
        .from('test_questions')
        .select('is_correct')
        .eq('question_id', questionId)
        .eq('test_id', supabase.from('tests').select('id').eq('user_id', userId))

      if (error && error.code !== 'PGRST116') {
        throw error
      }

      if (!data || data.length === 0) {
        // No hay historial, devolver dificultad estándar de la pregunta
        const { data: questionData, error: qError } = await supabase
          .from('questions')
          .select('difficulty')
          .eq('id', questionId)
          .single()

        if (qError) throw qError

        return {
          personal_difficulty: questionData.difficulty,
          success_rate: null,
          total_attempts: 0,
          trend: 'stable',
          is_personal: false
        }
      }

      // Calcular estadísticas
      const totalAttempts = data.length
      const correctAttempts = data.filter(d => d.is_correct).length
      const successRate = (correctAttempts / totalAttempts) * 100

      // Determinar dificultad personal basada en éxito
      let personalDifficulty = 'medium'
      if (successRate >= 80) personalDifficulty = 'easy'
      else if (successRate >= 60) personalDifficulty = 'medium'
      else if (successRate >= 40) personalDifficulty = 'hard'
      else personalDifficulty = 'extreme'

      return {
        personal_difficulty: personalDifficulty,
        success_rate: successRate,
        total_attempts: totalAttempts,
        trend: 'stable', // Simplificado por ahora
        is_personal: true
      }
    } catch (error) {
      console.error('Error getting personal difficulty:', error)
      return {
        personal_difficulty: 'medium',
        success_rate: null,
        total_attempts: 0,
        trend: 'stable',
        is_personal: false
      }
    }
  }

  /**
   * Obtiene el historial de dificultades de un usuario
   * UPDATED: Usa RPC para calcular desde test_questions
   */
  async getUserDifficultyHistory(userId, options = {}) {
    try {
      // Por ahora retornar array vacío ya que no tenemos tabla de historial
      // Se podría implementar calculando desde test_questions si es necesario
      return []
    } catch (error) {
      console.error('Error getting user difficulty history:', error)
      return []
    }
  }

  /**
   * Obtiene estadísticas agregadas de dificultad del usuario
   * UPDATED: Usa RPC en lugar de tabla user_difficulty_metrics
   */
  async getUserDifficultyMetrics(userId) {
    try {
      const { data, error } = await supabase
        .rpc('get_user_difficulty_metrics', { p_user_id: userId })

      if (error) {
        console.error('RPC error:', error)
        throw error
      }

      // La RPC retorna un array, tomamos el primer elemento
      const metrics = data && data.length > 0 ? data[0] : null

      if (!metrics) {
        // Retornar métricas vacías si no hay datos
        return {
          avg_personal_difficulty: 0,
          total_questions_attempted: 0,
          questions_mastered: 0,
          questions_struggling: 0,
          accuracy_trend: 'stable'
        }
      }

      return metrics
    } catch (error) {
      console.error('Error getting user difficulty metrics:', error)
      return {
        avg_personal_difficulty: 0,
        total_questions_attempted: 0,
        questions_mastered: 0,
        questions_struggling: 0,
        accuracy_trend: 'stable'
      }
    }
  }

  /**
   * Ya no necesitamos crear métricas iniciales porque la RPC las calcula
   */
  async createInitialUserMetrics(userId) {
    // No hacer nada, la RPC maneja todo
    return {
      user_id: userId,
      avg_personal_difficulty: 0,
      total_questions_attempted: 0,
      questions_mastered: 0,
      questions_struggling: 0,
      accuracy_trend: 'stable'
    }
  }

  /**
   * Obtiene preguntas por dificultad personal para un usuario
   * UPDATED: Simplificado, no depende de tabla de historial
   */
  async getQuestionsByPersonalDifficulty(userId, difficulty, options = {}) {
    try {
      // Por ahora retornar array vacío
      // Se podría implementar calculando desde test_questions si es necesario
      return []
    } catch (error) {
      console.error('Error getting questions by personal difficulty:', error)
      return []
    }
  }

  /**
   * Calcula la distribución de dificultades personales para un usuario
   * UPDATED: Calcula desde test_questions
   */
  async getPersonalDifficultyBreakdown(userId) {
    try {
      // Obtener todas las preguntas respondidas por el usuario
      const { data: testData, error: testError } = await supabase
        .from('tests')
        .select('id')
        .eq('user_id', userId)

      if (testError) throw testError

      if (!testData || testData.length === 0) {
        return {
          easy: 0,
          medium: 0,
          hard: 0,
          extreme: 0,
          total: 0
        }
      }

      const testIds = testData.map(t => t.id)

      const { data, error } = await supabase
        .from('test_questions')
        .select('question_id, is_correct')
        .in('test_id', testIds)

      if (error) throw error

      // Agrupar por pregunta y calcular éxito
      const questionStats = {}
      data?.forEach(item => {
        if (!questionStats[item.question_id]) {
          questionStats[item.question_id] = { correct: 0, total: 0 }
        }
        questionStats[item.question_id].total++
        if (item.is_correct) questionStats[item.question_id].correct++
      })

      const breakdown = {
        easy: 0,
        medium: 0,
        hard: 0,
        extreme: 0,
        total: 0
      }

      // Clasificar cada pregunta por dificultad personal
      Object.values(questionStats).forEach(stat => {
        const successRate = (stat.correct / stat.total) * 100
        if (successRate >= 80) breakdown.easy++
        else if (successRate >= 60) breakdown.medium++
        else if (successRate >= 40) breakdown.hard++
        else breakdown.extreme++
        breakdown.total++
      })

      // Calcular porcentajes
      if (breakdown.total > 0) {
        Object.keys(breakdown).forEach(key => {
          if (key !== 'total') {
            breakdown[`${key}_percentage`] = Math.round((breakdown[key] / breakdown.total) * 100)
          }
        })
      }

      return breakdown
    } catch (error) {
      console.error('Error getting personal difficulty breakdown:', error)
      return {
        easy: 0,
        medium: 0,
        hard: 0,
        extreme: 0,
        total: 0
      }
    }
  }

  /**
   * Obtiene las preguntas más difíciles para un usuario
   * UPDATED: Usa RPC
   */
  async getStrugglingQuestions(userId, limit = 10) {
    try {
      const { data, error } = await supabase
        .rpc('get_struggling_questions', {
          p_user_id: userId,
          p_limit: limit
        })

      if (error) throw error

      // Transformar el resultado para mantener compatibilidad
      return data?.map(item => ({
        question_id: item.question_id,
        success_rate: item.success_rate / 100, // Convertir a decimal
        total_attempts: item.total_attempts,
        personal_difficulty: item.personal_difficulty,
        trend: item.trend,
        questions: {
          question_text: item.question_text
        }
      })) || []
    } catch (error) {
      console.error('Error getting struggling questions:', error)
      return []
    }
  }

  /**
   * Obtiene las preguntas dominadas por un usuario
   * UPDATED: Usa RPC
   */
  async getMasteredQuestions(userId, limit = 10) {
    try {
      const { data, error } = await supabase
        .rpc('get_mastered_questions', {
          p_user_id: userId,
          p_limit: limit
        })

      if (error) throw error

      // Transformar el resultado para mantener compatibilidad
      return data?.map(item => ({
        question_id: item.question_id,
        success_rate: item.success_rate / 100, // Convertir a decimal
        total_attempts: item.total_attempts,
        personal_difficulty: item.personal_difficulty,
        questions: {
          question_text: item.question_text
        }
      })) || []
    } catch (error) {
      console.error('Error getting mastered questions:', error)
      return []
    }
  }

  /**
   * Obtiene tendencias de progreso del usuario
   * UPDATED: Usa RPC
   */
  async getUserProgressTrends(userId) {
    try {
      const { data, error } = await supabase
        .rpc('get_user_progress_trends', { p_user_id: userId })

      if (error) throw error

      // La RPC retorna un array, tomamos el primer elemento
      const trends = data && data.length > 0 ? data[0] : null

      if (!trends) {
        return {
          improving: 0,
          declining: 0,
          stable: 0,
          total: 0
        }
      }

      return trends
    } catch (error) {
      console.error('Error getting user progress trends:', error)
      return {
        improving: 0,
        declining: 0,
        stable: 0,
        total: 0
      }
    }
  }

  /**
   * Ejecuta la migración de datos existentes
   * YA NO ES NECESARIA
   */
  async runDataMigration() {
    return {
      success: true,
      recordsProcessed: 0,
      message: 'Migration not needed - using RPC functions'
    }
  }

  /**
   * Obtiene recomendaciones personalizadas para el usuario
   * UPDATED: Usa RPC
   */
  async getPersonalizedRecommendations(userId) {
    try {
      const { data, error } = await supabase
        .rpc('get_personalized_recommendations', { p_user_id: userId })

      if (error) throw error

      return data || []
    } catch (error) {
      console.error('Error getting personalized recommendations:', error)
      return []
    }
  }
}

// Instancia singleton
export const adaptiveDifficultyService = new AdaptiveDifficultyService()