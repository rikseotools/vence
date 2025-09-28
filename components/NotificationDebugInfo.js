// components/NotificationDebugInfo.js - DEBUG INFO PARA NOTIFICACIONES
'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import notificationTracker from '../lib/services/notificationTracker'

export default function NotificationDebugInfo({ show = false }) {
  const { user } = useAuth()
  const [debugInfo, setDebugInfo] = useState({})
  const [recentEvents, setRecentEvents] = useState([])
  const [showDetails, setShowDetails] = useState(false)

  useEffect(() => {
    if (show && typeof window !== 'undefined') {
      collectDebugInfo()
    }
  }, [show])

  const collectDebugInfo = () => {
    const deviceType = notificationTracker.getDeviceType()
    const mobileInfo = notificationTracker.getMobileInfo()
    
    const info = {
      // Información básica del dispositivo
      deviceType,
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      
      // APIs disponibles
      hasNotificationAPI: 'Notification' in window,
      hasServiceWorkerAPI: 'serviceWorker' in navigator,
      hasPushManagerAPI: 'PushManager' in window,
      
      // Permisos actuales
      notificationPermission: 'Notification' in window ? Notification.permission : 'unsupported',
      
      // Información específica móvil
      ...mobileInfo,
      
      // Información de pantalla
      screenInfo: {
        width: window.screen.width,
        height: window.screen.height,
        colorDepth: window.screen.colorDepth,
        pixelRatio: window.devicePixelRatio
      },
      
      // Información de viewport
      viewportInfo: {
        width: window.innerWidth,
        height: window.innerHeight
      },
      
      // Variables de entorno relevantes
      vapidKeyConfigured: !!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
      
      // Información de conexión
      connectionInfo: navigator.connection ? {
        effectiveType: navigator.connection.effectiveType,
        downlink: navigator.connection.downlink,
        rtt: navigator.connection.rtt
      } : null
    }
    
    setDebugInfo(info)
  }

  const testNotificationPermission = async () => {
    try {
      const startTime = Date.now()
      
      // Trackear el intento de test
      await notificationTracker.trackPushEvent('debug_permission_test', user, {
        deviceType: notificationTracker.getDeviceType()
      })
      
      const permission = await Notification.requestPermission()
      const responseTime = Date.now() - startTime
      
      // Trackear el resultado
      await notificationTracker.trackPushEvent('debug_permission_result', user, {
        permission,
        responseTime,
        deviceType: notificationTracker.getDeviceType()
      })
      
      // Actualizar debug info
      collectDebugInfo()
      
      alert(`Permiso: ${permission}\nTiempo: ${responseTime}ms`)
      
    } catch (error) {
      console.error('Error testing permission:', error)
      
      await notificationTracker.trackPushEvent('debug_permission_error', user, {
        error: error.message,
        errorName: error.name,
        deviceType: notificationTracker.getDeviceType()
      })
      
      alert(`Error: ${error.message}`)
    }
  }

  const testServiceWorkerRegistration = async () => {
    try {
      if (!('serviceWorker' in navigator)) {
        throw new Error('Service Worker no soportado')
      }
      
      const registration = await navigator.serviceWorker.register('/sw.js')
      await navigator.serviceWorker.ready
      
      await notificationTracker.trackPushEvent('debug_sw_registration_success', user, {
        deviceType: notificationTracker.getDeviceType(),
        swScope: registration.scope
      })
      
      alert('Service Worker registrado correctamente')
      
    } catch (error) {
      console.error('Error registering service worker:', error)
      
      await notificationTracker.trackPushEvent('debug_sw_registration_error', user, {
        error: error.message,
        deviceType: notificationTracker.getDeviceType()
      })
      
      alert(`Error SW: ${error.message}`)
    }
  }

  const testPushSubscription = async () => {
    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        throw new Error('Push API no soportado')
      }
      
      const registration = await navigator.serviceWorker.ready
      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      
      if (!vapidPublicKey) {
        throw new Error('VAPID public key no configurada')
      }
      
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
      })
      
      await notificationTracker.trackPushEvent('debug_subscription_success', user, {
        deviceType: notificationTracker.getDeviceType(),
        hasSubscription: !!subscription
      })
      
      alert('Suscripción push creada correctamente')
      
    } catch (error) {
      console.error('Error creating push subscription:', error)
      
      await notificationTracker.trackPushEvent('debug_subscription_error', user, {
        error: error.message,
        errorName: error.name,
        deviceType: notificationTracker.getDeviceType(),
        vapidAvailable: !!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      })
      
      alert(`Error Suscripción: ${error.message}`)
    }
  }

  if (!show || process.env.NODE_ENV !== 'development') {
    return null
  }

  return (
    <div className="fixed bottom-4 left-4 bg-black/90 text-white text-xs p-4 rounded-lg max-w-sm z-50">
      <div className="flex items-center justify-between mb-2">
        <span className="font-bold">🐛 Debug Notificaciones</span>
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="text-yellow-400 hover:text-yellow-200"
        >
          {showDetails ? '▼' : '▶'}
        </button>
      </div>
      
      <div className="space-y-1">
        <div>📱 <span className="text-green-400">{debugInfo.deviceType}</span></div>
        <div>🔔 <span className={debugInfo.notificationPermission === 'granted' ? 'text-green-400' : 'text-red-400'}>
          {debugInfo.notificationPermission}
        </span></div>
        <div>⚙️ APIs: 
          <span className={debugInfo.hasNotificationAPI ? 'text-green-400' : 'text-red-400'}> N</span>
          <span className={debugInfo.hasServiceWorkerAPI ? 'text-green-400' : 'text-red-400'}> SW</span>
          <span className={debugInfo.hasPushManagerAPI ? 'text-green-400' : 'text-red-400'}> PM</span>
        </div>
        <div>🗝️ VAPID: <span className={debugInfo.vapidKeyConfigured ? 'text-green-400' : 'text-red-400'}>
          {debugInfo.vapidKeyConfigured ? 'OK' : 'NO'}
        </span></div>
      </div>

      {showDetails && (
        <div className="mt-3 space-y-2 text-xs">
          <div className="border-t border-gray-600 pt-2">
            <div>📐 {debugInfo.screenInfo?.width}x{debugInfo.screenInfo?.height}</div>
            <div>📱 {debugInfo.viewportInfo?.width}x{debugInfo.viewportInfo?.height}</div>
            <div>📶 {debugInfo.connectionInfo?.effectiveType || 'N/A'}</div>
            {debugInfo.isStandalone && <div>📱 PWA Mode</div>}
            {debugInfo.isTouchDevice && <div>👆 Touch: {debugInfo.maxTouchPoints}</div>}
          </div>
          
          <div className="border-t border-gray-600 pt-2 space-y-1">
            <button
              onClick={testNotificationPermission}
              className="block w-full text-left text-yellow-400 hover:text-yellow-200"
            >
              🧪 Test Permisos
            </button>
            <button
              onClick={testServiceWorkerRegistration}
              className="block w-full text-left text-blue-400 hover:text-blue-200"
            >
              🧪 Test Service Worker
            </button>
            <button
              onClick={testPushSubscription}
              className="block w-full text-left text-green-400 hover:text-green-200"
            >
              🧪 Test Suscripción
            </button>
          </div>
        </div>
      )}
    </div>
  )
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