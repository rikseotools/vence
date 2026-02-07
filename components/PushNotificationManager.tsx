// @ts-nocheck - TODO: Migrate to strict TypeScript
// Componente para gestionar notificaciones push
// Solo muestra el prompt en dispositivos móviles o PWA
'use client'
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import notificationTracker from '../lib/services/notificationTracker'
import pwaTracker from '../lib/services/pwaTracker'

// ============================================
// TIPOS
// ============================================

// Tipo para el usuario de Supabase
interface User {
  id: string
  email?: string
}

// Tipo para el cliente de Supabase (simplificado)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = any

// Tipo para el contexto de autenticación
interface AuthContextValue {
  user: User | null
  supabase: SupabaseClient
}

interface NotificationSettings {
  user_id: string
  push_enabled: boolean
  push_subscription: string | null
  preferred_times?: string[]
  timezone?: string
  frequency?: string
  oposicion_type?: string
  motivation_level?: string
}

interface NotificationState {
  permission: NotificationPermission | 'default'
  supported: boolean
  subscription: PushSubscription | null
  showPrompt: boolean
  settings: NotificationSettings | null
  isMobileOrPWA: boolean
}

type BannerType = 'prominent' | 'compact' | 'initial_prompt'

// ============================================
// UTILIDADES
// ============================================

/**
 * Detecta si el usuario está en un dispositivo móvil o usando la PWA
 */
function detectMobileOrPWA(): boolean {
  if (typeof window === 'undefined') return false

  // Detectar PWA (instalada como app)
  const isPWA = window.matchMedia('(display-mode: standalone)').matches ||
                (window.navigator as Navigator & { standalone?: boolean }).standalone === true

  // Detectar dispositivo móvil por user agent
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)

  // Detectar tablet (también incluir)
  const isTablet = /iPad|Android(?!.*Mobile)/i.test(navigator.userAgent)

  return isPWA || isMobile || isTablet
}

/**
 * Convierte VAPID key de base64 a Uint8Array
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  try {
    console.log('🔑 Converting VAPID key:', base64String.substring(0, 20) + '...')

    const padding = '='.repeat((4 - base64String.length % 4) % 4)
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/')

    const rawData = window.atob(base64)

    if (rawData.length !== 65) {
      console.error('❌ Invalid VAPID key length:', rawData.length, 'expected 65')
      throw new Error(`Invalid VAPID key length: ${rawData.length}, expected 65`)
    }

    const outputArray = new Uint8Array(rawData.length)
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i)
    }

    console.log('✅ VAPID key converted successfully')
    return outputArray
  } catch (error) {
    console.error('❌ Error converting VAPID key:', error)
    throw new Error(`VAPID key conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

// ============================================
// COMPONENTE PRINCIPAL
// ============================================

export default function PushNotificationManager() {
  const { user, supabase } = useAuth() as AuthContextValue
  const [notificationState, setNotificationState] = useState<NotificationState>({
    permission: 'default',
    supported: false,
    subscription: null,
    showPrompt: false,
    settings: null,
    isMobileOrPWA: false
  })
  const [loading, setLoading] = useState(false)
  const [isDismissed, setIsDismissed] = useState(false)
  const [wasDismissedBefore, setWasDismissedBefore] = useState(false)
  const [bannerTracked, setBannerTracked] = useState(false)

  // Verificar si el banner fue descartado temporalmente
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const dismissedUntil = localStorage.getItem('push_banner_dismissed_until')
      const dismissCount = parseInt(localStorage.getItem('push_banner_dismiss_count') || '0')

      if (dismissCount > 0) {
        setWasDismissedBefore(true)
      }

      if (dismissedUntil) {
        const dismissedDate = new Date(dismissedUntil)
        if (dismissedDate > new Date()) {
          setIsDismissed(true)
        } else {
          localStorage.removeItem('push_banner_dismissed_until')
        }
      }
    }
  }, [])

  // Función para trackear eventos del banner
  const trackBannerEvent = useCallback(async (eventType: string, bannerType: BannerType, extraData: Record<string, unknown> = {}) => {
    if (!user) return

    try {
      const dismissCount = parseInt(localStorage.getItem('push_banner_dismiss_count') || '0')

      await notificationTracker.trackPushEvent(eventType, user, {
        deviceType: notificationTracker.getDeviceType(),
        customData: {
          banner_type: bannerType,
          dismiss_count: dismissCount,
          permission_status: notificationState.permission,
          has_settings: !!notificationState.settings,
          push_enabled: notificationState.settings?.push_enabled || false,
          is_mobile_or_pwa: notificationState.isMobileOrPWA,
          ...extraData
        }
      })
    } catch (error) {
      console.error('Error tracking banner event:', error)
    }
  }, [user, notificationState.permission, notificationState.settings, notificationState.isMobileOrPWA])

  // Función para descartar el banner por 1 mes
  const dismissForOneMonth = async (bannerType: BannerType = 'prominent') => {
    const oneMonthFromNow = new Date()
    oneMonthFromNow.setMonth(oneMonthFromNow.getMonth() + 1)
    localStorage.setItem('push_banner_dismissed_until', oneMonthFromNow.toISOString())

    const currentCount = parseInt(localStorage.getItem('push_banner_dismiss_count') || '0')
    localStorage.setItem('push_banner_dismiss_count', String(currentCount + 1))

    await trackBannerEvent('banner_dismissed', bannerType, {
      new_dismiss_count: currentCount + 1,
      dismissed_until: oneMonthFromNow.toISOString()
    })

    setIsDismissed(true)
    setWasDismissedBefore(true)
  }

  // Verificar soporte de notificaciones
  const checkNotificationSupport = useCallback(() => {
    const supported = 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window
    const permission = supported ? Notification.permission : 'denied'
    const isMobileOrPWA = detectMobileOrPWA()

    setNotificationState(prev => ({
      ...prev,
      supported,
      permission,
      isMobileOrPWA,
      // Solo mostrar prompt en móvil/PWA
      showPrompt: supported && permission === 'default' && !!user && isMobileOrPWA
    }))
  }, [user])

  // Cargar configuración del usuario
  const loadUserSettings = useCallback(async () => {
    if (!user || !supabase) return

    try {
      const { data: settings, error } = await supabase
        .from('user_notification_settings')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()

      if (error) {
        console.log('Error loading notification settings:', error.message)
        return
      }

      if (settings) {
        setNotificationState(prev => ({
          ...prev,
          settings: settings as NotificationSettings,
          // Solo mostrar prompt en móvil/PWA
          showPrompt: !settings.push_enabled && prev.permission === 'default' && prev.supported && prev.isMobileOrPWA
        }))
      }
    } catch (error) {
      console.log('No previous notification settings found')
    }
  }, [user, supabase])

  // Inicialización principal
  useEffect(() => {
    if (typeof window !== 'undefined' && user && supabase) {
      notificationTracker.setSupabaseInstance(supabase)
      pwaTracker.setSupabaseInstance(supabase)
      pwaTracker.startSession()

      setTimeout(() => {
        pwaTracker.detectExistingPWAUser()
      }, 2000)

      checkNotificationSupport()
      loadUserSettings()

      // Listeners para errores globales
      const handleGlobalError = async (event: ErrorEvent) => {
        if (event.error && (
          event.error.message?.includes('notification') ||
          event.error.message?.includes('push') ||
          event.error.message?.includes('service') ||
          event.filename?.includes('sw.js')
        )) {
          console.error('🔥 Error global relacionado con notificaciones:', event.error)

          await notificationTracker.trackPushEvent('notification_failed', user, {
            error: event.error.message,
            errorStack: event.error.stack,
            errorFilename: event.filename,
            errorLineno: event.lineno,
            errorColno: event.colno,
            deviceType: notificationTracker.getDeviceType(),
            customData: {
              errorType: 'global_browser_error',
              userAgent: navigator.userAgent
            }
          })
        }
      }

      const handleUnhandledRejection = async (event: PromiseRejectionEvent) => {
        const reason = event.reason
        if (reason && (
          reason.message?.includes('notification') ||
          reason.message?.includes('push') ||
          reason.message?.includes('service')
        )) {
          console.error('🔥 Promise rejection relacionada con notificaciones:', reason)

          await notificationTracker.trackPushEvent('notification_failed', user, {
            error: reason.message || reason.toString(),
            errorStack: reason.stack,
            deviceType: notificationTracker.getDeviceType(),
            customData: {
              errorType: 'unhandled_promise_rejection',
              userAgent: navigator.userAgent
            }
          })
        }
      }

      window.addEventListener('error', handleGlobalError)
      window.addEventListener('unhandledrejection', handleUnhandledRejection)

      return () => {
        window.removeEventListener('error', handleGlobalError)
        window.removeEventListener('unhandledrejection', handleUnhandledRejection)
      }
    }
  }, [user, supabase, checkNotificationSupport, loadUserSettings])

  // Verificaciones automáticas de suscripción
  useEffect(() => {
    if (!notificationState.settings || !user || !supabase) return

    let verificationInterval: NodeJS.Timeout | null = null

    const getLastVerificationTime = (): number => {
      const stored = localStorage.getItem('vence_last_push_verification')
      return stored ? parseInt(stored) : 0
    }

    const setLastVerificationTime = (timestamp: number) => {
      localStorage.setItem('vence_last_push_verification', timestamp.toString())
    }

    const shouldVerifyToday = (): boolean => {
      const lastCheck = getLastVerificationTime()
      const now = Date.now()
      const twoDaysInMs = 2 * 24 * 60 * 60 * 1000
      return (now - lastCheck) >= twoDaysInMs
    }

    const startSmartVerification = () => {
      if (verificationInterval) return

      verificationInterval = setInterval(() => {
        if (document.visibilityState === 'visible' &&
            shouldVerifyToday() &&
            notificationState.settings?.push_enabled) {
          refreshSubscriptionIfExpired()
          setLastVerificationTime(Date.now())
        }
      }, 6 * 60 * 60 * 1000)
    }

    const handleInitialCheck = () => {
      if (shouldVerifyToday() && notificationState.settings?.push_enabled) {
        refreshSubscriptionIfExpired()
        setLastVerificationTime(Date.now())
      }
    }

    handleInitialCheck()

    if (notificationState.settings?.push_enabled) {
      startSmartVerification()
    }

    return () => {
      if (verificationInterval) {
        clearInterval(verificationInterval)
      }
    }
  }, [notificationState.settings, user, supabase])

  // Guardar configuración de notificaciones
  const saveNotificationSettings = async (subscription: PushSubscription | null, permission: NotificationPermission): Promise<NotificationSettings | null> => {
    if (!user || !supabase) return null

    const settingsData: NotificationSettings = {
      user_id: user.id,
      push_enabled: permission === 'granted',
      push_subscription: subscription ? JSON.stringify(subscription) : null,
      preferred_times: ['09:00', '14:00', '20:00'],
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      frequency: 'smart',
      oposicion_type: 'auxiliar-administrativo',
      motivation_level: 'medium'
    }

    const { error } = await supabase
      .from('user_notification_settings')
      .upsert(settingsData, { onConflict: 'user_id' })

    if (error) {
      console.error('Error saving notification settings:', error)
      return null
    }

    await supabase
      .from('user_smart_scheduling')
      .upsert({
        user_id: user.id,
        next_notification_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        notification_frequency_hours: 24,
        streak_status: 0,
        risk_level: 'low'
      }, { onConflict: 'user_id' })

    return settingsData
  }

  // Mostrar notificación de bienvenida
  const showWelcomeNotification = async () => {
    if (Notification.permission === 'granted') {
      try {
        const notification = new Notification('🎯 ¡Notificaciones activadas!', {
          body: 'Te ayudaremos a mantener tu racha de estudio para conseguir tu plaza de funcionario. ¡A por todas!',
          icon: '/icon-192.png',
          badge: '/badge-72.png',
          tag: 'welcome'
        })

        await notificationTracker.trackPushEvent('notification_delivered', user, {
          notificationType: 'welcome',
          title: '🎯 ¡Notificaciones activadas!',
          deviceType: notificationTracker.getDeviceType()
        })

        notification.onclick = async function(this: Notification) {
          await notificationTracker.trackPushEvent('notification_clicked', user, {
            notificationType: 'welcome',
            deviceType: notificationTracker.getDeviceType()
          })
          window.focus()
          this.close()
        }

      } catch (error) {
        console.error('Error mostrando notificación de bienvenida:', error)

        await notificationTracker.trackPushEvent('notification_failed', user, {
          error: error instanceof Error ? error.message : 'Unknown error',
          notificationType: 'welcome',
          deviceType: notificationTracker.getDeviceType()
        })
      }
    }
  }

  // Solicitar permisos de notificación
  const requestNotificationPermission = async () => {
    if (loading) return

    const startTime = Date.now()

    try {
      await notificationTracker.trackPushEvent('permission_requested', user, {
        deviceType: notificationTracker.getDeviceType(),
        supported: notificationState.supported,
        currentPermission: notificationState.permission,
        customData: {
          action: 'activation_button_clicked',
          trigger: 'user_initiated',
          is_mobile_or_pwa: notificationState.isMobileOrPWA
        }
      })

      pwaTracker.trackAction('notification_permission_requested')
    } catch (trackingError) {
      console.error('⚠️ Error en tracking inicial:', trackingError)
    }

    if (!notificationState.supported) {
      await notificationTracker.trackPushEvent('permission_denied', user, {
        error: 'Browser not supported',
        deviceType: notificationTracker.getDeviceType(),
        userAgent: navigator.userAgent
      })

      alert('Tu navegador no soporta notificaciones push')
      return
    }

    setLoading(true)

    try {
      await notificationTracker.trackPermissionRequested(user)

      const permission = await Notification.requestPermission()
      const responseTime = Date.now() - startTime

      if (permission === 'granted') {
        await notificationTracker.trackPermissionGranted(user)

        const registration = await navigator.serviceWorker.register('/sw.js')
        await navigator.serviceWorker.ready

        let subscription = await registration.pushManager.getSubscription()

        if (!subscription) {
          const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY

          if (!vapidPublicKey) {
            throw new Error('VAPID public key not configured')
          }

          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
          })

          await notificationTracker.trackSubscriptionCreated(user, subscription)
        }

        const newSettings = await saveNotificationSettings(subscription, permission)

        try {
          await showWelcomeNotification()

          await notificationTracker.trackPushEvent('settings_updated', user, {
            responseTime,
            deviceType: notificationTracker.getDeviceType(),
            hasSubscription: !!subscription,
            customData: {
              action: 'setup_completed_successfully',
              subscriptionEndpoint: subscription?.endpoint ? 'present' : 'missing',
              welcomeNotificationAttempted: true
            }
          })
        } catch (welcomeError) {
          console.error('Error en notificación de bienvenida:', welcomeError)
        }

        setNotificationState(prev => ({
          ...prev,
          permission,
          subscription,
          settings: newSettings,
          showPrompt: false
        }))

      } else {
        await notificationTracker.trackPermissionDenied(user)

        const newSettings = await saveNotificationSettings(null, permission)
        setNotificationState(prev => ({
          ...prev,
          permission,
          settings: newSettings,
          showPrompt: false
        }))
      }
    } catch (error) {
      const responseTime = Date.now() - startTime
      console.error('❌ Error requesting notification permission:', error)

      await notificationTracker.trackPushEvent('notification_failed', user, {
        error: error instanceof Error ? error.message : 'Unknown error',
        errorName: error instanceof Error ? error.name : 'Unknown',
        responseTime,
        deviceType: notificationTracker.getDeviceType(),
        currentPermission: Notification.permission,
        serviceWorkerSupported: 'serviceWorker' in navigator,
        pushManagerSupported: 'PushManager' in window
      })

      let errorMessage = 'Error al configurar notificaciones:\n\n'
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          errorMessage += '❌ Permisos denegados por el navegador.\n\nPrueba:\n1. Ir a configuración del navegador\n2. Buscar "Notificaciones"\n3. Permitir para este sitio'
        } else if (error.name === 'AbortError') {
          errorMessage += '❌ Operación cancelada.'
        } else if (error.message.includes('VAPID')) {
          errorMessage += '❌ Error de configuración del servidor.\n\nError: ' + error.message
        } else {
          errorMessage += '❌ ' + error.message
        }
      }

      alert(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  // Desactivar notificaciones
  const disableNotifications = async () => {
    setLoading(true)
    try {
      if (user && supabase) {
        await supabase
          .from('user_notification_settings')
          .upsert({
            user_id: user.id,
            push_enabled: false
          }, { onConflict: 'user_id' })
      }

      setNotificationState(prev => ({
        ...prev,
        settings: prev.settings ? { ...prev.settings, push_enabled: false } : null,
        showPrompt: prev.permission === 'default' && prev.supported && prev.isMobileOrPWA
      }))
    } catch (error) {
      console.error('Error disabling notifications:', error)
    } finally {
      setLoading(false)
    }
  }

  // Refrescar suscripción si expiró
  const refreshSubscriptionIfExpired = async () => {
    try {
      if (!user || !notificationState.settings?.push_enabled) return
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) return

      const currentPermission = Notification.permission

      if (currentPermission === 'denied' && notificationState.settings.push_enabled) {
        await markSubscriptionAsDisabled('permissions_denied')
        return
      }

      const registration = await navigator.serviceWorker.ready
      const currentSubscription = await registration.pushManager.getSubscription()

      if (!currentSubscription && notificationState.settings.push_subscription) {
        const savedSubscription = JSON.parse(notificationState.settings.push_subscription || '{}')
        const isFakeSubscription = savedSubscription.endpoint?.includes('FAKE_ENDPOINT_FOR_TESTING')

        if (!isFakeSubscription) {
          await markSubscriptionAsDisabled('subscription_removed')
          return
        }
      }

      if (currentSubscription && notificationState.settings.push_subscription) {
        const savedSubscription = JSON.parse(notificationState.settings.push_subscription || '{}')
        if (currentSubscription.endpoint !== savedSubscription.endpoint) {
          await updateSubscriptionInDatabase(currentSubscription)
        }
      }

    } catch (error) {
      console.log('⚠️ Error en verificación (no crítico):', error instanceof Error ? error.message : 'Unknown')
    }
  }

  // Marcar suscripción como deshabilitada
  const markSubscriptionAsDisabled = async (reason: string) => {
    try {
      const response = await fetch('/api/push/mark-disabled', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.id,
          reason: reason,
          timestamp: new Date().toISOString()
        })
      })

      if (response.ok) {
        setNotificationState(prev => ({
          ...prev,
          settings: prev.settings ? {
            ...prev.settings,
            push_enabled: false,
            push_subscription: null
          } : null,
          showPrompt: Notification.permission === 'default' && prev.isMobileOrPWA,
          permission: Notification.permission
        }))
      }
    } catch (error) {
      console.error('❌ Error en markSubscriptionAsDisabled:', error)
    }
  }

  // Actualizar suscripción en base de datos
  const updateSubscriptionInDatabase = async (subscription: PushSubscription) => {
    try {
      const response = await fetch('/api/push/refresh-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.id,
          newSubscription: subscription
        })
      })

      if (response.ok) {
        setNotificationState(prev => ({
          ...prev,
          subscription: subscription,
          settings: prev.settings ? {
            ...prev.settings,
            push_subscription: JSON.stringify(subscription)
          } : null
        }))
      }
    } catch (error) {
      console.log('⚠️ Error actualizando suscripción en BD:', error instanceof Error ? error.message : 'Unknown')
    }
  }

  // Determinar tipo de banner
  const shouldShowReactivationBanner =
    (notificationState.settings && !notificationState.settings.push_enabled) ||
    (!notificationState.settings && notificationState.permission !== 'default')

  const shouldShowInitialPrompt = notificationState.showPrompt &&
    (!notificationState.settings || !notificationState.settings.push_enabled)

  const bannerTypeToShow: BannerType | null = shouldShowReactivationBanner
    ? (wasDismissedBefore ? 'compact' : 'prominent')
    : (shouldShowInitialPrompt ? 'initial_prompt' : null)

  // Trackear visualización del banner
  useEffect(() => {
    if (!user || !notificationState.supported || isDismissed || bannerTracked) return
    if (notificationState.settings?.push_enabled) return
    if (!notificationState.isMobileOrPWA) return // Solo trackear en móvil/PWA

    if (bannerTypeToShow) {
      trackBannerEvent('banner_viewed', bannerTypeToShow)
      setBannerTracked(true)
    }
  }, [user, notificationState.supported, notificationState.settings, notificationState.isMobileOrPWA, isDismissed, bannerTypeToShow, bannerTracked, trackBannerEvent])

  // No mostrar nada si no hay usuario, no es compatible, o NO es móvil/PWA
  if (!user || !notificationState.supported || !notificationState.isMobileOrPWA) return null

  // Si ya tiene configuración y están activadas, no mostrar nada
  if (notificationState.settings && notificationState.settings.push_enabled) {
    return null
  }

  // Si el usuario descartó el banner temporalmente, no mostrar
  if (isDismissed) {
    return null
  }

  // Banner de reactivación
  if (shouldShowReactivationBanner) {
    if (wasDismissedBefore) {
      // Versión compacta
      return (
        <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-auto z-50">
          <div className="bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg p-3 shadow-lg">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center space-x-2">
                <span className="text-lg">🔔</span>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Notificaciones desactivadas
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => dismissForOneMonth('compact')}
                  className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  ✕
                </button>
                <button
                  onClick={requestNotificationPermission}
                  disabled={loading}
                  className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 font-medium"
                >
                  {loading ? '...' : 'Activar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )
    }

    // Versión prominente
    return (
      <div className="bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 mb-4 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <span className="text-2xl">🔔</span>
            <div>
              <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                Las notificaciones están desactivadas
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Actívalas para recibir recordatorios de estudio
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2 flex-shrink-0">
            <button
              onClick={() => dismissForOneMonth('prominent')}
              className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 px-2 py-1"
            >
              Más tarde
            </button>
            <button
              onClick={requestNotificationPermission}
              disabled={loading}
              className="bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? '...' : 'Activar'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Prompt inicial para activar notificaciones
  if (notificationState.showPrompt && (!notificationState.settings || !notificationState.settings.push_enabled)) {
    return (
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-200 dark:border-green-800 rounded-lg p-6 mb-6 shadow-sm">
        <div className="flex items-start space-x-4">
          <div className="flex-shrink-0">
            <span className="text-3xl">🚀</span>
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
              🎯 ¡Activa las notificaciones para tu oposición!
            </h3>

            <div className="flex space-x-3">
              <button
                onClick={requestNotificationPermission}
                disabled={loading}
                className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-bold py-2 px-4 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                {loading ? (
                  <>
                    <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                    <span>Configurando...</span>
                  </>
                ) : (
                  <>
                    <span>🔔</span>
                    <span>¡Activar Notificaciones!</span>
                  </>
                )}
              </button>

              <button
                onClick={() => setNotificationState(prev => ({ ...prev, showPrompt: false }))}
                className="text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 font-medium py-2 px-4 rounded-lg transition-colors"
              >
                Ahora no
              </button>
            </div>

            <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
              💡 Puedes cambiar esta configuración en cualquier momento desde tu perfil
            </p>
          </div>
        </div>
      </div>
    )
  }

  return null
}
