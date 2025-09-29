// app/admin/notificaciones/users/page.js - PÁGINA DETALLADA DE USUARIOS
'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import Link from 'next/link'

export default function UsersDetailPage() {
  const { user, supabase, loading: authLoading } = useAuth()
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [users, setUsers] = useState([])
  const [selectedUser, setSelectedUser] = useState(null)
  const [userDetails, setUserDetails] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState('engagement_score')
  const [filterBy, setFilterBy] = useState('all')

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
          loadUsersData()
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

  const loadUsersData = async () => {
    try {
      // Obtener métricas de usuarios
      const { data: userMetrics } = await supabase
        .from('user_notification_metrics')
        .select('*')
        .order('overall_engagement_score', { ascending: false })

      // Obtener perfiles de usuarios
      const userIds = (userMetrics || []).map(m => m.user_id)
      const { data: userProfiles } = await supabase
        .from('user_profiles')
        .select(`
          id,
          email, 
          created_at, 
          plan_type, 
          registration_source,
          requires_payment,
          stripe_customer_id
        `)
        .in('id', userIds)

      // Obtener conteos de eventos por usuario (últimos 30 días)
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
      
      const { data: pushCounts } = await supabase
        .from('notification_events')
        .select('user_id')
        .gte('created_at', thirtyDaysAgo)

      const { data: emailCounts } = await supabase
        .from('email_events')
        .select('user_id')
        .gte('created_at', thirtyDaysAgo)

      // Procesar datos
      const pushCountsByUser = {}
      const emailCountsByUser = {}

      pushCounts?.forEach(event => {
        pushCountsByUser[event.user_id] = (pushCountsByUser[event.user_id] || 0) + 1
      })

      emailCounts?.forEach(event => {
        emailCountsByUser[event.user_id] = (emailCountsByUser[event.user_id] || 0) + 1
      })

      // Crear mapa de perfiles
      const profileMap = {}
      userProfiles?.forEach(profile => {
        profileMap[profile.id] = profile
      })

      // Combinar datos
      const enrichedUsers = userMetrics?.map(user => ({
        ...user,
        user_profiles: profileMap[user.user_id],
        recentPushEvents: pushCountsByUser[user.user_id] || 0,
        recentEmailEvents: emailCountsByUser[user.user_id] || 0,
        totalRecentEvents: (pushCountsByUser[user.user_id] || 0) + (emailCountsByUser[user.user_id] || 0)
      })) || []

      setUsers(enrichedUsers)

    } catch (error) {
      console.error('Error loading users data:', error)
    }
  }

  const loadUserDetails = async (userId) => {
    try {
      // Obtener eventos recientes del usuario
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

      const [pushEventsResult, emailEventsResult] = await Promise.all([
        supabase
          .from('notification_events')
          .select('*')
          .eq('user_id', userId)
          .gte('created_at', thirtyDaysAgo)
          .order('created_at', { ascending: false }),
        
        supabase
          .from('email_events')
          .select('*')
          .eq('user_id', userId)
          .gte('created_at', thirtyDaysAgo)
          .order('created_at', { ascending: false })
      ])

      const pushEvents = pushEventsResult.data || []
      const emailEvents = emailEventsResult.data || []

      // Procesar estadísticas del usuario
      const stats = {
        pushEvents: pushEvents.length,
        emailEvents: emailEvents.length,
        totalEvents: pushEvents.length + emailEvents.length,
        pushClicks: pushEvents.filter(e => e.event_type === 'notification_clicked').length,
        emailOpens: emailEvents.filter(e => e.event_type === 'opened').length,
        emailClicks: emailEvents.filter(e => e.event_type === 'clicked').length,
        lastActivity: pushEvents.length > 0 || emailEvents.length > 0 ? 
          new Date(Math.max(
            ...[...pushEvents, ...emailEvents].map(e => new Date(e.created_at))
          )) : null,
        devices: [...new Set([
          ...pushEvents.map(e => e.device_info?.platform).filter(Boolean),
          ...emailEvents.map(e => e.device_type).filter(Boolean)
        ])],
        browsers: [...new Set(pushEvents.map(e => e.browser_info?.name).filter(Boolean))]
      }

      setUserDetails({
        ...stats,
        pushEventsList: pushEvents.slice(0, 20),
        emailEventsList: emailEvents.slice(0, 20),
        recentEvents: [...pushEvents, ...emailEvents]
          .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
          .slice(0, 30)
      })

    } catch (error) {
      console.error('Error loading user details:', error)
    }
  }

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.user_profiles?.email?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesFilter = filterBy === 'all' || 
      (filterBy === 'premium' && user.user_profiles?.plan_type === 'premium') ||
      (filterBy === 'free' && user.user_profiles?.plan_type === 'legacy_free') ||
      (filterBy === 'high_engagement' && user.overall_engagement_score >= 80) ||
      (filterBy === 'low_engagement' && user.overall_engagement_score < 30)
    
    return matchesSearch && matchesFilter
  }).sort((a, b) => {
    switch (sortBy) {
      case 'engagement_score':
        return (b.overall_engagement_score || 0) - (a.overall_engagement_score || 0)
      case 'recent_activity':
        return b.totalRecentEvents - a.totalRecentEvents
      case 'email':
        return (a.user_profiles?.email || '').localeCompare(b.user_profiles?.email || '')
      case 'registration_date':
        return new Date(b.user_profiles?.created_at || 0) - new Date(a.user_profiles?.created_at || 0)
      default:
        return 0
    }
  })

  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando datos de usuarios...</p>
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
          <nav className="flex items-center space-x-2 text-sm text-gray-500 mb-2">
            <Link href="/admin/notificaciones" className="hover:text-blue-600">Panel Admin</Link>
            <span>›</span>
            <span className="text-gray-800">Usuarios Detallado</span>
          </nav>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            👥 Análisis Detallado de Usuarios
          </h1>
          <p className="text-gray-600">
            Información completa sobre el engagement y actividad de usuarios
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Lista de Usuarios */}
          <div className="lg:col-span-2">
            
            {/* Filtros y Búsqueda */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Buscar</label>
                  <input
                    type="text"
                    placeholder="Email del usuario..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Filtrar por</label>
                  <select
                    value={filterBy}
                    onChange={(e) => setFilterBy(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  >
                    <option value="all">Todos los usuarios</option>
                    <option value="premium">Solo Premium</option>
                    <option value="free">Solo Gratuitos</option>
                    <option value="high_engagement">Alto Engagement (≥80%)</option>
                    <option value="low_engagement">Bajo Engagement (&lt;30%)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ordenar por</label>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  >
                    <option value="engagement_score">Engagement Score</option>
                    <option value="recent_activity">Actividad Reciente</option>
                    <option value="email">Email</option>
                    <option value="registration_date">Fecha de Registro</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Lista de Usuarios */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-800">
                  Usuarios ({filteredUsers.length})
                </h3>
              </div>
              <div className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
                {filteredUsers.map((userData, index) => (
                  <div 
                    key={userData.user_id}
                    onClick={() => {
                      setSelectedUser(userData)
                      loadUserDetails(userData.user_id)
                    }}
                    className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${
                      selectedUser?.user_id === userData.user_id ? 'bg-blue-50 border-l-4 border-blue-500' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-sm font-medium">
                            {userData.user_profiles?.email?.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {userData.user_profiles?.email}
                            </p>
                            <div className="flex items-center space-x-2 text-xs text-gray-500">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                userData.user_profiles?.plan_type === 'premium' ? 'bg-green-100 text-green-800' :
                                userData.user_profiles?.plan_type === 'trial' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {userData.user_profiles?.plan_type || 'N/A'}
                              </span>
                              <span>{userData.totalRecentEvents} eventos (30d)</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`text-lg font-bold ${
                          userData.overall_engagement_score >= 80 ? 'text-green-600' :
                          userData.overall_engagement_score >= 60 ? 'text-yellow-600' :
                          'text-red-600'
                        }`}>
                          {userData.overall_engagement_score || 0}%
                        </div>
                        <div className="text-xs text-gray-500">Engagement</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Detalles del Usuario Seleccionado */}
          <div className="lg:col-span-1">
            {selectedUser ? (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 sticky top-4">
                <div className="text-center mb-6">
                  <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center text-2xl font-bold text-blue-600 mx-auto mb-3">
                    {selectedUser.user_profiles?.email?.charAt(0).toUpperCase()}
                  </div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-1">
                    {selectedUser.user_profiles?.email}
                  </h3>
                  <p className="text-sm text-gray-500">
                    Registrado: {new Date(selectedUser.user_profiles?.created_at).toLocaleDateString('es-ES')}
                  </p>
                </div>

                {userDetails ? (
                  <div className="space-y-4">
                    
                    {/* Métricas Principales */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center p-3 bg-blue-50 rounded-lg">
                        <div className="text-2xl font-bold text-blue-600">{userDetails.totalEvents}</div>
                        <div className="text-xs text-gray-600">Total Eventos</div>
                      </div>
                      <div className="text-center p-3 bg-green-50 rounded-lg">
                        <div className="text-2xl font-bold text-green-600">{selectedUser.overall_engagement_score || 0}%</div>
                        <div className="text-xs text-gray-600">Engagement</div>
                      </div>
                    </div>

                    {/* Push vs Email */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">📱 Push Events</span>
                        <span className="font-medium">{userDetails.pushEvents}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">📧 Email Events</span>
                        <span className="font-medium">{userDetails.emailEvents}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">👆 Push Clicks</span>
                        <span className="font-medium">{userDetails.pushClicks}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">📖 Email Opens</span>
                        <span className="font-medium">{userDetails.emailOpens}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">🔗 Email Clicks</span>
                        <span className="font-medium">{userDetails.emailClicks}</span>
                      </div>
                    </div>

                    {/* Dispositivos */}
                    {userDetails.devices.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-700 mb-2">Dispositivos</h4>
                        <div className="flex flex-wrap gap-1">
                          {userDetails.devices.map((device, i) => (
                            <span key={i} className="px-2 py-1 bg-gray-100 text-xs rounded-full">
                              {device}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Navegadores */}
                    {userDetails.browsers.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-700 mb-2">Navegadores</h4>
                        <div className="flex flex-wrap gap-1">
                          {userDetails.browsers.map((browser, i) => (
                            <span key={i} className="px-2 py-1 bg-gray-100 text-xs rounded-full">
                              {browser}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Última Actividad */}
                    {userDetails.lastActivity && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-700 mb-2">Última Actividad</h4>
                        <p className="text-sm text-gray-600">
                          {userDetails.lastActivity.toLocaleString('es-ES')}
                        </p>
                      </div>
                    )}

                    {/* Eventos Recientes */}
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Eventos Recientes</h4>
                      <div className="max-h-40 overflow-y-auto space-y-2">
                        {userDetails.recentEvents.slice(0, 10).map((event, i) => (
                          <div key={i} className="flex items-center justify-between text-xs">
                            <span className={`px-2 py-1 rounded-full ${
                              event.email_type ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                            }`}>
                              {event.email_type ? '📧' : '📱'} {event.event_type}
                            </span>
                            <span className="text-gray-500">
                              {new Date(event.created_at).toLocaleDateString('es-ES')}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3"></div>
                    <p className="text-sm text-gray-600">Cargando detalles...</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 text-center">
                <div className="text-6xl mb-4">👤</div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">Selecciona un Usuario</h3>
                <p className="text-sm text-gray-600">
                  Haz clic en cualquier usuario de la lista para ver sus detalles completos
                </p>
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  )
}