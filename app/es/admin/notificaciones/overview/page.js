// app/es/admin/notificaciones/overview/page.js - PÁGINA DETALLADA DE RESUMEN
'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '../../../../../contexts/AuthContext'
import Link from 'next/link'

export default function OverviewDetailPage() {
  const { user, supabase, loading: authLoading } = useAuth()
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [data, setData] = useState(null)
  const [timeRange, setTimeRange] = useState('30') // días

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
          loadDetailedData()
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

  const loadDetailedData = async () => {
    try {
      const daysAgo = new Date(Date.now() - parseInt(timeRange) * 24 * 60 * 60 * 1000).toISOString()

      // Datos completos de notificaciones
      const { data: pushEvents } = await supabase
        .from('notification_events')
        .select('*')
        .gte('created_at', daysAgo)
        .order('created_at', { ascending: false })

      // Datos completos de emails
      const { data: emailEvents } = await supabase
        .from('email_events')
        .select('*')
        .gte('created_at', daysAgo)
        .order('created_at', { ascending: false })

      // Métricas por usuario
      const { data: userMetrics } = await supabase
        .from('user_notification_metrics')
        .select('*')
        .order('overall_engagement_score', { ascending: false })

      // Obtener perfiles de usuarios
      const allUserIds = [...new Set([
        ...(pushEvents || []).map(e => e.user_id),
        ...(emailEvents || []).map(e => e.user_id),
        ...(userMetrics || []).map(m => m.user_id)
      ])]

      const { data: userProfiles } = await supabase
        .from('user_profiles')
        .select('id, email, created_at, plan_type, registration_source')
        .in('id', allUserIds)

      // Crear mapa de usuarios
      const userMap = {}
      userProfiles?.forEach(profile => {
        userMap[profile.id] = profile
      })

      // Enriquecer datos con perfiles
      const enrichedPushEvents = (pushEvents || []).map(event => ({
        ...event,
        user_profiles: userMap[event.user_id]
      }))

      const enrichedEmailEvents = (emailEvents || []).map(event => ({
        ...event,
        user_profiles: userMap[event.user_id]
      }))

      const enrichedUserMetrics = (userMetrics || []).map(metric => ({
        ...metric,
        user_profiles: userMap[metric.user_id]
      }))

      // Estadísticas por hora del día
      const hourlyStats = processHourlyStats(pushEvents, emailEvents)
      
      // Estadísticas por día de la semana
      const weeklyStats = processWeeklyStats(pushEvents, emailEvents)
      
      // Dispositivos más activos
      const deviceStats = processDeviceStats(pushEvents, emailEvents)

      setData({
        pushEvents: enrichedPushEvents.slice(0, 100),
        emailEvents: enrichedEmailEvents.slice(0, 100),
        userMetrics: enrichedUserMetrics,
        hourlyStats,
        weeklyStats,
        deviceStats,
        summary: {
          totalUsers: allUserIds.length,
          totalPushEvents: enrichedPushEvents.length,
          totalEmailEvents: enrichedEmailEvents.length,
          avgEngagementScore: enrichedUserMetrics?.length ? 
            (enrichedUserMetrics.reduce((sum, u) => sum + (u.overall_engagement_score || 0), 0) / enrichedUserMetrics.length).toFixed(2) : 0
        }
      })

    } catch (error) {
      console.error('Error loading detailed data:', error)
    }
  }

  const processHourlyStats = (pushEvents, emailEvents) => {
    const hours = Array.from({ length: 24 }, (_, i) => ({ hour: i, push: 0, email: 0 }))
    
    pushEvents?.forEach(event => {
      const hour = new Date(event.created_at).getHours()
      hours[hour].push++
    })
    
    emailEvents?.forEach(event => {
      const hour = new Date(event.created_at).getHours()
      hours[hour].email++
    })
    
    return hours
  }

  const processWeeklyStats = (pushEvents, emailEvents) => {
    const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
    const weekStats = days.map(day => ({ day, push: 0, email: 0 }))
    
    pushEvents?.forEach(event => {
      const dayIndex = new Date(event.created_at).getDay()
      weekStats[dayIndex].push++
    })
    
    emailEvents?.forEach(event => {
      const dayIndex = new Date(event.created_at).getDay()
      weekStats[dayIndex].email++
    })
    
    return weekStats
  }

  const processDeviceStats = (pushEvents, emailEvents) => {
    const devices = {}
    
    pushEvents?.forEach(event => {
      const platform = event.device_info?.platform || 'Unknown'
      if (!devices[platform]) devices[platform] = { push: 0, email: 0 }
      devices[platform].push++
    })
    
    emailEvents?.forEach(event => {
      const device = event.device_type || 'Unknown'
      if (!devices[device]) devices[device] = { push: 0, email: 0 }
      devices[device].email++
    })
    
    return Object.entries(devices).map(([device, stats]) => ({
      device,
      ...stats,
      total: stats.push + stats.email
    })).sort((a, b) => b.total - a.total)
  }

  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando datos detallados...</p>
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
                <span className="text-gray-800">Resumen Detallado</span>
              </nav>
              <h1 className="text-3xl font-bold text-gray-800 mb-2">
                📊 Análisis Completo de Notificaciones
              </h1>
              <p className="text-gray-600">
                Vista detallada de todas las métricas y estadísticas
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
                onClick={loadDetailedData}
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
            
            {/* Resumen General */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatCard title="Usuarios Únicos" value={data.summary.totalUsers} icon="👥" color="blue" />
              <StatCard title="Eventos Push" value={data.summary.totalPushEvents} icon="📱" color="green" />
              <StatCard title="Eventos Email" value={data.summary.totalEmailEvents} icon="📧" color="purple" />
              <StatCard title="Engagement Promedio" value={`${data.summary.avgEngagementScore}%`} icon="📊" color="orange" />
            </div>

            {/* Estadísticas por Hora */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">📈 Actividad por Hora del Día</h3>
              <div className="grid grid-cols-12 gap-2">
                {data.hourlyStats.map((stat, index) => (
                  <div key={index} className="text-center">
                    <div className="text-xs text-gray-500 mb-1">{stat.hour}h</div>
                    <div className="bg-blue-100 rounded-sm h-16 flex flex-col justify-end relative">
                      <div 
                        className="bg-blue-500 rounded-sm" 
                        style={{ 
                          height: `${Math.max(5, (stat.push / Math.max(...data.hourlyStats.map(s => s.push + s.email))) * 100)}%` 
                        }}
                      ></div>
                      <div 
                        className="bg-purple-400 rounded-sm" 
                        style={{ 
                          height: `${Math.max(2, (stat.email / Math.max(...data.hourlyStats.map(s => s.push + s.email))) * 80)}%` 
                        }}
                      ></div>
                    </div>
                    <div className="text-xs text-gray-600 mt-1">{stat.push + stat.email}</div>
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

            {/* Estadísticas por Día de la Semana */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">📅 Actividad por Día de la Semana</h3>
              <div className="space-y-3">
                {data.weeklyStats.map((stat, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex items-center space-x-3 w-24">
                      <span className="text-sm font-medium text-gray-700">{stat.day}</span>
                    </div>
                    <div className="flex-1 mx-4">
                      <div className="bg-gray-200 rounded-full h-4 relative">
                        <div 
                          className="bg-blue-500 h-4 rounded-full" 
                          style={{ width: `${(stat.push / Math.max(...data.weeklyStats.map(s => s.push + s.email))) * 100}%` }}
                        ></div>
                        <div 
                          className="bg-purple-400 h-4 rounded-full absolute top-0" 
                          style={{ 
                            width: `${(stat.email / Math.max(...data.weeklyStats.map(s => s.push + s.email))) * 100}%`,
                            left: `${(stat.push / Math.max(...data.weeklyStats.map(s => s.push + s.email))) * 100}%`
                          }}
                        ></div>
                      </div>
                    </div>
                    <div className="text-sm text-gray-600 w-20 text-right">
                      {stat.push + stat.email} eventos
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Top Dispositivos */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">📱 Dispositivos Más Activos</h3>
              <div className="space-y-3">
                {data.deviceStats.slice(0, 10).map((device, index) => (
                  <div key={index} className="flex items-center justify-between py-2">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-sm font-medium">
                        {index + 1}
                      </div>
                      <span className="font-medium text-gray-800 capitalize">{device.device}</span>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium text-gray-800">{device.total} eventos</div>
                      <div className="text-xs text-gray-500">
                        📱 {device.push} · 📧 {device.email}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Últimos Eventos */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-800">🕐 Últimos 50 Eventos</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tiempo</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Usuario</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Evento</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Dispositivo</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {[...data.pushEvents, ...data.emailEvents]
                      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
                      .slice(0, 50)
                      .map((event, index) => (
                      <tr key={index}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {new Date(event.created_at).toLocaleString('es-ES')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {event.user_profiles?.email || 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            event.email_type ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
                          }`}>
                            {event.email_type ? '📧 Email' : '📱 Push'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {event.event_type}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {event.device_info?.platform || event.device_type || 'N/A'}
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
      <h3 className="text-2xl font-bold text-gray-900 mb-1">{value}</h3>
      <p className="text-gray-600 font-medium">{title}</p>
    </div>
  )
}