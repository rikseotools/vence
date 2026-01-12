// hooks/useTopicUnlock.js - Hook para obtener progreso del usuario por tema
// NOTA: Simplificado - ya no hay sistema de bloqueo, solo tracking de progreso
'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'

export function useTopicUnlock() {
  const { user, supabase } = useAuth()
  const [topicProgress, setTopicProgress] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user && supabase) {
      loadUserProgress()
    } else {
      setTopicProgress({})
      setLoading(false)
    }
  }, [user, supabase])

  // Cargar progreso del usuario desde la base de datos
  const loadUserProgress = async () => {
    if (!user) return

    try {
      setLoading(true)

      const { data: themeStatsData, error } = await supabase
        .rpc('get_user_theme_stats', { p_user_id: user.id })

      if (error) {
        console.error('Error loading user theme stats:', error)
        setTopicProgress({})
        return
      }

      // Procesar progreso por tema
      const progress = {}

      if (themeStatsData && themeStatsData.length > 0) {
        themeStatsData.forEach(row => {
          const temaNumber = row.tema_number
          if (typeof temaNumber !== 'number') return

          // Convertir de 0-indexed a 1-indexed
          const actualTemaNumber = temaNumber + 1

          const accuracy = parseInt(row.accuracy) || 0
          const questionsAnswered = parseInt(row.total) || 0

          progress[actualTemaNumber] = {
            accuracy,
            questionsAnswered,
            masteryLevel: accuracy >= 90 ? 'expert' : accuracy >= 70 ? 'good' : 'beginner',
            lastStudy: row.last_study ? new Date(row.last_study) : null
          }
        })
      }

      setTopicProgress(progress)

    } catch (error) {
      console.error('Error in loadUserProgress:', error)
      setTopicProgress({})
    } finally {
      setLoading(false)
    }
  }

  // Obtener progreso de un tema específico
  const getTopicProgress = (topicNumber) => {
    return topicProgress[topicNumber] || {
      accuracy: 0,
      questionsAnswered: 0,
      masteryLevel: null
    }
  }

  // Actualizar progreso cuando el usuario complete tests
  const updateTopicProgress = async () => {
    if (!user) return
    await loadUserProgress()
  }

  return {
    topicProgress,
    loading,
    getTopicProgress,
    updateTopicProgress,
    refreshProgress: loadUserProgress
  }
}
