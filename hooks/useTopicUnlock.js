// hooks/useTopicUnlock.js - Hook para obtener progreso del usuario por tema
// NOTA: Simplificado - ya no hay sistema de bloqueo, solo tracking de progreso
'use client'
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'

/**
 * Hook para obtener progreso del usuario por tema
 * @param {Object} options - Opciones del hook
 * @param {string} options.positionType - Tipo de oposición para filtrar (ej: 'auxiliar_administrativo')
 */
export function useTopicUnlock({ positionType } = {}) {
  const { user, supabase } = useAuth()
  const [topicProgress, setTopicProgress] = useState({})
  const [weakArticlesByTopic, setWeakArticlesByTopic] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user && supabase) {
      loadUserProgress()
      // Solo cargar weak articles si hay positionType definido
      // Esto evita llamadas duplicadas desde componentes que no necesitan filtrar por oposición
      if (positionType) {
        loadWeakArticles()
      }
    } else {
      setTopicProgress({})
      setWeakArticlesByTopic({})
      setLoading(false)
    }
  }, [user, supabase, positionType])

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

  // Obtener artículos débiles de un tema específico
  const getWeakArticles = (topicNumber) => {
    return weakArticlesByTopic[topicNumber] || []
  }

  // Cargar artículos débiles del usuario via API v2 (Drizzle + Zod)
  const loadWeakArticles = async () => {
    if (!user || !supabase) return

    try {
      // Obtener token de sesión
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        console.error('No session token for weak articles API')
        return
      }

      // Construir URL con parámetro positionType si está disponible
      const params = new URLSearchParams()
      if (positionType) {
        params.set('positionType', positionType)
      }
      const queryString = params.toString()
      const url = `/api/v2/topic-progress/weak-articles${queryString ? `?${queryString}` : ''}`

      // Llamar a la API v2
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      })

      if (!response.ok) {
        console.error('Error loading weak articles:', response.statusText)
        return
      }

      const data = await response.json()

      if (data.success && data.weakArticlesByTopic) {
        setWeakArticlesByTopic(data.weakArticlesByTopic)
      }

    } catch (error) {
      console.error('Error in loadWeakArticles:', error)
    }
  }

  // Actualizar progreso cuando el usuario complete tests
  const updateTopicProgress = async () => {
    if (!user) return
    await loadUserProgress()
    await loadWeakArticles()
  }

  return {
    topicProgress,
    weakArticlesByTopic,
    loading,
    getTopicProgress,
    getWeakArticles,
    updateTopicProgress,
    refreshProgress: loadUserProgress
  }
}
