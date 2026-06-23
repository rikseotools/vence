// hooks/useDailyGoal.ts
// Hook para tracking de meta diaria de preguntas (solo premium)
// La meta por defecto se calcula como la media personal de la última semana
'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { getAuthHeaders } from '../lib/api/authHeaders'

interface DailyGoalStatus {
  questionsToday: number
  studyGoal: number
  goalReached: boolean
  justReachedGoal: boolean
  loading: boolean
}

export function useDailyGoal() {
  const { user, userProfile, isPremium } = useAuth() as any
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
    if (!user || !isPremium) {
      setStatus(prev => ({ ...prev, loading: false }))
      return
    }

    async function fetchData() {
      try {
        const today = new Date()
        today.setHours(0, 0, 0, 0)

        // Meta: si el usuario la configuró (distinto de 25), usar esa. Si no, media semanal.
        let studyGoal = userProfile?.study_goal || 0
        const hasCustomGoal = userProfile?.study_goal && userProfile.study_goal !== 25

        // Fase C1: los conteos van por endpoint Drizzle (user_id del token). Las
        // fechas se calculan aquí (tz local) y se pasan al endpoint para preservar
        // EXACTO el "hoy"/"semana" del usuario. La semana solo se pide si no hay meta custom.
        const qs = new URLSearchParams({ today: today.toISOString() })
        if (!hasCustomGoal) {
          const weekAgo = new Date()
          weekAgo.setDate(weekAgo.getDate() - 7)
          weekAgo.setHours(0, 0, 0, 0)
          qs.set('weekAgo', weekAgo.toISOString())
        }

        const headers = await getAuthHeaders()
        const res = await fetch(`/api/v2/daily-goal/status?${qs.toString()}`, { headers })
        if (!res.ok) {
          setStatus(prev => ({ ...prev, loading: false }))
          return
        }
        const { questionsToday, weekCount } = await res.json()

        if (!hasCustomGoal) {
          if (weekCount > 0) {
            const rawAvg = weekCount / 7
            studyGoal = Math.max(25, Math.round(rawAvg / 5) * 5)
          } else {
            studyGoal = 25
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
  }, [user, isPremium, userProfile?.study_goal])

  // Escuchar evento de respuesta desde otras instancias del hook
  useEffect(() => {
    function handleGoalUpdate() {
      setStatus(prev => {
        if (prev.loading) return prev
        const newCount = prev.questionsToday + 1
        const nowReached = newCount >= prev.studyGoal
        const justReached = nowReached && !celebratedRef.current
        if (justReached) celebratedRef.current = true
        return { ...prev, questionsToday: newCount, goalReached: nowReached, justReachedGoal: justReached }
      })
    }
    window.addEventListener('dailyGoalAnswerRecorded', handleGoalUpdate)
    return () => window.removeEventListener('dailyGoalAnswerRecorded', handleGoalUpdate)
  }, [])

  // Llamar después de cada respuesta guardada — actualiza todas las instancias via evento
  const recordAnswerForGoal = useCallback(() => {
    window.dispatchEvent(new Event('dailyGoalAnswerRecorded'))
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
