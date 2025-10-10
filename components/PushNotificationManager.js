// Componente para gestionar notificaciones push
'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import notificationTracker from '../lib/services/notificationTracker'

export default function PushNotificationManager() {
  const { user, supabase } = useAuth()
  const [notificationState, setNotificationState] = useState({
    permission: 'default', // 'default', 'granted', 'denied'
    supported: false,
    subscription: null,
    showPrompt: false,
    settings: null
  })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined' && user && supabase) {
      // Configurar tracker con instancia de Supabase
      notificationTracker.setSupabaseInstance(supabase)
      checkNotificationSupport()
      loadUserSettings()
      
      // 📊 TRACKING: Listener para errores globales del navegador móvil
      const handleGlobalError = async (event) => {
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
      
      const handleUnhandledRejection = async (event) => {
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
      
      // Agregar listeners
      window.addEventListener('error', handleGlobalError)
      window.addEventListener('unhandledrejection', handleUnhandledRejection)
      
      // Cleanup
      return () => {
        window.removeEventListener('error', handleGlobalError)
        window.removeEventListener('unhandledrejection', handleUnhandledRejection)
      }
    }
  }, [user, supabase])

  const checkNotificationSupport = () => {
    const supported = 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window
    const permission = supported ? Notification.permission : 'denied'
    
    setNotificationState(prev => ({
      ...prev,
      supported,
      permission,
      showPrompt: supported && permission === 'default' && user
    }))
  }

  const loadUserSettings = async () => {
    if (!user || !supabase) return

    try {
      const { data: settings } = await supabase
        .from('user_notification_settings')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (settings) {
        setNotificationState(prev => ({
          ...prev,
          settings,
          showPrompt: !settings.push_enabled && prev.permission === 'default' && prev.supported
        }))
      }
    } catch (error) {
      console.log('No previous notification settings found')
    }
  }

  const requestNotificationPermission = async () => {
    console.log('🚀 Iniciando requestNotificationPermission, loading actual:', loading)
    
    // Prevenir doble click
    if (loading) {
      console.log('⚠️ Ya está en proceso, ignorando click')
      return
    }
    
    const startTime = Date.now()
    
    try {
      // 📊 TRACKING: Usuario hizo click en activar notificaciones (usando permission_requested con contexto)
      await notificationTracker.trackPushEvent('permission_requested', user, {
        deviceType: notificationTracker.getDeviceType(),
        supported: notificationState.supported,
        currentPermission: notificationState.permission,
        customData: {
          action: 'activation_button_clicked',
          trigger: 'user_initiated'
        }
      })
    } catch (trackingError) {
      console.error('⚠️ Error en tracking inicial:', trackingError)
      // Continuar aunque falle el tracking
    }
    
    if (!notificationState.supported) {
      const error = 'Browser not supported'
      console.error('❌ Browser not supported for push notifications')
      
      try {
        // 📊 TRACKING: Error de soporte del navegador - usar tipo existente
        await notificationTracker.trackPushEvent('permission_denied', user, {
          error,
          deviceType: notificationTracker.getDeviceType(),
          userAgent: navigator.userAgent
        })
      } catch (trackingError) {
        console.error('⚠️ Error en tracking de browser not supported:', trackingError)
      }
      
      alert('Tu navegador no soporta notificaciones push')
      return
    }

    console.log('🔄 Estableciendo loading = true')
    setLoading(true)
    
    try {
      // 📊 TRACKING: Solicitando permisos
      await notificationTracker.trackPermissionRequested(user)
      
      // Solicitar permiso
      const permission = await Notification.requestPermission()
      const responseTime = Date.now() - startTime
      
      if (permission === 'granted') {
        try {
          // 📊 TRACKING: Permisos otorgados
          await notificationTracker.trackPermissionGranted(user)
        } catch (trackingError) {
          console.error('⚠️ Error en tracking de permisos otorgados:', trackingError)
        }
        
        try {
          console.log('🔧 Registrando service worker...')
          // Registrar service worker si no existe
          const registration = await navigator.serviceWorker.register('/sw.js')
          console.log('✅ Service worker registrado, esperando ready...')
          await navigator.serviceWorker.ready
          console.log('✅ Service worker ready')

          // Obtener o crear suscripción push
          console.log('🔍 Verificando suscripción existente...')
          let subscription = await registration.pushManager.getSubscription()
          
          if (!subscription) {
            console.log('🆕 Creando nueva suscripción...')
            // Crear nueva suscripción
            const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
            console.log('🔑 VAPID key disponible:', !!vapidPublicKey)
            
            if (!vapidPublicKey) {
              throw new Error('VAPID public key not configured')
            }
            
            subscription = await registration.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
            })
            console.log('✅ Suscripción creada exitosamente')
            
            try {
              // 📊 TRACKING: Suscripción creada exitosamente
              await notificationTracker.trackSubscriptionCreated(user, subscription)
            } catch (trackingError) {
              console.error('⚠️ Error en tracking de suscripción:', trackingError)
            }
          } else {
            console.log('✅ Usando suscripción existente')
          }

          // Guardar configuración en base de datos
          console.log('💾 Guardando configuración en base de datos...')
          const newSettings = await saveNotificationSettings(subscription, permission)
          console.log('✅ Configuración guardada:', !!newSettings)
          
          // Mostrar notificación de bienvenida
          // Mostrar notificación de bienvenida y trackear el resultado
          try {
            await showWelcomeNotification()
            
            // 📊 TRACKING: Configuración completa exitosa
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
            
            // 📊 TRACKING: Error en notificación de bienvenida pero setup OK
            await notificationTracker.trackPushEvent('settings_updated', user, {
              responseTime,
              deviceType: notificationTracker.getDeviceType(),
              hasSubscription: !!subscription,
              customData: {
                action: 'setup_completed_with_welcome_error',
                subscriptionEndpoint: subscription?.endpoint ? 'present' : 'missing',
                welcomeNotificationError: welcomeError.message
              }
            })
          }
          
          // Actualizar estado con nueva configuración
          setNotificationState(prev => ({
            ...prev,
            permission,
            subscription,
            settings: newSettings, // Importante: actualizar settings inmediatamente
            showPrompt: false
          }))

        } catch (subscriptionError) {
          console.error('❌ Error creating subscription:', subscriptionError)
          
          try {
            // 📊 TRACKING: Error creando suscripción - usar tipo existente
            await notificationTracker.trackPushEvent('notification_failed', user, {
              error: subscriptionError.message,
              errorStack: subscriptionError.stack,
              responseTime,
              deviceType: notificationTracker.getDeviceType(),
              vapidAvailable: !!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
            })
          } catch (trackingError) {
            console.error('⚠️ Error en tracking de subscription error:', trackingError)
          }
          
          throw subscriptionError
        }

      } else {
        // Usuario rechazó permisos
        console.log('❌ User denied notification permission:', permission)
        
        try {
          // 📊 TRACKING: Permisos denegados
          await notificationTracker.trackPermissionDenied(user)
        } catch (trackingError) {
          console.error('⚠️ Error en tracking de permisos denegados:', trackingError)
        }
        
        const newSettings = await saveNotificationSettings(null, permission)
        setNotificationState(prev => ({
          ...prev,
          permission,
          settings: newSettings, // Actualizar settings también cuando se deniega
          showPrompt: false
        }))
      }
    } catch (error) {
      const responseTime = Date.now() - startTime
      console.error('❌ Error requesting notification permission:', error)
      
      try {
        // 📊 TRACKING: Error general en el proceso - usar tipo existente
        await notificationTracker.trackPushEvent('notification_failed', user, {
          error: error.message,
          errorName: error.name,
          errorStack: error.stack,
          responseTime,
          deviceType: notificationTracker.getDeviceType(),
          currentPermission: Notification.permission,
          serviceWorkerSupported: 'serviceWorker' in navigator,
          pushManagerSupported: 'PushManager' in window
        })
      } catch (trackingError) {
        console.error('⚠️ Error en tracking de error general:', trackingError)
      }
      
      // Mostrar error específico según el tipo
      let errorMessage = 'Error al configurar notificaciones. '
      if (error.name === 'NotAllowedError') {
        errorMessage += 'Permisos denegados por el navegador.'
      } else if (error.name === 'AbortError') {
        errorMessage += 'Operación cancelada.'
      } else if (error.message.includes('VAPID')) {
        errorMessage += 'Error de configuración del servidor.'
      } else {
        errorMessage += 'Inténtalo de nuevo.'
      }
      
      alert(errorMessage)
    } finally {
      console.log('🏁 Finalizando requestNotificationPermission, estableciendo loading = false')
      setLoading(false)
    }
  }

  const saveNotificationSettings = async (subscription, permission) => {
    if (!user || !supabase) return null

    const settingsData = {
      user_id: user.id,
      push_enabled: permission === 'granted',
      push_subscription: subscription ? JSON.stringify(subscription) : null,
      preferred_times: ['09:00', '14:00', '20:00'],
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      frequency: 'smart',
      oposicion_type: 'auxiliar-administrativo',
      motivation_level: 'medium'
    }

    // Upsert configuración
    const { error } = await supabase
      .from('user_notification_settings')
      .upsert(settingsData, { onConflict: 'user_id' })

    if (error) {
      console.error('Error saving notification settings:', error)
      return null
    }

    // Inicializar smart scheduling
    await supabase
      .from('user_smart_scheduling')
      .upsert({
        user_id: user.id,
        next_notification_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        notification_frequency_hours: 24,
        streak_status: 0,
        risk_level: 'low'
      }, { onConflict: 'user_id' })
    
    // Retornar la configuración guardada para actualizar el estado
    return settingsData
  }

  const showWelcomeNotification = async () => {
    if (Notification.permission === 'granted') {
      try {
        const notification = new Notification('🎯 ¡Notificaciones activadas!', {
          body: 'Te ayudaremos a mantener tu racha de estudio para conseguir tu plaza de funcionario. ¡A por todas!',
          icon: '/icon-192.png',
          badge: '/badge-72.png',
          tag: 'welcome'
        })
        
        // 📊 TRACKING: Notificación de bienvenida mostrada
        await notificationTracker.trackPushEvent('notification_delivered', user, {
          notificationType: 'welcome',
          title: '🎯 ¡Notificaciones activadas!',
          deviceType: notificationTracker.getDeviceType()
        })
        
        console.log('✅ Notificación de bienvenida mostrada')
        
        // Manejar click en la notificación
        notification.onclick = async function() {
          await notificationTracker.trackPushEvent('notification_clicked', user, {
            notificationType: 'welcome',
            deviceType: notificationTracker.getDeviceType()
          })
          window.focus()
          this.close()
        }
        
      } catch (error) {
        console.error('Error mostrando notificación de bienvenida:', error)
        
        // 📊 TRACKING: Error mostrando notificación
        await notificationTracker.trackPushEvent('notification_failed', user, {
          error: error.message,
          notificationType: 'welcome',
          deviceType: notificationTracker.getDeviceType()
        })
      }
    } else {
      console.warn('No se puede mostrar notificación: permisos no otorgados')
    }
  }

  const disableNotifications = async () => {
    setLoading(true)
    try {
      // Actualizar configuración en BD
      if (user && supabase) {
        const { error } = await supabase
          .from('user_notification_settings')
          .upsert({
            user_id: user.id,
            push_enabled: false
          }, { onConflict: 'user_id' })
        
        if (error) {
          console.error('Error disabling notifications:', error)
        }
      }

      setNotificationState(prev => ({
        ...prev,
        settings: { ...prev.settings, push_enabled: false },
        showPrompt: prev.permission === 'default' && prev.supported // Mostrar prompt si el permiso del navegador lo permite y es compatible
      }))
    } catch (error) {
      console.error('Error disabling notifications:', error)
    } finally {
      setLoading(false)
    }
  }

  // Debug info
  if (process.env.NODE_ENV === 'development') {
    console.log('🔔 PushNotificationManager state:', {
      hasUser: !!user,
      supported: notificationState.supported,
      permission: notificationState.permission,
      hasSettings: !!notificationState.settings,
      pushEnabled: notificationState.settings?.push_enabled,
      showPrompt: notificationState.showPrompt,
      loading: loading,
      subscription: !!notificationState.subscription
    })
  }

  // No mostrar nada si no hay usuario o no es compatible
  if (!user || !notificationState.supported) return null

  // Si ya tiene configuración y están activadas, no mostrar nada (solo en perfil)
  if (notificationState.settings && notificationState.settings.push_enabled) {
    return null
  }

  // Si están desactivadas, mostrar solo botón de reactivación compacto
  if (notificationState.settings && !notificationState.settings.push_enabled && notificationState.permission !== 'default') {
    return (
      <div className="bg-gray-50 dark:bg-gray-900/20 border border-gray-200 dark:border-gray-800 rounded-lg p-3 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-lg">🔔</span>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Notificaciones desactivadas
            </span>
          </div>
          <button
            onClick={requestNotificationPermission}
            disabled={loading}
            className="text-sm text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-200 disabled:opacity-50 font-medium"
          >
            {loading ? '...' : 'Reactivar'}
          </button>
        </div>
      </div>
    )
  }

  // Mostrar prompt para activar notificaciones
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
                    <span>Configurando... (ver consola para debug)</span>
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

// Utility function para convertir VAPID key
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/')

  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}