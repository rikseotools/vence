// hooks/useOnboarding.js
// Hook para detectar si el usuario necesita completar el onboarding
'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { getSupabaseClient } from '../lib/supabase'

const supabase = getSupabaseClient()

// Solo usar sessionStorage para evitar mostrar 2 veces en la misma sesión
const ONBOARDING_SESSION_SHOWN_KEY = 'onboarding_session_shown'

export function useOnboarding() {
  const { user, userProfile, loading: authLoading } = useAuth()
  const [needsOnboarding, setNeedsOnboarding] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [checking, setChecking] = useState(true)
  const [hasChecked, setHasChecked] = useState(false)

  useEffect(() => {
    // Solo verificar una vez por sesión
    if (hasChecked || authLoading || !user) {
      setChecking(false)
      return
    }

    checkOnboardingStatus()
  }, [user, authLoading, hasChecked])

  const checkOnboardingStatus = async () => {
    try {
      setChecking(true)

      // Obtener perfil con datos de tracking
      const { data: profile, error } = await supabase
        .from('user_profiles')
        .select('target_oposicion, onboarding_completed_at, age, gender, daily_study_hours, ciudad, onboarding_skip_count, onboarding_last_skip_at')
        .eq('id', user.id)
        .single()

      if (error) {
        console.error('Error verificando onboarding:', error)
        setNeedsOnboarding(false)
        setHasChecked(true)
        setChecking(false)
        return
      }

      // Verificar si necesita onboarding
      const needsIt = !profile.target_oposicion ||
                      !profile.onboarding_completed_at ||
                      !profile.age ||
                      !profile.gender ||
                      !profile.daily_study_hours ||
                      !profile.ciudad

      console.log('🎯 Onboarding check:', {
        hasOposicion: !!profile.target_oposicion,
        hasCompleted: !!profile.onboarding_completed_at,
        hasAge: !!profile.age,
        hasGender: !!profile.gender,
        hasHours: !!profile.daily_study_hours,
        hasCiudad: !!profile.ciudad,
        skipCount: profile.onboarding_skip_count || 0,
        lastSkip: profile.onboarding_last_skip_at,
        needsOnboarding: needsIt
      })

      setNeedsOnboarding(needsIt)
      setHasChecked(true)

      // Mostrar modal con pequeño delay si necesita y debe mostrarse
      if (needsIt && await shouldShowModal(profile)) {
        setTimeout(() => setShowModal(true), 2000)
      }

    } catch (err) {
      console.error('Error en checkOnboardingStatus:', err)
      setNeedsOnboarding(false)
      setHasChecked(true)
    } finally {
      setChecking(false)
    }
  }

  // Función para verificar si debe mostrar según recordatorios (ahora usa BD)
  const shouldShowModal = async (profile) => {
    if (typeof window === 'undefined') return false

    try {
      const sessionShown = sessionStorage.getItem(ONBOARDING_SESSION_SHOWN_KEY)

      // Si ya se mostró en esta sesión, no volver a mostrar
      if (sessionShown) {
        console.log('🎯 Ya mostrado en esta sesión')
        return false
      }

      const skipCount = profile.onboarding_skip_count || 0
      const lastSkip = profile.onboarding_last_skip_at

      // Primera vez (sin skips previos)
      if (skipCount === 0) {
        console.log('🎯 Primera vez - mostrar modal')
        return true
      }

      // Si hay skips previos, verificar tiempo transcurrido
      if (lastSkip) {
        const lastSkipDate = new Date(lastSkip)
        const now = new Date()
        const hoursSinceSkip = (now - lastSkipDate) / (1000 * 60 * 60)
        const daysSinceSkip = hoursSinceSkip / 24

        // Primer skip: volver a mostrar después de 5 minutos
        if (skipCount === 1 && hoursSinceSkip < 0.08) { // 0.08 horas = 5 minutos
          console.log(`🎯 Primer skip - esperar ${Math.ceil((0.08 - hoursSinceSkip) * 60)} minutos más`)
          return false
        }

        // A partir del segundo skip: volver a mostrar cada día
        if (skipCount >= 2 && daysSinceSkip < 1) {
          console.log(`🎯 Skip ${skipCount} - esperar ${Math.ceil((1 - daysSinceSkip) * 24)} horas más`)
          return false
        }
      }

      console.log(`🎯 Mostrar modal (skip count: ${skipCount})`)
      return true
    } catch (err) {
      console.error('Error verificando shouldShowModal:', err)
      return true // En caso de error, mostrar el modal
    }
  }

  const handleComplete = async () => {
    setShowModal(false)
    setNeedsOnboarding(false)

    // Resetear contadores en BD
    try {
      await supabase
        .from('user_profiles')
        .update({
          onboarding_skip_count: 0,
          onboarding_last_skip_at: null
        })
        .eq('id', user.id)

      console.log('✅ Onboarding completado - contadores reseteados')
    } catch (err) {
      console.error('Error reseteando contadores:', err)
    }

    // Recargar página para actualizar el contexto de usuario
    window.location.reload()
  }

  const handleSkip = async () => {
    setShowModal(false)

    if (typeof window === 'undefined') return

    try {
      // Marcar como mostrado en esta sesión
      sessionStorage.setItem(ONBOARDING_SESSION_SHOWN_KEY, 'true')

      // Incrementar contador en BD
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('onboarding_skip_count')
        .eq('id', user.id)
        .single()

      const newSkips = (profile?.onboarding_skip_count || 0) + 1

      await supabase
        .from('user_profiles')
        .update({
          onboarding_skip_count: newSkips,
          onboarding_last_skip_at: new Date().toISOString()
        })
        .eq('id', user.id)

      console.log(`🎯 Onboarding saltado (${newSkips} veces) - guardado en BD`)

      // Programar recordatorio según el número de skips
      if (newSkips === 1) {
        console.log('🎯 Próximo recordatorio: en 5 minutos de navegación')
      } else {
        console.log('🎯 Próximo recordatorio: mañana (y cada día hasta completar)')
      }
    } catch (err) {
      console.error('Error en handleSkip:', err)
    }
  }

  // Función para forzar mostrar el modal (útil para testing o botón manual)
  const forceShow = () => {
    setShowModal(true)
  }

  return {
    needsOnboarding,
    showModal,
    checking,
    handleComplete,
    handleSkip,
    forceShow
  }
}
