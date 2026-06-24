// hooks/useTopicUnlock.ts - Hook para obtener progreso del usuario por tema
// NOTA: Simplificado - ya no hay sistema de bloqueo, solo tracking de progreso
'use client'
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { getAuthHeaders } from '@/lib/api/authHeaders'
import { getOposicionByPositionType } from '@/lib/config/oposiciones'

interface TopicProgress {
  accuracy: number
  accuracy30d: number | null
  questionsAnswered: number
  masteryLevel: string | null
  lastStudy: Date | null
}

interface WeakArticle {
  lawName: string
  articleNumber: string
  failedCount: number
  totalAttempts: number
  correctCount: number
  avgSuccessRate: number
}

interface UseTopicUnlockOptions {
  positionType?: string | null
}

export function useTopicUnlock({ positionType }: UseTopicUnlockOptions = {}) {
  const { user, supabase } = useAuth() as any
  const [topicProgress, setTopicProgress] = useState<Record<number, TopicProgress>>({})
  const [weakArticlesByTopic, setWeakArticlesByTopic] = useState<Record<number, WeakArticle[]>>({})
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
  // Antes usaba supabase.rpc('get_user_theme_stats') que hacía count(*) sobre
  // test_questions (16s para Nila con 55k respuestas → 504 en Vercel).
  // Ahora usa fetch con AbortController (8s timeout) + fallback a vacío.
  const loadUserProgress = async () => {
    if (!user) return

    try {
      setLoading(true)

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 8000)

      let themeStatsData: any[] | null = null
      let error: any = null

      try {
        // Pasar oposicionId (slug) cuando lo tengamos: el endpoint filtra las
        // stats por position_type de esa oposición. SIN oposicionId cae en la
        // query legacy que mezcla el progreso entre oposiciones distintas (el
        // accuracy se agrupaba por tema_number, que colisiona entre oposiciones)
        // → salían porcentajes en temas no estudiados de la oposición actual y
        // no se "reseteaban" al cambiar de oposición (bug reportado por usuaria).
        const oposicionSlug = positionType ? getOposicionByPositionType(positionType)?.slug : undefined
        const themeStatsUrl = oposicionSlug
          ? `/api/v2/topic-progress/theme-stats?userId=${user.id}&oposicionId=${oposicionSlug}`
          : `/api/v2/topic-progress/theme-stats?userId=${user.id}`
        const res = await fetch(themeStatsUrl, { signal: controller.signal })
        clearTimeout(timeoutId)

        if (res.ok) {
          const data = await res.json()
          themeStatsData = data.stats || data
        } else {
          error = { message: `HTTP ${res.status}` }
        }
      } catch (fetchErr: any) {
        clearTimeout(timeoutId)
        if (fetchErr.name === 'AbortError') {
          console.warn('⏱️ [useTopicUnlock] theme stats timeout 8s, usando datos vacíos')
        }
        error = fetchErr
      }

      if (error) {
        console.error('Error loading user theme stats:', error)
        setTopicProgress({})
        return
      }

      // Procesar progreso por tema
      const progress: Record<number, TopicProgress> = {}

      if (themeStatsData && themeStatsData.length > 0) {
        themeStatsData.forEach((row: any) => {
          const temaNumber = row.tema_number
          if (typeof temaNumber !== 'number') return

          // tema_number en test_questions ya es 1-indexed (coincide con topics.topic_number)
          // Bug anterior: sumaba +1 desplazando todas las stats un tema
          const actualTemaNumber = temaNumber

          const accuracy = parseInt(row.accuracy) || 0
          const questionsAnswered = parseInt(row.total) || 0

          progress[actualTemaNumber] = {
            accuracy,
            accuracy30d: row.accuracy_30d != null ? parseInt(row.accuracy_30d) : null,
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
  const getTopicProgress = (topicNumber: number) => {
    return topicProgress[topicNumber] || {
      accuracy: 0,
      accuracy30d: null,
      questionsAnswered: 0,
      masteryLevel: null
    }
  }

  // Obtener artículos débiles de un tema específico
  const getWeakArticles = (topicNumber: number) => {
    return weakArticlesByTopic[topicNumber] || []
  }

  // Cargar artículos débiles del usuario via API v2 (Drizzle + Zod)
  const loadWeakArticles = async () => {
    if (!user || !supabase) return

    try {
      // Obtener token de sesión
      const authHeaders = await getAuthHeaders()
      if (!authHeaders['Authorization']) {
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
          ...authHeaders,
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
