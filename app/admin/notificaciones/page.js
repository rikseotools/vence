// app/admin/notificaciones/page.js - PANEL ADMIN DE SEGUIMIENTO DE NOTIFICACIONES
'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import Link from 'next/link'

export default function AdminNotificacionesPage() {
  const { user, supabase, loading: authLoading } = useAuth()
  const [loading, setLoading] = useState(true)
  const [dataLoading, setDataLoading] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')
  
  // Estados para datos
  const [overviewData, setOverviewData] = useState(null)
  const [pushData, setPushData] = useState(null)
  const [emailData, setEmailData] = useState(null)
  const [userMetrics, setUserMetrics] = useState([])
  const [recentEvents, setRecentEvents] = useState([])

  // Verificar si es admin
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
          loadOverviewData()
        }
      } catch (error) {
        console.error('Error checking admin access:', error)
        setIsAdmin(false)
      } finally {
        setLoading(false)
      }
    }

    checkAdminAccess()
  }, [user, authLoading, supabase])

  // Cargar datos generales
  const loadOverviewData = async () => {
    setDataLoading(true)
    try {
      // Métricas de últimos 30 días
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

      // 1. Datos de notificaciones push
      const { data: pushEvents } = await supabase
        .from('notification_events')
        .select('event_type, notification_type, device_info, created_at')
        .gte('created_at', thirtyDaysAgo)

      // 2. Datos de emails
      const { data: emailEvents } = await supabase
        .from('email_events')
        .select('event_type, email_type, device_type, created_at')
        .gte('created_at', thirtyDaysAgo)

      // 3. Métricas por usuario (top 20)
      const { data: metrics } = await supabase
        .from('user_notification_metrics')
        .select(`
          user_id,
          push_click_rate,
          email_open_rate,
          email_click_rate,
          overall_engagement_score
        `)
        .order('overall_engagement_score', { ascending: false })
        .limit(20)

      // 4. Eventos recientes
      const { data: recent } = await supabase
        .from('notification_events')
        .select(`
          event_type,
          notification_type,
          device_info,
          created_at,
          user_id
        `)
        .order('created_at', { ascending: false })
        .limit(50)

      // Obtener emails de usuarios para métricas
      const userIds = [...new Set([
        ...(metrics || []).map(m => m.user_id),
        ...(recent || []).map(r => r.user_id)
      ])]

      const { data: userProfiles } = await supabase
        .from('user_profiles')
        .select('id, email, created_at')
        .in('id', userIds)

      // Crear un mapa de usuarios
      const userMap = {}
      userProfiles?.forEach(profile => {
        userMap[profile.id] = profile
      })

      // Enriquecer métricas con emails
      const enrichedMetrics = (metrics || []).map(metric => ({
        ...metric,
        user_profiles: userMap[metric.user_id]
      }))

      // Enriquecer eventos recientes con emails
      const enrichedRecent = (recent || []).map(event => ({
        ...event,
        user_profiles: userMap[event.user_id]
      }))

      // Procesar datos
      const processedOverview = processOverviewData(pushEvents, emailEvents)
      const processedPush = processPushData(pushEvents)
      const processedEmail = processEmailData(emailEvents)

      setOverviewData(processedOverview)
      setPushData(processedPush)
      setEmailData(processedEmail)
      setUserMetrics(enrichedMetrics)
      setRecentEvents(enrichedRecent)

    } catch (error) {
      console.error('Error loading admin data:', error)
    } finally {
      setDataLoading(false)
    }
  }

  // Procesar datos generales (solo push notifications)
  const processOverviewData = (pushEvents = [], emailEvents = []) => {
    const totalUsers = new Set(pushEvents.map(e => e.user_id)).size

    const pushSent = pushEvents.filter(e => e.event_type === 'notification_sent').length
    const pushClicked = pushEvents.filter(e => e.event_type === 'notification_clicked').length
    const pushClickRate = pushSent > 0 ? ((pushClicked / pushSent) * 100).toFixed(2) : 0

    return {
      totalUsers,
      pushSent,
      pushClicked,
      pushClickRate,
      totalEvents: pushEvents.length
    }
  }

  // Procesar datos de push
  const processPushData = (events = []) => {
    const deviceTypes = {}
    const eventTypes = {}
    const dailyStats = {}

    events.forEach(event => {
      // Dispositivos
      const platform = event.device_info?.platform || 'unknown'
      deviceTypes[platform] = (deviceTypes[platform] || 0) + 1

      // Tipos de evento
      eventTypes[event.event_type] = (eventTypes[event.event_type] || 0) + 1

      // Estadísticas diarias
      const date = new Date(event.created_at).toISOString().split('T')[0]
      if (!dailyStats[date]) {
        dailyStats[date] = { sent: 0, clicked: 0, dismissed: 0 }
      }
      if (event.event_type === 'notification_sent') dailyStats[date].sent++
      if (event.event_type === 'notification_clicked') dailyStats[date].clicked++
      if (event.event_type === 'notification_dismissed') dailyStats[date].dismissed++
    })

    return { deviceTypes, eventTypes, dailyStats }
  }

  // Procesar datos de email
  const processEmailData = (events = []) => {
    const emailTypes = {}
    const eventTypes = {}
    const dailyStats = {}
    const deviceTypes = {}

    events.forEach(event => {
      // Tipos de email
      emailTypes[event.email_type] = (emailTypes[event.email_type] || 0) + 1

      // Tipos de evento
      eventTypes[event.event_type] = (eventTypes[event.event_type] || 0) + 1

      // Dispositivos
      const device = event.device_type || 'unknown'
      deviceTypes[device] = (deviceTypes[device] || 0) + 1

      // Estadísticas diarias
      const date = new Date(event.created_at).toISOString().split('T')[0]
      if (!dailyStats[date]) {
        dailyStats[date] = { sent: 0, opened: 0, clicked: 0 }
      }
      if (event.event_type === 'sent') dailyStats[date].sent++
      if (event.event_type === 'opened') dailyStats[date].opened++
      if (event.event_type === 'clicked') dailyStats[date].clicked++
    })

    return { emailTypes, eventTypes, dailyStats, deviceTypes }
  }

  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Verificando acceso...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
          <div className="text-6xl mb-4">🔒</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Acceso Requerido</h2>
          <p className="text-gray-600 mb-6">Necesitas iniciar sesión para acceder al panel de administración.</p>
          <Link 
            href="/login"
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 px-6 rounded-lg font-bold hover:opacity-90 transition-opacity block"
          >
            🚀 Iniciar Sesión
          </Link>
        </div>
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
          <div className="text-6xl mb-4">⛔</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Acceso Denegado</h2>
          <p className="text-gray-600 mb-6">No tienes permisos para acceder al panel de administración.</p>
          <Link 
            href="/es"
            className="w-full bg-gray-200 text-gray-700 py-3 px-6 rounded-lg font-medium hover:bg-gray-300 transition-colors block"
          >
            ← Volver al Inicio
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-8">
        
        {/* Header - Responsive */}
        <div className="mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
            <div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-800 mb-2">
                🔔 Panel de Notificaciones
              </h1>
              <p className="text-sm sm:text-base text-gray-600">
                Gestión de avisos y notificaciones internas del sistema (campana)
              </p>
            </div>
            <button
              onClick={loadOverviewData}
              disabled={dataLoading}
              className="bg-blue-500 text-white px-3 py-2 sm:px-4 sm:py-2 rounded-lg hover:bg-blue-600 transition-colors flex items-center justify-center space-x-2 text-sm sm:text-base disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span>{dataLoading ? '⏳' : '🔄'}</span>
              <span>{dataLoading ? 'Cargando...' : 'Actualizar'}</span>
            </button>
          </div>
        </div>

        {/* Navegación por pestañas - Mobile Responsive */}
        <div className="bg-white rounded-lg shadow-sm mb-4 sm:mb-6">
          <div className="border-b border-gray-200">
            {/* Mobile: Dropdown */}
            <div className="sm:hidden px-4 py-3">
              <select
                value={activeTab}
                onChange={(e) => setActiveTab(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md bg-white text-sm font-medium"
              >
                <option value="overview">📊 Resumen</option>
                <option value="push">📱 Push Notifications</option>
                <option value="users">👥 Usuarios</option>
                <option value="events">📋 Eventos Recientes</option>
              </select>
            </div>
            
            {/* Desktop: Tab Navigation */}
            <nav className="hidden sm:flex sm:space-x-4 lg:space-x-8 px-4 sm:px-6">
              {[
                { id: 'overview', label: '📊 Resumen', shortLabel: '📊' },
                { id: 'push', label: '📱 Push', shortLabel: '📱' },
                { id: 'users', label: '👥 Usuarios', shortLabel: '👥' },
                { id: 'events', label: '📋 Eventos', shortLabel: '📋' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-3 sm:py-4 px-1 sm:px-2 border-b-2 font-medium text-xs sm:text-sm transition-colors whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <span className="sm:hidden">{tab.shortLabel}</span>
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Contenido por pestaña */}
        {dataLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Cargando datos del panel...</p>
          </div>
        ) : (
          <>
            {activeTab === 'overview' && (
              <OverviewTab data={overviewData} />
            )}
            
            {activeTab === 'push' && (
              <PushTab data={pushData} />
            )}
            
            {activeTab === 'users' && (
              <UsersTab data={userMetrics} />
            )}
            
            {activeTab === 'events' && (
              <EventsTab data={recentEvents} />
            )}
          </>
        )}

      </div>
    </div>
  )
}

// Componente de pestaña de resumen
function OverviewTab({ data }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard
          title="Usuarios Activos"
          value={data?.totalUsers || 0}
          icon="👥"
          color="blue"
          description="Con notificaciones push en 30 días"
          href="/admin/notificaciones/users"
        />
        <StatCard
          title="Push Enviadas"
          value={data?.pushSent || 0}
          icon="📱"
          color="green"
          description={`${data?.pushClickRate || 0}% click rate`}
          href="/admin/notificaciones/push"
        />
        <StatCard
          title="Total Eventos Push"
          value={data?.totalEvents || 0}
          icon="🔔"
          color="orange"
          description="Últimos 30 días"
          href="/admin/notificaciones/events"
        />
      </div>

      {/* Acceso rápido a otros sistemas */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">🔗 Enlaces Rápidos</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link 
            href="/admin/notificaciones/email" 
            className="flex items-center space-x-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors group"
          >
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center group-hover:bg-blue-200 transition-colors">
              <span className="text-xl">📧</span>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900">Email Analytics</h4>
              <p className="text-sm text-gray-600">Ver métricas detalladas de emails</p>
            </div>
            <div className="text-gray-400 group-hover:text-gray-600 ml-auto">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </Link>
          
          <Link 
            href="/admin/usuarios" 
            className="flex items-center space-x-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors group"
          >
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center group-hover:bg-green-200 transition-colors">
              <span className="text-xl">👥</span>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900">Gestión de Usuarios</h4>
              <p className="text-sm text-gray-600">Ver historial de emails por usuario</p>
            </div>
            <div className="text-gray-400 group-hover:text-gray-600 ml-auto">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </Link>
        </div>
      </div>
      
      {(!data || data.totalEvents === 0) && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
          <div className="text-6xl mb-4">🔔</div>
          <h3 className="text-lg font-semibold text-gray-800 mb-2">Sin Datos de Push Aún</h3>
          <p className="text-gray-600">
            Los datos aparecerán aquí cuando los usuarios interactúen con las notificaciones push.
          </p>
        </div>
      )}
    </div>
  )
}

// Componente de estadística
function StatCard({ title, value, icon, color, description, href }) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600 border-blue-200',
    green: 'bg-green-50 text-green-600 border-green-200',
    purple: 'bg-purple-50 text-purple-600 border-purple-200',
    orange: 'bg-orange-50 text-orange-600 border-orange-200'
  }

  const CardContent = () => (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 h-full">
      <div className="flex items-center justify-between mb-4">
        <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
          <span className="text-2xl">{icon}</span>
        </div>
        {href && (
          <div className="text-gray-400 group-hover:text-gray-600 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        )}
      </div>
      <h3 className="text-2xl font-bold text-gray-900 mb-1">{value?.toLocaleString() || 0}</h3>
      <p className="text-gray-600 font-medium mb-1">{title}</p>
      <p className="text-sm text-gray-500">{description}</p>
    </div>
  )

  if (href) {
    return (
      <Link href={href} className="block group hover:scale-105 transition-transform duration-200">
        <CardContent />
      </Link>
    )
  }

  return <CardContent />
}

// Componente de pestaña push
function PushTab({ data }) {
  if (!data || Object.keys(data.deviceTypes || {}).length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
        <div className="text-6xl mb-4">📱</div>
        <h3 className="text-lg font-semibold text-gray-800 mb-2">Sin Datos de Push</h3>
        <p className="text-gray-600">
          Los datos de push notifications aparecerán cuando los usuarios activen las notificaciones.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Dispositivos */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">📱 Dispositivos</h3>
          <div className="space-y-3">
            {Object.entries(data.deviceTypes).map(([device, count]) => (
              <div key={device} className="flex items-center justify-between">
                <span className="text-gray-600 capitalize">{device}</span>
                <span className="font-semibold text-gray-900">{count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Tipos de evento */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">🔔 Eventos</h3>
          <div className="space-y-3">
            {Object.entries(data.eventTypes).map(([event, count]) => (
              <div key={event} className="flex items-center justify-between">
                <span className="text-gray-600">{event.replace('_', ' ')}</span>
                <span className="font-semibold text-gray-900">{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Estadísticas diarias */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">📈 Tendencia Diaria</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Enviadas</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Clicked</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Dismissed</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">CTR</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {Object.entries(data.dailyStats)
                .sort(([a], [b]) => b.localeCompare(a))
                .slice(0, 10)
                .map(([date, stats]) => (
                <tr key={date}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{date}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{stats.sent}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600">{stats.clicked}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600">{stats.dismissed}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {stats.sent > 0 ? ((stats.clicked / stats.sent) * 100).toFixed(1) : 0}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}


// Componente de pestaña usuarios
function UsersTab({ data }) {
  if (!data || data.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
        <div className="text-6xl mb-4">👥</div>
        <h3 className="text-lg font-semibold text-gray-800 mb-2">Sin Datos de Usuarios</h3>
        <p className="text-gray-600">
          Las métricas de usuario aparecerán cuando haya actividad de notificaciones.
        </p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-800">👥 Top Usuarios por Engagement</h3>
        <p className="text-sm text-gray-600">Usuarios más activos en notificaciones</p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Usuario</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Push CTR</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email Open</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email CTR</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Score</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {data.map((user, index) => (
              <tr key={user.user_id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {user.user_profiles?.email || 'Email no disponible'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {user.push_click_rate || 0}%
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {user.email_open_rate || 0}%
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {user.email_click_rate || 0}%
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    user.overall_engagement_score >= 80 ? 'bg-green-100 text-green-800' :
                    user.overall_engagement_score >= 60 ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {user.overall_engagement_score || 0}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// Componente de pestaña eventos
function EventsTab({ data }) {
  if (!data || data.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
        <div className="text-6xl mb-4">📋</div>
        <h3 className="text-lg font-semibold text-gray-800 mb-2">Sin Eventos Recientes</h3>
        <p className="text-gray-600">
          Los eventos aparecerán aquí cuando haya actividad de notificaciones y emails.
        </p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-800">📋 Eventos Recientes</h3>
        <p className="text-sm text-gray-600">Últimos 50 eventos de notificaciones</p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Usuario</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Evento</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Dispositivo</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {data.map((event, index) => (
              <tr key={index}>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {new Date(event.created_at).toLocaleString('es-ES')}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {event.user_profiles?.email || 'N/A'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    event.event_type === 'notification_clicked' ? 'bg-green-100 text-green-800' :
                    event.event_type === 'notification_sent' ? 'bg-blue-100 text-blue-800' :
                    event.event_type === 'notification_dismissed' ? 'bg-red-100 text-red-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {event.event_type}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {event.notification_type || 'N/A'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {event.device_info?.platform || 'N/A'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}