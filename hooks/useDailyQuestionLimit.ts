// hooks/useDailyQuestionLimit.ts
// Hook para gestionar el limite diario de preguntas con graduación dinámica.
// Usuarios nuevos: 25/día. Veteranos que tocan el límite repetidamente: se reduce.
'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { auth } from '../lib/auth'
import { getAuthHeaders } from '../lib/api/authHeaders'
import { trackLimitReached } from '../lib/services/conversionTracker'
import { safeGet, safeSet } from '@/lib/storage/safeLocalStorage'

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
  // El servidor ha visto 2+ cuentas free en este dispositivo ([T-418]). Viaja por aquí porque
  // este hook ya consulta `/api/v2/daily-question/status` y deduplica: un fetch aparte para el
  // aviso seria una segunda puerta al mismo dato.
  multiCuentaDispositivo: boolean
}

const DEFAULT_LIMIT = 25
const CACHE_TTL = 60000 // 1 minuto — para evitar queries excesivas mid-test

// Promise compartida a nivel de módulo: si dos componentes montan a la vez
// y ambos hacen fetchStatus(true), solo se ejecuta 1 query real
let inflightFetch: Promise<void> | null = null

// Sincronización ENTRE PESTAÑAS ([T-418], 05/08/2026). El `CustomEvent('dailyLimitUpdated')`
// de abajo viaja por `window`, que es UN documento — o sea, dentro de una sola pestaña. Con
// dos pestañas del mismo test abiertas (lo normal estudiando), cada una lleva su propio
// contador optimista y ninguna se entera de la otra: la pestaña A gasta la última pregunta, la
// B sigue creyendo que le queda cupo, le deja contestar, y el servidor rechaza el guardado con
// 403 — la respuesta se pierde en silencio, corregida en pantalla como si se hubiera guardado.
// Medido: 607 usuarios, 1.317 rechazos en 14 días; reproducido con navegador real
// (`scratchpad/t418/sim-goteo-2pestanas.ts`). `BroadcastChannel` sí cruza pestañas del mismo
// origen. Una sola conexión a nivel de módulo; fail-open si el navegador no lo soporta (no hay
// sincronía cross-tab, igual que antes — no se rompe nada nuevo).
const dailyLimitChannel: BroadcastChannel | null =
  typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined'
    ? new BroadcastChannel('vence-daily-limit')
    : null
// `unref` es de la implementación de Node (tests/SSR) — no existe en el navegador. Sin
// esto, cualquier proceso Node que importe este módulo (jest, un script de simulación)
// se queda colgado tras terminar: el canal es un handle async que nunca se cierra solo.
;(dailyLimitChannel as unknown as { unref?: () => void } | null)?.unref?.()

interface DailyLimitBroadcastMessage {
  userId: string
  status: DailyLimitStatus
}

function broadcastDailyLimitUpdate(userId: string, detail: DailyLimitStatus): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('dailyLimitUpdated', { detail }))
  // `userId` viaja en el mensaje porque, a diferencia del CustomEvent (que solo llega
  // dentro de esta pestaña, con un único usuario logueado), BroadcastChannel es del
  // ORIGEN entero — si otra pestaña tiene otra cuenta abierta (perfil/incógnito
  // aparte; el coste de comprobarlo es mínimo), no debe pisar su estado con el ajeno.
  dailyLimitChannel?.postMessage({ userId, status: detail } satisfies DailyLimitBroadcastMessage)
}

export function useDailyQuestionLimit() {
  const { user, userProfile, isPremium, isLegacy } = useAuth() as any

  const [status, setStatus] = useState<DailyLimitStatus>({
    questionsToday: 0,
    questionsRemaining: DEFAULT_LIMIT,
    dailyLimit: DEFAULT_LIMIT,
    isLimitReached: false,
    isPremiumUser: false,
    isGraduated: false,
    resetTime: null,
    loading: true,
    error: null,
    multiCuentaDispositivo: false
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
    if (!user) return DEFAULT_LIMIT

    try {
      const session = await auth.getSession()
      if (!session?.accessToken) return DEFAULT_LIMIT

      const res = await fetch('/api/daily-limit', {
        headers: { Authorization: `Bearer ${session.accessToken}` },
      })

      if (!res.ok) return DEFAULT_LIMIT

      const data = await res.json()
      dynamicLimitRef.current = data.dailyLimit || DEFAULT_LIMIT

      return dynamicLimitRef.current
    } catch {
      return DEFAULT_LIMIT
    }
  }, [user])

  // Obtener estado actual desde BD
  const fetchStatus = useCallback(async (force = false) => {
    if (!user) {
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
        error: null,
        multiCuentaDispositivo: false
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
        // Fetch dynamic limit + estado diario (endpoint Drizzle) en paralelo
        const headers = await getAuthHeaders()
        const [userDailyLimit, statusRes] = await Promise.all([
          fetchDynamicLimit(),
          fetch('/api/v2/daily-question/status', { headers }),
        ])

        if (!statusRes.ok) throw new Error(`daily-question/status ${statusRes.status}`)
        if (!isMountedRef.current) return

        const result = (await statusRes.json()).status

        if (result) {
          const questionsToday = result.questions_today || 0
          const remaining = Math.max(0, userDailyLimit - questionsToday)
          const isLimitReached = questionsToday >= userDailyLimit

          const newStatus = {
            questionsToday,
            questionsRemaining: remaining,
            dailyLimit: userDailyLimit,
            isLimitReached,
            isPremiumUser: result.is_premium || false,
            isGraduated: userDailyLimit < DEFAULT_LIMIT,
            resetTime: result.reset_time ?? null,
            loading: false,
            error: null,
            multiCuentaDispositivo: result.multi_cuenta_dispositivo === true
          }
          setStatus(newStatus)

          // Sincronizar otros componentes que usen este hook (misma pestaña) y otras
          // pestañas del mismo origen. Necesario aquí (no solo en recordAnswer) porque
          // cuando dos componentes se montan simultáneamente, el segundo cae en la rama
          // de deduplicación (`inflightFetch`) y no escribe su propio state — solo se
          // entera del fetch completado vía este evento.
          broadcastDailyLimitUpdate(user.id, newStatus)
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
  }, [user, userProfile, isPremium, isLegacy, fetchDynamicLimit])

  // Registrar respuesta (llamar DESPUES de guardar respuesta exitosamente)
  const recordAnswer = useCallback(async () => {
    if (!user) {
      return { success: false, error: 'No user' }
    }

    // Usuarios premium no incrementan contador
    if (isPremium || isLegacy || status.isPremiumUser) {
      return { success: true, canContinue: true, isPremium: true }
    }

    const currentLimit = dynamicLimitRef.current

    try {
      // ═══════════════════════════════════════════════════════════════
      // NO se cobra cupo desde aquí (29/07/2026). El cobro es del SERVIDOR,
      // en answer-and-save, y solo cuando la respuesta se PERSISTE
      // (`debeConsumirCupo` → saveAction === 'saved_new').
      //
      // Este método solo lleva la cuenta OPTIMISTA para que el gate de la UI
      // reaccione al instante; el servidor reconcilia después (fetchStatus).
      //
      // Por qué cambió: cobrar desde el cliente desacoplaba el cupo del
      // guardado (respuestas que no llegaban a `test_questions` consumían
      // igual) y no era idempotente (un evento repetido cobraba dos veces).
      // Medido en 14 días: 41 usuarios free agotaron el tope de 25 con una
      // media de 13 respuestas reales.
      // ═══════════════════════════════════════════════════════════════
      const result = {
        questions_today: Math.min(status.questionsToday + 1, currentLimit),
        is_premium: false,
        reset_time: status.resetTime,
      }

      // Reconciliar con el contador autoritativo del servidor sin bloquear la UI.
      // `fetchStatus(true)` salta el cache y emite `dailyLimitUpdated`, así que si
      // el optimista se desvía (respuesta que no se guardó), la corrección llega sola.
      setTimeout(() => { if (isMountedRef.current) fetchStatus(true) }, 2500)

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
          error: null,
          // Se ARRASTRA: `recordAnswer` reconstruye el objeto entero y sin esto el aviso
          // desapareceria en cuanto el usuario contestara una pregunta.
          multiCuentaDispositivo: status.multiCuentaDispositivo
        }

        setStatus(newStatus)

        // Sincronizar otros componentes del hook, misma pestaña y otras pestañas del
        // mismo origen ([T-418]: es este optimista, disparado AL CLICAR y sin esperar
        // red, el que cierra la ventana del goteo entre pestañas).
        broadcastDailyLimitUpdate(user.id, newStatus)

        // Mostrar modal si alcanzó el limite
        if (isLimitReached) {
          setShowUpgradeModal(true)

          // Trackear evento de conversion SOLO UNA VEZ por día
          const today = new Date().toISOString().split('T')[0]
          const storageKey = `limit_tracked_${user.id}_${today}`
          const alreadyTracked = limitTrackedTodayRef.current ||
            (typeof window !== 'undefined' && safeGet(storageKey))

          if (questionsToday === currentLimit && !alreadyTracked) {
            limitTrackedTodayRef.current = true
            if (typeof window !== 'undefined') {
              safeSet(storageKey, 'true')
            }
            // Track with graduated limit context for observability
            trackLimitReached(user.id, questionsToday, {
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
  }, [user, isPremium, isLegacy, status.isPremiumUser, status.questionsToday, status.resetTime, fetchStatus])

  // Cargar estado inicial — force=true para no usar cache viejo entre navegaciones
  // inflightFetch deduplicata si múltiples componentes montan a la vez
  useEffect(() => {
    isMountedRef.current = true
    fetchStatus(true)

    return () => {
      isMountedRef.current = false
    }
  }, [fetchStatus])

  // Escuchar eventos de sincronización de otros componentes (misma pestaña) y de otras
  // pestañas del mismo origen ([T-418]: sin el segundo listener, el broadcast de arriba
  // no serviría de nada — hace falta quien lo reciba en la pestaña B).
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

    const handleChannelMessage = (event: MessageEvent<DailyLimitBroadcastMessage>) => {
      if (!isMountedRef.current || !event.data) return
      // Ignorar broadcasts de OTRA cuenta (pestaña con otro perfil/incógnito abierto en
      // el mismo origen): aplicarlo pisaría el estado de este usuario con el ajeno.
      if (!user?.id || event.data.userId !== user.id) return
      setStatus(prev => ({ ...prev, ...event.data.status }))
    }
    dailyLimitChannel?.addEventListener('message', handleChannelMessage)

    return () => {
      window.removeEventListener('dailyLimitUpdated', handleLimitUpdate)
      dailyLimitChannel?.removeEventListener('message', handleChannelMessage)
    }
  }, [user?.id])

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

  // Memoizada ([T-418], 05/08): una función nueva en cada render aquí rompía la
  // estabilidad que `useDailyLimitEvent` da por hecha vía `useCallback` en el caller —
  // el efecto se resuscribía en cada render de este hook en vez de solo al montar.
  const refreshStatus = useCallback(() => fetchStatus(true), [fetchStatus])

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
    multiCuentaDispositivo: status.multiCuentaDispositivo,

    // Modal
    showUpgradeModal,
    setShowUpgradeModal,

    // Acciones
    recordAnswer,
    refreshStatus
  }
}
