'use client'
import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'

export default function NotificationDebugTemp() {
  const { user } = useAuth()
  const [debugInfo, setDebugInfo] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      setLoading(false)
      return
    }

    const checkNotificationSystem = async () => {
      try {
        console.log('🔍 Checking notification system...')
        
        // Test 1: Verificar si el hook funciona
        const { useIntelligentNotifications } = await import('../hooks/useIntelligentNotifications')
        
        // Test 2: Hacer llamada directa a API si existe
        try {
          const response = await fetch('/api/notifications/user-notifications', {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            }
          })
          
          if (response.ok) {
            const data = await response.json()
            console.log('📊 API Response:', data)
            setDebugInfo({
              apiWorking: true,
              hasNotifications: data.notifications?.length > 0,
              notificationCount: data.notifications?.length || 0,
              notifications: data.notifications || []
            })
          } else {
            console.error('❌ API Error:', response.status)
            setDebugInfo({
              apiWorking: false,
              error: `API returned ${response.status}`
            })
          }
        } catch (apiError) {
          console.error('❌ API Call failed:', apiError)
          setDebugInfo({
            apiWorking: false,
            error: apiError.message
          })
        }
        
      } catch (error) {
        console.error('❌ Debug check failed:', error)
        setDebugInfo({
          error: error.message
        })
      }
      
      setLoading(false)
    }

    checkNotificationSystem()
  }, [user])

  if (!user) {
    return (
      <div className="fixed bottom-4 right-4 bg-yellow-100 border border-yellow-400 text-yellow-800 px-4 py-2 rounded-lg shadow-lg">
        <div className="text-sm font-bold">🔍 Debug Notifications</div>
        <div className="text-xs">Usuario no logueado</div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="fixed bottom-4 right-4 bg-blue-100 border border-blue-400 text-blue-800 px-4 py-2 rounded-lg shadow-lg">
        <div className="text-sm font-bold">🔍 Debug Notifications</div>
        <div className="text-xs">Cargando...</div>
      </div>
    )
  }

  return (
    <div className="fixed bottom-4 right-4 bg-white border border-gray-300 rounded-lg shadow-lg p-4 max-w-sm">
      <div className="text-sm font-bold text-gray-800 mb-2">🔍 Debug Notifications</div>
      {debugInfo ? (
        <div className="text-xs text-gray-600 space-y-1">
          <div>API Working: {debugInfo.apiWorking ? '✅' : '❌'}</div>
          {debugInfo.apiWorking && (
            <>
              <div>Has Notifications: {debugInfo.hasNotifications ? '✅' : '❌'}</div>
              <div>Count: {debugInfo.notificationCount}</div>
              {debugInfo.notifications.length > 0 && (
                <div className="mt-2">
                  <div className="font-semibold">Notifications:</div>
                  {debugInfo.notifications.slice(0, 3).map((notif, idx) => (
                    <div key={idx} className="text-xs bg-gray-100 p-1 rounded mt-1">
                      {notif.title || notif.type || 'Unknown'}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
          {debugInfo.error && (
            <div className="text-red-600">Error: {debugInfo.error}</div>
          )}
        </div>
      ) : (
        <div className="text-xs text-red-600">No debug info available</div>
      )}
    </div>
  )
}