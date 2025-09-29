// app/admin/notificaciones/push/usuarios/page.js - USUARIOS ACTIVOS DE PUSH
'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import Link from 'next/link'

export default function PushUsersPage() {
  const { user, supabase, loading: authLoading } = useAuth()
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [activeUsers, setActiveUsers] = useState([])
  const [timeRange, setTimeRange] = useState('30')

  useEffect(() => {
    async function checkAdminAccess() {
      if (authLoading) return
      
      if (!user) {
        setLoading(false)
        return
      }

      try {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('plan_type, email')
          .eq('id', user.id)
          .single()

        const adminAccess = profile?.plan_type === 'admin' || 
                           profile?.email === 'ilovetestpro@gmail.com' ||
                           profile?.email === 'rikseotools@gmail.com'
        
        setIsAdmin(adminAccess)
        
        if (adminAccess) {
          loadActiveUsers()
        }
      } catch (error) {
        console.error('Error checking admin access:', error)
        setIsAdmin(false)
      } finally {
        setLoading(false)
      }
    }

    checkAdminAccess()
  }, [user, authLoading, supabase, timeRange])

  const loadActiveUsers = async () => {
    console.log('🚀 Iniciando loadActiveUsers - Dispositivo:', /Mobi|Android/i.test(navigator.userAgent) ? 'Móvil' : 'Escritorio')
    try {
      const daysAgo = new Date(Date.now() - parseInt(timeRange) * 24 * 60 * 60 * 1000).toISOString()

      console.log('🔍 Cargando usuarios activos desde:', daysAgo)

      // Obtener todos los eventos de push para analizar el estado actual
      const { data: allPushEvents } = await supabase
        .from('notification_events')
        .select('user_id, event_type, created_at')
        .gte('created_at', daysAgo)
        .order('created_at', { ascending: false })

      console.log('📱 Eventos push encontrados:', allPushEvents?.length || 0)

      // Determinar usuarios activos basándose en el último evento relevante
      const userLastEvent = {}
      allPushEvents?.forEach(event => {
        if (!userLastEvent[event.user_id] || 
            new Date(event.created_at) > new Date(userLastEvent[event.user_id].created_at)) {
          userLastEvent[event.user_id] = event
        }
      })

      console.log('🔄 Procesando usuarios y sus últimos eventos:')
      Object.entries(userLastEvent).forEach(([userId, event]) => {
        console.log(`👤 Usuario ${userId.substring(0, 8)}: ${event.event_type} (${event.created_at})`)
      })

      // Obtener TODOS los eventos push (no filtrar aún)
      const { data: pushEvents } = await supabase
        .from('notification_events')
        .select('*')
        .gte('created_at', daysAgo)
        .order('created_at', { ascending: false })

      // Usuarios activos: último evento NO es subscription_deleted
      const activeUserIds = Object.keys(userLastEvent).filter(userId => {
        const lastEvent = userLastEvent[userId]
        return lastEvent.event_type !== 'subscription_deleted'
      })

      console.log('👤 Usuarios con push activo (sin subscription_deleted):', activeUserIds.length)
      console.log('📋 Lista de usuarios activos:', activeUserIds)

      console.log('📱 Eventos push encontrados:', pushEvents?.length || 0)

      if (!pushEvents || pushEvents.length === 0) {
        setActiveUsers([])
        return
      }

      // Solo procesar usuarios activos
      const uniqueUserIds = activeUserIds
      console.log('👥 Usuarios únicos con push activo (filtrados):', uniqueUserIds.length)

      if (uniqueUserIds.length === 0) {
        console.log('⚠️ No hay usuarios activos después del filtro')
        setActiveUsers([])
        return
      }

      // Obtener perfiles de usuarios
      const { data: userProfiles } = await supabase
        .from('user_profiles')
        .select('id, email, created_at, plan_type, registration_source')
        .in('id', uniqueUserIds)

      console.log('📋 Perfiles encontrados:', userProfiles?.length || 0)

      // Crear mapa de usuarios
      const userMap = {}
      userProfiles?.forEach(profile => {
        userMap[profile.id] = profile
      })

      // Procesar detalles de usuarios
      const userDetails = []
      
      for (const userId of uniqueUserIds) {
        const userEvents = pushEvents.filter(e => e.user_id === userId)
        const userProfile = userMap[userId]
        
        console.log(`👤 Procesando usuario ${userId}:`, {
          events: userEvents.length,
          hasProfile: !!userProfile,
          email: userProfile?.email
        })
        
        // Si no hay perfil, crear entrada básica
        const email = userProfile?.email || `usuario-${userId.substring(0, 8)}`
        
        // Obtener dispositivos y navegadores del usuario
        const devices = [...new Set(userEvents.map(e => e.device_info?.platform).filter(Boolean))]
        const browsers = [...new Set(userEvents.map(e => e.browser_info?.name).filter(Boolean))]
        
        // Calcular estadísticas del usuario
        const totalEvents = userEvents.length
        const clickedEvents = userEvents.filter(e => e.event_type === 'notification_clicked').length
        const sentEvents = userEvents.filter(e => e.event_type === 'notification_sent').length
        const permissionEvents = userEvents.filter(e => e.event_type === 'permission_granted').length
        const clickRate = sentEvents > 0 ? ((clickedEvents / sentEvents) * 100).toFixed(1) : 0
        
        // Último evento
        const lastEvent = userEvents[0] // Ya están ordenados por fecha
        
        // Información de suscripción activa (basada en último evento)
        const lastEventForUser = userLastEvent[userId]
        const hasActiveSubscription = lastEventForUser && lastEventForUser.event_type !== 'subscription_deleted'
        
        userDetails.push({
          userId,
          email,
          devices: devices.length > 0 ? devices.join(', ') : 'N/A',
          browsers: browsers.length > 0 ? browsers.join(', ') : 'N/A',
          totalEvents,
          clickedEvents,
          sentEvents,
          permissionEvents,
          clickRate,
          lastEventType: lastEvent?.event_type || 'N/A',
          lastEventDate: lastEvent?.created_at || null,
          planType: userProfile?.plan_type || 'N/A',
          registrationSource: userProfile?.registration_source || 'N/A',
          registrationDate: userProfile?.created_at || null,
          hasActiveSubscription,
          subscriptionDate: lastEventForUser?.created_at || null
        })
      }

      console.log('✅ Usuarios procesados:', userDetails.length)
      setActiveUsers(userDetails)

    } catch (error) {
      console.error('❌ Error loading active users:', error)
      console.error('🔍 Error details:', {
        message: error.message,
        stack: error.stack,
        device: /Mobi|Android/i.test(navigator.userAgent) ? 'Móvil' : 'Escritorio'
      })
      // En caso de error, mostrar lista vacía
      setActiveUsers([])
    }
  }

  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando usuarios activos...</p>
        </div>
      </div>
    )
  }

  if (!user || !isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
          <div className="text-6xl mb-4">⛔</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Acceso Denegado</h2>
          <p className="text-gray-600 mb-6">No tienes permisos para acceder a este panel.</p>
          <Link 
            href="/admin/notificaciones"
            className="w-full bg-gray-200 text-gray-700 py-3 px-6 rounded-lg font-medium hover:bg-gray-300 transition-colors block"
          >
            ← Volver al Panel
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
            <div>
              <nav className="flex items-center space-x-2 text-sm text-gray-500 mb-2">
                <Link href="/admin/notificaciones" className="hover:text-blue-600">Panel Admin</Link>
                <span>›</span>
                <Link href="/admin/notificaciones/push" className="hover:text-blue-600">Push Notifications</Link>
                <span>›</span>
                <span className="text-gray-800">Usuarios Activos</span>
              </nav>
              <h1 className="text-3xl font-bold text-gray-800 mb-2">
                👥 Usuarios Activos con Push Notifications
              </h1>
              <p className="text-gray-600">
                Lista completa de usuarios que han interactuado con notificaciones push
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm"
              >
                <option value="7">Últimos 7 días</option>
                <option value="30">Últimos 30 días</option>
                <option value="90">Últimos 90 días</option>
                <option value="365">Último año</option>
              </select>
              <button
                onClick={loadActiveUsers}
                className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors flex items-center space-x-2"
              >
                <span>🔄</span>
                <span>Actualizar</span>
              </button>
            </div>
          </div>
        </div>

        {/* Estadísticas Rápidas */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 rounded-lg bg-blue-50 text-blue-600">
                <span className="text-2xl">👥</span>
              </div>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-1">{activeUsers.length}</h3>
            <p className="text-gray-600 font-medium">Usuarios Únicos</p>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 rounded-lg bg-green-50 text-green-600">
                <span className="text-2xl">📱</span>
              </div>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-1">
              {activeUsers.reduce((sum, user) => sum + user.totalEvents, 0)}
            </h3>
            <p className="text-gray-600 font-medium">Total Eventos</p>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 rounded-lg bg-purple-50 text-purple-600">
                <span className="text-2xl">👆</span>
              </div>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-1">
              {activeUsers.length > 0 ? 
                (activeUsers.reduce((sum, user) => sum + parseFloat(user.clickRate), 0) / activeUsers.length).toFixed(1) : 0
              }%
            </h3>
            <p className="text-gray-600 font-medium">CTR Promedio</p>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 rounded-lg bg-orange-50 text-orange-600">
                <span className="text-2xl">✅</span>
              </div>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-1">
              {activeUsers.filter(user => user.permissionEvents > 0).length}
            </h3>
            <p className="text-gray-600 font-medium">Con Permisos</p>
          </div>
        </div>

        {/* Tabla de Usuarios */}
        {activeUsers.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
            <div className="text-6xl mb-4">📱</div>
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Sin Usuarios Activos</h3>
            <p className="text-gray-600">
              No hay usuarios con actividad de push notifications en el período seleccionado.
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-800">
                Usuarios Activos ({activeUsers.length})
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Usuario</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Plan</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Dispositivos</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Navegadores</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Eventos</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">CTR</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado Push</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Último Evento</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Registro</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {activeUsers.map((userDetail, index) => (
                    <tr key={userDetail.userId} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-sm font-medium text-blue-600">
                            {userDetail.email?.charAt(0).toUpperCase()}
                          </div>
                          <div className="ml-3">
                            <div className="text-sm font-medium text-gray-900">
                              {userDetail.email}
                            </div>
                            <div className="text-xs text-gray-500">
                              {userDetail.registrationSource}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          userDetail.planType === 'premium' ? 'bg-green-100 text-green-800' :
                          userDetail.planType === 'admin' ? 'bg-purple-100 text-purple-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {userDetail.planType}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        <div className="max-w-xs truncate" title={userDetail.devices}>
                          {userDetail.devices}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        <div className="max-w-xs truncate" title={userDetail.browsers}>
                          {userDetail.browsers}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div className="flex flex-col">
                          <span className="font-medium">{userDetail.totalEvents} total</span>
                          <span className="text-xs text-gray-500">
                            📤 {userDetail.sentEvents} | 👆 {userDetail.clickedEvents} | ✅ {userDetail.permissionEvents}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`text-sm font-medium ${
                          parseFloat(userDetail.clickRate) >= 50 ? 'text-green-600' :
                          parseFloat(userDetail.clickRate) >= 25 ? 'text-yellow-600' :
                          parseFloat(userDetail.clickRate) > 0 ? 'text-orange-600' :
                          'text-gray-600'
                        }`}>
                          {userDetail.clickRate}%
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          userDetail.hasActiveSubscription ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {userDetail.hasActiveSubscription ? '🟢 Activo' : '🔴 Inactivo'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div className="flex flex-col">
                          <span className="capitalize">
                            {userDetail.lastEventType?.replace('notification_', '').replace('_', ' ')}
                          </span>
                          <span className="text-xs">
                            {userDetail.lastEventDate ? 
                              new Date(userDetail.lastEventDate).toLocaleDateString('es-ES') : 
                              'N/A'
                            }
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {userDetail.registrationDate ? 
                          new Date(userDetail.registrationDate).toLocaleDateString('es-ES') : 
                          'N/A'
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}