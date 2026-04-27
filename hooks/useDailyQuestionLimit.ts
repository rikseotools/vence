// hooks/useDailyQuestionLimit.ts
// Hook para gestionar el limite diario de preguntas con graduación dinámica.
// Usuarios nuevos: 25/día. Veteranos que tocan el límite repetidamente: se reduce.
'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { trackLimitReached } from '../lib/services/conversionTracker'

interface DailyLimitStatus {
  questionsToday: number
  questionsRemaining: number
  dailyLimit: number
  isLimitReached: boolean
  isPremiumUser: boolean
  isGraduated: boolean
  resetTime: string | null
  loading: boolean
  error: string | null
}

const DEFAULT_LIMIT = 25
const CACHE_TTL = 60000 // 1 minuto — para evitar queries excesivas mid-test

// Promise compartida a nivel de módulo: si dos componentes montan a la vez
// y ambos hacen fetchStatus(true), solo se ejecuta 1 query real
let inflightFetch: Promise<void> | null = null

export function useDailyQuestionLimit() {
  const { user, userProfile, isPremium, isLegacy, supabase } = useAuth() as any

  const [status, setStatus] = useState<DailyLimitStatus>({
    questionsToday: 0,
    questionsRemaining: DEFAULT_LIMIT,
    dailyLimit: DEFAULT_LIMIT,
    isLimitReached: false,
    isPremiumUser: false,
    isGraduated: false,
    resetTime: null,
    loading: true,
    error: null
  })

  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const lastFetchRef = useRef(0)
  const isMountedRef = useRef(true)
  const limitTrackedTodayRef = useRef(false)
  // Store the dynamic limit fetched from server
  const dynamicLimitRef = useRef<number>(DEFAULT_LIMIT)

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

  // Fetch the dynamic limit from the server API
  const fetchDynamicLimit = useCallback(async (): Promise<number> => {
    if (!user || !supabase) return DEFAULT_LIMIT

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) return DEFAULT_LIMIT

      const res = await fetch('/api/daily-limit', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })

      if (!res.ok) return DEFAULT_LIMIT

      const data = await res.json()
      dynamicLimitRef.current = data.dailyLimit || DEFAULT_LIMIT

      return dynamicLimitRef.current
    } catch {
      return DEFAULT_LIMIT
    }
  }, [user, supabase])

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
        dailyLimit: DEFAULT_LIMIT,
        isLimitReached: false,
        isPremiumUser: true,
        isGraduated: false,
        resetTime: null,
        loading: false,
        error: null
      })
      return
    }

    // Cache check (evitar queries excesivas mid-test)
    const now = Date.now()
    if (!force && now - lastFetchRef.current < CACHE_TTL) {
      return
    }

    // Deduplicar: si otro componente ya está fetching, esperar su resultado
    if (inflightFetch) {
      await inflightFetch
      return
    }

    const doFetch = async () => {
      try {
        // Fetch dynamic limit and RPC status in parallel
        const [userDailyLimit, rpcResult] = await Promise.all([
          fetchDynamicLimit(),
          supabase.rpc('get_daily_question_status', { p_user_id: user.id }),
        ])

        const { data, error } = rpcResult
        if (error) throw error
        if (!isMountedRef.current) return

        const result = Array.isArray(data) ? data[0] : data

        if (result) {
          const questionsToday = result.questions_today || 0
          const remaining = Math.max(0, userDailyLimit - questionsToday)
          const isLimitReached = questionsToday >= userDailyLimit

          setStatus({
            questionsToday,
            questionsRemaining: remaining,
            dailyLimit: userDailyLimit,
            isLimitReached,
            isPremiumUser: result.is_premium || false,
            isGraduated: userDailyLimit < DEFAULT_LIMIT,
            resetTime: result.reset_time ?? null,
            loading: false,
            error: null
          })
        }

        lastFetchRef.current = now

      } catch (error: any) {
        console.error('Error fetching daily limit status:', error)
        if (isMountedRef.current) {
          setStatus(prev => ({
            ...prev,
            loading: false,
            error: error.message
          }))
        }
      }
    }

    // Envolver en promise compartida para deduplicar mounts simultáneos
    inflightFetch = doFetch().finally(() => { inflightFetch = null })
  }, [user, userProfile, isPremium, isLegacy, supabase, fetchDynamicLimit])

  // Registrar respuesta (llamar DESPUES de guardar respuesta exitosamente)
  const recordAnswer = useCallback(async () => {
    if (!user || !supabase) {
      return { success: false, error: 'No user or supabase' }
    }

    // Usuarios premium no incrementan contador
    if (isPremium || isLegacy || status.isPremiumUser) {
      return { success: true, canContinue: true, isPremium: true }
    }

    const currentLimit = dynamicLimitRef.current

    try {
      const { data, error } = await supabase.rpc('increment_daily_questions', {
        p_user_id: user.id,
        p_limit: currentLimit
      })

      if (error) throw error

      const result = Array.isArray(data) ? data[0] : data

      if (result && isMountedRef.current) {
        const questionsToday = result.questions_today
        const remaining = Math.max(0, currentLimit - questionsToday)
        const isLimitReached = questionsToday >= currentLimit

        const newStatus = {
          questionsToday,
          questionsRemaining: remaining,
          dailyLimit: currentLimit,
          isLimitReached,
          isPremiumUser: result.is_premium,
          isGraduated: currentLimit < DEFAULT_LIMIT,
          resetTime: result.reset_time ?? null,
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
        if (isLimitReached) {
          setShowUpgradeModal(true)

          // Trackear evento de conversion SOLO UNA VEZ por día
          const today = new Date().toISOString().split('T')[0]
          const storageKey = `limit_tracked_${user.id}_${today}`
          const alreadyTracked = limitTrackedTodayRef.current ||
            (typeof window !== 'undefined' && localStorage.getItem(storageKey))

          if (questionsToday === currentLimit && !alreadyTracked) {
            limitTrackedTodayRef.current = true
            if (typeof window !== 'undefined') {
              localStorage.setItem(storageKey, 'true')
            }
            // Track with graduated limit context for observability
            trackLimitReached(supabase, user.id, questionsToday, {
              daily_limit: currentLimit,
              is_graduated: currentLimit < DEFAULT_LIMIT,
            })
          }
        }

        return {
          success: true,
          canContinue: !isLimitReached,
          questionsRemaining: remaining,
          isLimitReached
        }
      }

      return { success: true, canContinue: true }

    } catch (error: any) {
      console.error('Error recording answer:', error)
      return { success: false, error: error.message }
    }
  }, [user, supabase, isPremium, isLegacy, status.isPremiumUser])

  // Cargar estado inicial — force=true para no usar cache viejo entre navegaciones
  // inflightFetch deduplicata si múltiples componentes montan a la vez
  useEffect(() => {
    isMountedRef.current = true
    fetchStatus(true)

    return () => {
      isMountedRef.current = false
    }
  }, [fetchStatus])

  // Escuchar eventos de sincronización de otros componentes
  useEffect(() => {
    const handleLimitUpdate = (event: Event) => {
      if (isMountedRef.current && (event as CustomEvent).detail) {
        setStatus(prev => ({
          ...prev,
          ...(event as CustomEvent).detail
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
      const resetTime = new Date(status.resetTime as string)

      if (now.getTime() >= resetTime.getTime()) {
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
    isGraduated: status.isGraduated,
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
