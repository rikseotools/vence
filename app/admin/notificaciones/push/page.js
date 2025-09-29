// app/admin/notificaciones/push/page.js - PÁGINA DETALLADA DE PUSH NOTIFICATIONS
'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '../../../contexts/AuthContext'
import Link from 'next/link'

export default function PushDetailPage() {
  const { user, supabase, loading: authLoading } = useAuth()
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [data, setData] = useState(null)
  const [timeRange, setTimeRange] = useState('30')
  const [selectedEvent, setSelectedEvent] = useState(null)

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
          loadPushData()
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

  const loadPushData = async () => {
    try {
      const daysAgo = new Date(Date.now() - parseInt(timeRange) * 24 * 60 * 60 * 1000).toISOString()

      // Obtener todos los eventos push
      const { data: pushEvents } = await supabase
        .from('notification_events')
        .select('*')
        .gte('created_at', daysAgo)
        .order('created_at', { ascending: false })

      // Determinar usuarios activos basándose en el último evento
      const userLastEvent = {}
      pushEvents?.forEach(event => {
        if (!userLastEvent[event.user_id] || 
            new Date(event.created_at) > new Date(userLastEvent[event.user_id].created_at)) {
          userLastEvent[event.user_id] = event
        }
      })

      // Usuarios activos: último evento NO es subscription_deleted
      const activeUserIds = Object.keys(userLastEvent).filter(userId => {
        const lastEvent = userLastEvent[userId]
        return lastEvent.event_type !== 'subscription_deleted'
      })
      const userIds = [...new Set((pushEvents || []).map(e => e.user_id))]
      const { data: userProfiles } = await supabase
        .from('user_profiles')
        .select('id, email, created_at, plan_type')
        .in('id', userIds)

      // Crear mapa de usuarios
      const userMap = {}
      userProfiles?.forEach(profile => {
        userMap[profile.id] = profile
      })

      // Enriquecer eventos con perfiles
      const enrichedEvents = (pushEvents || []).map(event => ({
        ...event,
        user_profiles: userMap[event.user_id]
      }))

      const events = pushEvents || []
      
      // Procesar estadísticas detalladas
      const stats = {
        totalEvents: events.length,
        uniqueUsers: activeUserIds.length, // Solo usuarios con push activo
        uniqueUsersTotal: new Set(events.map(e => e.user_id)).size, // Total histórico
        eventTypes: {},
        deviceTypes: {},
        browserTypes: {},
        notificationTypes: {},
        hourlyDistribution: Array.from({ length: 24 }, () => 0),
        dailyTrends: {},
        responseTimeStats: [],
        clickThroughRates: {},
        userEngagement: {}
      }

      // Procesar cada evento
      events.forEach(event => {
        // Tipos de evento
        stats.eventTypes[event.event_type] = (stats.eventTypes[event.event_type] || 0) + 1

        // Dispositivos
        const platform = event.device_info?.platform || 'Unknown'
        stats.deviceTypes[platform] = (stats.deviceTypes[platform] || 0) + 1

        // Navegadores
        const browser = event.browser_info?.name || 'Unknown'
        stats.browserTypes[browser] = (stats.browserTypes[browser] || 0) + 1

        // Tipos de notificación
        if (event.notification_type) {
          stats.notificationTypes[event.notification_type] = (stats.notificationTypes[event.notification_type] || 0) + 1
        }

        // Distribución por hora
        const hour = new Date(event.created_at).getHours()
        stats.hourlyDistribution[hour]++

        // Tendencias diarias
        const date = new Date(event.created_at).toISOString().split('T')[0]
        if (!stats.dailyTrends[date]) {
          stats.dailyTrends[date] = { sent: 0, clicked: 0, dismissed: 0, delivered: 0 }
        }
        stats.dailyTrends[date][event.event_type.replace('notification_', '')] = 
          (stats.dailyTrends[date][event.event_type.replace('notification_', '')] || 0) + 1

        // Tiempos de respuesta
        if (event.response_time_ms && event.response_time_ms > 0) {
          stats.responseTimeStats.push(event.response_time_ms)
        }

        // Engagement por usuario
        if (!stats.userEngagement[event.user_id]) {
          stats.userEngagement[event.user_id] = { sent: 0, clicked: 0, dismissed: 0 }
        }
        const action = event.event_type.replace('notification_', '')
        if (stats.userEngagement[event.user_id][action] !== undefined) {
          stats.userEngagement[event.user_id][action]++
        }
      })

      // Calcular CTR por tipo de notificación
      Object.keys(stats.notificationTypes).forEach(type => {
        const typeEvents = events.filter(e => e.notification_type === type)
        const sent = typeEvents.filter(e => e.event_type === 'notification_sent').length
        const clicked = typeEvents.filter(e => e.event_type === 'notification_clicked').length
        stats.clickThroughRates[type] = sent > 0 ? ((clicked / sent) * 100).toFixed(2) : 0
      })

      // Estadísticas de tiempo de respuesta
      if (stats.responseTimeStats.length > 0) {
        stats.responseTimeStats.sort((a, b) => a - b)
        stats.avgResponseTime = stats.responseTimeStats.reduce((a, b) => a + b, 0) / stats.responseTimeStats.length
        stats.medianResponseTime = stats.responseTimeStats[Math.floor(stats.responseTimeStats.length / 2)]
      }


      setData({
        events: enrichedEvents.slice(0, 100), // Solo los primeros 100 para la tabla
        stats,
        allEvents: enrichedEvents
      })

    } catch (error) {
      console.error('Error loading push data:', error)
    }
  }

  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando datos de push notifications...</p>
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
                <span className="text-gray-800">Push Notifications</span>
              </nav>
              <h1 className="text-3xl font-bold text-gray-800 mb-2">
                📱 Análisis Detallado de Push Notifications
              </h1>
              <p className="text-gray-600">
                Estadísticas completas de notificaciones push, engagement y rendimiento
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
                onClick={loadPushData}
                className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors flex items-center space-x-2"
              >
                <span>🔄</span>
                <span>Actualizar</span>
              </button>
            </div>
          </div>
        </div>

        {!data ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Cargando datos...</p>
          </div>
        ) : (
          <div className="space-y-8">
            
            {/* Métricas Principales */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatCard title="Total Eventos" value={data.stats.totalEvents} icon="📊" color="blue" />
              <StatCard 
                title="Usuarios Únicos" 
                value={data.stats.uniqueUsers} 
                icon="👥" 
                color="green" 
                href="/admin/notificaciones/push/usuarios"
              />
              <StatCard title="Tiempo Resp. Promedio" value={`${Math.round(data.stats.avgResponseTime || 0)}ms`} icon="⚡" color="yellow" />
              <StatCard title="CTR Promedio" value={`${Object.values(data.stats.clickThroughRates).reduce((a, b) => parseFloat(a) + parseFloat(b), 0) / Object.keys(data.stats.clickThroughRates).length || 0}%`} icon="👆" color="purple" />
            </div>

            {/* Gráfico de Actividad por Hora */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">📈 Actividad por Hora del Día</h3>
              <div className="grid grid-cols-12 gap-2">
                {data.stats.hourlyDistribution.map((count, hour) => (
                  <div key={hour} className="text-center">
                    <div className="text-xs text-gray-500 mb-1">{hour}h</div>
                    <div className="bg-blue-100 rounded-sm h-20 flex items-end">
                      <div 
                        className="w-full bg-blue-500 rounded-sm min-h-[4px]" 
                        style={{ 
                          height: `${Math.max(20, (count / Math.max(...data.stats.hourlyDistribution)) * 100)}%` 
                        }}
                      ></div>
                    </div>
                    <div className="text-xs text-gray-600 mt-1">{count}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              
              {/* Tipos de Evento */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">🔔 Tipos de Eventos</h3>
                <div className="space-y-3">
                  {Object.entries(data.stats.eventTypes)
                    .sort(([,a], [,b]) => b - a)
                    .map(([event, count]) => (
                    <div key={event} className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className={`w-3 h-3 rounded-full ${
                          event.includes('clicked') ? 'bg-green-500' :
                          event.includes('sent') ? 'bg-blue-500' :
                          event.includes('dismissed') ? 'bg-red-500' :
                          'bg-gray-500'
                        }`}></div>
                        <span className="text-gray-700 capitalize">{event.replace('notification_', '').replace('_', ' ')}</span>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-gray-900">{count.toLocaleString()}</div>
                        <div className="text-xs text-gray-500">
                          {((count / data.stats.totalEvents) * 100).toFixed(1)}%
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Dispositivos */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">📱 Dispositivos</h3>
                <div className="space-y-3">
                  {Object.entries(data.stats.deviceTypes)
                    .sort(([,a], [,b]) => b - a)
                    .slice(0, 8)
                    .map(([device, count]) => (
                    <div key={device} className="flex items-center justify-between">
                      <span className="text-gray-700 capitalize">{device}</span>
                      <div className="text-right">
                        <div className="font-semibold text-gray-900">{count.toLocaleString()}</div>
                        <div className="text-xs text-gray-500">
                          {((count / data.stats.totalEvents) * 100).toFixed(1)}%
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* CTR por Tipo de Notificación */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">👆 Click-Through Rate por Tipo</h3>
                <div className="space-y-3">
                  {Object.entries(data.stats.clickThroughRates)
                    .sort(([,a], [,b]) => parseFloat(b) - parseFloat(a))
                    .map(([type, ctr]) => (
                    <div key={type} className="flex items-center justify-between">
                      <span className="text-gray-700 capitalize">{type.replace('_', ' ')}</span>
                      <div className="flex items-center space-x-2">
                        <div className="w-24 bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-green-500 h-2 rounded-full" 
                            style={{ width: `${Math.min(100, parseFloat(ctr))}%` }}
                          ></div>
                        </div>
                        <span className="font-semibold text-gray-900 w-12 text-right">{ctr}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Navegadores */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">🌐 Navegadores</h3>
                <div className="space-y-3">
                  {Object.entries(data.stats.browserTypes)
                    .sort(([,a], [,b]) => b - a)
                    .slice(0, 6)
                    .map(([browser, count]) => (
                    <div key={browser} className="flex items-center justify-between">
                      <span className="text-gray-700">{browser}</span>
                      <div className="text-right">
                        <div className="font-semibold text-gray-900">{count.toLocaleString()}</div>
                        <div className="text-xs text-gray-500">
                          {((count / data.stats.totalEvents) * 100).toFixed(1)}%
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>

            {/* Tendencias Diarias */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">📊 Tendencias Diarias</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Enviadas</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Entregadas</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Clicked</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Dismissed</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">CTR</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {Object.entries(data.stats.dailyTrends)
                      .sort(([a], [b]) => b.localeCompare(a))
                      .slice(0, 30)
                      .map(([date, stats]) => (
                      <tr key={date}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{date}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{stats.sent || 0}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{stats.delivered || 0}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600">{stats.clicked || 0}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600">{stats.dismissed || 0}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {stats.sent > 0 ? ((stats.clicked / stats.sent) * 100).toFixed(1) : 0}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Eventos Recientes */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-800">🕐 Eventos Recientes</h3>
                <p className="text-sm text-gray-600">Últimos 100 eventos de push notifications</p>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tiempo</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Usuario</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Evento</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Dispositivo</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Resp. Time</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {data.events.map((event, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {new Date(event.created_at).toLocaleString('es-ES')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {event.user_profiles?.email?.substring(0, 20)}...
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            event.event_type.includes('clicked') ? 'bg-green-100 text-green-800' :
                            event.event_type.includes('sent') ? 'bg-blue-100 text-blue-800' :
                            event.event_type.includes('dismissed') ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {event.event_type.replace('notification_', '')}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {event.notification_type || 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {event.device_info?.platform || 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {event.response_time_ms ? `${event.response_time_ms}ms` : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}


      </div>
    </div>
  )
}

function StatCard({ title, value, icon, color, href }) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600 border-blue-200',
    green: 'bg-green-50 text-green-600 border-green-200',
    purple: 'bg-purple-50 text-purple-600 border-purple-200',
    orange: 'bg-orange-50 text-orange-600 border-orange-200',
    yellow: 'bg-yellow-50 text-yellow-600 border-yellow-200'
  }

  const CardContent = () => (
    <div className={`bg-white rounded-lg shadow-sm border border-gray-200 p-6 h-full ${
      href ? 'transition-all duration-200 hover:shadow-md hover:scale-105 hover:border-blue-300' : ''
    }`}>
      <div className="flex items-center justify-between mb-4">
        <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
          <span className="text-2xl">{icon}</span>
        </div>
        {href && (
          <div className="text-gray-400 group-hover:text-gray-600 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </div>
        )}
      </div>
      <h3 className="text-2xl font-bold text-gray-900 mb-1">{value}</h3>
      <p className="text-gray-600 font-medium">{title}</p>
      {href && (
        <p className="text-xs text-blue-500 mt-2">Hacer clic para ver detalles</p>
      )}
    </div>
  )

  if (href) {
    return (
      <Link href={href} className="block w-full text-left group">
        <CardContent />
      </Link>
    )
  }

  return <CardContent />
}