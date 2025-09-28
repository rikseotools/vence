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
   */
  async getPersonalDifficulty(userId, questionId) {
    try {
      const { data, error } = await supabase
        .from('user_question_history')
        .select('personal_difficulty, success_rate, total_attempts, trend')
        .eq('user_id', userId)
        .eq('question_id', questionId)
        .single()

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
        throw error
      }

      if (!data) {
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

      return {
        ...data,
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
   */
  async getUserDifficultyHistory(userId, options = {}) {
    try {
      let query = supabase
        .from('user_question_history')
        .select(`
          question_id,
          personal_difficulty,
          success_rate,
          total_attempts,
          trend,
          first_attempt_at,
          last_attempt_at,
          questions (
            question_text,
            difficulty,
            tags
          )
        `)
        .eq('user_id', userId)
        .order('last_attempt_at', { ascending: false })

      if (options.difficulty) {
        query = query.eq('personal_difficulty', options.difficulty)
      }

      if (options.trend) {
        query = query.eq('trend', options.trend)
      }

      if (options.limit) {
        query = query.limit(options.limit)
      }

      const { data, error } = await query

      if (error) throw error

      return data || []
    } catch (error) {
      console.error('Error getting user difficulty history:', error)
      return []
    }
  }

  /**
   * Obtiene estadísticas agregadas de dificultad del usuario
   */
  async getUserDifficultyMetrics(userId) {
    try {
      const { data, error } = await supabase
        .from('user_difficulty_metrics')
        .select('*')
        .eq('user_id', userId)
        .single()

      if (error && error.code !== 'PGRST116') {
        throw error
      }

      if (!data) {
        // Crear métricas iniciales si no existen
        return await this.createInitialUserMetrics(userId)
      }

      return data
    } catch (error) {
      console.error('Error getting user difficulty metrics:', error)
      return {
        avg_personal_difficulty: 2.50,
        total_questions_attempted: 0,
        questions_mastered: 0,
        questions_struggling: 0,
        difficulty_improved_this_week: 0,
        difficulty_declined_this_week: 0
      }
    }
  }

  /**
   * Crea métricas iniciales para un usuario nuevo
   */
  async createInitialUserMetrics(userId) {
    try {
      const initialMetrics = {
        user_id: userId,
        avg_personal_difficulty: 2.50,
        total_questions_attempted: 0,
        questions_mastered: 0,
        questions_struggling: 0,
        difficulty_improved_this_week: 0,
        difficulty_declined_this_week: 0
      }

      const { data, error } = await supabase
        .from('user_difficulty_metrics')
        .insert([initialMetrics])
        .select()
        .single()

      if (error) throw error

      return data
    } catch (error) {
      console.error('Error creating initial user metrics:', error)
      return null
    }
  }

  /**
   * Obtiene preguntas por dificultad personal para un usuario
   */
  async getQuestionsByPersonalDifficulty(userId, difficulty, options = {}) {
    try {
      let query = supabase
        .from('user_question_history')
        .select(`
          question_id,
          personal_difficulty,
          success_rate,
          trend,
          questions (
            id,
            question_text,
            option_a,
            option_b,
            option_c,
            option_d,
            correct_option,
            explanation,
            difficulty,
            tags
          )
        `)
        .eq('user_id', userId)
        .eq('personal_difficulty', difficulty)

      if (options.trend) {
        query = query.eq('trend', options.trend)
      }

      if (options.limit) {
        query = query.limit(options.limit)
      }

      query = query.order('last_attempt_at', { ascending: false })

      const { data, error } = await query

      if (error) throw error

      return data?.map(item => ({
        ...item.questions,
        personal_data: {
          personal_difficulty: item.personal_difficulty,
          success_rate: item.success_rate,
          trend: item.trend
        }
      })) || []
    } catch (error) {
      console.error('Error getting questions by personal difficulty:', error)
      return []
    }
  }

  /**
   * Calcula la distribución de dificultades personales para un usuario
   */
  async getPersonalDifficultyBreakdown(userId) {
    try {
      const { data, error } = await supabase
        .from('user_question_history')
        .select('personal_difficulty')
        .eq('user_id', userId)

      if (error) throw error

      const breakdown = {
        easy: 0,
        medium: 0,
        hard: 0,
        extreme: 0,
        total: data?.length || 0
      }

      data?.forEach(item => {
        if (breakdown.hasOwnProperty(item.personal_difficulty)) {
          breakdown[item.personal_difficulty]++
        }
      })

      // Calcular porcentajes
      const total = breakdown.total
      if (total > 0) {
        Object.keys(breakdown).forEach(key => {
          if (key !== 'total') {
            breakdown[`${key}_percentage`] = Math.round((breakdown[key] / total) * 100)
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
   */
  async getStrugglingQuestions(userId, limit = 10) {
    try {
      const { data, error } = await supabase
        .from('user_question_history')
        .select(`
          question_id,
          success_rate,
          total_attempts,
          personal_difficulty,
          trend,
          questions (
            question_text,
            tags,
            difficulty
          )
        `)
        .eq('user_id', userId)
        .lte('success_rate', 0.3)
        .gte('total_attempts', 3)
        .order('success_rate', { ascending: true })
        .limit(limit)

      if (error) throw error

      return data || []
    } catch (error) {
      console.error('Error getting struggling questions:', error)
      return []
    }
  }

  /**
   * Obtiene las preguntas dominadas por un usuario
   */
  async getMasteredQuestions(userId, limit = 10) {
    try {
      const { data, error } = await supabase
        .from('user_question_history')
        .select(`
          question_id,
          success_rate,
          total_attempts,
          personal_difficulty,
          trend,
          questions (
            question_text,
            tags,
            difficulty
          )
        `)
        .eq('user_id', userId)
        .gte('success_rate', 0.85)
        .gte('total_attempts', 3)
        .order('success_rate', { ascending: false })
        .limit(limit)

      if (error) throw error

      return data || []
    } catch (error) {
      console.error('Error getting mastered questions:', error)
      return []
    }
  }

  /**
   * Obtiene tendencias de progreso del usuario
   */
  async getUserProgressTrends(userId) {
    try {
      const { data, error } = await supabase
        .from('user_question_history')
        .select('trend, personal_difficulty')
        .eq('user_id', userId)

      if (error) throw error

      const trends = {
        improving: 0,
        declining: 0,
        stable: 0,
        total: data?.length || 0
      }

      data?.forEach(item => {
        if (trends.hasOwnProperty(item.trend)) {
          trends[item.trend]++
        }
      })

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
   */
  async runDataMigration() {
    try {
      const { data, error } = await supabase
        .rpc('migrate_existing_data')

      if (error) throw error

      return {
        success: true,
        recordsProcessed: data
      }
    } catch (error) {
      console.error('Error running data migration:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * Obtiene recomendaciones personalizadas para el usuario
   */
  async getPersonalizedRecommendations(userId) {
    try {
      const [metrics, strugglingQuestions, trends] = await Promise.all([
        this.getUserDifficultyMetrics(userId),
        this.getStrugglingQuestions(userId, 5),
        this.getUserProgressTrends(userId)
      ])

      const recommendations = []

      // Recomendación basada en preguntas difíciles
      if (strugglingQuestions.length > 0) {
        recommendations.push({
          type: 'focus_improvement',
          title: 'Enfócate en tus puntos débiles',
          description: `Tienes ${strugglingQuestions.length} preguntas que necesitan más práctica`,
          action: 'review_struggling',
          priority: 'high'
        })
      }

      // Recomendación basada en tendencias
      if (trends.declining > trends.improving) {
        recommendations.push({
          type: 'review_basics',
          title: 'Revisa conceptos fundamentales',
          description: 'Tu rendimiento ha disminuido en algunas áreas',
          action: 'practice_easy',
          priority: 'medium'
        })
      }

      // Recomendación basada en métricas
      if (metrics.questions_mastered > 10) {
        recommendations.push({
          type: 'challenge_yourself',
          title: 'Desafíate con contenido más avanzado',
          description: `Has dominado ${metrics.questions_mastered} preguntas`,
          action: 'try_harder',
          priority: 'low'
        })
      }

      return recommendations
    } catch (error) {
      console.error('Error getting personalized recommendations:', error)
      return []
    }
  }
}

// Instancia singleton
export const adaptiveDifficultyService = new AdaptiveDifficultyService()