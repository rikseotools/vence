// hooks/useDailyGoal.ts
// Hook para tracking de meta diaria de preguntas (aplica a todos los usuarios)
'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'

interface DailyGoalStatus {
  questionsToday: number
  studyGoal: number
  goalReached: boolean
  justReachedGoal: boolean // true solo la primera vez que se alcanza en esta sesión
}

export function useDailyGoal() {
  const { user, userProfile, supabase } = useAuth() as any
  const [status, setStatus] = useState<DailyGoalStatus>({
    questionsToday: 0,
    studyGoal: 25,
    goalReached: false,
    justReachedGoal: false,
  })

  const celebratedRef = useRef(false)
  const prevCountRef = useRef(0)

  const studyGoal = userProfile?.study_goal || 25

  // Cargar conteo del día al montar
  useEffect(() => {
    if (!user || !supabase) return

    async function fetchTodayCount() {
      try {
        const today = new Date()
        today.setHours(0, 0, 0, 0)

        const { count, error } = await supabase
          .from('detailed_answers')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .gte('created_at', today.toISOString())

        if (!error && count !== null) {
          prevCountRef.current = count
          const reached = count >= studyGoal
          if (reached) celebratedRef.current = true // Ya la alcanzó antes de esta sesión
          setStatus({
            questionsToday: count,
            studyGoal,
            goalReached: reached,
            justReachedGoal: false,
          })
        }
      } catch (err) {
        console.warn('Error cargando conteo diario:', err)
      }
    }

    fetchTodayCount()
  }, [user, supabase, studyGoal])

  // Llamar después de cada respuesta guardada
  const recordAnswerForGoal = useCallback(() => {
    setStatus(prev => {
      const newCount = prev.questionsToday + 1
      const nowReached = newCount >= studyGoal
      const justReached = nowReached && !celebratedRef.current

      if (justReached) {
        celebratedRef.current = true
      }

      return {
        questionsToday: newCount,
        studyGoal,
        goalReached: nowReached,
        justReachedGoal: justReached,
      }
    })
  }, [studyGoal])

  // Resetear el flag de "just reached" después de mostrarlo
  const dismissGoalCelebration = useCallback(() => {
    setStatus(prev => ({ ...prev, justReachedGoal: false }))
  }, [])

  return {
    ...status,
    recordAnswerForGoal,
    dismissGoalCelebration,
  }
}
