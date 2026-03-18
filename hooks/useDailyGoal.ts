// hooks/useDailyGoal.ts
// Hook para tracking de meta diaria de preguntas (solo premium)
// La meta por defecto se calcula como la media personal de la última semana
'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'

interface DailyGoalStatus {
  questionsToday: number
  studyGoal: number
  goalReached: boolean
  justReachedGoal: boolean
  loading: boolean
}

export function useDailyGoal() {
  const { user, userProfile, supabase, isPremium } = useAuth() as any
  const [status, setStatus] = useState<DailyGoalStatus>({
    questionsToday: 0,
    studyGoal: 25,
    goalReached: false,
    justReachedGoal: false,
    loading: true,
  })

  const celebratedRef = useRef(false)

  // Cargar conteo del día + calcular meta al montar
  useEffect(() => {
    if (!user || !supabase || !isPremium) {
      setStatus(prev => ({ ...prev, loading: false }))
      return
    }

    async function fetchData() {
      try {
        const today = new Date()
        today.setHours(0, 0, 0, 0)

        // 1. Contar preguntas de hoy
        const { count: todayCount, error: todayError } = await supabase
          .from('detailed_answers')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .gte('created_at', today.toISOString())

        const questionsToday = (!todayError && todayCount !== null) ? todayCount : 0

        // 2. Determinar meta: si el usuario la configuró, usar esa. Si no, calcular media semanal.
        let studyGoal = userProfile?.study_goal || 0
        const hasCustomGoal = userProfile?.study_goal && userProfile.study_goal !== 25

        if (!hasCustomGoal) {
          // Calcular media personal de los últimos 7 días
          const weekAgo = new Date()
          weekAgo.setDate(weekAgo.getDate() - 7)
          weekAgo.setHours(0, 0, 0, 0)

          const { count: weekCount, error: weekError } = await supabase
            .from('detailed_answers')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .gte('created_at', weekAgo.toISOString())
            .lt('created_at', today.toISOString()) // Excluir hoy para no sesgar

          if (!weekError && weekCount !== null && weekCount > 0) {
            // Media de los últimos 7 días, redondeada al múltiplo de 5 más cercano
            const rawAvg = weekCount / 7
            studyGoal = Math.max(5, Math.round(rawAvg / 5) * 5)
          } else {
            studyGoal = 25 // Fallback si no hay historial
          }
        }

        const reached = questionsToday >= studyGoal
        if (reached) celebratedRef.current = true

        setStatus({
          questionsToday,
          studyGoal,
          goalReached: reached,
          justReachedGoal: false,
          loading: false,
        })
      } catch (err) {
        console.warn('Error cargando meta diaria:', err)
        setStatus(prev => ({ ...prev, loading: false }))
      }
    }

    fetchData()
  }, [user, supabase, isPremium, userProfile?.study_goal])

  // Llamar después de cada respuesta guardada
  const recordAnswerForGoal = useCallback(() => {
    setStatus(prev => {
      if (prev.loading) return prev
      const newCount = prev.questionsToday + 1
      const nowReached = newCount >= prev.studyGoal
      const justReached = nowReached && !celebratedRef.current

      if (justReached) {
        celebratedRef.current = true
      }

      return {
        ...prev,
        questionsToday: newCount,
        goalReached: nowReached,
        justReachedGoal: justReached,
      }
    })
  }, [])

  const dismissGoalCelebration = useCallback(() => {
    setStatus(prev => ({ ...prev, justReachedGoal: false }))
  }, [])

  return {
    ...status,
    recordAnswerForGoal,
    dismissGoalCelebration,
  }
}
