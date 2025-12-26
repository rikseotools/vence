// hooks/useDailyQuestionLimit.js
// Hook para gestionar el limite diario de preguntas (25/dia para usuarios FREE)
'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { trackLimitReached } from '../lib/services/conversionTracker'

const DAILY_LIMIT = 25
const CACHE_TTL = 60000 // 1 minuto

export function useDailyQuestionLimit() {
  const { user, userProfile, isPremium, isLegacy, supabase } = useAuth()

  const [status, setStatus] = useState({
    questionsToday: 0,
    questionsRemaining: DAILY_LIMIT,
    dailyLimit: DAILY_LIMIT,
    isLimitReached: false,
    isPremiumUser: false,
    resetTime: null,
    loading: true,
    error: null
  })

  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const lastFetchRef = useRef(0)
  const isMountedRef = useRef(true)
  const limitTrackedTodayRef = useRef(false)

  // Determinar si usuario tiene limite (solo FREE y no premium/legacy)
  const hasLimit = !!(
    user &&
    userProfile &&
    !isPremium &&
    !isLegacy &&
    userProfile.plan_type !== 'premium' &&
    userProfile.plan_type !== 'trial' &&
    userProfile.plan_type !== 'legacy_free' &&
    userProfile.plan_type !== 'admin'
  )

  // Obtener estado actual desde BD
  const fetchStatus = useCallback(async (force = false) => {
    if (!user || !supabase) {
      setStatus(prev => ({ ...prev, loading: false }))
      return
    }

    // Usuarios premium/legacy no tienen limite
    if (isPremium || isLegacy) {
      setStatus({
        questionsToday: 0,
        questionsRemaining: 999,
        dailyLimit: DAILY_LIMIT,
        isLimitReached: false,
        isPremiumUser: true,
        resetTime: null,
        loading: false,
        error: null
      })
      return
    }

    // Cache check (evitar queries excesivas)
    const now = Date.now()
    if (!force && now - lastFetchRef.current < CACHE_TTL) {
      return
    }

    try {
      const { data, error } = await supabase.rpc('get_daily_question_status', {
        p_user_id: user.id
      })

      if (error) throw error
      if (!isMountedRef.current) return

      const result = Array.isArray(data) ? data[0] : data

      if (result) {
        setStatus({
          questionsToday: result.questions_today || 0,
          questionsRemaining: result.questions_remaining ?? DAILY_LIMIT,
          dailyLimit: result.daily_limit || DAILY_LIMIT,
          isLimitReached: result.is_limit_reached || false,
          isPremiumUser: result.is_premium || false,
          resetTime: result.reset_time ? new Date(result.reset_time) : null,
          loading: false,
          error: null
        })
      }

      lastFetchRef.current = now

    } catch (error) {
      console.error('Error fetching daily limit status:', error)
      if (isMountedRef.current) {
        setStatus(prev => ({
          ...prev,
          loading: false,
          error: error.message
        }))
      }
    }
  }, [user, userProfile, isPremium, isLegacy, supabase])

  // Registrar respuesta (llamar DESPUES de guardar respuesta exitosamente)
  const recordAnswer = useCallback(async () => {
    if (!user || !supabase) {
      return { success: false, error: 'No user or supabase' }
    }

    // Usuarios premium no incrementan contador
    if (isPremium || isLegacy || status.isPremiumUser) {
      return { success: true, canContinue: true, isPremium: true }
    }

    try {
      const { data, error } = await supabase.rpc('increment_daily_questions', {
        p_user_id: user.id,
        p_limit: DAILY_LIMIT
      })

      if (error) throw error

      const result = Array.isArray(data) ? data[0] : data

      if (result && isMountedRef.current) {
        const newStatus = {
          questionsToday: result.questions_today,
          questionsRemaining: result.questions_remaining,
          dailyLimit: DAILY_LIMIT,
          isLimitReached: result.is_limit_reached,
          isPremiumUser: result.is_premium,
          resetTime: result.reset_time ? new Date(result.reset_time) : null,
          loading: false,
          error: null
        }

        setStatus(newStatus)

        // Emitir evento para sincronizar otros componentes que usen este hook
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('dailyLimitUpdated', {
            detail: newStatus
          }))
        }

        // Mostrar modal si alcanzó el limite
        if (result.is_limit_reached) {
          setShowUpgradeModal(true)

          // Trackear evento de conversion SOLO UNA VEZ por día
          // Verificar ref (sesión actual) y localStorage (entre recargas)
          const today = new Date().toISOString().split('T')[0]
          const storageKey = `limit_tracked_${user.id}_${today}`
          const alreadyTracked = limitTrackedTodayRef.current ||
            (typeof window !== 'undefined' && localStorage.getItem(storageKey))

          if (result.questions_today === DAILY_LIMIT && !alreadyTracked) {
            limitTrackedTodayRef.current = true
            if (typeof window !== 'undefined') {
              localStorage.setItem(storageKey, 'true')
            }
            trackLimitReached(supabase, user.id, result.questions_today)
          }
        }

        return {
          success: true,
          canContinue: !result.is_limit_reached,
          questionsRemaining: result.questions_remaining,
          isLimitReached: result.is_limit_reached
        }
      }

      return { success: true, canContinue: true }

    } catch (error) {
      console.error('Error recording answer:', error)
      return { success: false, error: error.message }
    }
  }, [user, supabase, isPremium, isLegacy, status.isPremiumUser])

  // Cargar estado inicial
  useEffect(() => {
    isMountedRef.current = true
    fetchStatus()

    return () => {
      isMountedRef.current = false
    }
  }, [fetchStatus])

  // Escuchar eventos de sincronización de otros componentes
  useEffect(() => {
    const handleLimitUpdate = (event) => {
      if (isMountedRef.current && event.detail) {
        setStatus(prev => ({
          ...prev,
          ...event.detail
        }))
      }
    }

    window.addEventListener('dailyLimitUpdated', handleLimitUpdate)
    return () => {
      window.removeEventListener('dailyLimitUpdated', handleLimitUpdate)
    }
  }, [])

  // Auto-refresh cuando cambia el usuario o perfil
  useEffect(() => {
    if (user && userProfile) {
      fetchStatus(true)
    }
  }, [user?.id, userProfile?.plan_type])

  // Verificar reset a medianoche (cada minuto)
  useEffect(() => {
    if (!status.resetTime || status.isPremiumUser) return

    const checkReset = () => {
      const now = new Date()
      const resetTime = new Date(status.resetTime)

      if (now >= resetTime) {
        console.log('Daily limit reset detected - refreshing status')
        fetchStatus(true)
      }
    }

    const interval = setInterval(checkReset, 60000)
    return () => clearInterval(interval)
  }, [status.resetTime, status.isPremiumUser, fetchStatus])

  return {
    // Estado
    questionsToday: status.questionsToday,
    questionsRemaining: status.questionsRemaining,
    dailyLimit: status.dailyLimit,
    isLimitReached: status.isLimitReached,
    isPremiumUser: status.isPremiumUser,
    resetTime: status.resetTime,
    loading: status.loading,
    error: status.error,

    // Flags
    hasLimit,

    // Modal
    showUpgradeModal,
    setShowUpgradeModal,

    // Acciones
    recordAnswer,
    refreshStatus: () => fetchStatus(true)
  }
}
