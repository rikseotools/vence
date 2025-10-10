// app/admin/notificaciones/email/page.js - PÁGINA DETALLADA DE EMAIL TRACKING
'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'

export default function EmailDetailPage() {
  const { user, supabase, loading: authLoading } = useAuth()
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [data, setData] = useState(null)
  const [timeRange, setTimeRange] = useState('30')
  const [selectedEmail, setSelectedEmail] = useState(null)
  const [showEmailModal, setShowEmailModal] = useState(false)

  useEffect(() => {
    async function checkAdminAccess() {
      if (authLoading) return
      
      if (!user) {
        setLoading(false)
        return
      }

      try {
        // 🔧 FIX: Use same admin verification as Header
        const { data: isAdminResult, error } = await supabase.rpc('is_current_user_admin')
        
        if (error) {
          console.error('Error verificando admin status:', error)
          setIsAdmin(false)
        } else {
          setIsAdmin(isAdminResult === true)
        }
        
        if (isAdminResult === true) {
          loadEmailData()
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

  const loadEmailData = async () => {
    try {
      const daysAgo = new Date(Date.now() - parseInt(timeRange) * 24 * 60 * 60 * 1000).toISOString()

      // Obtener todos los eventos de email con detalles del usuario y preferencias
      const { data: emailEvents, error: emailError } = await supabase
        .from('email_events')
        .select(`
          *,
          user_profiles(email, created_at, plan_type)
        `)
        .gte('created_at', daysAgo)
        .order('created_at', { ascending: false })

      // Obtener preferencias de email de todos los usuarios únicos
      const uniqueUserIds = [...new Set((emailEvents || []).map(e => e.user_id))]
      const { data: emailPreferences, error: prefError } = await supabase
        .from('email_preferences')
        .select('user_id, unsubscribed_all')
        .in('user_id', uniqueUserIds)

      if (emailError) {
        console.error('❌ Error consultando email_events:', emailError)
        return
      }

      const events = emailEvents || []
      const preferences = emailPreferences || []
      
      // Crear mapa de preferencias para acceso rápido
      const preferencesMap = new Map()
      preferences.forEach(pref => {
        preferencesMap.set(pref.user_id, pref)
      })
      
      // Procesar estadísticas detalladas
      const stats = {
        totalEvents: events.length,
        uniqueUsers: new Set(events.map(e => e.user_id)).size,
        eventTypes: {},
        emailTypes: {},
        deviceTypes: {},
        clientTypes: {},
        subscriptionStatus: { subscribed: 0, unsubscribed: 0 },
        hourlyDistribution: Array.from({ length: 24 }, () => 0),
        dailyTrends: {},
        openRates: {},
        clickRates: {},
        topDomains: {},
        campaignPerformance: {}
      }

      // Calcular usuarios subscritos vs no subscritos con SQL simple
      console.log('🔍 Calculando estado de suscripción de usuarios...')
      
      // Obtener conteo de suscripciones con función RPC
      const { data: subscriptionCount, error: rpcError } = await supabase
        .rpc('get_subscription_count')
      
      if (!rpcError && subscriptionCount && subscriptionCount.length > 0) {
        const counts = subscriptionCount[0]
        stats.subscriptionStatus.subscribed = counts.suscritos
        stats.subscriptionStatus.unsubscribed = counts.no_suscritos
        console.log(`✅ Conteo via RPC: ${counts.suscritos} suscritos, ${counts.no_suscritos} no suscritos de ${counts.total} usuarios totales`)
      } else {
        console.error('❌ Error obteniendo conteo RPC:', rpcError)
      }

      // Procesar cada evento
      events.forEach(event => {
        // Tipos de evento
        stats.eventTypes[event.event_type] = (stats.eventTypes[event.event_type] || 0) + 1

        // Tipos de email
        if (event.email_type) {
          stats.emailTypes[event.email_type] = (stats.emailTypes[event.email_type] || 0) + 1
        }

        // Dispositivos - Mejorar detección basada en datos disponibles
        let deviceCategory = 'Unknown'
        if (event.device_type) {
          // Si tenemos device_type, categorizarlo mejor
          const deviceLower = event.device_type.toLowerCase()
          if (deviceLower.includes('mobile') || deviceLower.includes('phone') || deviceLower.includes('android') || deviceLower.includes('iphone')) {
            deviceCategory = 'Mobile'
          } else if (deviceLower.includes('tablet') || deviceLower.includes('ipad')) {
            deviceCategory = 'Tablet'
          } else if (deviceLower.includes('desktop') || deviceLower.includes('windows') || deviceLower.includes('mac') || deviceLower.includes('linux')) {
            deviceCategory = 'Desktop'
          } else {
            deviceCategory = event.device_type
          }
        } else {
          // Si no hay device_type, inferir del client_name
          const client = (event.client_name || '').toLowerCase()
          if (client.includes('mobile') || client.includes('android') || client.includes('iphone')) {
            deviceCategory = 'Mobile'
          } else if (client.includes('ipad') || client.includes('tablet')) {
            deviceCategory = 'Tablet'
          } else if (client.includes('outlook') || client.includes('thunderbird') || client.includes('apple mail')) {
            deviceCategory = 'Desktop'
          }
        }
        stats.deviceTypes[deviceCategory] = (stats.deviceTypes[deviceCategory] || 0) + 1

        // Clientes de email - Mejorar la categorización
        let emailClient = 'Unknown'
        if (event.client_name) {
          const clientLower = event.client_name.toLowerCase()
          if (clientLower.includes('gmail') || clientLower.includes('google')) {
            emailClient = 'Gmail'
          } else if (clientLower.includes('outlook') || clientLower.includes('microsoft')) {
            emailClient = 'Outlook'
          } else if (clientLower.includes('apple') || clientLower.includes('mail')) {
            emailClient = 'Apple Mail'
          } else if (clientLower.includes('yahoo')) {
            emailClient = 'Yahoo Mail'
          } else if (clientLower.includes('thunderbird')) {
            emailClient = 'Thunderbird'
          } else {
            emailClient = event.client_name
          }
        } else {
          // Si no hay client_name, inferir del dominio del email
          if (event.email_address) {
            const domain = event.email_address.split('@')[1]?.toLowerCase()
            if (domain?.includes('gmail')) {
              emailClient = 'Gmail (Web)'
            } else if (domain?.includes('outlook') || domain?.includes('hotmail') || domain?.includes('live')) {
              emailClient = 'Outlook (Web)'
            } else if (domain?.includes('yahoo')) {
              emailClient = 'Yahoo (Web)'
            } else if (domain?.includes('icloud') || domain?.includes('me.com')) {
              emailClient = 'Apple Mail (Web)'
            }
          }
        }
        stats.clientTypes[emailClient] = (stats.clientTypes[emailClient] || 0) + 1

        // Distribución por hora
        const hour = new Date(event.created_at).getHours()
        stats.hourlyDistribution[hour]++

        // Tendencias diarias
        const date = new Date(event.created_at).toISOString().split('T')[0]
        if (!stats.dailyTrends[date]) {
          stats.dailyTrends[date] = { sent: 0, opened: 0, clicked: 0, bounced: 0, unsubscribed: 0 }
        }
        if (stats.dailyTrends[date][event.event_type] !== undefined) {
          stats.dailyTrends[date][event.event_type]++
        }

        // Dominios de email
        if (event.email_address) {
          const domain = event.email_address.split('@')[1]
          if (domain) {
            stats.topDomains[domain] = (stats.topDomains[domain] || 0) + 1
          }
        }

        // Performance por campaña
        if (event.campaign_id) {
          if (!stats.campaignPerformance[event.campaign_id]) {
            stats.campaignPerformance[event.campaign_id] = { sent: 0, opened: 0, clicked: 0 }
          }
          if (stats.campaignPerformance[event.campaign_id][event.event_type] !== undefined) {
            stats.campaignPerformance[event.campaign_id][event.event_type]++
          }
        }
      })

      // Calcular rates por tipo de email
      Object.keys(stats.emailTypes).forEach(type => {
        const typeEvents = events.filter(e => e.email_type === type)
        const sent = typeEvents.filter(e => e.event_type === 'sent').length
        const opened = typeEvents.filter(e => e.event_type === 'opened').length
        const clicked = typeEvents.filter(e => e.event_type === 'clicked').length
        
        stats.openRates[type] = sent > 0 ? ((opened / sent) * 100).toFixed(2) : 0
        stats.clickRates[type] = sent > 0 ? ((clicked / sent) * 100).toFixed(2) : 0
      })

      // Calcular rates generales
      const totalSent = events.filter(e => e.event_type === 'sent').length
      const totalOpened = events.filter(e => e.event_type === 'opened').length
      const totalClicked = events.filter(e => e.event_type === 'clicked').length
      const totalBounced = events.filter(e => e.event_type === 'bounced').length
      const totalUnsubscribed = events.filter(e => e.event_type === 'unsubscribed').length

      stats.overallStats = {
        sent: totalSent,
        opened: totalOpened,
        clicked: totalClicked,
        bounced: totalBounced,
        unsubscribed: totalUnsubscribed,
        openRate: totalSent > 0 ? ((totalOpened / totalSent) * 100).toFixed(2) : 0,
        clickRate: totalSent > 0 ? ((totalClicked / totalSent) * 100).toFixed(2) : 0,
        bounceRate: totalSent > 0 ? ((totalBounced / totalSent) * 100).toFixed(2) : 0,
        unsubscribeRate: totalSent > 0 ? ((totalUnsubscribed / totalSent) * 100).toFixed(2) : 0
      }

      setData({
        events: events.slice(0, 50), // Solo los últimos 50 para la tabla
        stats,
        allEvents: events
      })

    } catch (error) {
      console.error('Error loading email data:', error)
    }
  }

  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando datos de email tracking...</p>
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
                <span className="text-gray-800">Email Tracking</span>
              </nav>
              <h1 className="text-3xl font-bold text-gray-800 mb-2">
                📧 Análisis Detallado de Email Marketing
              </h1>
              <p className="text-gray-600">
                Estadísticas completas de emails, open rates, click rates y engagement
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
                onClick={loadEmailData}
                className="bg-purple-500 text-white px-4 py-2 rounded-lg hover:bg-purple-600 transition-colors flex items-center space-x-2"
              >
                <span>🔄</span>
                <span>Actualizar</span>
              </button>
            </div>
          </div>
        </div>

        {!data ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Cargando datos...</p>
          </div>
        ) : (
          <div className="space-y-8">
            
            {/* Métricas Principales */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              {/* Tasa de Suscripción - Nueva tarjeta principal */}
              <Link href="/admin/notificaciones/email/subscripciones" className="block group">
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 h-full transition-all duration-200 group-hover:shadow-md group-hover:scale-105 group-hover:border-blue-300">
                  <div className="flex items-center justify-between mb-2">
                    <div className="p-2 rounded-lg bg-green-50 text-green-600">
                      <span className="text-xl">📧</span>
                    </div>
                    <div className="text-gray-400 group-hover:text-gray-600 transition-colors">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-1">
                    {(data.stats.subscriptionStatus.subscribed + data.stats.subscriptionStatus.unsubscribed) > 0 ? 
                      ((data.stats.subscriptionStatus.subscribed / (data.stats.subscriptionStatus.subscribed + data.stats.subscriptionStatus.unsubscribed)) * 100).toFixed(1) : 
                      100}%
                  </h3>
                  <p className="text-gray-600 text-sm font-medium">Tasa Suscripción</p>
                  <p className="text-xs text-green-600 mt-1">{data.stats.subscriptionStatus.subscribed} suscritos</p>
                </div>
              </Link>
              
              <StatCard title="Emails Enviados" value={data.stats.overallStats.sent} icon="📤" color="blue" />
              <StatCard title="Open Rate" value={`${data.stats.overallStats.openRate}%`} icon="📖" color="green" />
              <StatCard title="Click Rate" value={`${data.stats.overallStats.clickRate}%`} icon="👆" color="purple" />
              <StatCard title="Bounce Rate" value={`${data.stats.overallStats.bounceRate}%`} icon="⚠️" color="red" />
            </div>

            {/* Gráfico de Actividad por Hora */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">📈 Actividad por Hora del Día</h3>
              <div className="grid grid-cols-12 gap-2">
                {data.stats.hourlyDistribution.map((count, hour) => (
                  <div key={hour} className="text-center">
                    <div className="text-xs text-gray-500 mb-1">{hour}h</div>
                    <div className="bg-gray-100 rounded-sm h-20 flex items-end">
                      {count > 0 && (
                        <div 
                          className="w-full bg-purple-500 rounded-sm" 
                          style={{ 
                            height: `${Math.max(8, (count / Math.max(...data.stats.hourlyDistribution)) * 100)}%` 
                          }}
                        ></div>
                      )}
                    </div>
                    <div className="text-xs text-gray-600 mt-1">{count || ''}</div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-3 text-center">
                💡 Solo se muestran horas con actividad de email. Horas vacías no tienen barra.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              
              {/* Performance por Tipo de Email */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">📧 Performance por Tipo de Email</h3>
                <div className="space-y-4">
                  {Object.entries(data.stats.emailTypes)
                    .sort(([,a], [,b]) => b - a)
                    .map(([type, count]) => (
                    <div key={type} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex justify-between items-center mb-2">
                        <h4 className="font-medium text-gray-800 capitalize">{type.replace('_', ' ')}</h4>
                        <span className="text-sm text-gray-500">{count} eventos</span>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-600">Open Rate:</span>
                          <span className="ml-2 font-semibold text-green-600">{data.stats.openRates[type] || 0}%</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Click Rate:</span>
                          <span className="ml-2 font-semibold text-purple-600">{data.stats.clickRates[type] || 0}%</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Estado de Suscripción */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-800">📧 Estado de Suscripción</h3>
                  <Link 
                    href="/admin/notificaciones/email/subscripciones"
                    className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm transition-colors"
                  >
                    Ver Detalles
                  </Link>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-3 h-3 rounded-full bg-green-500"></div>
                      <span className="text-gray-700">Suscritos</span>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-gray-900">{data.stats.subscriptionStatus.subscribed.toLocaleString()}</div>
                      <div className="text-xs text-gray-500">
                        {(data.stats.subscriptionStatus.subscribed + data.stats.subscriptionStatus.unsubscribed) > 0 ? 
                          ((data.stats.subscriptionStatus.subscribed / (data.stats.subscriptionStatus.subscribed + data.stats.subscriptionStatus.unsubscribed)) * 100).toFixed(1) : 0}%
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-3 h-3 rounded-full bg-red-500"></div>
                      <span className="text-gray-700">No Suscritos</span>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-gray-900">{data.stats.subscriptionStatus.unsubscribed.toLocaleString()}</div>
                      <div className="text-xs text-gray-500">
                        {(data.stats.subscriptionStatus.subscribed + data.stats.subscriptionStatus.unsubscribed) > 0 ? 
                          ((data.stats.subscriptionStatus.unsubscribed / (data.stats.subscriptionStatus.subscribed + data.stats.subscriptionStatus.unsubscribed)) * 100).toFixed(1) : 0}%
                      </div>
                    </div>
                  </div>
                  
                  {/* Gráfico visual */}
                  <div className="mt-4">
                    <div className="flex h-4 rounded-full overflow-hidden bg-gray-200">
                      <div 
                        className="bg-green-500" 
                        style={{
                          width: (data.stats.subscriptionStatus.subscribed + data.stats.subscriptionStatus.unsubscribed) > 0 ? 
                            `${(data.stats.subscriptionStatus.subscribed / (data.stats.subscriptionStatus.subscribed + data.stats.subscriptionStatus.unsubscribed)) * 100}%` : '0%'
                        }}
                      ></div>
                      <div 
                        className="bg-red-500" 
                        style={{
                          width: (data.stats.subscriptionStatus.subscribed + data.stats.subscriptionStatus.unsubscribed) > 0 ? 
                            `${(data.stats.subscriptionStatus.unsubscribed / (data.stats.subscriptionStatus.subscribed + data.stats.subscriptionStatus.unsubscribed)) * 100}%` : '0%'
                        }}
                      ></div>
                    </div>
                    <div className="text-center mt-2 text-xs text-gray-500">
                      Total usuarios: {data.stats.subscriptionStatus.subscribed + data.stats.subscriptionStatus.unsubscribed}
                    </div>
                  </div>
                </div>
              </div>

              {/* Dispositivos */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">📱 Dispositivos</h3>
                <div className="space-y-3">
                  {Object.entries(data.stats.deviceTypes)
                    .sort(([,a], [,b]) => b - a)
                    .map(([device, count]) => (
                    <div key={device} className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className={`w-3 h-3 rounded-full ${
                          device === 'Mobile' ? 'bg-green-500' :
                          device === 'Desktop' ? 'bg-blue-500' :
                          device === 'Tablet' ? 'bg-purple-500' :
                          'bg-gray-500'
                        }`}></div>
                        <span className="text-gray-700">
                          {device === 'Mobile' ? '📱 Móvil' :
                           device === 'Desktop' ? '💻 Desktop' :
                           device === 'Tablet' ? '📋 Tablet' :
                           device === 'Unknown' ? '❓ Desconocido' :
                           device}
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
                
                {/* Resumen móvil vs desktop */}
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="grid grid-cols-2 gap-4 text-center">
                    <div className="bg-green-50 rounded-lg p-3">
                      <div className="text-lg font-bold text-green-600">
                        {((data.stats.deviceTypes['Mobile'] || 0) / data.stats.totalEvents * 100).toFixed(1)}%
                      </div>
                      <div className="text-xs text-gray-600">Móvil</div>
                    </div>
                    <div className="bg-blue-50 rounded-lg p-3">
                      <div className="text-lg font-bold text-blue-600">
                        {((data.stats.deviceTypes['Desktop'] || 0) / data.stats.totalEvents * 100).toFixed(1)}%
                      </div>
                      <div className="text-xs text-gray-600">Desktop</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Clientes de Email */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">📧 Clientes de Email</h3>
                <div className="space-y-3">
                  {Object.entries(data.stats.clientTypes)
                    .sort(([,a], [,b]) => b - a)
                    .slice(0, 8)
                    .map(([client, count]) => (
                    <div key={client} className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className={`w-3 h-3 rounded-full ${
                          client.includes('Gmail') ? 'bg-red-500' :
                          client.includes('Outlook') ? 'bg-blue-500' :
                          client.includes('Apple') ? 'bg-gray-500' :
                          client.includes('Yahoo') ? 'bg-purple-500' :
                          client.includes('Unknown') ? 'bg-gray-300' :
                          'bg-green-500'
                        }`}></div>
                        <span className="text-gray-700">{client}</span>
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

              {/* Top Dominios */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">🌐 Top Dominios de Email</h3>
                <div className="space-y-3">
                  {Object.entries(data.stats.topDomains)
                    .sort(([,a], [,b]) => b - a)
                    .slice(0, 10)
                    .map(([domain, count]) => (
                    <div key={domain} className="flex items-center justify-between">
                      <span className="text-gray-700">{domain}</span>
                      <div className="text-right">
                        <div className="font-semibold text-gray-900">{count.toLocaleString()}</div>
                        <div className="text-xs text-gray-500">
                          {((count / data.stats.uniqueUsers) * 100).toFixed(1)}%
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
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Enviados</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Abiertos</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Clicked</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Bounced</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Open Rate</th>
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
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600">{stats.opened || 0}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600">{stats.clicked || 0}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600">{stats.bounced || 0}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {stats.sent > 0 ? ((stats.opened / stats.sent) * 100).toFixed(1) : 0}%
                        </td>
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
                <p className="text-sm text-gray-600">Últimos 50 eventos de email</p>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tiempo</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Evento</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Template</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Asunto</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {data.events.map((event, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {new Date(event.created_at).toLocaleString('es-ES')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {event.email_address || event.user_profiles?.email || 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            event.event_type === 'opened' ? 'bg-blue-100 text-blue-800' :
                            event.event_type === 'clicked' ? 'bg-green-100 text-green-800' :
                            event.event_type === 'sent' ? 'bg-gray-100 text-gray-800' :
                            event.event_type === 'bounced' ? 'bg-red-100 text-red-800' :
                            event.event_type === 'unsubscribed' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-purple-100 text-purple-800'
                          }`}>
                            {event.event_type}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded ${
                            event.email_type === 'motivation' ? 'bg-blue-50 text-blue-700' :
                            event.email_type === 'achievement' ? 'bg-yellow-50 text-yellow-700' :
                            'bg-gray-50 text-gray-700'
                          }`}>
                            {event.email_type || 'N/A'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded ${
                            event.template_id === 'comeback' ? 'bg-orange-50 text-orange-700' :
                            event.template_id === 'streak_risk' ? 'bg-red-50 text-red-700' :
                            event.template_id === 'medal_congratulation' ? 'bg-yellow-50 text-yellow-700' :
                            'bg-gray-50 text-gray-700'
                          }`}>
                            {event.template_id || 'N/A'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">
                          {event.subject || 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button
                            onClick={() => {
                              setSelectedEmail(event)
                              setShowEmailModal(true)
                            }}
                            className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-xs transition-colors"
                          >
                            Ver Email
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

        {/* Modal de Email */}
        {showEmailModal && selectedEmail && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden">
              <div className="flex justify-between items-center p-6 border-b">
                <h3 className="text-lg font-semibold text-gray-800">
                  📧 Vista Previa del Email
                </h3>
                <button
                  onClick={() => {
                    setShowEmailModal(false)
                    setSelectedEmail(null)
                  }}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ×
                </button>
              </div>
              
              <div className="p-6 border-b bg-gray-50">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><strong>Para:</strong> {selectedEmail.email_address}</div>
                  <div><strong>Asunto:</strong> {selectedEmail.subject}</div>
                  <div><strong>Tipo:</strong> {selectedEmail.email_type}</div>
                  <div><strong>Template:</strong> {selectedEmail.template_id}</div>
                  <div><strong>Enviado:</strong> {new Date(selectedEmail.created_at).toLocaleString('es-ES')}</div>
                </div>
              </div>
              
              <div className="flex-1 overflow-hidden">
                <div className="h-96 overflow-auto border">
                  <iframe
                    srcDoc={generateEmailHTML(selectedEmail)}
                    className="w-full h-full"
                    title="Email Preview"
                  />
                </div>
              </div>
              
              <div className="p-4 bg-gray-50 flex justify-end">
                <button
                  onClick={() => {
                    setShowEmailModal(false)
                    setSelectedEmail(null)
                  }}
                  className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

// Función para generar el HTML del email tal como lo recibió el usuario
function generateEmailHTML(event) {
  const { email_type, template_id, subject, email_content_preview, email_address } = event
  
  // Determinar el tipo de email y generar HTML apropiado
  if (email_type === 'achievement' && template_id === 'medal_congratulation') {
    // Email de medalla
    const medalTitle = subject?.includes('🥇') ? '🥇 Líder del Día' :
                      subject?.includes('🏅') ? '🏅 Podio Diario' :
                      subject?.includes('🎯') ? '🎯 Alta Precisión' :
                      'Medalla Conseguida'
    
    return generateMedalEmailHTML(medalTitle, email_address)
  } else if (email_type === 'motivation') {
    // Email motivacional
    if (template_id === 'streak_risk') {
      return generateStreakRiskEmailHTML(email_content_preview, email_address)
    } else if (template_id === 'comeback') {
      return generateComebackEmailHTML(email_content_preview, email_address)
    }
  }
  
  // Fallback genérico
  return generateGenericEmailHTML(subject, email_content_preview, email_address)
}

function generateMedalEmailHTML(medalTitle, email) {
  const name = email?.split('@')[0] || 'Estudiante'
  
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>¡Felicidades! Nueva medalla</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f8f9fa;">
        <div style="max-width: 600px; margin: 0 auto; background: #ffffff;">
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #ffd700 0%, #ffed4e 100%); color: #333; text-align: center; padding: 40px 20px;">
            <div style="font-size: 60px; margin-bottom: 10px;">🏆</div>
            <h1 style="margin: 0; font-size: 28px; font-weight: bold;">¡Enhorabuena!</h1>
            <p style="margin: 10px 0 0 0; font-size: 18px; font-weight: 600;">${medalTitle}</p>
          </div>
          
          <!-- Content -->
          <div style="padding: 40px 30px;">
            <p style="font-size: 16px; margin-bottom: 20px;">¡Hola ${name}! 👋</p>
            
            <p style="font-size: 16px; margin-bottom: 25px; line-height: 1.8;">
              ¡Qué emocionante momento! Has conseguido una nueva medalla: <strong>${medalTitle}</strong>.
              Tu dedicación y esfuerzo están dando sus frutos. ¡Sigue así y conseguirás tus objetivos!
            </p>
            
            <!-- CTA Button -->
            <div style="text-align: center; margin: 35px 0;">
              <a href="https://www.vence.es/auxiliar-administrativo-estado/test" 
                 style="display: inline-block; background: #ffd700; color: #333; text-decoration: none; padding: 15px 30px; border-radius: 8px; font-weight: bold; font-size: 16px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                🎯 Continuar Estudiando
              </a>
            </div>
            
            <div style="background: #fff3cd; border-left: 4px solid #ffd700; padding: 20px; margin: 25px 0; border-radius: 4px;">
              <p style="margin: 0; font-size: 14px; color: #856404;">
                🏆 <strong>¡Eres increíble!</strong> Esta medalla es el reconocimiento a tu constancia y buen rendimiento.
              </p>
            </div>
          </div>
          
          <!-- Footer -->
          <div style="background: #f8f9fa; padding: 20px 30px; text-align: center; border-top: 1px solid #eee;">
            <p style="margin: 0; font-size: 12px; color: #666;">
              <a href="https://www.vence.es/perfil?tab=emails" style="color: #ffd700; text-decoration: none;">Gestionar preferencias de notificaciones</a>
            </p>
            <p style="margin: 5px 0 0 0; font-size: 12px; color: #999;">
              © 2025 Vence. Te ayudamos a conseguir tu plaza.
            </p>
          </div>
        </div>
      </body>
    </html>
  `
}

function generateStreakRiskEmailHTML(content, email) {
  const name = email?.split('@')[0] || 'Estudiante'
  const days = content?.match(/(\d+) días/) ? content.match(/(\d+) días/)[1] : '3'
  
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>🔥 ¡No pierdas tu racha!</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; background: #ffffff;">
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; text-align: center; padding: 30px 20px;">
            <div style="font-size: 48px; margin-bottom: 10px;">🔥</div>
            <h1 style="margin: 0; font-size: 24px; font-weight: bold;">¡Tu racha está en peligro!</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9; font-size: 16px;">Vence - Auxiliar Administrativo</p>
          </div>
          
          <!-- Content -->
          <div style="padding: 40px 30px;">
            <p style="font-size: 16px; margin-bottom: 20px;">¡Hola ${name}! 👋</p>
            
            <p style="font-size: 16px; margin-bottom: 25px;">
              Llevas ${days} días seguidos estudiando. ¡Increíble constancia! No dejes que esta racha se pierda ahora.
            </p>
            
            <!-- CTA Button -->
            <div style="text-align: center; margin: 35px 0;">
              <a href="https://www.vence.es/auxiliar-administrativo-estado/test" 
                 style="display: inline-block; background: #ef4444; color: white; text-decoration: none; padding: 15px 30px; border-radius: 8px; font-weight: bold; font-size: 16px;">
                🎯 Mantener Mi Racha
              </a>
            </div>
            
            <div style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 20px; margin: 25px 0; border-radius: 4px;">
              <p style="margin: 0; font-size: 14px; color: #991b1b;">
                ⚡ <strong>Consejo:</strong> Haz aunque sea un test rápido para mantener tu racha activa. ¡La constancia es clave!
              </p>
            </div>
          </div>
          
          <!-- Footer -->
          <div style="background: #f8f9fa; padding: 20px 30px; text-align: center; border-top: 1px solid #eee;">
            <p style="margin: 0; font-size: 12px; color: #666;">
              <a href="https://www.vence.es/perfil?tab=emails" style="color: #ef4444; text-decoration: none;">Gestionar preferencias de notificaciones</a>
            </p>
            <p style="margin: 5px 0 0 0; font-size: 12px; color: #999;">
              © 2025 Vence. Te ayudamos a conseguir tu plaza.
            </p>
          </div>
        </div>
      </body>
    </html>
  `
}

function generateComebackEmailHTML(content, email) {
  const name = email?.split('@')[0] || 'Estudiante'
  const days = content?.match(/(\d+) días/) ? content.match(/(\d+) días/)[1] : '2'
  
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>¡Te echamos de menos!</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; background: #ffffff;">
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-align: center; padding: 30px 20px;">
            <h1 style="margin: 0; font-size: 24px; font-weight: bold;">¡Vuelve a la preparación!</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9; font-size: 16px;">Vence - Auxiliar Administrativo</p>
          </div>
          
          <!-- Content -->
          <div style="padding: 40px 30px;">
            <p style="font-size: 16px; margin-bottom: 20px;">¡Hola ${name}! 👋</p>
            
            <p style="font-size: 16px; margin-bottom: 25px;">
              Han pasado ${days} días desde tu última sesión de estudio. ¡No pierdas el ritmo de preparación para las oposiciones!
            </p>
            
            <!-- CTA Button -->
            <div style="text-align: center; margin: 35px 0;">
              <a href="https://www.vence.es/auxiliar-administrativo-estado/test" 
                 style="display: inline-block; background: #667eea; color: white; text-decoration: none; padding: 15px 30px; border-radius: 8px; font-weight: bold; font-size: 16px;">
                🎯 Hacer Test Ahora
              </a>
            </div>
            
            <div style="background: #f8f9fa; border-left: 4px solid #667eea; padding: 20px; margin: 25px 0; border-radius: 4px;">
              <p style="margin: 0; font-size: 14px; color: #666;">
                💡 <strong>Recuerda:</strong> La constancia es clave para aprobar las oposiciones. ¡Cada minuto de estudio cuenta!
              </p>
            </div>
          </div>
          
          <!-- Footer -->
          <div style="background: #f8f9fa; padding: 20px 30px; text-align: center; border-top: 1px solid #eee;">
            <p style="margin: 0; font-size: 12px; color: #666;">
              <a href="https://www.vence.es/perfil?tab=emails" style="color: #667eea; text-decoration: none;">Gestionar preferencias de notificaciones</a>
            </p>
            <p style="margin: 5px 0 0 0; font-size: 12px; color: #999;">
              © 2025 Vence. Te ayudamos a conseguir tu plaza.
            </p>
          </div>
        </div>
      </body>
    </html>
  `
}

function generateGenericEmailHTML(subject, content, email) {
  const name = email?.split('@')[0] || 'Estudiante'
  
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subject || 'Email de Vence'}</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; background: #ffffff;">
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-align: center; padding: 30px 20px;">
            <h1 style="margin: 0; font-size: 24px; font-weight: bold;">${subject || 'Vence'}</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9; font-size: 16px;">Auxiliar Administrativo</p>
          </div>
          
          <!-- Content -->
          <div style="padding: 40px 30px;">
            <p style="font-size: 16px; margin-bottom: 20px;">¡Hola ${name}! 👋</p>
            
            <p style="font-size: 16px; margin-bottom: 25px;">
              ${content || 'Contenido del email'}
            </p>
            
            <!-- CTA Button -->
            <div style="text-align: center; margin: 35px 0;">
              <a href="https://www.vence.es/auxiliar-administrativo-estado/test" 
                 style="display: inline-block; background: #667eea; color: white; text-decoration: none; padding: 15px 30px; border-radius: 8px; font-weight: bold; font-size: 16px;">
                🎯 Ir a Vence
              </a>
            </div>
          </div>
          
          <!-- Footer -->
          <div style="background: #f8f9fa; padding: 20px 30px; text-align: center; border-top: 1px solid #eee;">
            <p style="margin: 0; font-size: 12px; color: #666;">
              <a href="https://www.vence.es/perfil?tab=emails" style="color: #667eea; text-decoration: none;">Gestionar preferencias</a>
            </p>
            <p style="margin: 5px 0 0 0; font-size: 12px; color: #999;">
              © 2025 Vence
            </p>
          </div>
        </div>
      </body>
    </html>
  `
}

function StatCard({ title, value, icon, color }) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600 border-blue-200',
    green: 'bg-green-50 text-green-600 border-green-200',
    purple: 'bg-purple-50 text-purple-600 border-purple-200',
    red: 'bg-red-50 text-red-600 border-red-200'
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-2">
        <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
          <span className="text-xl">{icon}</span>
        </div>
      </div>
      <h3 className="text-xl font-bold text-gray-900 mb-1">{value}</h3>
      <p className="text-gray-600 text-sm font-medium">{title}</p>
    </div>
  )
}