// app/admin/conversiones/page.js - Panel completo de tracking de conversiones
'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'

export default function ConversionesPage() {
  const { supabase } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState('funnel') // 'funnel' | 'ab-testing' | 'predictions'

  // Estados para predicciones
  const [predictionData, setPredictionData] = useState(null)
  const [loadingPredictions, setLoadingPredictions] = useState(false)

  // Estados para datos del funnel
  const [funnelStats, setFunnelStats] = useState([])
  const [registrationStats, setRegistrationStats] = useState({ total: 0, totalAllTime: 0, bySource: {} })
  const [timeAnalysis, setTimeAnalysis] = useState([])
  const [recentEvents, setRecentEvents] = useState([])
  const [dailyStats, setDailyStats] = useState([])
  const [selectedUser, setSelectedUser] = useState(null)
  const [userJourney, setUserJourney] = useState([])
  const [dateRange, setDateRange] = useState('7') // dias
  const [selectedStage, setSelectedStage] = useState(null)
  const [stageUsers, setStageUsers] = useState([])
  const [loadingStage, setLoadingStage] = useState(false)

  // Estados para A/B testing
  const [abStats, setAbStats] = useState([])
  const [abImpressions, setAbImpressions] = useState([])
  const [abTotals, setAbTotals] = useState({ impressions: 0, clicks: 0, conversions: 0 })

  // Cargar datos
  useEffect(() => {
    if (supabase) {
      loadAllData()
    }
  }, [supabase, dateRange])

  // Cargar datos de A/B testing cuando cambia el tab
  useEffect(() => {
    if (supabase && activeTab === 'ab-testing') {
      loadABTestingData()
    }
  }, [supabase, activeTab])

  // Cargar predicciones cuando cambia el tab
  useEffect(() => {
    if (activeTab === 'predictions') {
      loadPredictions()
    }
  }, [activeTab])

  const loadPredictions = async () => {
    setLoadingPredictions(true)
    try {
      const response = await fetch('/api/admin/sales-prediction')
      if (!response.ok) throw new Error('Error loading predictions')
      const data = await response.json()
      setPredictionData(data)
    } catch (err) {
      console.error('Error loading predictions:', err)
    } finally {
      setLoadingPredictions(false)
    }
  }

  const loadAllData = async () => {
    setLoading(true)
    setError(null)

    try {
      await Promise.all([
        loadMainStats(),
        loadFunnelStats(),
        loadTimeAnalysis()
      ])
    } catch (err) {
      console.error('Error loading data:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Cargar datos principales desde la API (usa service role para bypasear RLS)
  const loadMainStats = async () => {
    const response = await fetch(`/api/admin/conversion-stats?days=${dateRange}`)
    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || 'Error loading stats')
    }

    const data = await response.json()

    setRegistrationStats(data.registrations)
    setRecentEvents(data.events)
    setDailyStats(data.dailyStats)
  }

  const loadFunnelStats = async () => {
    // Intentar cargar la vista, si falla usar datos vacíos
    const { data, error } = await supabase
      .from('conversion_funnel_stats')
      .select('*')

    if (error) {
      console.log('Funnel stats view not available:', error.message)
      setFunnelStats([])
      return
    }
    setFunnelStats(data || [])
  }

  const loadTimeAnalysis = async () => {
    const { data, error } = await supabase
      .from('conversion_time_analysis')
      .select('*')

    if (error) {
      console.log('Time analysis view not available:', error.message)
      setTimeAnalysis([])
      return
    }
    setTimeAnalysis(data || [])
  }

  const loadUserJourney = async (userId) => {
    setSelectedUser(userId)

    const { data, error } = await supabase
      .rpc('get_user_conversion_journey', { p_user_id: userId })

    if (error) {
      console.error('Error loading journey:', error)
      return
    }

    setUserJourney(data || [])
  }

  // Cargar datos de A/B testing de mensajes
  const loadABTestingData = async () => {
    try {
      // Cargar estadisticas de mensajes
      const { data: messageStats, error: statsError } = await supabase
        .from('admin_upgrade_message_stats')
        .select('*')
        .order('total_impressions', { ascending: false })

      if (statsError) {
        console.error('Error cargando stats A/B:', statsError)
      } else {
        setAbStats(messageStats || [])

        // Calcular totales
        const totalImpressions = messageStats?.reduce((sum, m) => sum + (m.total_impressions || 0), 0) || 0
        const totalClicks = messageStats?.reduce((sum, m) => sum + (m.total_clicks || 0), 0) || 0
        const totalConversions = messageStats?.reduce((sum, m) => sum + (m.total_conversions || 0), 0) || 0

        setAbTotals({
          impressions: totalImpressions,
          clicks: totalClicks,
          conversions: totalConversions,
          avgClickRate: totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(1) : 0,
          avgConversionRate: totalImpressions > 0 ? ((totalConversions / totalImpressions) * 100).toFixed(1) : 0
        })
      }

      // Cargar impresiones recientes
      const { data: impressions, error: impError } = await supabase
        .from('upgrade_message_impressions')
        .select(`
          *,
          upgrade_messages(title, message_key)
        `)
        .order('shown_at', { ascending: false })
        .limit(20)

      if (!impError) {
        setAbImpressions(impressions || [])
      }
    } catch (err) {
      console.error('Error cargando A/B testing:', err)
    }
  }

  // Actualizar peso de un mensaje
  const updateMessageWeight = async (messageId, newWeight) => {
    const { error } = await supabase
      .from('upgrade_messages')
      .update({ weight: newWeight })
      .eq('id', messageId)

    if (!error) {
      loadABTestingData()
    }
  }

  // Activar/desactivar mensaje
  const toggleMessageActive = async (messageId, currentActive) => {
    const { error } = await supabase
      .from('upgrade_messages')
      .update({ is_active: !currentActive })
      .eq('id', messageId)

    if (!error) {
      loadABTestingData()
    }
  }

  // Cargar usuarios por etapa del funnel
  const loadStageUsers = async (stageKey, stageName) => {
    setSelectedStage({ key: stageKey, name: stageName })
    setLoadingStage(true)
    setStageUsers([])

    try {
      const response = await fetch(`/api/admin/funnel-users?stage=${stageKey}&days=${dateRange}&limit=100`)
      if (!response.ok) {
        throw new Error('Error loading users')
      }
      const data = await response.json()
      setStageUsers(data.users || [])
    } catch (err) {
      console.error('Error loading stage users:', err)
    } finally {
      setLoadingStage(false)
    }
  }

  // Calcular totales del funnel
  const getTotals = () => {
    // Totales históricos (todo el tiempo) de la vista
    const fromFunnelView = funnelStats.reduce((acc, row) => ({
      hit_limit: (acc.hit_limit || 0) + (row.hit_limit || 0),
      saw_modal: (acc.saw_modal || 0) + (row.saw_modal || 0),
      clicked_upgrade: (acc.clicked_upgrade || 0) + (row.clicked_upgrade || 0),
      visited_premium: (acc.visited_premium || 0) + (row.visited_premium || 0),
      started_checkout: (acc.started_checkout || 0) + (row.started_checkout || 0),
      paid: (acc.paid || 0) + (row.paid || 0)
    }), {})

    // Pagos del período seleccionado (de recentEvents, que ya está filtrado por fecha)
    const paidInPeriod = recentEvents.filter(e => e.event_type === 'payment_completed').length

    // Registros y primer test vienen de user_profiles (ya filtrados por período)
    return {
      registrations: registrationStats.total,
      completed_first_test: registrationStats.firstTestCompleted || 0,
      ...fromFunnelView,
      // Sobrescribir paid con el del período para cálculo correcto de tasa
      paidInPeriod
    }
  }

  const totals = getTotals()

  // Mapeo de nombres de eventos
  const eventNames = {
    'registration': 'Registro',
    'first_test_started': 'Primer test iniciado',
    'first_test_completed': 'Primer test completado',
    'test_completed': 'Test completado',
    'limit_reached': 'Limite alcanzado',
    'limit_warning': 'Aviso de limite',
    'upgrade_modal_viewed': 'Modal upgrade visto',
    'upgrade_button_clicked': 'Boton upgrade clic',
    'upgrade_banner_clicked': 'Banner upgrade clic',
    'premium_page_viewed': 'Pagina premium vista',
    'plan_selected': 'Plan seleccionado',
    'checkout_started': 'Checkout iniciado',
    'checkout_abandoned': 'Checkout abandonado',
    'payment_completed': 'Pago completado',
    'payment_failed': 'Pago fallido'
  }

  const eventColors = {
    'registration': 'bg-blue-100 text-blue-800',
    'first_test_completed': 'bg-green-100 text-green-800',
    'limit_reached': 'bg-yellow-100 text-yellow-800',
    'upgrade_modal_viewed': 'bg-orange-100 text-orange-800',
    'upgrade_button_clicked': 'bg-orange-200 text-orange-900',
    'premium_page_viewed': 'bg-purple-100 text-purple-800',
    'checkout_started': 'bg-indigo-100 text-indigo-800',
    'payment_completed': 'bg-emerald-100 text-emerald-800',
    'payment_failed': 'bg-red-100 text-red-800'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Cargando datos de conversion...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
        <h3 className="text-red-800 dark:text-red-200 font-bold mb-2">Error</h3>
        <p className="text-red-600 dark:text-red-300">{error}</p>
        <button
          onClick={loadAllData}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
        >
          Reintentar
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <span>💰</span>
            Conversiones
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Tracking del journey y A/B testing de mensajes
          </p>
        </div>

        {/* Filtro de fecha - solo para funnel */}
        {activeTab === 'funnel' && (
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600 dark:text-gray-400">Periodo:</label>
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            >
              <option value="1">Hoy</option>
              <option value="7">Ultimos 7 dias</option>
              <option value="30">Ultimos 30 dias</option>
              <option value="90">Ultimos 90 dias</option>
              <option value="365">Todo el ano</option>
            </select>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setActiveTab('funnel')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'funnel'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
          }`}
        >
          Funnel de Conversion
        </button>
        <button
          onClick={() => setActiveTab('ab-testing')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'ab-testing'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
          }`}
        >
          A/B Testing Mensajes
        </button>
        <button
          onClick={() => setActiveTab('predictions')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'predictions'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
          }`}
        >
          Predicciones
        </button>
      </div>

      {/* ===== TAB: FUNNEL DE CONVERSION ===== */}
      {activeTab === 'funnel' && (
        <>
      {/* Guia de Configuracion de Campañas */}
      <details className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
        <summary className="p-4 cursor-pointer font-bold text-blue-800 dark:text-blue-200 flex items-center gap-2">
          <span>📖</span>
          Guia: Como configurar URLs de campañas para tracking
        </summary>
        <div className="px-4 pb-4 space-y-4 text-sm">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
            <h4 className="font-bold text-purple-600 mb-2">📘 Meta Ads (Facebook/Instagram)</h4>
            <p className="text-gray-600 dark:text-gray-400 mb-2">URL destino en tu anuncio:</p>
            <code className="block bg-gray-100 dark:bg-gray-700 p-2 rounded text-xs break-all">
              https://vence.pro?utm_source=facebook&utm_medium=cpc&utm_campaign=NOMBRE_CAMPANA
            </code>
            <p className="text-gray-500 text-xs mt-2">Tambien detecta automaticamente el parametro fbclid que Meta añade.</p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
            <h4 className="font-bold text-blue-600 mb-2">🔍 Google Ads</h4>
            <p className="text-gray-600 dark:text-gray-400 mb-2">URL destino en tu anuncio:</p>
            <code className="block bg-gray-100 dark:bg-gray-700 p-2 rounded text-xs break-all">
              https://vence.pro?utm_source=google&utm_medium=cpc&utm_campaign=NOMBRE_CAMPANA
            </code>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
            <h4 className="font-bold text-green-600 mb-2">✅ Parametros detectados automaticamente</h4>
            <ul className="text-gray-600 dark:text-gray-400 space-y-1">
              <li><code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">utm_source=facebook|instagram|meta</code> → meta_ads</li>
              <li><code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">utm_source=google + utm_medium=cpc</code> → google_ads</li>
              <li><code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">fbclid</code> (automatico de Meta) → meta_ads</li>
              <li>Sin UTMs → organic</li>
            </ul>
          </div>

          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
            <h4 className="font-bold text-yellow-700 dark:text-yellow-300 mb-2">⚠️ Importante</h4>
            <ul className="text-yellow-600 dark:text-yellow-400 space-y-1 text-xs">
              <li>• El tracking se guarda cuando el usuario se REGISTRA (no en cada visita)</li>
              <li>• Si el usuario ya existe, mantiene su fuente original</li>
              <li>• Usa URLs sin espacios ni caracteres especiales en utm_campaign</li>
            </ul>
          </div>
        </div>
      </details>

      {/* Canales de Adquisicion */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <span>📣</span>
          Canales de Adquisicion
        </h2>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.entries(registrationStats.bySource).length === 0 ? (
            <div className="col-span-4 text-center py-4 text-gray-500">
              Sin datos en el periodo seleccionado
            </div>
          ) : (
            Object.entries(registrationStats.bySource)
              .sort((a, b) => b[1] - a[1])
              .map(([source, count]) => {
                const percentage = registrationStats.total > 0
                  ? ((count / registrationStats.total) * 100).toFixed(1)
                  : 0
                const colors = {
                  'organic': 'bg-green-50 dark:bg-green-900/20 text-green-600',
                  'google_ads': 'bg-blue-50 dark:bg-blue-900/20 text-blue-600',
                  'meta_ads': 'bg-purple-50 dark:bg-purple-900/20 text-purple-600',
                  'default': 'bg-gray-50 dark:bg-gray-700 text-gray-600'
                }
                const icons = {
                  'organic': '🌱',
                  'google_ads': '🔍',
                  'meta_ads': '📘'
                }
                return (
                  <div key={source} className={`p-4 rounded-lg ${colors[source] || colors.default}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span>{icons[source] || '📊'}</span>
                      <span className="font-medium capitalize">{source.replace('_', ' ')}</span>
                    </div>
                    <div className="text-3xl font-bold">{count}</div>
                    <div className="text-sm opacity-75">{percentage}% del total</div>
                  </div>
                )
              })
          )}
        </div>
      </div>

      {/* Funnel Visual Principal */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
          <span>📊</span>
          Funnel de Conversion (Totales)
        </h2>

        <div className="space-y-3">
          {[
            { key: 'registrations', label: 'Registros', icon: '👤', color: 'bg-blue-500' },
            { key: 'completed_first_test', label: 'Primer Test Completado', icon: '✅', color: 'bg-green-500' },
            { key: 'hit_limit', label: 'Limite Alcanzado', icon: '🚫', color: 'bg-yellow-500' },
            { key: 'saw_modal', label: 'Vio Modal Upgrade', icon: '👁️', color: 'bg-orange-500' },
            { key: 'clicked_upgrade', label: 'Clic en Upgrade', icon: '👆', color: 'bg-orange-600' },
            { key: 'visited_premium', label: 'Visito /premium', icon: '💎', color: 'bg-purple-500' },
            { key: 'started_checkout', label: 'Inicio Checkout', icon: '🛒', color: 'bg-indigo-500' },
            { key: 'paid', label: 'Pago Completado', icon: '💰', color: 'bg-emerald-500' }
          ].map((step, index, arr) => {
            const value = totals[step.key] || 0
            const prevValue = index > 0 ? (totals[arr[index - 1].key] || 0) : value
            const conversionRate = prevValue > 0 ? ((value / prevValue) * 100).toFixed(1) : 0
            const totalRate = totals.registrations > 0 ? ((value / totals.registrations) * 100).toFixed(1) : 0
            const barWidth = totals.registrations > 0 ? Math.max(5, (value / totals.registrations) * 100) : 0
            const isExpanded = selectedStage?.key === step.key

            return (
              <div key={step.key} className="relative">
                <div
                  className={`flex items-center gap-4 p-2 -mx-2 rounded-lg transition-colors ${
                    value > 0 ? 'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700/50' : ''
                  } ${isExpanded ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
                  onClick={() => {
                    if (value > 0) {
                      if (isExpanded) {
                        setSelectedStage(null)
                        setStageUsers([])
                      } else {
                        loadStageUsers(step.key, step.label)
                      }
                    }
                  }}
                  title={value > 0 ? `Clic para ver ${value} usuarios` : ''}
                >
                  <div className="w-10 text-2xl">{step.icon}</div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
                        {step.label}
                        {value > 0 && (
                          <span className={`text-xs ${isExpanded ? 'text-blue-600' : 'text-blue-500'}`}>
                            {isExpanded ? '▼ ocultar' : '▶ ver usuarios'}
                          </span>
                        )}
                      </span>
                      <div className="flex items-center gap-3">
                        <span className={`text-2xl font-bold ${value > 0 ? 'text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-white'}`}>
                          {value}
                        </span>
                        {index > 0 && (
                          <span className={`text-sm px-2 py-0.5 rounded ${
                            parseFloat(conversionRate) >= 50 ? 'bg-green-100 text-green-800' :
                            parseFloat(conversionRate) >= 20 ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {conversionRate}% del paso anterior
                          </span>
                        )}
                        <span className="text-xs text-gray-500">({totalRate}% total)</span>
                      </div>
                    </div>
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${step.color} transition-all duration-500`}
                        style={{ width: `${barWidth}%` }}
                      ></div>
                    </div>
                  </div>
                </div>

                {/* Panel expandido con usuarios */}
                {isExpanded && (
                  <div className="ml-12 mt-2 mb-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
                    {loadingStage ? (
                      <div className="text-center py-4">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2"></div>
                        <p className="text-sm text-gray-500">Cargando usuarios...</p>
                      </div>
                    ) : stageUsers.length === 0 ? (
                      <p className="text-center text-gray-500 py-4">No hay usuarios en esta etapa</p>
                    ) : (
                      <div className="max-h-[400px] overflow-y-auto">
                        <table className="w-full text-sm">
                          <thead className="sticky top-0 bg-gray-50 dark:bg-gray-700">
                            <tr className="border-b border-gray-200 dark:border-gray-600">
                              <th className="text-left py-2 px-2 font-semibold text-gray-600 dark:text-gray-400">Email</th>
                              <th className="text-left py-2 px-2 font-semibold text-gray-600 dark:text-gray-400">Nombre</th>
                              <th className="text-left py-2 px-2 font-semibold text-gray-600 dark:text-gray-400">Plan</th>
                              <th className="text-left py-2 px-2 font-semibold text-gray-600 dark:text-gray-400">Fuente</th>
                              <th className="text-left py-2 px-2 font-semibold text-gray-600 dark:text-gray-400">Fecha</th>
                              <th className="text-center py-2 px-2 font-semibold text-gray-600 dark:text-gray-400">Journey</th>
                            </tr>
                          </thead>
                          <tbody>
                            {stageUsers.map((user, i) => (
                              <tr
                                key={user.id || i}
                                className="border-b border-gray-100 dark:border-gray-600/50 hover:bg-white dark:hover:bg-gray-600/50"
                              >
                                <td className="py-2 px-2 text-gray-900 dark:text-white">{user.email}</td>
                                <td className="py-2 px-2 text-gray-600 dark:text-gray-300">{user.full_name || '-'}</td>
                                <td className="py-2 px-2">
                                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                    user.plan_type === 'premium' ? 'bg-amber-100 text-amber-800' :
                                    user.plan_type === 'free' ? 'bg-gray-200 text-gray-700' :
                                    'bg-blue-100 text-blue-800'
                                  }`}>
                                    {user.plan_type}
                                  </span>
                                </td>
                                <td className="py-2 px-2 text-gray-500 text-xs">{user.registration_source || 'organic'}</td>
                                <td className="py-2 px-2 text-gray-500 text-xs">
                                  {user.event_at
                                    ? new Date(user.event_at).toLocaleDateString('es-ES')
                                    : user.created_at
                                      ? new Date(user.created_at).toLocaleDateString('es-ES')
                                      : '-'}
                                </td>
                                <td className="py-2 px-2 text-center">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      loadUserJourney(user.id)
                                    }}
                                    className="text-blue-600 hover:text-blue-800 text-xs font-medium hover:underline"
                                  >
                                    Ver
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {stageUsers.length >= 100 && (
                          <p className="text-xs text-gray-400 text-center mt-2">Mostrando primeros 100 usuarios</p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {index < arr.length - 1 && !isExpanded && (
                  <div className="ml-5 h-4 border-l-2 border-dashed border-gray-300 dark:border-gray-600"></div>
                )}
              </div>
            )
          })}
        </div>

        {/* Resumen de conversion */}
        <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <div className="text-3xl font-bold text-blue-600">{totals.registrations || 0}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Total Registros</div>
            </div>
            <div className="text-center p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
              <div className="text-3xl font-bold text-yellow-600">{totals.hit_limit || 0}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Llegaron al Limite</div>
            </div>
            <div className="text-center p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
              <div className="text-3xl font-bold text-purple-600">{totals.visited_premium || 0}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Visitaron Premium</div>
            </div>
            <div className="text-center p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
              <div className="text-3xl font-bold text-emerald-600">{totals.paidInPeriod || 0}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Pagos en Periodo</div>
              {totals.paid > 0 && totals.paid !== totals.paidInPeriod && (
                <div className="text-xs text-gray-500 mt-1">({totals.paid} total historico)</div>
              )}
            </div>
          </div>

          {totals.registrations > 0 && (
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Tasa del período */}
              <div className="text-center p-4 bg-gradient-to-r from-emerald-500 to-green-600 rounded-lg text-white">
                <div className="text-3xl font-bold">
                  {totals.paidInPeriod > 0
                    ? ((totals.paidInPeriod / totals.registrations) * 100).toFixed(2)
                    : '0.00'}%
                </div>
                <div className="text-sm opacity-90">Conversion ultimos {dateRange} dias</div>
                <div className="text-xs opacity-75 mt-1">
                  {totals.paidInPeriod} pagos / {totals.registrations} registros
                </div>
              </div>
              {/* Tasa histórica */}
              <div className="text-center p-4 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg text-white">
                <div className="text-3xl font-bold">
                  {totals.paid > 0 && registrationStats.totalAllTime > 0
                    ? ((totals.paid / registrationStats.totalAllTime) * 100).toFixed(2)
                    : '0.00'}%
                </div>
                <div className="text-sm opacity-90">Conversion historica total</div>
                <div className="text-xs opacity-75 mt-1">
                  {totals.paid} pagos / {registrationStats.totalAllTime || 0} usuarios
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Funnel por Fuente */}
      {funnelStats.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <span>🎯</span>
            Funnel por Fuente de Registro
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-3 px-2 font-semibold text-gray-600 dark:text-gray-400">Fuente</th>
                  <th className="text-right py-3 px-2 font-semibold text-gray-600 dark:text-gray-400">Registros</th>
                  <th className="text-right py-3 px-2 font-semibold text-gray-600 dark:text-gray-400">1er Test</th>
                  <th className="text-right py-3 px-2 font-semibold text-gray-600 dark:text-gray-400">Limite</th>
                  <th className="text-right py-3 px-2 font-semibold text-gray-600 dark:text-gray-400">Modal</th>
                  <th className="text-right py-3 px-2 font-semibold text-gray-600 dark:text-gray-400">Premium</th>
                  <th className="text-right py-3 px-2 font-semibold text-gray-600 dark:text-gray-400">Checkout</th>
                  <th className="text-right py-3 px-2 font-semibold text-gray-600 dark:text-gray-400">Pagos</th>
                  <th className="text-right py-3 px-2 font-semibold text-gray-600 dark:text-gray-400">% Conv.</th>
                </tr>
              </thead>
              <tbody>
                {funnelStats.map((row, i) => (
                  <tr key={i} className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="py-3 px-2 font-medium text-gray-900 dark:text-white">
                      {row.registration_source || 'Sin fuente'}
                    </td>
                    <td className="text-right py-3 px-2 text-gray-600 dark:text-gray-300">{row.registrations || 0}</td>
                    <td className="text-right py-3 px-2 text-gray-600 dark:text-gray-300">{row.completed_first_test || 0}</td>
                    <td className="text-right py-3 px-2 text-gray-600 dark:text-gray-300">{row.hit_limit || 0}</td>
                    <td className="text-right py-3 px-2 text-gray-600 dark:text-gray-300">{row.saw_modal || 0}</td>
                    <td className="text-right py-3 px-2 text-gray-600 dark:text-gray-300">{row.visited_premium || 0}</td>
                    <td className="text-right py-3 px-2 text-gray-600 dark:text-gray-300">{row.started_checkout || 0}</td>
                    <td className="text-right py-3 px-2 font-bold text-emerald-600">{row.paid || 0}</td>
                    <td className="text-right py-3 px-2">
                      <span className={`px-2 py-1 rounded text-xs font-bold ${
                        (row.conversion_rate || 0) >= 5 ? 'bg-green-100 text-green-800' :
                        (row.conversion_rate || 0) >= 1 ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {row.conversion_rate || 0}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tiempo hasta Conversion */}
      {timeAnalysis.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <span>⏱️</span>
            Tiempo hasta Conversion
          </h2>

          <div className="grid md:grid-cols-3 gap-4">
            {timeAnalysis.map((row, i) => (
              <div key={i} className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                  {row.registration_source || 'Sin fuente'}
                </div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {Math.round(row.avg_days_to_convert || 0)} dias
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Min: {row.min_days || 0}d | Max: {row.max_days || 0}d | Total: {row.total_conversions || 0}
                </div>
              </div>
            ))}
          </div>

          {/* Nota explicativa */}
          <div className="mt-4 text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/30 rounded-lg p-3">
            <span className="font-medium">Nota:</span> La primera venta (23/12/2025) tenia 63 dias porque el usuario usaba la app antes de implementar pagos, distorsionando la media (18d vs 10d reales). Se deja la BD sin modificar ya que se corregira automaticamente con mas ventas.
          </div>
        </div>
      )}

      {/* Stats por Dia */}
      {dailyStats.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <span>📅</span>
            Eventos por Dia
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-3 px-2 font-semibold text-gray-600 dark:text-gray-400">Fecha</th>
                  <th className="text-right py-3 px-2 font-semibold text-gray-600 dark:text-gray-400">Limite</th>
                  <th className="text-right py-3 px-2 font-semibold text-gray-600 dark:text-gray-400">Modal</th>
                  <th className="text-right py-3 px-2 font-semibold text-gray-600 dark:text-gray-400">Clic Upgrade</th>
                  <th className="text-right py-3 px-2 font-semibold text-gray-600 dark:text-gray-400">Premium</th>
                  <th className="text-right py-3 px-2 font-semibold text-gray-600 dark:text-gray-400">Checkout</th>
                  <th className="text-right py-3 px-2 font-semibold text-gray-600 dark:text-gray-400">Pagos</th>
                </tr>
              </thead>
              <tbody>
                {dailyStats.slice(0, 14).map((day, i) => (
                  <tr key={i} className="border-b border-gray-100 dark:border-gray-700/50">
                    <td className="py-3 px-2 font-medium text-gray-900 dark:text-white">{day.date}</td>
                    <td className="text-right py-3 px-2 text-gray-600 dark:text-gray-300">{day.limit_reached || 0}</td>
                    <td className="text-right py-3 px-2 text-gray-600 dark:text-gray-300">{day.upgrade_modal_viewed || 0}</td>
                    <td className="text-right py-3 px-2 text-gray-600 dark:text-gray-300">{day.upgrade_button_clicked || 0}</td>
                    <td className="text-right py-3 px-2 text-gray-600 dark:text-gray-300">{day.premium_page_viewed || 0}</td>
                    <td className="text-right py-3 px-2 text-gray-600 dark:text-gray-300">{day.checkout_started || 0}</td>
                    <td className="text-right py-3 px-2 font-bold text-emerald-600">{day.payment_completed || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Eventos Recientes */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <span>📋</span>
          Eventos Recientes ({recentEvents.length})
        </h2>

        {recentEvents.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <div className="text-4xl mb-2">📭</div>
            <p>No hay eventos en el periodo seleccionado</p>
            <p className="text-sm mt-1">Los eventos se registraran cuando los usuarios interactuen con el sistema de limites</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {recentEvents.map((event, i) => (
              <div
                key={i}
                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
                onClick={() => loadUserJourney(event.user_id)}
              >
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${eventColors[event.event_type] || 'bg-gray-100 text-gray-800'}`}>
                    {eventNames[event.event_type] || event.event_type}
                  </span>
                  <span className="text-sm text-gray-600 dark:text-gray-300">
                    {event.user_profiles?.email || event.user_id?.substring(0, 8) + '...'}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  {event.days_since_registration !== null && (
                    <span className="text-xs text-gray-500">
                      Dia {event.days_since_registration}
                    </span>
                  )}
                  <span className="text-xs text-gray-400">
                    {new Date(event.created_at).toLocaleString('es-ES')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal Journey Usuario */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedUser(null)}>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <span>🛤️</span>
                Journey del Usuario
              </h3>
              <button
                onClick={() => setSelectedUser(null)}
                className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                ✕
              </button>
            </div>

            <div className="p-4 overflow-y-auto max-h-[60vh]">
              {userJourney.length === 0 ? (
                <p className="text-gray-500 text-center py-4">Cargando journey...</p>
              ) : (
                <div className="space-y-3">
                  {userJourney.map((event, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center text-sm font-bold text-blue-600">
                        {i + 1}
                      </div>
                      <div className="flex-1 pb-3 border-b border-gray-100 dark:border-gray-700/50">
                        <div className="flex items-center justify-between">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${eventColors[event.event_type] || 'bg-gray-100 text-gray-800'}`}>
                            {eventNames[event.event_type] || event.event_type}
                          </span>
                          <span className="text-xs text-gray-400">
                            Dia {event.days_since_registration} • {new Date(event.created_at).toLocaleString('es-ES')}
                          </span>
                        </div>
                        {event.event_data && Object.keys(event.event_data).length > 0 && (
                          <pre className="mt-2 text-xs text-gray-500 bg-gray-50 dark:bg-gray-700/50 p-2 rounded overflow-x-auto">
                            {JSON.stringify(event.event_data, null, 2)}
                          </pre>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
        </>
      )}

      {/* ===== TAB: A/B TESTING DE MENSAJES ===== */}
      {activeTab === 'ab-testing' && (
        <>
          {/* Totales A/B */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="text-3xl font-bold text-gray-900 dark:text-white">{abTotals.impressions}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Impresiones totales</div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="text-3xl font-bold text-blue-600">{abTotals.clicks}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Clics en upgrade</div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="text-3xl font-bold text-green-600">{abTotals.conversions}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Conversiones</div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="text-3xl font-bold text-purple-600">{abTotals.avgClickRate}%</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">CTR promedio</div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="text-3xl font-bold text-orange-600">{abTotals.avgConversionRate}%</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Conversion rate</div>
            </div>
          </div>

          {/* Tabla de mensajes */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Rendimiento por Mensaje</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Mensajes que se muestran cuando el usuario toca el limite diario
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700/50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Mensaje</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Estado</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Peso</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Impresiones</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Clics</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">CTR</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Conversiones</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">CVR</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {abStats.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                        No hay datos de A/B testing. Ejecuta la migracion SQL primero.
                      </td>
                    </tr>
                  ) : (
                    abStats.map((msg) => (
                      <tr key={msg.id} className={!msg.is_active ? 'bg-gray-50 dark:bg-gray-800/50 opacity-60' : ''}>
                        <td className="px-6 py-4">
                          <div className="font-medium text-gray-900 dark:text-white">{msg.title}</div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">{msg.message_key}</div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`inline-flex px-2 py-1 text-xs rounded-full ${
                            msg.is_active
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                              : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400'
                          }`}>
                            {msg.is_active ? 'Activo' : 'Inactivo'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <select
                            value={msg.weight}
                            onChange={(e) => updateMessageWeight(msg.id, parseInt(e.target.value))}
                            className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          >
                            {[1, 2, 3, 4, 5].map(w => (
                              <option key={w} value={w}>{w}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-6 py-4 text-center font-medium text-gray-900 dark:text-white">{msg.total_impressions || 0}</td>
                        <td className="px-6 py-4 text-center text-blue-600 font-medium">{msg.total_clicks || 0}</td>
                        <td className="px-6 py-4 text-center">
                          <span className={`font-medium ${
                            (msg.click_rate || 0) > 30 ? 'text-green-600' :
                            (msg.click_rate || 0) > 20 ? 'text-yellow-600' : 'text-red-600'
                          }`}>
                            {msg.click_rate || 0}%
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center text-green-600 font-medium">{msg.total_conversions || 0}</td>
                        <td className="px-6 py-4 text-center">
                          <span className={`font-medium ${
                            (msg.conversion_rate || 0) > 5 ? 'text-green-600' :
                            (msg.conversion_rate || 0) > 2 ? 'text-yellow-600' : 'text-gray-600 dark:text-gray-400'
                          }`}>
                            {msg.conversion_rate || 0}%
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <button
                            onClick={() => toggleMessageActive(msg.id, msg.is_active)}
                            className={`text-sm px-3 py-1 rounded ${
                              msg.is_active
                                ? 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400'
                                : 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400'
                            }`}
                          >
                            {msg.is_active ? 'Desactivar' : 'Activar'}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Impresiones recientes */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Impresiones Recientes</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700/50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Fecha</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Mensaje</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Preguntas</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Clic Upgrade</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Dismiss</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Convertido</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {abImpressions.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                        No hay impresiones registradas aun
                      </td>
                    </tr>
                  ) : (
                    abImpressions.map((imp) => (
                      <tr key={imp.id}>
                        <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">
                          {new Date(imp.shown_at).toLocaleString('es-ES')}
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {imp.upgrade_messages?.title || 'N/A'}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {imp.upgrade_messages?.message_key || 'N/A'}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center text-sm text-gray-600 dark:text-gray-300">{imp.questions_answered || '-'}</td>
                        <td className="px-6 py-4 text-center">
                          {imp.clicked_upgrade ? (
                            <span className="text-green-600">Si</span>
                          ) : (
                            <span className="text-gray-400">No</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-center">
                          {imp.dismissed ? (
                            <span className="text-red-600">Si</span>
                          ) : (
                            <span className="text-gray-400">No</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-center">
                          {imp.converted_to_premium ? (
                            <span className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 px-2 py-1 rounded-full text-xs font-medium">
                              Premium
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Info */}
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-6 border border-blue-200 dark:border-blue-800">
            <h3 className="font-bold text-blue-900 dark:text-blue-200 mb-2">Como funciona el A/B Testing</h3>
            <ul className="text-sm text-blue-800 dark:text-blue-300 space-y-1">
              <li>Cada vez que un usuario toca el limite diario, se muestra un mensaje aleatorio</li>
              <li>El peso determina la probabilidad de que aparezca (peso 2 = doble probabilidad que peso 1)</li>
              <li>CTR = porcentaje de usuarios que hacen clic en "Upgrade"</li>
              <li>CVR = porcentaje de usuarios que terminan comprando premium</li>
              <li>Desactiva los mensajes con bajo rendimiento y aumenta el peso de los mejores</li>
            </ul>
          </div>
        </>
      )}

      {/* ===== TAB: PREDICCIONES ===== */}
      {activeTab === 'predictions' && (
        <div className="space-y-6">
          {loadingPredictions ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : predictionData ? (
            <>
              {/* Calidad de la prediccion */}
              <div className={`rounded-xl p-4 border ${
                predictionData.quality.reliability === 'alta'
                  ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                  : predictionData.quality.reliability === 'media'
                  ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
                  : 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800'
              }`}>
                <div className="flex items-center gap-2">
                  <span className="text-2xl">
                    {predictionData.quality.reliability === 'alta' ? '🎯' : predictionData.quality.reliability === 'media' ? '📊' : '⚠️'}
                  </span>
                  <div>
                    <div className="font-bold text-gray-900 dark:text-white">
                      Fiabilidad: {predictionData.quality.reliability.toUpperCase()}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {predictionData.quality.message}
                    </div>
                  </div>
                </div>
              </div>

              {/* 3 MÉTODOS DE PROYECCIÓN DE VENTAS */}
              {predictionData.projectionMethods && (
                <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-gray-900 dark:text-white">
                    <span>🔮</span>
                    3 Métodos de Proyección de Ventas
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    {/* Método 1: Por registros */}
                    <div className="border border-blue-200 dark:border-blue-800 rounded-lg p-4 bg-blue-50 dark:bg-blue-900/20">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xl">📊</span>
                        <span className="font-bold text-blue-700 dark:text-blue-300">
                          {predictionData.projectionMethods.byRegistrations.name}
                        </span>
                      </div>
                      <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                        {predictionData.projectionMethods.byRegistrations.salesPerMonth.toFixed(1)}
                        <span className="text-lg font-normal text-gray-500 dark:text-gray-400"> ventas/mes</span>
                      </div>
                      <div className="text-lg font-semibold text-green-600 dark:text-green-400">
                        {predictionData.projectionMethods.byRegistrations.revenuePerMonth.toFixed(0)}€/mes
                      </div>
                      <div className="mt-3 text-xs text-gray-600 dark:text-gray-400 space-y-1">
                        <div className="font-medium">{predictionData.projectionMethods.byRegistrations.description}</div>
                        <div>• {predictionData.projectionMethods.byRegistrations.inputs.dailyRegistrations} registros/día</div>
                        <div>• {predictionData.projectionMethods.byRegistrations.inputs.conversionRate}% tasa conversión</div>
                      </div>
                      <div className="mt-2 text-xs text-blue-600 dark:text-blue-400 font-medium">
                        ✓ {predictionData.projectionMethods.byRegistrations.bestFor}
                      </div>
                    </div>

                    {/* Método 2: Por activos */}
                    <div className="border border-purple-200 dark:border-purple-800 rounded-lg p-4 bg-purple-50 dark:bg-purple-900/20">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xl">👥</span>
                        <span className="font-bold text-purple-700 dark:text-purple-300">
                          {predictionData.projectionMethods.byActiveUsers.name}
                        </span>
                      </div>
                      <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                        {predictionData.projectionMethods.byActiveUsers.salesPerMonth.toFixed(1)}
                        <span className="text-lg font-normal text-gray-500 dark:text-gray-400"> ventas/mes</span>
                      </div>
                      <div className="text-lg font-semibold text-green-600 dark:text-green-400">
                        {predictionData.projectionMethods.byActiveUsers.revenuePerMonth.toFixed(0)}€/mes
                      </div>
                      <div className="mt-3 text-xs text-gray-600 dark:text-gray-400 space-y-1">
                        <div className="font-medium">{predictionData.projectionMethods.byActiveUsers.description}</div>
                        <div>• {predictionData.projectionMethods.byActiveUsers.inputs.activeFreeUsers} usuarios FREE activos</div>
                        <div>• {predictionData.projectionMethods.byActiveUsers.inputs.weeklyConversionRate}% conv. semanal</div>
                      </div>
                      <div className="mt-2 text-xs text-purple-600 dark:text-purple-400 font-medium">
                        ✓ {predictionData.projectionMethods.byActiveUsers.bestFor}
                      </div>
                    </div>

                    {/* Método 3: Por histórico */}
                    <div className="border border-amber-200 dark:border-amber-800 rounded-lg p-4 bg-amber-50 dark:bg-amber-900/20">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xl">📈</span>
                        <span className="font-bold text-amber-700 dark:text-amber-300">
                          {predictionData.projectionMethods.byHistoric.name}
                        </span>
                      </div>
                      <div className="text-3xl font-bold text-amber-600 dark:text-amber-400">
                        {predictionData.projectionMethods.byHistoric.salesPerMonth.toFixed(1)}
                        <span className="text-lg font-normal text-gray-500 dark:text-gray-400"> ventas/mes</span>
                      </div>
                      <div className="text-lg font-semibold text-green-600 dark:text-green-400">
                        {predictionData.projectionMethods.byHistoric.revenuePerMonth.toFixed(0)}€/mes
                      </div>
                      <div className="mt-3 text-xs text-gray-600 dark:text-gray-400 space-y-1">
                        <div className="font-medium">{predictionData.projectionMethods.byHistoric.description}</div>
                        <div>• {predictionData.projectionMethods.byHistoric.inputs.avgDaysBetweenPayments || '?'} días entre pagos</div>
                      </div>
                      <div className="mt-2 text-xs text-amber-600 dark:text-amber-400 font-medium">
                        ✓ {predictionData.projectionMethods.byHistoric.bestFor}
                      </div>
                    </div>
                  </div>

                  {/* Proyección combinada */}
                  <div className="bg-gradient-to-r from-emerald-500 to-teal-600 rounded-lg p-4 text-white">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm opacity-90 mb-1">📊 Proyección Combinada (promedio de {predictionData.projectionMethods.combined.methodsUsed} métodos)</div>
                        <div className="text-3xl font-bold">
                          {predictionData.projectionMethods.combined.salesPerMonth.toFixed(1)} ventas/mes
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm opacity-90 mb-1">Ingresos esperados</div>
                        <div className="text-3xl font-bold">
                          {predictionData.projectionMethods.combined.revenuePerMonth.toFixed(0)}€/mes
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Info sobre tipos de conversión */}
                  {predictionData.conversionByActivity?.conversionType && (
                    <div className="mt-4 text-xs text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700 pt-3">
                      <span className="font-medium">Tipos de conversión:</span>
                      {' '}{predictionData.conversionByActivity.conversionType.sameDay} usuarios pagaron el día 0 ({predictionData.conversionByActivity.conversionType.sameDayPercent}%),
                      {' '}{predictionData.conversionByActivity.conversionType.afterTrying} probaron antes de pagar
                    </div>
                  )}
                </div>
              )}

              {/* Metricas principales */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Tasa de conversion real */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                    Tasa de Conversion Real
                  </h3>
                  <div className="text-4xl font-bold text-emerald-600">
                    {(predictionData.conversion.rate * 100).toFixed(2)}%
                  </div>
                  <div className="text-sm text-gray-500 mt-1">
                    {predictionData.conversion.uniquePayingUsers} de {predictionData.conversion.totalUsers} usuarios
                  </div>
                  <div className="mt-2 text-xs text-gray-400 bg-gray-100 dark:bg-gray-700 rounded p-2">
                    <div className="font-medium mb-1">Intervalo de confianza 95%:</div>
                    <div>La tasa real esta entre <strong>{(predictionData.conversion.confidenceInterval.lower * 100).toFixed(1)}%</strong> y <strong>{(predictionData.conversion.confidenceInterval.upper * 100).toFixed(1)}%</strong></div>
                    <div className="mt-1 opacity-75">Con mas ventas, este rango se estrecha y la prediccion mejora</div>
                  </div>
                  <div className="mt-2 text-xs text-gray-500">
                    Tiempo medio: {predictionData.conversion.avgDaysToConvert} dias hasta pagar
                  </div>
                </div>

                {/* Probabilidad de proxima venta */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                    Probabilidad Proxima Venta
                  </h3>
                  <div className="text-4xl font-bold text-blue-600">
                    {(predictionData.prediction.probability * 100).toFixed(0)}%
                  </div>
                  <div className="text-sm text-gray-500 mt-1">
                    Pool: {predictionData.current.pool.total} usuarios sin pagar
                  </div>
                  <div className="mt-2 text-xs text-gray-400">
                    IC: {(predictionData.prediction.probabilityCI.lower * 100).toFixed(0)}% - {(predictionData.prediction.probabilityCI.upper * 100).toFixed(0)}%
                  </div>
                  {/* Barra de progreso */}
                  <div className="mt-3">
                    <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 transition-all duration-500"
                        style={{ width: `${Math.min(predictionData.prediction.probability * 100, 100)}%` }}
                      ></div>
                    </div>
                  </div>
                </div>

                {/* Dias desde ultimo pago */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                    Dias Desde Ultimo Pago
                  </h3>
                  <div className="text-4xl font-bold text-purple-600">
                    {predictionData.current.daysSinceLastPayment || 0}
                  </div>
                  <div className="text-sm text-gray-500 mt-1">
                    Promedio historico: {predictionData.trend.avgDaysBetweenPayments || '?'} dias
                  </div>
                  {predictionData.trend.avgDaysBetweenPayments && (
                    <div className="mt-3">
                      <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-500 ${
                            predictionData.current.daysSinceLastPayment > predictionData.trend.avgDaysBetweenPayments
                              ? 'bg-orange-500'
                              : 'bg-green-500'
                          }`}
                          style={{
                            width: `${Math.min((predictionData.current.daysSinceLastPayment / predictionData.trend.avgDaysBetweenPayments) * 100, 100)}%`
                          }}
                        ></div>
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        {predictionData.current.daysSinceLastPayment > predictionData.trend.avgDaysBetweenPayments
                          ? 'Por encima del promedio'
                          : 'Dentro del promedio'}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Estimaciones */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <span>📈</span>
                  Estimaciones de Proxima Venta
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Registros necesarios */}
                  <div>
                    <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-3">Usuarios Necesarios Para:</h4>
                    <div className="space-y-3">
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>50% probabilidad</span>
                          <span className="font-medium">{predictionData.prediction.registrationsFor50} usuarios</span>
                        </div>
                        <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-yellow-500"
                            style={{ width: `${Math.min((predictionData.current.pool.total / predictionData.prediction.registrationsFor50) * 100, 100)}%` }}
                          ></div>
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>75% probabilidad</span>
                          <span className="font-medium">{predictionData.prediction.registrationsFor75} usuarios</span>
                        </div>
                        <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-orange-500"
                            style={{ width: `${Math.min((predictionData.current.pool.total / predictionData.prediction.registrationsFor75) * 100, 100)}%` }}
                          ></div>
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>90% probabilidad</span>
                          <span className="font-medium">{predictionData.prediction.registrationsFor90} usuarios</span>
                        </div>
                        <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-red-500"
                            style={{ width: `${Math.min((predictionData.current.pool.total / predictionData.prediction.registrationsFor90) * 100, 100)}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 text-sm text-gray-500">
                      Pool actual: {predictionData.current.pool.total} usuarios sin pagar
                    </div>
                  </div>

                  {/* Usuarios en proceso */}
                  <div>
                    <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-3">Pool de Usuarios (sin pagar):</h4>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                        <div>
                          <div className="font-medium text-green-700 dark:text-green-300">Nuevos (0-7 dias)</div>
                          <div className="text-xs text-green-600 dark:text-green-400">Recien llegados</div>
                        </div>
                        <div className="text-2xl font-bold text-green-600">{predictionData.current.pool.new}</div>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                        <div>
                          <div className="font-medium text-yellow-700 dark:text-yellow-300">Activos (7-30 dias)</div>
                          <div className="text-xs text-yellow-600 dark:text-yellow-400">Probando la app</div>
                        </div>
                        <div className="text-2xl font-bold text-yellow-600">{predictionData.current.pool.active}</div>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                        <div>
                          <div className="font-medium text-gray-700 dark:text-gray-300">Dormidos (30+ dias)</div>
                          <div className="text-xs text-gray-600 dark:text-gray-400">Baja probabilidad</div>
                        </div>
                        <div className="text-2xl font-bold text-gray-600">{predictionData.current.pool.dormant}</div>
                      </div>
                    </div>
                    <div className="mt-3 text-sm text-gray-500">
                      Velocidad: {predictionData.prediction.dailyRegistrationRate} registros/dia
                    </div>
                  </div>
                </div>
              </div>

              {/* MRR y Proyecciones de Facturación */}
              {predictionData.mrr && (
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <span>💰</span>
                    MRR y Proyecciones de Facturación
                  </h3>

                  {/* MRR Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="text-center p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-200 dark:border-emerald-800">
                      <div className="text-3xl font-bold text-emerald-600">{predictionData.mrr.current.toFixed(2)}€</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">MRR (mensual)</div>
                    </div>
                    <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                      <div className="text-3xl font-bold text-blue-600">{predictionData.mrr.arr.toFixed(0)}€</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">ARR (anual)</div>
                    </div>
                    <div className="text-center p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
                      <div className="text-3xl font-bold text-purple-600">{predictionData.mrr.activeSubscriptions}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">Suscripciones activas</div>
                    </div>
                    <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                      <div className="text-3xl font-bold text-gray-600 dark:text-gray-300">{predictionData.mrr.cancelingSubscriptions}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">Cancelando</div>
                    </div>
                  </div>

                  {/* Proyección MRR */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <div className="p-4 bg-gradient-to-r from-green-500 to-emerald-600 rounded-lg text-white">
                      <div className="text-sm opacity-90 mb-1">MRR en 6 meses</div>
                      <div className="text-3xl font-bold">{predictionData.mrr.in6Months?.toFixed(0) || 0}€/mes</div>
                      <div className="text-xs opacity-75 mt-1">
                        {predictionData.mrr.current}€ actual + {((predictionData.mrr.in6Months || 0) - predictionData.mrr.current).toFixed(0)}€ nuevas subs
                      </div>
                      <div className="text-xs opacity-60 mt-1">
                        ARR: {predictionData.mrr.arrIn6Months?.toFixed(0) || 0}€/año
                      </div>
                    </div>
                    <div className="p-4 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg text-white">
                      <div className="text-sm opacity-90 mb-1">MRR en 12 meses</div>
                      <div className="text-3xl font-bold">{predictionData.mrr.in12Months?.toFixed(0) || 0}€/mes</div>
                      <div className="text-xs opacity-75 mt-1">
                        {predictionData.mrr.current}€ actual + {((predictionData.mrr.in12Months || 0) - predictionData.mrr.current).toFixed(0)}€ nuevas subs
                      </div>
                      <div className="text-xs opacity-60 mt-1">
                        ARR: {predictionData.mrr.arrIn12Months?.toFixed(0) || 0}€/año
                      </div>
                    </div>
                  </div>

                  {/* Calendario de renovaciones */}
                  {predictionData.renewals && (
                  <div>
                    <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-3">Renovaciones por mes</h4>
                    <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                      {predictionData.renewals.byMonth.slice(0, 6).map((month, i) => (
                        <div
                          key={i}
                          className={`text-center p-3 rounded-lg border ${
                            month.renewals > 0
                              ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                              : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600'
                          }`}
                        >
                          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">{month.month}</div>
                          <div className={`text-lg font-bold ${month.renewals > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                            {month.revenue}€
                          </div>
                          <div className="text-xs text-gray-400">
                            {month.renewals} {month.renewals === 1 ? 'renovación' : 'renovaciones'}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  )}

                  <div className="mt-4 text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 rounded p-2">
                    <strong>Nota:</strong> MRR proyectado asume 0% churn. Cada nueva suscripción añade ~{predictionData.mrr.mrrPerNewSub?.toFixed(2) || 0}€/mes al MRR. Fórmula: {predictionData.mrr.newSubsPerMonth?.toFixed(1) || 0} nuevas subs/mes × {predictionData.mrr.mrrPerNewSub?.toFixed(2) || 0}€ = +{((predictionData.mrr.newSubsPerMonth || 0) * (predictionData.mrr.mrrPerNewSub || 0)).toFixed(0)}€ MRR/mes.
                  </div>
                </div>
              )}

              {/* Historial de pagos */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <span>💳</span>
                  Historial de Pagos ({predictionData.current.totalPayments} total)
                </h3>
                <div className="space-y-2">
                  {predictionData.trend.paymentHistory.map((payment, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                      <div className="text-sm">
                        <span className="font-medium text-gray-900 dark:text-white">Pago #{predictionData.current.totalPayments - i}</span>
                      </div>
                      <div className="text-sm text-gray-500">
                        {new Date(payment.date).toLocaleDateString('es-ES', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Explicacion */}
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-6 border border-blue-200 dark:border-blue-800">
                <h3 className="font-bold text-blue-900 dark:text-blue-200 mb-2">Como funcionan las predicciones</h3>
                <ul className="text-sm text-blue-800 dark:text-blue-300 space-y-1">
                  <li><strong>Tasa de conversion:</strong> Calculada con TODOS los usuarios y TODAS las ventas (datos reales)</li>
                  <li><strong>Intervalo de confianza (IC):</strong> Rango donde esta el valor real con 95% de certeza. Se estrecha automaticamente con mas ventas.</li>
                  <li><strong>Probabilidad:</strong> Calculada con distribucion binomial sobre el pool de usuarios que aun no han pagado</li>
                  <li><strong>Pool:</strong> Nuevos (0-7d), Activos (7-30d probando), Dormidos (30+d baja probabilidad)</li>
                  <li><strong>Tiempo medio:</strong> Dias promedio desde registro hasta pago (puede ser 0 = mismo dia)</li>
                  <li><strong>Fiabilidad:</strong> Con menos de 10 ventas es baja, 10-20 media, mas de 20 alta</li>
                </ul>
              </div>
            </>
          ) : (
            <div className="text-center py-12 text-gray-500">
              No se pudieron cargar las predicciones
            </div>
          )}
        </div>
      )}

    </div>
  )
}
