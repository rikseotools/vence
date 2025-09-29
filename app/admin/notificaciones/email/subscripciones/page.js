// app/admin/notificaciones/email/subscripciones/page.js - Página detallada de subscripciones de email
'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '../../../contexts/AuthContext'
import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'

export default function EmailSubscriptionsPage() {
  const { user, supabase, loading: authLoading } = useAuth()
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [subscriptionData, setSubscriptionData] = useState(null)
  const [filterStatus, setFilterStatus] = useState('all') // all, subscribed, unsubscribed
  const [searchEmail, setSearchEmail] = useState('')

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
          loadSubscriptionData()
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

  const loadSubscriptionData = async () => {
    try {
      console.log('🔍 Cargando datos de suscripciones...')
      
      // Usar función RPC para obtener todos los usuarios con suscripciones
      const { data: usersData, error: rpcError } = await supabase
        .rpc('get_all_users_with_subscriptions')

      if (rpcError) {
        console.error('❌ Error obteniendo usuarios con suscripciones:', rpcError)
        setSubscriptionData({
          users: [],
          stats: { total: 0, subscribed: 0, unsubscribed: 0, subscriptionRate: 0 }
        })
        return
      }

      if (!usersData || usersData.length === 0) {
        console.log('⚠️ No se encontraron usuarios')
        setSubscriptionData({
          users: [],
          stats: { total: 0, subscribed: 0, unsubscribed: 0, subscriptionRate: 0 }
        })
        return
      }

      console.log(`📊 Procesando ${usersData.length} usuarios obtenidos via RPC`)

      // Procesar datos de usuarios
      const processedUsers = usersData.map(user => ({
        id: user.id,
        email: user.email,
        created_at: user.created_at,
        plan_type: user.plan_type,
        full_name: user.full_name,
        isSubscribed: !user.unsubscribed_all,
        unsubscribeDate: user.unsubscribe_date,
        preferences: user.unsubscribed_all ? { 
          unsubscribed_all: user.unsubscribed_all,
          updated_at: user.unsubscribe_date 
        } : null,
        unsubscribeEvents: [],
        firstEmailDate: null,
        totalUnsubscribeEvents: 0
      }))

      // Calcular estadísticas
      const subscribed = processedUsers.filter(user => user.isSubscribed).length
      const unsubscribed = processedUsers.filter(user => !user.isSubscribed).length
      const total = processedUsers.length
      const subscriptionRate = total > 0 ? ((subscribed / total) * 100) : 0

      console.log(`✅ Procesados: ${total} usuarios - ${subscribed} suscritos, ${unsubscribed} no suscritos`)

      setSubscriptionData({
        users: processedUsers,
        stats: {
          total,
          subscribed,
          unsubscribed,
          subscriptionRate: subscriptionRate.toFixed(1)
        }
      })

    } catch (error) {
      console.error('❌ Error loading subscription data:', error)
    }
  }

  // Filtrar usuarios basado en el filtro seleccionado y búsqueda
  const filteredUsers = subscriptionData?.users?.filter(user => {
    const matchesFilter = filterStatus === 'all' || 
                         (filterStatus === 'subscribed' && user.isSubscribed) ||
                         (filterStatus === 'unsubscribed' && !user.isSubscribed)
    
    const matchesSearch = !searchEmail || 
                         user.email?.toLowerCase().includes(searchEmail.toLowerCase())
    
    return matchesFilter && matchesSearch
  }) || []

  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando datos de suscripciones...</p>
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
            href="/admin/notificaciones/email"
            className="w-full bg-gray-200 text-gray-700 py-3 px-6 rounded-lg font-medium hover:bg-gray-300 transition-colors block"
          >
            ← Volver a Email Analytics
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
          <nav className="flex items-center space-x-2 text-sm text-gray-500 mb-4">
            <Link href="/admin/notificaciones" className="hover:text-blue-600">Panel Admin</Link>
            <span>›</span>
            <Link href="/admin/notificaciones/email" className="hover:text-blue-600">Email Analytics</Link>
            <span>›</span>
            <span className="text-gray-800">Suscripciones</span>
          </nav>
          
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
            <div>
              <h1 className="text-3xl font-bold text-gray-800 mb-2">
                📧 Estado de Suscripciones de Email
              </h1>
              <p className="text-gray-600">
                Gestión detallada de usuarios suscritos y no suscritos a notificaciones por email
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={loadSubscriptionData}
                className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors flex items-center space-x-2"
              >
                <span>🔄</span>
                <span>Actualizar</span>
              </button>
              <Link
                href="/admin/notificaciones/email"
                className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600 transition-colors"
              >
                ← Volver
              </Link>
            </div>
          </div>
        </div>

        {!subscriptionData ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Cargando datos de suscripciones...</p>
          </div>
        ) : (
          <div className="space-y-6">
            
            {/* Estadísticas principales */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
                    <span className="text-xl">👥</span>
                  </div>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-1">{subscriptionData.stats.total}</h3>
                <p className="text-gray-600 text-sm font-medium">Usuarios Totales</p>
              </div>
              
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="p-2 rounded-lg bg-green-50 text-green-600">
                    <span className="text-xl">✅</span>
                  </div>
                </div>
                <h3 className="text-xl font-bold text-green-900 mb-1">{subscriptionData.stats.subscribed}</h3>
                <p className="text-gray-600 text-sm font-medium">Suscritos</p>
              </div>
              
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="p-2 rounded-lg bg-red-50 text-red-600">
                    <span className="text-xl">❌</span>
                  </div>
                </div>
                <h3 className="text-xl font-bold text-red-900 mb-1">{subscriptionData.stats.unsubscribed}</h3>
                <p className="text-gray-600 text-sm font-medium">No Suscritos</p>
              </div>
              
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="p-2 rounded-lg bg-purple-50 text-purple-600">
                    <span className="text-xl">📊</span>
                  </div>
                </div>
                <h3 className="text-xl font-bold text-purple-900 mb-1">{subscriptionData.stats.subscriptionRate}%</h3>
                <p className="text-gray-600 text-sm font-medium">Tasa Suscripción</p>
              </div>
            </div>

            {/* Filtros */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
                <div className="flex items-center space-x-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Filtrar por estado</label>
                    <select
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm"
                    >
                      <option value="all">Todos los usuarios ({subscriptionData.stats.total})</option>
                      <option value="subscribed">Solo suscritos ({subscriptionData.stats.subscribed})</option>
                      <option value="unsubscribed">Solo no suscritos ({subscriptionData.stats.unsubscribed})</option>
                    </select>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Buscar por email</label>
                  <input
                    type="text"
                    value={searchEmail}
                    onChange={(e) => setSearchEmail(e.target.value)}
                    placeholder="Buscar email..."
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm w-64"
                  />
                </div>
              </div>
            </div>

            {/* Tabla de usuarios */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-800">
                  📋 Lista de Usuarios ({filteredUsers.length})
                </h3>
                <p className="text-sm text-gray-600">
                  Estado detallado de suscripciones a notificaciones por email
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Primera Actividad</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha Unsub</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Plan</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredUsers.map((user, index) => (
                      <tr key={user.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <div className="flex items-center">
                            <div className="flex-shrink-0">
                              <div className={`w-3 h-3 rounded-full ${
                                user.isSubscribed ? 'bg-green-500' : 'bg-red-500'
                              }`}></div>
                            </div>
                            <div className="ml-3">
                              <div className="font-medium">{user.email}</div>
                              <div className="text-xs text-gray-500">
                                Registrado: {new Date(user.created_at).toLocaleDateString('es-ES')}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            user.isSubscribed 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {user.isSubscribed ? '✅ Suscrito' : '❌ No Suscrito'}
                          </span>
                          {user.preferences && (
                            <div className="text-xs text-gray-500 mt-1">
                              {user.preferences.unsubscribed_motivation && '🔕 Motivación'}
                              {user.preferences.unsubscribed_achievement && ' 🏆 Logros'}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {user.firstEmailDate 
                            ? new Date(user.firstEmailDate).toLocaleDateString('es-ES')
                            : 'N/A'
                          }
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {user.unsubscribeDate ? (
                            <div>
                              <div>{new Date(user.unsubscribeDate).toLocaleDateString('es-ES')}</div>
                              {user.totalUnsubscribeEvents > 0 && (
                                <div className="text-xs text-orange-600">
                                  {user.totalUnsubscribeEvents} eventos
                                </div>
                              )}
                            </div>
                          ) : (
                            user.isSubscribed ? '✅ Activo' : 'Sin fecha'
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded ${
                            user.plan_type === 'premium' ? 'bg-yellow-50 text-yellow-700' :
                            user.plan_type === 'admin' ? 'bg-red-50 text-red-700' :
                            'bg-gray-50 text-gray-700'
                          }`}>
                            {user.plan_type || 'free'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <Link
                            href={`/admin/usuarios/${user.id}/emails`}
                            className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-xs transition-colors"
                          >
                            Ver Historial
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                
                {filteredUsers.length === 0 && (
                  <div className="text-center py-8">
                    <div className="text-4xl mb-4">🔍</div>
                    <p className="text-gray-500">
                      {subscriptionData.stats.total === 0 
                        ? 'No hay usuarios con actividad de email'
                        : 'No se encontraron usuarios con los filtros aplicados'
                      }
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Resumen de fechas de unsubscribe */}
            {subscriptionData.stats.unsubscribed > 0 && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">📅 Análisis Temporal de Unsubscribes</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Últimos 30 días */}
                  <div className="text-center p-4 bg-red-50 rounded-lg">
                    <div className="text-2xl font-bold text-red-600">
                      {subscriptionData.users.filter(user => 
                        !user.isSubscribed && user.unsubscribeDate && 
                        new Date(user.unsubscribeDate) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
                      ).length}
                    </div>
                    <div className="text-sm text-gray-600">Últimos 30 días</div>
                  </div>
                  
                  {/* Últimos 90 días */}
                  <div className="text-center p-4 bg-orange-50 rounded-lg">
                    <div className="text-2xl font-bold text-orange-600">
                      {subscriptionData.users.filter(user => 
                        !user.isSubscribed && user.unsubscribeDate && 
                        new Date(user.unsubscribeDate) > new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
                      ).length}
                    </div>
                    <div className="text-sm text-gray-600">Últimos 90 días</div>
                  </div>
                  
                  {/* Sin fecha */}
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <div className="text-2xl font-bold text-gray-600">
                      {subscriptionData.users.filter(user => 
                        !user.isSubscribed && !user.unsubscribeDate
                      ).length}
                    </div>
                    <div className="text-sm text-gray-600">Sin fecha registrada</div>
                  </div>
                </div>
              </div>
            )}

          </div>
        )}

      </div>
    </div>
  )
}