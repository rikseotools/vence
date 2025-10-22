'use client'
import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'

export default function SetupPersonalPushPage() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)

  const setupPersonalPush = async () => {
    if (!user || user.email !== 'manueltrader@gmail.com') {
      setResult({ success: false, message: 'Solo para manueltrader@gmail.com' })
      return
    }

    try {
      setLoading(true)
      setResult(null)

      // Verificar soporte
      if (!('Notification' in window)) {
        setResult({ success: false, message: 'Notificaciones no soportadas en este navegador' })
        return
      }

      if (!('serviceWorker' in navigator)) {
        setResult({ success: false, message: 'Service Workers no soportados' })
        return
      }

      // Solicitar permisos
      const permission = await Notification.requestPermission()
      
      if (permission !== 'granted') {
        setResult({ success: false, message: `Permisos denegados: ${permission}` })
        return
      }

      // Registrar service worker
      const registration = await navigator.serviceWorker.register('/sw.js')
      await navigator.serviceWorker.ready

      // Crear suscripción
      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      if (!vapidPublicKey) {
        setResult({ success: false, message: 'VAPID key no configurada' })
        return
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
      })

      // Guardar en base de datos
      const response = await fetch('/api/push/refresh-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          newSubscription: subscription
        })
      })

      if (response.ok) {
        setResult({ 
          success: true, 
          message: '✅ Push notifications configuradas exitosamente para manueltrader@gmail.com',
          subscription: subscription.endpoint?.substring(0, 50) + '...'
        })
      } else {
        const error = await response.json()
        setResult({ success: false, message: `Error guardando: ${error.error}` })
      }

    } catch (error) {
      console.error('Error setup push:', error)
      setResult({ success: false, message: `Error: ${error.message}` })
    } finally {
      setLoading(false)
    }
  }

  const sendPersonalTest = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/admin/send-personal-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminEmail: 'manueltrader@gmail.com',
          title: '🎯 Test Personal Vence',
          body: 'Esta es una notificación de prueba personal para el administrador',
          category: 'admin_personal_test'
        })
      })

      const result = await response.json()
      setResult(result)

    } catch (error) {
      setResult({ success: false, message: `Error: ${error.message}` })
    } finally {
      setLoading(false)
    }
  }

  if (!user || user.email !== 'manueltrader@gmail.com') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-4">Acceso Restringido</h1>
          <p className="text-gray-600">Solo para manueltrader@gmail.com</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 mb-8">🔧 Setup Push Personal - Manuel</h1>
        
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold mb-4">1. Configurar Push Notifications</h2>
            <button
              onClick={setupPersonalPush}
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-bold py-3 px-4 rounded-lg"
            >
              {loading ? 'Configurando...' : '🔔 Habilitar Push Notifications'}
            </button>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold mb-4">2. Enviar Test Personal</h2>
            <button
              onClick={sendPersonalTest}
              disabled={loading}
              className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-bold py-3 px-4 rounded-lg"
            >
              {loading ? 'Enviando...' : '🚀 Enviar Test a Mi Móvil'}
            </button>
          </div>

          {result && (
            <div className={`rounded-lg p-6 ${result.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
              <h3 className="font-bold mb-2">Resultado:</h3>
              <p className={result.success ? 'text-green-700' : 'text-red-700'}>{result.message}</p>
              {result.subscription && (
                <p className="text-sm text-gray-600 mt-2">Endpoint: {result.subscription}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Utility function
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