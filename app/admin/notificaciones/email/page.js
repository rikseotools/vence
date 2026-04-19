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
  const [emailTypeFilter, setEmailTypeFilter] = useState('all')
  const [templateFilter, setTemplateFilter] = useState('all')
  const [campaignFilter, setCampaignFilter] = useState('all')
  const [viewMode, setViewMode] = useState('grouped') // 'individual' | 'grouped' - Admin debe ver todo agrupado
  const [eventsLimit, setEventsLimit] = useState(500) // Aumentar para ver más eventos
  const [currentPage, setCurrentPage] = useState(1)

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
  }, [user, authLoading, supabase, timeRange, emailTypeFilter, templateFilter, campaignFilter, eventsLimit, currentPage])

  // Función para reiniciar página cuando cambien filtros
  const handleFilterChange = (filterType, value) => {
    setCurrentPage(1) // Reiniciar a la primera página
    
    switch(filterType) {
      case 'emailType':
        setEmailTypeFilter(value)
        break
      case 'template':
        setTemplateFilter(value)
        break
      case 'campaign':
        setCampaignFilter(value)
        break
      case 'limit':
        setEventsLimit(parseInt(value))
        break
    }
  }

  const loadEmailData = async () => {
    console.log('🚀 INICIANDO loadEmailData con API admin (service_role)')
    console.log('🔍 FILTROS ACTIVOS:', {
      emailTypeFilter,
      templateFilter, 
      campaignFilter,
      timeRange
    })
    
    try {
      // Call admin API with auth
      const { data: { session } } = await supabase.auth.getSession()
      const response = await fetch(`/api/admin/email-events?timeRange=${timeRange}`, {
        headers: session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {},
      })
      
      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`)
      }
      
      const apiData = await response.json()
      console.log(`✅ Admin API returned ${apiData.totalEvents} events from service_role`)
      
      // Debug today's events specifically
      const today = new Date().toISOString().split('T')[0]
      const todayEvents = apiData.events.filter(e => 
        e.created_at >= `${today}T00:00:00.000Z` && 
        e.created_at <= `${today}T23:59:59.999Z`
      )
      
      console.log(`🗓️ EVENTOS DE HOY (${today}) con service_role:`, {
        count: todayEvents.length,
        tipoEventos: todayEvents.reduce((acc, e) => {
          acc[e.event_type] = (acc[e.event_type] || 0) + 1
          return acc
        }, {})
      })

      const allEvents = apiData.events || []
      
      // Aplicar filtros antes del slice
      let filteredEvents = allEvents
      
      if (emailTypeFilter !== 'all') {
        filteredEvents = filteredEvents.filter(e => e.email_type === emailTypeFilter)
      }
      
      if (templateFilter !== 'all') {
        filteredEvents = filteredEvents.filter(e => e.template_id === templateFilter)
      }
      
      if (campaignFilter !== 'all') {
        filteredEvents = filteredEvents.filter(e => e.campaign_id === campaignFilter)
      }
      
      const events = filteredEvents.slice(0, eventsLimit * 2) // Limit for table display
      
      // Procesar estadísticas detalladas
      const stats = {
        totalEvents: allEvents.length,
        uniqueUsers: new Set(allEvents.map(e => e.user_id)).size,
        eventTypes: {},
        emailTypes: {},
        deviceTypes: {},
        clientTypes: {},
        subscriptionStatus: { subscribed: 0, unsubscribed: 0 },
        hourlyDistribution: Array.from({ length: 24 }, () => 0),
        hourlySent: Array.from({ length: 24 }, () => 0), // Envíos por hora  
        hourlyOpens: Array.from({ length: 24 }, () => 0), // Aperturas por hora
        dailyTrends: {},
        openRates: {},
        clickRates: {},
        topDomains: {},
        campaignPerformance: {}
      }

      // Usar datos de suscripción desde la API
      console.log('🔍 Usando datos de suscripción desde API...')
      const subscriptionData = apiData.subscriptionCount
      
      if (subscriptionData) {
        stats.subscriptionStatus.subscribed = subscriptionData.suscritos
        stats.subscriptionStatus.unsubscribed = subscriptionData.no_suscritos
        console.log(`✅ Conteo desde API: ${subscriptionData.suscritos} suscritos, ${subscriptionData.no_suscritos} no suscritos de ${subscriptionData.total} usuarios totales`)
      } else {
        console.warn('⚠️ No se obtuvieron datos de suscripción desde API')
      }

      // Agregar debug para detectar problemas
      console.log(`📊 Procesando ${allEvents.length} eventos de email (todos los datos)`)
      console.log(`📊 Eventos limitados para tabla: ${events.length}`)
      
      // Crear estructuras para conteo correcto por día
      const dailyEventTracker = new Map() // date -> { sent: Set, opened: Set, clicked: Set }
      const rawEventCounts = new Map() // Para comparar eventos brutos vs únicos
      
      // Procesar cada evento (USAR TODOS LOS EVENTOS PARA ESTADÍSTICAS)
      allEvents.forEach((event, index) => {
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
        
        // Distribución específica por tipo de evento
        if (event.event_type === 'sent') {
          stats.hourlySent[hour]++
        } else if (event.event_type === 'opened') {
          stats.hourlyOpens[hour]++
        }

        // Tendencias diarias - usar Sets para conteo único por usuario/email
        const date = new Date(event.created_at).toISOString().split('T')[0]
        if (!dailyEventTracker.has(date)) {
          dailyEventTracker.set(date, {
            sent: new Set(),
            opened: new Set(),
            clicked: new Set(),
            bounced: new Set(),
            unsubscribed: new Set()
          })
        }
        
        const dayEvents = dailyEventTracker.get(date)
        // Para usuarios únicos, solo usar user_id (sin timestamp para evitar falsos únicos)
        const uniqueKey = event.user_id
        
        // Contar eventos brutos para debug
        if (!rawEventCounts.has(date)) {
          rawEventCounts.set(date, { sent: 0, opened: 0, clicked: 0, bounced: 0, unsubscribed: 0 })
        }
        const rawCounts = rawEventCounts.get(date)
        
        // Agregar a Sets para evitar duplicados por usuario/email
        switch(event.event_type) {
          case 'sent':
          case 'delivered': // Ambos cuentan como enviados
            dayEvents.sent.add(uniqueKey)
            rawCounts.sent++
            break
          case 'opened':
            dayEvents.opened.add(uniqueKey)
            rawCounts.opened++
            break
          case 'clicked':
            dayEvents.clicked.add(uniqueKey)
            rawCounts.clicked++
            break
          case 'bounced':
            dayEvents.bounced.add(uniqueKey)
            rawCounts.bounced++
            break
          case 'unsubscribed':
            dayEvents.unsubscribed.add(uniqueKey)
            rawCounts.unsubscribed++
            break
          case 'complained':
            dayEvents.bounced.add(uniqueKey)
            rawCounts.bounced++
            break
          default:
            console.warn(`⚠️ Tipo de evento desconocido: ${event.event_type}`)
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
      
      // Convertir Sets a conteos finales en stats.dailyTrends
      for (const [date, dayEvents] of dailyEventTracker.entries()) {
        stats.dailyTrends[date] = {
          sent: dayEvents.sent.size,
          opened: dayEvents.opened.size,
          clicked: dayEvents.clicked.size,
          bounced: dayEvents.bounced.size,
          unsubscribed: dayEvents.unsubscribed.size
        }
      }
      
      // Debug: comparar eventos brutos vs únicos
      console.log('📊 Comparación eventos brutos vs únicos (últimos 5 días):')
      const sortedDates = Array.from(dailyEventTracker.keys()).sort().reverse().slice(0, 5)
      sortedDates.forEach(date => {
        const unique = stats.dailyTrends[date]
        const raw = rawEventCounts.get(date)
        console.log(`${date}: Enviados ${raw.sent} → ${unique.sent} únicos, Abiertos ${raw.opened} → ${unique.opened} únicos`)
      })
      
      // Debug: mostrar resumen de tendencias diarias
      console.log('📊 Resumen de tendencias diarias procesadas:')
      Object.entries(stats.dailyTrends)
        .sort(([a], [b]) => b.localeCompare(a))
        .slice(0, 5)
        .forEach(([date, dayStats]) => {
          const openRate = dayStats.sent > 0 ? ((dayStats.opened / dayStats.sent) * 100).toFixed(1) : 0
          const clickRate = dayStats.sent > 0 ? ((dayStats.clicked / dayStats.sent) * 100).toFixed(1) : 0
          console.log(`  ${date}: ${dayStats.sent} enviados, ${dayStats.opened} abiertos (${openRate}%), ${dayStats.clicked} clicks (${clickRate}%)`)
          
          if (dayStats.opened > dayStats.sent || dayStats.clicked > dayStats.sent) {
            console.error(`  ❌ ¡DATOS INCORRECTOS! ${date}: más abiertos/clicks que enviados`)
          }
        })

      // Calcular rates por tipo de email usando usuarios únicos
      Object.keys(stats.emailTypes).forEach(type => {
        const typeEvents = events.filter(e => e.email_type === type)
        const sent = typeEvents.filter(e => e.event_type === 'sent').length
        const uniqueOpened = new Set(typeEvents.filter(e => e.event_type === 'opened').map(e => e.user_id)).size
        const uniqueClicked = new Set(typeEvents.filter(e => e.event_type === 'clicked').map(e => e.user_id)).size
        
        stats.openRates[type] = sent > 0 ? ((uniqueOpened / sent) * 100).toFixed(2) : 0
        stats.clickRates[type] = sent > 0 ? ((uniqueClicked / sent) * 100).toFixed(2) : 0
      })

      // Calcular rates generales usando usuarios únicos
      const totalSent = events.filter(e => e.event_type === 'sent').length
      const uniqueOpened = new Set(events.filter(e => e.event_type === 'opened').map(e => e.user_id)).size
      const uniqueClicked = new Set(events.filter(e => e.event_type === 'clicked').map(e => e.user_id)).size
      const totalBounced = events.filter(e => e.event_type === 'bounced').length
      const totalUnsubscribed = events.filter(e => e.event_type === 'unsubscribed').length

      stats.overallStats = {
        sent: totalSent,
        opened: uniqueOpened,
        clicked: uniqueClicked,
        bounced: totalBounced,
        unsubscribed: totalUnsubscribed,
        openRate: totalSent > 0 ? ((uniqueOpened / totalSent) * 100).toFixed(2) : 0,
        clickRate: totalSent > 0 ? ((uniqueClicked / totalSent) * 100).toFixed(2) : 0,
        bounceRate: totalSent > 0 ? ((totalBounced / totalSent) * 100).toFixed(2) : 0,
        unsubscribeRate: totalSent > 0 ? ((totalUnsubscribed / totalSent) * 100).toFixed(2) : 0
      }

      // Procesar datos según el modo de vista
      let processedEvents = events
      let groupedCampaigns = null
      
      // Siempre agrupar por campaign_id para newsletters
      if (events.length > 0) {
        const campaignGroups = new Map()
        events.forEach(event => {
          const campaignKey = event.campaign_id || `${event.email_type}_${event.template_id}`
          if (!campaignGroups.has(campaignKey)) {
            campaignGroups.set(campaignKey, {
              campaign_id: event.campaign_id,
              email_type: event.email_type,
              template_id: event.template_id,
              subject: event.subject,
              created_at: event.created_at,
              events: []
            })
          }
          campaignGroups.get(campaignKey).events.push(event)
        })
        
        groupedCampaigns = Array.from(campaignGroups.values())
          .map(group => {
            const totalSent = group.events.filter(e => e.event_type === 'sent').length
            const uniqueOpened = new Set(group.events.filter(e => e.event_type === 'opened').map(e => e.user_id)).size
            const uniqueClicked = new Set(group.events.filter(e => e.event_type === 'clicked').map(e => e.user_id)).size
            const totalBounced = group.events.filter(e => e.event_type === 'bounced').length
            
            return {
              ...group,
              total_sent: totalSent,
              total_opened: uniqueOpened,
              total_clicked: uniqueClicked,
              total_bounced: totalBounced,
              open_rate: totalSent > 0 ? ((uniqueOpened / totalSent) * 100).toFixed(2) : 0,
              click_rate: totalSent > 0 ? ((uniqueClicked / totalSent) * 100).toFixed(2) : 0
            }
          })
          .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      }
      
      // Paginación para vista individual
      const startIndex = (currentPage - 1) * eventsLimit
      const endIndex = startIndex + eventsLimit
      const paginatedEvents = processedEvents.slice(startIndex, endIndex)
      
      setData({
        events: paginatedEvents,
        stats,
        allEvents: events,
        groupedCampaigns,
        totalEvents: events.length,
        totalPages: Math.ceil(events.length / eventsLimit),
        availableEmailTypes: [...new Set(allEvents.map(e => e.email_type).filter(Boolean))],
        availableTemplates: [...new Set(allEvents.map(e => e.template_id).filter(Boolean))],
        availableCampaigns: [...new Set(allEvents.map(e => e.campaign_id).filter(Boolean))]
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
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-8">
        
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
            {/* Filtros móvil-friendly */}
            <div className="space-y-4">
              {/* Primera fila: Filtros principales */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <select
                  value={timeRange}
                  onChange={(e) => setTimeRange(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm w-full"
                >
                  <option value="7">📅 Últimos 7 días</option>
                  <option value="30">📅 Últimos 30 días</option>
                  <option value="90">📅 Últimos 90 días</option>
                  <option value="365">📅 Último año</option>
                </select>
                
                <select
                  value={emailTypeFilter}
                  onChange={(e) => handleFilterChange('emailType', e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm w-full"
                >
                  <option value="all">📧 Todos los tipos</option>
                  {data?.availableEmailTypes?.map(type => (
                    <option key={type} value={type}>
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </option>
                  ))}
                </select>
                
                <select
                  value={templateFilter}
                  onChange={(e) => handleFilterChange('template', e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm w-full"
                >
                  <option value="all">📄 Todas las plantillas</option>
                  {data?.availableTemplates?.map(template => (
                    <option key={template} value={template}>
                      {template}
                    </option>
                  ))}
                </select>
                
                <select
                  value={campaignFilter}
                  onChange={(e) => handleFilterChange('campaign', e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm w-full"
                >
                  <option value="all">🎯 Todas las campañas</option>
                  {data?.availableCampaigns?.map(campaign => (
                    <option key={campaign} value={campaign}>
                      {campaign}
                    </option>
                  ))}
                </select>
              </div>
              
              {/* Segunda fila: Controles de límites y acciones */}
              <div className="flex flex-col sm:flex-row gap-3">
                <select
                  value={eventsLimit}
                  onChange={(e) => handleFilterChange('limit', e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm flex-1"
                >
                  <option value={50}>📊 50 eventos</option>
                  <option value={100}>📊 100 eventos</option>
                  <option value={250}>📊 250 eventos</option>
                  <option value={500}>📊 500 eventos</option>
                  <option value={1000}>📊 1000 eventos</option>
                </select>
                
                <div className="flex gap-2 sm:gap-3">
                  <button
                    onClick={() => {
                      setEmailTypeFilter('all')
                      setTemplateFilter('all')
                      setCampaignFilter('all')
                      setCurrentPage(1)
                    }}
                    className="bg-gray-500 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-gray-600 transition-colors flex items-center gap-1 sm:gap-2 text-sm"
                  >
                    <span>🧹</span>
                    <span className="hidden sm:inline">Limpiar</span>
                  </button>
                  
                  <button
                    onClick={loadEmailData}
                    className="bg-purple-500 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-purple-600 transition-colors flex items-center gap-1 sm:gap-2 text-sm"
                  >
                    <span>🔄</span>
                    <span className="hidden sm:inline">Actualizar</span>
                  </button>
                </div>
              </div>
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
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

            {/* Gráfico de Actividad por Hora - Envíos vs Aperturas */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">📈 Envíos vs Aperturas por Hora</h3>
              
              {/* Leyenda */}
              <div className="mb-4 flex justify-center gap-6">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-blue-500 rounded"></div>
                  <span className="text-sm text-gray-600">📧 Envíos</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-500 rounded"></div>
                  <span className="text-sm text-gray-600">📖 Aperturas</span>
                </div>
              </div>
              
              <div className="overflow-x-auto">
                <div className="grid grid-cols-12 gap-1 sm:gap-2 min-w-[800px]">
                  {Array.from({ length: 24 }, (_, hour) => {
                    const sentCount = data.stats.hourlySent[hour] || 0;
                    const openCount = data.stats.hourlyOpens[hour] || 0;
                    const maxSent = Math.max(...data.stats.hourlySent);
                    const maxOpen = Math.max(...data.stats.hourlyOpens);
                    const maxValue = Math.max(maxSent, maxOpen, 1); // Evitar división por 0
                    
                    return (
                      <div key={hour} className="text-center">
                        <div className="text-xs text-gray-500 mb-1">{hour}h</div>
                        <div className="bg-gray-100 rounded-sm h-20 sm:h-24 p-1 relative">
                          <div className="flex h-full gap-0.5">
                            {/* Barra de Envíos (azul) */}
                            <div className="flex-1 bg-gray-200 rounded-sm relative border border-gray-300">
                              {sentCount > 0 && (
                                <div 
                                  className="absolute bottom-0 left-0 right-0 bg-blue-500 rounded-sm" 
                                  style={{ 
                                    height: `${Math.max(10, (sentCount / maxValue) * 100)}%`
                                  }}
                                  title={`${sentCount} envíos a las ${hour}:00h`}
                                ></div>
                              )}
                            </div>
                            {/* Barra de Aperturas (verde) */}
                            <div className="flex-1 bg-gray-200 rounded-sm relative border border-gray-300">
                              {openCount > 0 && (
                                <div 
                                  className="absolute bottom-0 left-0 right-0 bg-green-500 rounded-sm" 
                                  style={{ 
                                    height: `${Math.max(10, (openCount / maxValue) * 100)}%`
                                  }}
                                  title={`${openCount} aperturas a las ${hour}:00h`}
                                ></div>
                              )}
                            </div>
                          </div>
                        </div>
                        {/* Números pequeños */}
                        <div className="text-xs text-gray-600 mt-1 flex justify-center gap-1">
                          {sentCount > 0 && <span className="text-blue-600">{sentCount}</span>}
                          {openCount > 0 && <span className="text-green-600">{openCount}</span>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
              
              <p className="text-xs text-gray-500 mt-3 text-center">
                💡 Compara cuándo envías emails (azul) vs cuándo los abren (verde) para optimizar timing
              </p>
              
              {/* Insights automáticos */}
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Mejor hora para enviar */}
                {data.stats.hourlyOpens.some(count => count > 0) && (
                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                    <div className="text-sm font-medium text-green-800 mb-1">
                      🏆 Mejor hora para enviar
                    </div>
                    <div className="text-sm text-green-700">
                      {data.stats.hourlyOpens.indexOf(Math.max(...data.stats.hourlyOpens))}:00h
                      <span className="text-xs ml-1">
                        ({Math.max(...data.stats.hourlyOpens)} aperturas)
                      </span>
                    </div>
                  </div>
                )}
                
                {/* Hora con más envíos */}
                {data.stats.hourlySent.some(count => count > 0) && (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="text-sm font-medium text-blue-800 mb-1">
                      📧 Hora de más envíos
                    </div>
                    <div className="text-sm text-blue-700">
                      {data.stats.hourlySent.indexOf(Math.max(...data.stats.hourlySent))}:00h
                      <span className="text-xs ml-1">
                        ({Math.max(...data.stats.hourlySent)} enviados)
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-8">
              
              {/* Performance por Tipo de Email */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
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
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
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
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
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
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
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
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
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
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">📊 Tendencias Diarias</h3>
              
              {/* Vista móvil: Cards */}
              <div className="block lg:hidden space-y-3">
                {Object.entries(data.stats.dailyTrends)
                  .sort(([a], [b]) => b.localeCompare(a))
                  .slice(0, 10)
                  .map(([date, stats]) => (
                  <div key={date} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="font-medium text-gray-900">{date}</h4>
                      <div className="text-sm text-gray-500">
                        {stats.sent > 0 ? ((stats.opened / stats.sent) * 100).toFixed(1) : 0}% open
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="text-gray-600">📤 Enviados:</span>
                        <span className="ml-1 font-semibold">{stats.sent || 0}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">📖 Abiertos:</span>
                        <span className="ml-1 font-semibold text-blue-600">{stats.opened || 0}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">👆 Clicks:</span>
                        <span className="ml-1 font-semibold text-green-600">{stats.clicked || 0}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">⚠️ Rebotes:</span>
                        <span className="ml-1 font-semibold text-red-600">{stats.bounced || 0}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Vista desktop: Tabla */}
              <div className="hidden lg:block overflow-x-auto">
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

            {/* Vista de Campañas Agrupadas */}
            {data?.groupedCampaigns && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                <div className="px-4 sm:px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-800">📧 Campañas de Email</h3>
                  <p className="text-sm text-gray-600">{data.groupedCampaigns.length} campañas encontradas</p>
                </div>
                
                {/* Vista móvil: Cards */}
                <div className="block lg:hidden p-4 space-y-4">
                  {data.groupedCampaigns.slice(0, 5).map((campaign, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h4 className="font-medium text-gray-900 text-sm mb-1">
                            {campaign.campaign_id || 'N/A'}
                          </h4>
                          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded ${
                            campaign.email_type === 'newsletter' ? 'bg-blue-50 text-blue-700' :
                            campaign.email_type === 'motivation' ? 'bg-green-50 text-green-700' :
                            campaign.email_type === 'achievement' ? 'bg-yellow-50 text-yellow-700' :
                            'bg-gray-50 text-gray-700'
                          }`}>
                            {campaign.email_type || 'N/A'}
                          </span>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-semibold text-green-600">{campaign.open_rate}%</div>
                          <div className="text-xs text-gray-500">open rate</div>
                        </div>
                      </div>
                      <p className="text-sm text-gray-600 mb-3 truncate">{campaign.subject || 'N/A'}</p>
                      <div className="grid grid-cols-3 gap-3 text-sm">
                        <div className="text-center">
                          <div className="font-semibold text-gray-900">{campaign.total_sent}</div>
                          <div className="text-xs text-gray-500">Enviados</div>
                        </div>
                        <div className="text-center">
                          <div className="font-semibold text-blue-600">{campaign.total_opened}</div>
                          <div className="text-xs text-gray-500">Abiertos</div>
                        </div>
                        <div className="text-center">
                          <div className="font-semibold text-green-600">{campaign.total_clicked}</div>
                          <div className="text-xs text-gray-500">Clicks</div>
                        </div>
                      </div>
                      <div className="mt-2 text-xs text-gray-500">
                        {new Date(campaign.created_at).toLocaleDateString('es-ES')}
                      </div>
                    </div>
                  ))}
                </div>
                
                {/* Vista desktop: Tabla */}
                <div className="hidden lg:block overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Campaña</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Plantilla</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Asunto</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Enviados</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Abiertos</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Clicks</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Open Rate</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">CTR</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {data.groupedCampaigns.map((campaign, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {campaign.campaign_id || 'N/A'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex px-2 py-1 text-xs font-medium rounded ${
                              campaign.email_type === 'newsletter' ? 'bg-blue-50 text-blue-700' :
                              campaign.email_type === 'motivation' ? 'bg-green-50 text-green-700' :
                              campaign.email_type === 'achievement' ? 'bg-yellow-50 text-yellow-700' :
                              'bg-gray-50 text-gray-700'
                            }`}>
                              {campaign.email_type || 'N/A'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {campaign.template_id || 'N/A'}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">
                            {campaign.subject || 'N/A'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            <span className="font-semibold">{campaign.total_sent}</span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600">
                            {campaign.total_opened}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600">
                            {campaign.total_clicked}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <span className={`font-semibold ${
                              parseFloat(campaign.open_rate) > 20 ? 'text-green-600' :
                              parseFloat(campaign.open_rate) > 10 ? 'text-yellow-600' :
                              'text-red-600'
                            }`}>
                              {campaign.open_rate}%
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <span className={`font-semibold ${
                              parseFloat(campaign.click_rate) > 5 ? 'text-green-600' :
                              parseFloat(campaign.click_rate) > 2 ? 'text-yellow-600' :
                              'text-red-600'
                            }`}>
                              {campaign.click_rate}%
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            {new Date(campaign.created_at).toLocaleDateString('es-ES')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Eventos Recientes */}
            {data?.events && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                <div className="px-4 sm:px-6 py-4 border-b border-gray-200">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center space-y-3 sm:space-y-0">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-800">🕐 Eventos Recientes</h3>
                      <p className="text-sm text-gray-600">
                        {data?.events?.length || 0} eventos de {data?.totalEvents || 0} totales
                        {emailTypeFilter !== 'all' && ` - Filtrado por: ${emailTypeFilter}`}
                      </p>
                    </div>
                    
                    {/* Controles de paginación */}
                    {data?.totalPages > 1 && (
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                          disabled={currentPage === 1}
                          className="px-2 sm:px-3 py-1 text-xs sm:text-sm border border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                        >
                          ←
                          <span className="hidden sm:inline ml-1">Anterior</span>
                        </button>
                        <span className="text-xs sm:text-sm text-gray-600">
                          {currentPage}/{data.totalPages}
                        </span>
                        <button
                          onClick={() => setCurrentPage(Math.min(data.totalPages, currentPage + 1))}
                          disabled={currentPage === data.totalPages}
                          className="px-2 sm:px-3 py-1 text-xs sm:text-sm border border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                        >
                          <span className="hidden sm:inline mr-1">Siguiente</span>
                          →
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Vista móvil: Cards */}
                <div className="block lg:hidden p-4 space-y-3">
                  {data.events.slice(0, 10).map((event, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-3">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-1">
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
                            <span className={`inline-flex px-2 py-1 text-xs font-medium rounded ${
                              event.email_type === 'newsletter' ? 'bg-blue-50 text-blue-700' :
                              event.email_type === 'motivation' ? 'bg-green-50 text-green-700' :
                              event.email_type === 'achievement' ? 'bg-yellow-50 text-yellow-700' :
                              'bg-gray-50 text-gray-700'
                            }`}>
                              {event.email_type || 'N/A'}
                            </span>
                          </div>
                          <p className="text-sm text-gray-900 font-medium truncate">
                            {event.email_address || event.user_profiles?.email || 'N/A'}
                          </p>
                          <p className="text-xs text-gray-600 truncate mt-1">
                            {event.subject || 'N/A'}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {new Date(event.created_at).toLocaleString('es-ES')}
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            setSelectedEmail(event)
                            setShowEmailModal(true)
                          }}
                          className="bg-blue-500 hover:bg-blue-600 text-white px-2 py-1 rounded text-xs transition-colors ml-2"
                        >
                          Ver
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                
                {/* Vista desktop: Tabla */}
                <div className="hidden lg:block overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tiempo</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Evento</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Template</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Campaña</th>
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
                              event.email_type === 'newsletter' ? 'bg-blue-50 text-blue-700' :
                              event.email_type === 'motivation' ? 'bg-green-50 text-green-700' :
                              event.email_type === 'achievement' ? 'bg-yellow-50 text-yellow-700' :
                              'bg-gray-50 text-gray-700'
                            }`}>
                              {event.email_type || 'N/A'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex px-2 py-1 text-xs font-medium rounded ${
                              event.template_id === 'newsletter' ? 'bg-blue-50 text-blue-700' :
                              event.template_id === 'comeback' ? 'bg-orange-50 text-orange-700' :
                              event.template_id === 'streak_risk' ? 'bg-red-50 text-red-700' :
                              event.template_id === 'medal_congratulation' ? 'bg-yellow-50 text-yellow-700' :
                              'bg-gray-50 text-gray-700'
                            }`}>
                              {event.template_id || 'N/A'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500">
                            {event.campaign_id || 'N/A'}
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
            )}

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