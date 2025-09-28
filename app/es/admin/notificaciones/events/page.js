// app/es/admin/notificaciones/events/page.js - PÁGINA DETALLADA DE EVENTOS
'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '../../../../../contexts/AuthContext'
import Link from 'next/link'

export default function EventsDetailPage() {
  const { user, supabase, loading: authLoading } = useAuth()
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [data, setData] = useState(null)
  const [timeRange, setTimeRange] = useState('30')
  const [eventTypeFilter, setEventTypeFilter] = useState('all')
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
          loadEventsData()
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

  const loadEventsData = async () => {
    try {
      const daysAgo = new Date(Date.now() - parseInt(timeRange) * 24 * 60 * 60 * 1000).toISOString()

      // Obtener eventos push
      const { data: pushEvents } = await supabase
        .from('notification_events')
        .select(`
          *,
          user_profiles!inner(email, created_at, plan_type)
        `)
        .gte('created_at', daysAgo)
        .order('created_at', { ascending: false })

      // Obtener eventos email
      const { data: emailEvents } = await supabase
        .from('email_events')
        .select(`
          *,
          user_profiles!inner(email, created_at, plan_type)
        `)
        .gte('created_at', daysAgo)
        .order('created_at', { ascending: false })

      const pushEventsWithType = (pushEvents || []).map(event => ({ ...event, source: 'push' }))
      const emailEventsWithType = (emailEvents || []).map(event => ({ ...event, source: 'email' }))
      
      // Combinar y ordenar por fecha
      const allEvents = [...pushEventsWithType, ...emailEventsWithType]
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

      // Procesar estadísticas
      const stats = {
        totalEvents: allEvents.length,
        pushEvents: pushEventsWithType.length,
        emailEvents: emailEventsWithType.length,
        uniqueUsers: new Set(allEvents.map(e => e.user_id)).size,
        eventsByType: {},
        eventsByUser: {},
        eventsByHour: Array.from({ length: 24 }, () => ({ push: 0, email: 0 })),
        eventsByDay: {},
        topUsers: {},
        deviceBreakdown: {},
        recentErrors: [],
        avgResponseTimes: {}
      }

      // Procesar cada evento
      allEvents.forEach(event => {
        const eventType = event.source === 'push' ? event.event_type : `email_${event.event_type}`
        
        // Contar por tipo
        stats.eventsByType[eventType] = (stats.eventsByType[eventType] || 0) + 1

        // Contar por usuario
        const userEmail = event.user_profiles?.email || 'Unknown'
        if (!stats.eventsByUser[userEmail]) {
          stats.eventsByUser[userEmail] = { push: 0, email: 0, total: 0 }
        }
        stats.eventsByUser[userEmail][event.source]++
        stats.eventsByUser[userEmail].total++

        // Distribución por hora
        const hour = new Date(event.created_at).getHours()
        stats.eventsByHour[hour][event.source]++

        // Distribución por día
        const date = new Date(event.created_at).toISOString().split('T')[0]
        if (!stats.eventsByDay[date]) {
          stats.eventsByDay[date] = { push: 0, email: 0, total: 0 }
        }
        stats.eventsByDay[date][event.source]++
        stats.eventsByDay[date].total++

        // Dispositivos
        const device = event.device_info?.platform || event.device_type || 'Unknown'
        if (!stats.deviceBreakdown[device]) {
          stats.deviceBreakdown[device] = { push: 0, email: 0 }
        }
        stats.deviceBreakdown[device][event.source]++

        // Errores recientes
        if (event.error_details) {
          stats.recentErrors.push({
            ...event,
            error: event.error_details
          })
        }

        // Tiempos de respuesta (solo push)
        if (event.source === 'push' && event.response_time_ms) {
          if (!stats.avgResponseTimes[event.event_type]) {
            stats.avgResponseTimes[event.event_type] = []
          }
          stats.avgResponseTimes[event.event_type].push(event.response_time_ms)
        }
      })

      // Calcular promedios de tiempo de respuesta
      Object.keys(stats.avgResponseTimes).forEach(eventType => {
        const times = stats.avgResponseTimes[eventType]
        const avg = times.reduce((a, b) => a + b, 0) / times.length
        stats.avgResponseTimes[eventType] = Math.round(avg)
      })

      // Top usuarios más activos
      stats.topUsers = Object.entries(stats.eventsByUser)
        .sort(([,a], [,b]) => b.total - a.total)
        .slice(0, 20)

      setData({
        events: allEvents.slice(0, 200), // Solo los primeros 200 para la tabla
        stats,
        allEvents
      })

    } catch (error) {
      console.error('Error loading events data:', error)
    }
  }

  const filteredEvents = data?.events.filter(event => {
    if (eventTypeFilter === 'all') return true
    if (eventTypeFilter === 'push') return event.source === 'push'
    if (eventTypeFilter === 'email') return event.source === 'email'
    if (eventTypeFilter === 'errors') return event.error_details
    return true
  }) || []

  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando datos de eventos...</p>
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
            href="/es/admin/notificaciones"
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
                <Link href="/es/admin/notificaciones" className="hover:text-blue-600">Panel Admin</Link>
                <span>›</span>
                <span className="text-gray-800">Eventos Detallados</span>
              </nav>
              <h1 className="text-3xl font-bold text-gray-800 mb-2">
                📋 Análisis Detallado de Eventos
              </h1>
              <p className="text-gray-600">
                Vista completa de todos los eventos de notificaciones y emails
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
                onClick={loadEventsData}
                className="bg-indigo-500 text-white px-4 py-2 rounded-lg hover:bg-indigo-600 transition-colors flex items-center space-x-2"
              >
                <span>🔄</span>
                <span>Actualizar</span>
              </button>
            </div>
          </div>
        </div>

        {!data ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Cargando datos...</p>
          </div>
        ) : (
          <div className="space-y-8">
            
            {/* Métricas Principales */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatCard title="Total Eventos" value={data.stats.totalEvents} icon="📊" color="blue" />
              <StatCard title="Eventos Push" value={data.stats.pushEvents} icon="📱" color="green" />
              <StatCard title="Eventos Email" value={data.stats.emailEvents} icon="📧" color="purple" />
              <StatCard title="Usuarios Únicos" value={data.stats.uniqueUsers} icon="👥" color="orange" />
            </div>

            {/* Gráfico de Actividad por Hora */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">📈 Actividad por Hora del Día</h3>
              <div className="grid grid-cols-12 gap-2">
                {data.stats.eventsByHour.map((hourData, hour) => (
                  <div key={hour} className="text-center">
                    <div className="text-xs text-gray-500 mb-1">{hour}h</div>
                    <div className="bg-gray-100 rounded-sm h-20 flex flex-col justify-end">
                      <div 
                        className="bg-blue-500 rounded-sm" 
                        style={{ 
                          height: `${Math.max(4, (hourData.push / Math.max(...data.stats.eventsByHour.map(h => h.push + h.email))) * 80)}%` 
                        }}
                      ></div>
                      <div 
                        className="bg-purple-400 rounded-sm" 
                        style={{ 
                          height: `${Math.max(2, (hourData.email / Math.max(...data.stats.eventsByHour.map(h => h.push + h.email))) * 60)}%` 
                        }}
                      ></div>
                    </div>
                    <div className="text-xs text-gray-600 mt-1">{hourData.push + hourData.email}</div>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-center space-x-4 mt-4 text-sm">
                <div className="flex items-center space-x-1">
                  <div className="w-3 h-3 bg-blue-500 rounded"></div>
                  <span>Push</span>
                </div>
                <div className="flex items-center space-x-1">
                  <div className="w-3 h-3 bg-purple-400 rounded"></div>
                  <span>Email</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              
              {/* Top Usuarios */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">👥 Usuarios Más Activos</h3>
                <div className="space-y-3 max-h-80 overflow-y-auto">
                  {data.stats.topUsers.map(([email, userData], index) => (
                    <div key={email} className="flex items-center justify-between py-2">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-xs font-medium">
                          {index + 1}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {email.length > 25 ? `${email.substring(0, 25)}...` : email}
                          </div>
                          <div className="text-xs text-gray-500">
                            📱 {userData.push} · 📧 {userData.email}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-gray-900">{userData.total}</div>
                        <div className="text-xs text-gray-500">eventos</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tipos de Eventos */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">🔔 Tipos de Eventos</h3>
                <div className="space-y-3 max-h-80 overflow-y-auto">
                  {Object.entries(data.stats.eventsByType)
                    .sort(([,a], [,b]) => b - a)
                    .map(([eventType, count]) => (
                    <div key={eventType} className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className={`w-3 h-3 rounded-full ${
                          eventType.includes('email') ? 'bg-purple-500' : 'bg-blue-500'
                        }`}></div>
                        <span className="text-sm text-gray-700 capitalize">
                          {eventType.replace('email_', '').replace('notification_', '').replace('_', ' ')}
                        </span>
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

              {/* Distribución de Dispositivos */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">📱 Dispositivos</h3>
                <div className="space-y-3">
                  {Object.entries(data.stats.deviceBreakdown)
                    .sort(([,a], [,b]) => (b.push + b.email) - (a.push + a.email))
                    .slice(0, 8)
                    .map(([device, counts]) => (
                    <div key={device} className="flex items-center justify-between">
                      <span className="text-gray-700 capitalize">{device}</span>
                      <div className="text-right">
                        <div className="font-semibold text-gray-900">{counts.push + counts.email}</div>
                        <div className="text-xs text-gray-500">
                          📱 {counts.push} · 📧 {counts.email}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tiempos de Respuesta Promedio */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">⚡ Tiempos de Respuesta</h3>
                <div className="space-y-3">
                  {Object.entries(data.stats.avgResponseTimes)
                    .sort(([,a], [,b]) => a - b)
                    .map(([eventType, avgTime]) => (
                    <div key={eventType} className="flex items-center justify-between">
                      <span className="text-sm text-gray-700 capitalize">
                        {eventType.replace('notification_', '').replace('_', ' ')}
                      </span>
                      <div className="flex items-center space-x-2">
                        <div className="w-16 bg-gray-200 rounded-full h-2">
                          <div 
                            className={`h-2 rounded-full ${
                              avgTime < 1000 ? 'bg-green-500' :
                              avgTime < 3000 ? 'bg-yellow-500' :
                              'bg-red-500'
                            }`}
                            style={{ width: `${Math.min(100, (avgTime / 5000) * 100)}%` }}
                          ></div>
                        </div>
                        <span className="font-semibold text-gray-900 w-16 text-right">{avgTime}ms</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>

            {/* Filtros para la tabla de eventos */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
                <h3 className="text-lg font-semibold text-gray-800">Eventos Recientes</h3>
                <div className="flex items-center space-x-4">
                  <select
                    value={eventTypeFilter}
                    onChange={(e) => setEventTypeFilter(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm"
                  >
                    <option value="all">Todos los eventos</option>
                    <option value="push">Solo Push</option>
                    <option value="email">Solo Email</option>
                    <option value="errors">Solo Errores</option>
                  </select>
                  <span className="text-sm text-gray-600">
                    {filteredEvents.length} de {data.events.length} eventos
                  </span>
                </div>
              </div>
            </div>

            {/* Tabla de Eventos */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tiempo</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Usuario</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fuente</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Evento</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Dispositivo</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Detalles</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredEvents.slice(0, 100).map((event, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {new Date(event.created_at).toLocaleString('es-ES')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {event.user_profiles?.email?.substring(0, 20)}...
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            event.source === 'push' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
                          }`}>
                            {event.source === 'push' ? '📱 Push' : '📧 Email'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {event.event_type}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {event.device_info?.platform || event.device_type || 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {event.response_time_ms ? `${event.response_time_ms}ms` : 
                           event.error_details ? '❌ Error' :
                           event.notification_type || event.email_type || '-'}
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

function StatCard({ title, value, icon, color }) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600 border-blue-200',
    green: 'bg-green-50 text-green-600 border-green-200',
    purple: 'bg-purple-50 text-purple-600 border-purple-200',
    orange: 'bg-orange-50 text-orange-600 border-orange-200'
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
          <span className="text-2xl">{icon}</span>
        </div>
      </div>
      <h3 className="text-2xl font-bold text-gray-900 mb-1">{value?.toLocaleString() || 0}</h3>
      <p className="text-gray-600 font-medium">{title}</p>
    </div>
  )
}