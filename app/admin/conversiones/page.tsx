// app/admin/conversiones/page.tsx - Panel completo de tracking de conversiones
'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { getAuthHeaders } from '@/lib/api/authHeaders'
import type { ConversionStatsResponse } from '@/lib/api/admin-conversion-stats'

type TabType = 'funnel' | 'ab-testing' | 'predictions' | 'graduated-limits'

interface PreviousPeriod {
  registrations: number
  firstTestCompleted: number
  funnelCounts: Record<string, number>
}

interface StageSelection {
  key: string
  name: string
}

interface StageUser {
  id: string
  email: string
  full_name?: string
  plan_type: string
  registration_source?: string
  created_at?: string
  event_at?: string
}

export default function ConversionesPage() {
  const { supabase } = useAuth()

  // Marcar ventas como leídas al montar
  useEffect(() => {
    fetch('/api/v2/admin/unread-sales', { method: 'POST' }).catch(() => {})
  }, [])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabType>('predictions')

  // Estados para predicciones
  const [predictionData, setPredictionData] = useState<any>(null)
  const [loadingPredictions, setLoadingPredictions] = useState(false)

  // Estados para datos del funnel
  const [funnelCounts, setFunnelCounts] = useState<Record<string, number>>({})
  const [paidAllTime, setPaidAllTime] = useState(0)
  const [previousPeriod, setPreviousPeriod] = useState<PreviousPeriod | null>(null)
  const [registrationStats, setRegistrationStats] = useState<ConversionStatsResponse['registrations']>({ total: 0, totalAllTime: 0, bySource: {}, firstTestCompleted: 0, activeUsers: 0, activationRate: 0 })
  const [activeUserMetrics, setActiveUserMetrics] = useState<ConversionStatsResponse['activeUserMetrics']>({
    dauTotal: 0, dauFree: 0, dauPremium: 0, monetizationRate: 0,
    paidInPeriod: 0, refundsInPeriod: 0, paidNetInPeriod: 0, refundAmountPeriod: 0, freeToPayRate: 0,
    dau7Days: 0, dau7DaysFree: 0, dau7DaysPremium: 0, monetizationRate7Days: 0,
    paidIn7Days: 0, refundsIn7Days: 0, paidNetIn7Days: 0, refundAmount7Days: 0, freeToPayRate7Days: 0
  })
  const [timeAnalysis, setTimeAnalysis] = useState<any[]>([])
  const [dailyStats, setDailyStats] = useState<any[]>([])
  const [selectedUser, setSelectedUser] = useState<string | null>(null)
  const [userJourney, setUserJourney] = useState<any[]>([])
  const [dateRange, setDateRange] = useState('7')
  const [selectedStage, setSelectedStage] = useState<StageSelection | null>(null)
  const [stageUsers, setStageUsers] = useState<StageUser[]>([])
  const [loadingStage, setLoadingStage] = useState(false)

  // Estados para A/B testing
  const [abStats, setAbStats] = useState<any[]>([])
  const [abImpressions, setAbImpressions] = useState<any[]>([])
  const [abTotals, setAbTotals] = useState<{ impressions: number; clicks: number; conversions: number; avgClickRate?: string | number; avgConversionRate?: string | number }>({ impressions: 0, clicks: 0, conversions: 0 })

  // Estados para limites graduados
  const [graduatedData, setGraduatedData] = useState<any>(null)
  const [loadingGraduated, setLoadingGraduated] = useState(false)

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
    if (activeTab === 'graduated-limits' && !graduatedData) {
      loadGraduatedLimits()
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

  const loadGraduatedLimits = async () => {
    setLoadingGraduated(true)
    try {
      const response = await fetch('/api/admin/graduated-limits')
      if (!response.ok) throw new Error('Error loading graduated limits')
      const data = await response.json()
      setGraduatedData(data)
    } catch (err) {
      console.error('Error loading graduated limits:', err)
    } finally {
      setLoadingGraduated(false)
    }
  }

  const loadAllData = async () => {
    setLoading(true)
    setError(null)

    try {
      await Promise.all([
        loadMainStats(),
        loadTimeAnalysis()
      ])
    } catch (err: any) {
      console.error('Error loading data:', err)
      setError(err?.message || 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  // Cargar datos principales desde la API (usa service role para bypasear RLS)
  const loadMainStats = async () => {
    const response = await fetch(`/api/v2/admin/conversion-stats?days=${dateRange}`)
    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || 'Error loading stats')
    }

    const data = await response.json()

    setRegistrationStats(data.registrations)
    setActiveUserMetrics(data.activeUserMetrics || {
      dauTotal: 0, dauFree: 0, dauPremium: 0, monetizationRate: 0,
      paidInPeriod: 0, freeToPayRate: 0,
      dau7Days: 0, dau7DaysFree: 0, dau7DaysPremium: 0, monetizationRate7Days: 0,
      paidIn7Days: 0, freeToPayRate7Days: 0
    })
    setFunnelCounts(data.funnelCounts || {})
    setPaidAllTime(data.paidAllTime || 0)
    setPreviousPeriod(data.previousPeriod || null)
    setDailyStats(data.dailyStats || [])
  }

  // Carga conversion_time_analysis Y admin_upgrade_message_stats en una
  // sola request. Antes el browser leía esas views directamente con cliente
  // authenticated (anti-pattern: dependía del SECURITY DEFINER + GRANT
  // public para bypassar RLS). Ahora el endpoint admin verifica auth y usa
  // service_role server-side.
  const loadAdminViews = async () => {
    try {
      const authHeaders = await getAuthHeaders()
      const res = await fetch('/api/admin/conversions/views', { headers: authHeaders })
      if (!res.ok) {
        console.error('Error cargando admin views:', res.status)
        setTimeAnalysis([])
        setAbStats([])
        return null
      }
      const json = await res.json()
      setTimeAnalysis(json.timeAnalysis || [])
      return json
    } catch (err) {
      console.error('Error cargando admin views:', err)
      setTimeAnalysis([])
      return null
    }
  }

  const loadTimeAnalysis = async () => {
    await loadAdminViews()
  }

  const loadUserJourney = async (userId: string) => {
    setSelectedUser(userId)

    // Endpoint admin con requireAdmin + service_role.
    // Antes era RPC directa SECURITY DEFINER → cualquier authenticated
    // podía obtener journey de cualquier user.
    try {
      const authHeaders = await getAuthHeaders()
      const res = await fetch(`/api/admin/conversions/user-journey?userId=${encodeURIComponent(userId)}`, { headers: authHeaders })
      if (!res.ok) {
        console.error('Error loading journey:', res.status)
        return
      }
      const json = await res.json()
      setUserJourney(json.journey || [])
    } catch (err) {
      console.error('Error loading journey:', err)
    }
  }

  // Cargar datos de A/B testing de mensajes
  const loadABTestingData = async () => {
    try {
      // admin_upgrade_message_stats ahora vía /api/admin/conversions/views
      // (mismo endpoint que loadAdminViews — combinado para 1 request)
      const adminViews = await loadAdminViews()
      const messageStats = adminViews?.abStats ?? []
      setAbStats(messageStats)

      const totalImpressions = messageStats.reduce((sum: number, m: any) => sum + (m.total_impressions || 0), 0)
      const totalClicks = messageStats.reduce((sum: number, m: any) => sum + (m.total_clicks || 0), 0)
      const totalConversions = messageStats.reduce((sum: number, m: any) => sum + (m.total_conversions || 0), 0)

      setAbTotals({
        impressions: totalImpressions,
        clicks: totalClicks,
        conversions: totalConversions,
        avgClickRate: totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(1) : 0,
        avgConversionRate: totalImpressions > 0 ? ((totalConversions / totalImpressions) * 100).toFixed(1) : 0
      })

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
  const updateMessageWeight = async (messageId: string, newWeight: number) => {
    if (!supabase) {
      console.error('❌ Supabase no inicializado')
      return
    }

    const { error } = await supabase
      .from('upgrade_messages')
      .update({ weight: newWeight })
      .eq('id', messageId)

    if (error) {
      console.error('❌ Error actualizando peso:', error)
      alert('Error actualizando peso: ' + error.message)
    } else {
      console.log('✅ Peso actualizado a', newWeight)
      loadABTestingData()
    }
  }

  // Activar/desactivar mensaje
  const toggleMessageActive = async (messageId: string, currentActive: boolean) => {
    if (!supabase) {
      console.error('❌ Supabase no inicializado')
      return
    }

    const { error } = await supabase
      .from('upgrade_messages')
      .update({ is_active: !currentActive })
      .eq('id', messageId)

    if (error) {
      console.error('❌ Error actualizando estado:', error)
      alert('Error actualizando estado: ' + error.message)
    } else {
      loadABTestingData()
    }
  }

  // Cargar usuarios por etapa del funnel
  const loadStageUsers = async (stageKey: string, stageName: string) => {
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

  // Calcular totales del funnel (filtrados por período)
  const getTotals = (): Record<string, number> => ({
    registrations: registrationStats.total,
    completed_first_test: registrationStats.firstTestCompleted || 0,
    hit_limit: funnelCounts.limit_reached || 0,
    saw_modal: funnelCounts.upgrade_modal_viewed || 0,
    clicked_upgrade: (funnelCounts.upgrade_button_clicked || 0) + (funnelCounts.upgrade_banner_clicked || 0),
    visited_premium: funnelCounts.premium_page_viewed || 0,
    started_checkout: funnelCounts.checkout_started || 0,
    paid: funnelCounts.payment_completed || 0,
  })

  const getPreviousTotals = (): Record<string, number> | null => {
    if (!previousPeriod) return null
    const pc = previousPeriod.funnelCounts || {}
    return {
      registrations: previousPeriod.registrations || 0,
      completed_first_test: previousPeriod.firstTestCompleted || 0,
      hit_limit: pc.limit_reached || 0,
      saw_modal: pc.upgrade_modal_viewed || 0,
      clicked_upgrade: (pc.upgrade_button_clicked || 0) + (pc.upgrade_banner_clicked || 0),
      visited_premium: pc.premium_page_viewed || 0,
      started_checkout: pc.checkout_started || 0,
      paid: pc.payment_completed || 0,
    }
  }

  const totals = getTotals()
  const prevTotals = getPreviousTotals()

  // Mapeo de nombres de eventos
  const eventNames: Record<string, string> = {
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

  const eventColors: Record<string, string> = {
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
      <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
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
        <button
          onClick={() => setActiveTab('graduated-limits')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'graduated-limits'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
          }`}
        >
          Limites
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
                const colors: Record<string, string> = {
                  'organic': 'bg-green-50 dark:bg-green-900/20 text-green-600',
                  'google_ads': 'bg-blue-50 dark:bg-blue-900/20 text-blue-600',
                  'meta_ads': 'bg-purple-50 dark:bg-purple-900/20 text-purple-600',
                  'default': 'bg-gray-50 dark:bg-gray-700 text-gray-600'
                }
                const icons: Record<string, string> = {
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

      {/* 🆕 Métricas de Activación y Monetización */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <span>🎯</span>
          Métricas de Activación y Monetización
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* 1. Registro → Activo */}
          {(() => {
            const rate = registrationStats.activationRate || 0
            const benchmark = { excellent: 60, good: 40, warning: 25 }
            const status = rate >= benchmark.excellent ? 'excellent' : rate >= benchmark.good ? 'good' : rate >= benchmark.warning ? 'warning' : 'poor'
            const statusConfig = {
              excellent: { icon: '🚀', text: 'Excelente', desc: 'Por encima del benchmark', bg: 'bg-green-100 dark:bg-green-900/30', border: 'border-green-300 dark:border-green-700', badge: 'bg-green-200 text-green-800' },
              good: { icon: '✅', text: 'Bueno', desc: 'En el benchmark óptimo', bg: 'bg-blue-100 dark:bg-blue-900/30', border: 'border-blue-300 dark:border-blue-700', badge: 'bg-blue-200 text-blue-800' },
              warning: { icon: '⚠️', text: 'Mejorable', desc: 'Por debajo del objetivo', bg: 'bg-yellow-100 dark:bg-yellow-900/30', border: 'border-yellow-300 dark:border-yellow-700', badge: 'bg-yellow-200 text-yellow-800' },
              poor: { icon: '🔴', text: 'Crítico', desc: 'Requiere atención', bg: 'bg-red-100 dark:bg-red-900/30', border: 'border-red-300 dark:border-red-700', badge: 'bg-red-200 text-red-800' }
            }
            const cfg = statusConfig[status]
            return (
              <div className={`${cfg.bg} border ${cfg.border} rounded-lg p-4`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xl">👤→✅</span>
                  <span className={`text-xs font-bold px-2 py-1 rounded ${cfg.badge}`}>
                    {cfg.icon} {cfg.text}
                  </span>
                </div>
                <div className="font-semibold text-gray-800 dark:text-gray-200 mb-1">Registro → Activo</div>
                <div className="text-xs text-gray-600 dark:text-gray-400 mb-3">
                  Usuarios que hacen al menos 1 test
                </div>
                <div className="flex items-end justify-between mb-2">
                  <div>
                    <div className="text-2xl font-bold text-gray-800 dark:text-gray-100">
                      {registrationStats.activeUsers || 0}
                    </div>
                    <div className="text-xs text-gray-500">de {registrationStats.total} registros</div>
                  </div>
                  <div className={`text-xl font-bold px-2 py-1 rounded ${cfg.badge}`}>
                    {rate}%
                  </div>
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-600 pt-2">
                  Benchmark: {benchmark.good}-{benchmark.excellent}%
                </div>
              </div>
            )
          })()}

          {/* 2. DAU Free + Premium (combinado) */}
          <div className="bg-blue-100 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-700 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xl">👥</span>
              <span className="text-xs font-bold px-2 py-1 rounded bg-blue-200 text-blue-800">
                Activos
              </span>
            </div>
            <div className="font-semibold text-gray-800 dark:text-gray-200 mb-1">DAU Activos</div>
            <div className="text-xs text-gray-600 dark:text-gray-400 mb-3">
              Usuarios activos (período seleccionado)
            </div>
            <div className="flex items-center gap-4 mb-2">
              <div>
                <div className="text-2xl font-bold text-gray-800 dark:text-gray-100">
                  {activeUserMetrics.dauTotal}
                </div>
                <div className="text-xs text-gray-500">total</div>
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Free:</span>
                  <span className="font-semibold text-gray-800 dark:text-gray-200">{activeUserMetrics.dauFree}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-amber-600 dark:text-amber-400">Premium:</span>
                  <span className="font-semibold text-amber-700 dark:text-amber-300">{activeUserMetrics.dauPremium}</span>
                </div>
              </div>
            </div>
            <div className="text-xs text-gray-500 border-t border-blue-200 dark:border-blue-600 pt-2">
              7d fijo: {activeUserMetrics.dau7Days} ({activeUserMetrics.dau7DaysFree} free, {activeUserMetrics.dau7DaysPremium} premium)
            </div>
          </div>

          {/* 3. Tasa de Monetización */}
          {(() => {
            const rate = activeUserMetrics.monetizationRate || 0
            const benchmark = { excellent: 8, good: 4, warning: 2 }
            const status = rate >= benchmark.excellent ? 'excellent' : rate >= benchmark.good ? 'good' : rate >= benchmark.warning ? 'warning' : 'poor'
            const statusConfig = {
              excellent: { icon: '🚀', text: 'Excelente', desc: 'Muy alta monetización', bg: 'bg-green-100 dark:bg-green-900/30', border: 'border-green-300 dark:border-green-700', badge: 'bg-green-200 text-green-800' },
              good: { icon: '✅', text: 'Bueno', desc: 'En rango SaaS típico', bg: 'bg-blue-100 dark:bg-blue-900/30', border: 'border-blue-300 dark:border-blue-700', badge: 'bg-blue-200 text-blue-800' },
              warning: { icon: '⚠️', text: 'Mejorable', desc: 'Optimizar pricing', bg: 'bg-yellow-100 dark:bg-yellow-900/30', border: 'border-yellow-300 dark:border-yellow-700', badge: 'bg-yellow-200 text-yellow-800' },
              poor: { icon: '🔴', text: 'Bajo', desc: 'Revisar modelo', bg: 'bg-red-100 dark:bg-red-900/30', border: 'border-red-300 dark:border-red-700', badge: 'bg-red-200 text-red-800' }
            }
            const cfg = statusConfig[status]
            return (
              <div className={`${cfg.bg} border ${cfg.border} rounded-lg p-4`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xl">💰</span>
                  <span className={`text-xs font-bold px-2 py-1 rounded ${cfg.badge}`}>
                    {cfg.icon} {cfg.text}
                  </span>
                </div>
                <div className="font-semibold text-gray-800 dark:text-gray-200 mb-1">Tasa Monetización</div>
                <div className="text-xs text-gray-600 dark:text-gray-400 mb-3">
                  % de usuarios activos que pagan
                </div>
                <div className="flex items-end justify-between mb-2">
                  <div>
                    <div className="text-2xl font-bold text-gray-800 dark:text-gray-100">
                      {activeUserMetrics.dauPremium}/{activeUserMetrics.dauTotal}
                    </div>
                  </div>
                  <div className={`text-xl font-bold px-2 py-1 rounded ${cfg.badge}`}>
                    {rate}%
                  </div>
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-600 pt-2">
                  7d fijo: {activeUserMetrics.monetizationRate7Days}% · Benchmark: {benchmark.good}-{benchmark.excellent}%
                </div>
              </div>
            )
          })()}

          {/* 4. DAU Free → Pago */}
          {(() => {
            const rate = activeUserMetrics.freeToPayRate || 0
            const benchmark = { excellent: 5, good: 2, warning: 1 }
            const status = rate >= benchmark.excellent ? 'excellent' : rate >= benchmark.good ? 'good' : rate >= benchmark.warning ? 'warning' : 'poor'
            const statusConfig = {
              excellent: { icon: '🚀', text: 'Excelente', bg: 'bg-green-100 dark:bg-green-900/30', border: 'border-green-300 dark:border-green-700', badge: 'bg-green-200 text-green-800' },
              good: { icon: '✅', text: 'Bueno', bg: 'bg-emerald-100 dark:bg-emerald-900/30', border: 'border-emerald-300 dark:border-emerald-700', badge: 'bg-emerald-200 text-emerald-800' },
              warning: { icon: '⚠️', text: 'Mejorable', bg: 'bg-yellow-100 dark:bg-yellow-900/30', border: 'border-yellow-300 dark:border-yellow-700', badge: 'bg-yellow-200 text-yellow-800' },
              poor: { icon: '🔴', text: 'Bajo', bg: 'bg-red-100 dark:bg-red-900/30', border: 'border-red-300 dark:border-red-700', badge: 'bg-red-200 text-red-800' }
            }
            const cfg = statusConfig[status]
            return (
              <div className={`${cfg.bg} border ${cfg.border} rounded-lg p-4`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xl">💰</span>
                  <span className={`text-xs font-bold px-2 py-1 rounded ${cfg.badge}`}>
                    {cfg.icon} {cfg.text}
                  </span>
                </div>
                <div className="font-semibold text-gray-800 dark:text-gray-200 mb-1">DAU Free → Pago</div>
                <div className="text-xs text-gray-600 dark:text-gray-400 mb-3">
                  Conversión de usuarios free activos
                </div>
                <div className="flex items-end justify-between mb-2">
                  <div>
                    <div className="text-2xl font-bold text-gray-800 dark:text-gray-100">
                      {activeUserMetrics.paidInPeriod}/{activeUserMetrics.dauFree}
                    </div>
                    <div className="text-xs text-gray-500">período {dateRange}d</div>
                  </div>
                  <div className={`text-xl font-bold px-2 py-1 rounded ${cfg.badge}`}>
                    {rate.toFixed(1)}%
                  </div>
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-600 pt-2">
                  7d fijo: {activeUserMetrics.freeToPayRate7Days}% ({activeUserMetrics.paidIn7Days}/{activeUserMetrics.dau7DaysFree}) · Benchmark: {benchmark.good}-{benchmark.excellent}%
                </div>
              </div>
            )
          })()}
        </div>
      </div>

      {/* Funnel Visual Principal */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
          <span>📊</span>
          Funnel de Conversion ({dateRange === '365' ? 'Todo el ano' : dateRange === '1' ? 'Hoy' : `Ultimos ${dateRange} dias`})
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
            const prevStepValue = index > 0 ? (totals[arr[index - 1].key] || 0) : value
            const conversionRate = prevStepValue > 0 ? ((value / prevStepValue) * 100).toFixed(1) : '0'
            const totalRate = totals.registrations > 0 ? ((value / totals.registrations) * 100).toFixed(1) : '0'
            const barWidth = totals.registrations > 0 ? Math.max(5, (value / totals.registrations) * 100) : 0
            const isExpanded = selectedStage?.key === step.key

            // Delta vs período anterior
            const prevPeriodValue = prevTotals ? (prevTotals[step.key] || 0) : null
            const delta = prevPeriodValue !== null && prevPeriodValue > 0
              ? Math.round(((value - prevPeriodValue) / prevPeriodValue) * 100)
              : null

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
                        {delta !== null && (
                          <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                            delta > 0 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                            delta < 0 ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                            'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                          }`}>
                            {delta > 0 ? '↑' : delta < 0 ? '↓' : '='}{Math.abs(delta)}% vs {dateRange === '1' ? 'ayer' : `${dateRange}d ant.`}
                          </span>
                        )}
                        {delta === null && prevTotals && (
                          <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                            value > 0 && prevPeriodValue === 0
                              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                              : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                          }`}>
                            {value > 0 && prevPeriodValue === 0
                              ? 'nuevo'
                              : `=0 vs ${dateRange === '1' ? 'ayer' : `${dateRange}d ant.`}`}
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
              <div className="text-3xl font-bold text-emerald-600">
                {activeUserMetrics.paidNetInPeriod || totals.paidInPeriod || 0}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Pagos Netos</div>
              {activeUserMetrics.refundsInPeriod > 0 && (
                <div className="text-xs text-red-500 mt-1">
                  ({activeUserMetrics.paidInPeriod} pagos - {activeUserMetrics.refundsInPeriod} refunds)
                </div>
              )}
              {paidAllTime > 0 && (
                <div className="text-xs text-gray-500 mt-1">({paidAllTime} total historico)</div>
              )}
            </div>
            {/* Refunds si hay */}
            {activeUserMetrics.refundsInPeriod > 0 && (
              <div className="text-center p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                <div className="text-3xl font-bold text-red-600">{activeUserMetrics.refundsInPeriod}</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Refunds</div>
                {activeUserMetrics.refundAmountPeriod > 0 && (
                  <div className="text-xs text-red-500 mt-1">
                    -{(activeUserMetrics.refundAmountPeriod / 100).toFixed(2)}€
                  </div>
                )}
              </div>
            )}
          </div>

          {totals.registrations > 0 && (
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Tasa del período (NETA) */}
              <div className="text-center p-4 bg-gradient-to-r from-emerald-500 to-green-600 rounded-lg text-white">
                <div className="text-3xl font-bold">
                  {(activeUserMetrics.paidNetInPeriod || totals.paidInPeriod) > 0
                    ? (((activeUserMetrics.paidNetInPeriod || totals.paidInPeriod) / totals.registrations) * 100).toFixed(2)
                    : '0.00'}%
                </div>
                <div className="text-sm opacity-90">Conversion neta ultimos {dateRange} dias</div>
                <div className="text-xs opacity-75 mt-1">
                  {activeUserMetrics.paidNetInPeriod || totals.paidInPeriod} pagos netos / {totals.registrations} registros
                  {activeUserMetrics.refundsInPeriod > 0 && (
                    <span className="ml-1">({activeUserMetrics.refundsInPeriod} refunds)</span>
                  )}
                </div>
              </div>
              {/* Tasa histórica */}
              <div className="text-center p-4 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg text-white">
                <div className="text-3xl font-bold">
                  {paidAllTime > 0 && registrationStats.totalAllTime > 0
                    ? ((paidAllTime / registrationStats.totalAllTime) * 100).toFixed(2)
                    : '0.00'}%
                </div>
                <div className="text-sm opacity-90">Conversion historica total</div>
                <div className="text-xs opacity-75 mt-1">
                  {paidAllTime} pagos / {registrationStats.totalAllTime || 0} usuarios
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

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
      {/* ===== TAB: LIMITES GRADUADOS ===== */}
      {activeTab === 'graduated-limits' && (
        <div className="space-y-6">
          {loadingGraduated ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : graduatedData ? (
            <>
              {/* Config actual */}
              <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                <h3 className="font-bold text-gray-700 dark:text-gray-200 mb-3">Configuracion actual</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {graduatedData.summary.config.tiers.map((tier: any) => (
                    <div key={tier.label} className="bg-white dark:bg-gray-900 rounded-lg p-3 border border-gray-200 dark:border-gray-600">
                      <div className="text-xs text-gray-500 dark:text-gray-400 uppercase">{tier.label}</div>
                      <div className="text-2xl font-bold text-gray-800 dark:text-gray-100">{tier.limit}/dia</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">Dias {tier.days}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 text-sm text-gray-500 dark:text-gray-400">
                  Se activa con {graduatedData.summary.config.minLimitHitsRequired}+ veces tocando el limite. Limite por defecto: {graduatedData.summary.config.defaultLimit}/dia.
                </div>
              </div>

              {/* Resumen */}
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 text-center">
                  <div className="text-3xl font-bold text-orange-600">{graduatedData.summary.totalAffected}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Con limite reducido</div>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 text-center">
                  <div className="text-3xl font-bold text-yellow-600">{graduatedData.summary.byTier.onboarding}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Onboarding (25/dia)</div>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 text-center">
                  <div className="text-3xl font-bold text-orange-500">{graduatedData.summary.byTier['first-reduction']}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">1a reduccion (15/dia)</div>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 text-center">
                  <div className="text-3xl font-bold text-red-500">{graduatedData.summary.byTier['second-reduction']}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">2a reduccion (10/dia)</div>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 text-center">
                  <div className="text-3xl font-bold text-red-700">{graduatedData.summary.byTier.veteran}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Veterano (5/dia)</div>
                </div>
              </div>

              {/* Tabla de usuarios afectados */}
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                  <h3 className="font-bold text-gray-700 dark:text-gray-200">
                    Usuarios con limite graduado ({graduatedData.users.filter((u: any) => u.isGraduated).length} afectados de {graduatedData.summary.totalWithHits} que tocaron limite 3+ veces)
                  </h3>
                </div>
                <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-900 sticky top-0">
                      <tr>
                        <th className="text-left py-2 px-2 text-gray-500 dark:text-gray-400 text-xs">Email</th>
                        <th className="text-center py-2 px-2 text-gray-500 dark:text-gray-400 text-xs">Limite</th>
                        <th className="text-center py-2 px-2 text-gray-500 dark:text-gray-400 text-xs hidden sm:table-cell">Tier</th>
                        <th className="text-center py-2 px-2 text-gray-500 dark:text-gray-400 text-xs">Dias</th>
                        <th className="text-center py-2 px-2 text-gray-500 dark:text-gray-400 text-xs">Hits</th>
                        <th className="text-left py-2 px-2 text-gray-500 dark:text-gray-400 text-xs hidden md:table-cell">Oposicion</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                      {graduatedData.users.map((user: any, i: number) => (
                        <tr key={i} className={user.isGraduated ? 'bg-orange-50/50 dark:bg-orange-900/10' : ''}>
                          <td className="py-2 px-2 text-gray-800 dark:text-gray-200 font-mono text-xs truncate max-w-[180px]">{user.email}</td>
                          <td className="py-2 px-2 text-center">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${
                              user.dailyLimit === 25 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                              user.dailyLimit === 15 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                              user.dailyLimit === 10 ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' :
                              'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                            }`}>
                              {user.dailyLimit}
                            </span>
                          </td>
                          <td className="py-2 px-2 text-center text-xs text-gray-500 dark:text-gray-400 hidden sm:table-cell">{user.tierLabel || '-'}</td>
                          <td className="py-2 px-2 text-center text-xs text-gray-600 dark:text-gray-300">{user.registrationAgeDays}</td>
                          <td className="py-2 px-2 text-center text-xs font-mono text-gray-600 dark:text-gray-300">{user.totalLimitHits}</td>
                          <td className="py-2 px-2 text-xs text-gray-500 dark:text-gray-400 truncate max-w-[120px] hidden md:table-cell">{user.targetOposicion?.replace(/_/g, ' ') || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Comparativa de conversion: antes vs despues */}
              {graduatedData.conversionComparison && (
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                    <h3 className="font-bold text-gray-700 dark:text-gray-200">Conversion: antes vs despues</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Compara tasa de conversion de usuarios que tocaron el limite antes y despues del sistema graduado</p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-0 sm:gap-0 divide-y sm:divide-y-0 sm:divide-x divide-gray-200 dark:divide-gray-700">
                    {[
                      { key: 'preGraduation', color: 'gray', icon: '⏮' },
                      { key: 'postGraduated', color: 'purple', icon: '📉' },
                      { key: 'postNormal', color: 'blue', icon: '📊' },
                    ].map(({ key, color, icon }) => {
                      const data = graduatedData.conversionComparison[key]
                      if (!data) return null
                      const rateColor = data.conversionRate > 10 ? 'text-green-600 dark:text-green-400' :
                        data.conversionRate > 5 ? 'text-yellow-600 dark:text-yellow-400' :
                        'text-red-500 dark:text-red-400'
                      return (
                        <div key={key} className="p-4 text-center">
                          <div className="text-lg mb-1">{icon}</div>
                          <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 leading-tight">{data.label}</div>
                          <div className={`text-3xl font-bold ${rateColor}`}>{data.conversionRate}%</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {data.usersWhoConverted} de {data.usersWhoHitLimit} convirtieron
                          </div>
                          <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-2 leading-tight">{data.description}</p>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Boton refrescar */}
              <div className="text-center">
                <button
                  onClick={() => { setGraduatedData(null); loadGraduatedLimits() }}
                  className="px-4 py-2 text-sm bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  Refrescar datos
                </button>
              </div>
            </>
          ) : (
            <div className="text-center py-12 text-gray-500">
              No se pudieron cargar los datos de limites graduados
            </div>
          )}
        </div>
      )}

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
                    Métodos de Proyección de Ventas
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    {/* Método 1: Por registros */}
                    <div className="border border-blue-200 dark:border-blue-800 rounded-lg p-4 bg-blue-50 dark:bg-blue-900/20">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">📊</span>
                          <span className="font-bold text-blue-700 dark:text-blue-300">
                            {predictionData.projectionMethods.byRegistrations.name}
                          </span>
                        </div>
                        {predictionData.projectionMethods.byRegistrations.weight !== undefined && (
                          <span className="text-xs bg-blue-200 dark:bg-blue-800 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full font-medium">
                            Peso: {predictionData.projectionMethods.byRegistrations.weight}%
                          </span>
                        )}
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
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">👥</span>
                          <span className="font-bold text-purple-700 dark:text-purple-300">
                            {predictionData.projectionMethods.byActiveUsers.name}
                          </span>
                        </div>
                        {predictionData.projectionMethods.byActiveUsers.weight !== undefined && (
                          <span className="text-xs bg-purple-200 dark:bg-purple-800 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded-full font-medium">
                            Peso: {predictionData.projectionMethods.byActiveUsers.weight}%
                          </span>
                        )}
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

                    {/* Método 3: Por Stripe con ventana móvil y tendencia (PRINCIPAL) */}
                    {predictionData.projectionMethods.byHistoric && (() => {
                      const h = predictionData.projectionMethods.byHistoric
                      const trendIcon = h.trend?.direction === 'accelerating' ? '📈' : h.trend?.direction === 'decelerating' ? '📉' : '➡️'
                      const trendColor = h.trend?.direction === 'accelerating' ? 'text-green-600' : h.trend?.direction === 'decelerating' ? 'text-red-500' : 'text-gray-500'
                      return (
                    <div className="border-2 border-emerald-300 dark:border-emerald-700 rounded-lg p-4 bg-emerald-50 dark:bg-emerald-900/20 md:col-span-2">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">💳</span>
                          <span className="font-bold text-emerald-700 dark:text-emerald-300">{h.name}</span>
                          <span className="text-xs bg-emerald-600 text-white px-2 py-0.5 rounded-full font-medium">PRINCIPAL</span>
                        </div>
                        <span className="text-xs bg-emerald-200 dark:bg-emerald-800 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full font-medium">
                          Peso: {h.weight}%
                        </span>
                      </div>
                      <div className="flex items-baseline gap-6 flex-wrap">
                        <div>
                          <div className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">
                            {h.salesPerMonth}
                            <span className="text-lg font-normal text-gray-500 dark:text-gray-400"> nuevas/mes</span>
                          </div>
                          <div className="text-lg font-semibold text-green-600 dark:text-green-400">
                            {h.revenuePerMonth.toFixed(0)}€/mes
                          </div>
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                          <div>
                            <span className="text-emerald-600 font-medium">+{h.inputs.newLast30Days}</span> nuevas,{' '}
                            <span className="text-red-500 font-medium">-{h.inputs.canceledLast30Days}</span> canceladas,{' '}
                            <span className="text-orange-500 font-medium">{h.inputs.cancelPending}</span> pendientes
                            <span className="ml-1 text-xs text-gray-400">(30d)</span>
                          </div>
                          <div>
                            {trendIcon} <span className={`font-medium ${trendColor}`}>{h.trend?.label || 'Estable'}</span>
                            <span className="ml-1 text-xs text-gray-400">
                              (ventana {h.inputs.windowDays}d, {h.inputs.weeksAnalyzed} semanas)
                            </span>
                          </div>
                        </div>
                      </div>
                      {/* Mini gráfico semanal */}
                      {h.weeklyBuckets && h.weeklyBuckets.length > 1 && (
                        <div className="mt-3 flex items-end gap-1 h-10">
                          {h.weeklyBuckets.map((w: any, i: number) => {
                            const max = Math.max(...h.weeklyBuckets.map((b: any) => b.new), 1)
                            const height = Math.max(4, (w.new / max) * 40)
                            return (
                              <div key={i} className="flex flex-col items-center gap-0.5" title={`Sem ${i + 1}: +${w.new} nuevas, -${w.canceled} canceladas`}>
                                <div
                                  className="bg-emerald-400 dark:bg-emerald-500 rounded-sm min-w-[16px]"
                                  style={{ height: `${height}px` }}
                                />
                                <span className="text-[9px] text-gray-400">{w.new}</span>
                              </div>
                            )
                          })}
                          <span className="text-[10px] text-gray-400 ml-1 self-end">subs/semana</span>
                        </div>
                      )}
                      <div className="mt-2 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                        ✓ {h.bestFor}
                      </div>
                    </div>
                      )
                    })()}
                  </div>

                  {/* Proyección combinada */}
                  <div className="bg-gradient-to-r from-emerald-500 to-teal-600 rounded-lg p-4 text-white">
                    <div className="flex items-center justify-between flex-wrap gap-4">
                      <div>
                        <div className="text-sm opacity-90 mb-1">
                          📊 Proyección Combinada ({predictionData.projectionMethods.combined.methodsUsed} métodos)
                          <span className="ml-2 bg-white/20 px-2 py-0.5 rounded text-xs">
                            {predictionData.projectionMethods.combined.description}
                          </span>
                        </div>
                        <div className="text-3xl font-bold">
                          {predictionData.projectionMethods.combined.salesPerMonth.toFixed(1)} ventas/mes
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-sm opacity-90 mb-1">Próxima venta estimada</div>
                        <div className="text-3xl font-bold">
                          {predictionData.projectionMethods.combined.salesPerMonth > 0
                            ? `~${Math.round(30 / predictionData.projectionMethods.combined.salesPerMonth)} días`
                            : '-'}
                        </div>
                        {predictionData.current?.daysSinceLastPayment !== null && (
                          <div className="text-xs opacity-75 mt-1">
                            Última venta hace {predictionData.current.daysSinceLastPayment} días
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="text-sm opacity-90 mb-1">Ingresos esperados</div>
                        <div className="text-3xl font-bold">
                          {predictionData.projectionMethods.combined.revenuePerMonth.toFixed(0)}€/mes
                        </div>
                        <div className="text-xs opacity-75 mt-1">
                          Ticket medio: {predictionData.revenue?.avgTicket?.toFixed(2) || 0}€
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

                {/* Intención de compra (últimos 7 días) */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                    Usuarios Calientes (7 días)
                  </h3>
                  {predictionData.purchaseIntent ? (
                    <>
                      <div className="space-y-3">
                        {[
                          { label: 'Alcanzaron límite', value: predictionData.purchaseIntent.limitReachedUsers, change: predictionData.purchaseIntent.change?.limitReached, color: 'orange', sub: 'Necesitan premium' },
                          { label: 'Vieron premium', value: predictionData.purchaseIntent.premiumPageUsers, change: predictionData.purchaseIntent.change?.premiumPage, color: 'blue', sub: 'Considerando pagar' },
                          { label: 'Clickaron upgrade', value: predictionData.purchaseIntent.upgradeClickEvents, change: predictionData.purchaseIntent.change?.upgradeClick, color: 'green', sub: 'Clicks en botón' },
                        ].map((item) => (
                          <div key={item.label}>
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-gray-600 dark:text-gray-400">{item.label}</span>
                              <div className="flex items-center gap-2">
                                {item.change !== null && item.change !== undefined && (
                                  <span className={`text-xs font-medium ${item.change > 0 ? 'text-green-500' : item.change < 0 ? 'text-red-500' : 'text-gray-400'}`}>
                                    {item.change > 0 ? '↑' : item.change < 0 ? '↓' : '='}{Math.abs(item.change)}%
                                  </span>
                                )}
                                <span className={`text-2xl font-bold text-${item.color}-600`}>{item.value}</span>
                              </div>
                            </div>
                            <div className="text-xs text-gray-400 mt-1">{item.sub} {item.change !== null && item.change !== undefined ? `(vs sem. anterior)` : ''}</div>
                          </div>
                        ))}
                        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Compraron</span>
                            <div className="flex items-center gap-2">
                              {(() => {
                                const curr = predictionData.purchaseIntent.hotWhoPaid
                                const prev = predictionData.purchaseIntent.prevHotWhoPaid ?? 0
                                if (prev > 0) {
                                  const pct = Math.round(((curr - prev) / prev) * 100)
                                  return (
                                    <span className={`text-xs font-medium ${pct > 0 ? 'text-green-500' : pct < 0 ? 'text-red-500' : 'text-gray-400'}`}>
                                      {pct > 0 ? '↑' : pct < 0 ? '↓' : '='}{Math.abs(pct)}%
                                    </span>
                                  )
                                }
                                const diff = curr - prev
                                return diff > 0 ? <span className="text-xs font-medium text-green-500">↑{diff} nuevo</span> : null
                              })()}
                              <span className="text-2xl font-bold text-emerald-600">{predictionData.purchaseIntent.hotWhoPaid}</span>
                            </div>
                          </div>
                          <div className="text-xs text-gray-400 mt-1">
                            {predictionData.purchaseIntent.hotConversionRate}% de {predictionData.purchaseIntent.hotTotal} calientes — sem. anterior: {predictionData.purchaseIntent.prevHotWhoPaid ?? 0}
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="text-sm text-gray-400">Cargando...</div>
                  )}
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


              {/* MRR y Proyecciones de Facturación */}
              {predictionData.mrr && (
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <span>💰</span>
                    MRR y Proyecciones de Facturación
                  </h3>

                  {/* MRR Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
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
                    <div className="text-center p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                      <div className="text-3xl font-bold text-red-600">{predictionData.mrr.churn?.calculatedRate || 0}%</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">Churn real</div>
                      <div className="text-xs text-gray-400 mt-1">
                        {predictionData.mrr.churn?.totalCancellations || 0} de {predictionData.mrr.churn?.payingUsers || 0} pagadores
                      </div>
                      {predictionData.mrr.churn?.totalRefunds > 0 && (
                        <div className="text-xs text-red-400 mt-1">
                          ({predictionData.mrr.churn.totalRefunds} con refund: {predictionData.mrr.churn.refundAmount}€)
                        </div>
                      )}
                      {predictionData.mrr.churn?.isMinimum && (
                        <div className="text-xs text-amber-600 mt-1">
                          Aplicado mín. 5%
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Proyección MRR */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <div className="p-4 bg-gradient-to-r from-green-500 to-emerald-600 rounded-lg text-white">
                      <div className="text-sm opacity-90 mb-1">MRR en 6 meses <span className="text-xs bg-white/20 px-1.5 py-0.5 rounded">con churn {predictionData.mrr.churn?.monthlyRate || 5}%</span></div>
                      <div className="text-3xl font-bold">{(predictionData.mrr.in6Months || 0).toLocaleString('es-ES', { maximumFractionDigits: 0 })}€/mes</div>
                      <div className="text-xs opacity-75 mt-1">
                        Churn real: {predictionData.mrr.churn?.calculatedRate || 0}%{predictionData.mrr.churn?.isMinimum ? ' → aplicado mín. 5%' : ''}
                      </div>
                      <div className="text-xs opacity-60 mt-1">
                        ARR: {(predictionData.mrr.arrIn6Months || 0).toLocaleString('es-ES', { maximumFractionDigits: 0 })}€/año
                      </div>
                    </div>
                    <div className="p-4 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg text-white">
                      <div className="text-sm opacity-90 mb-1">MRR en 12 meses <span className="text-xs bg-white/20 px-1.5 py-0.5 rounded">con churn {predictionData.mrr.churn?.monthlyRate || 5}%</span></div>
                      <div className="text-3xl font-bold">{(predictionData.mrr.in12Months || 0).toLocaleString('es-ES', { maximumFractionDigits: 0 })}€/mes</div>
                      <div className="text-xs opacity-75 mt-1">
                        Churn real: {predictionData.mrr.churn?.calculatedRate || 0}%{predictionData.mrr.churn?.isMinimum ? ' → aplicado mín. 5%' : ''}
                      </div>
                      <div className="text-xs opacity-60 mt-1">
                        ARR: {(predictionData.mrr.arrIn12Months || 0).toLocaleString('es-ES', { maximumFractionDigits: 0 })}€/año
                      </div>
                    </div>
                  </div>

                  {/* Calendario de renovaciones */}
                  {predictionData.renewals && (
                  <div>
                    <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-3">Renovaciones por mes</h4>
                    <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                      {predictionData.renewals.byMonth.slice(0, 6).map((month: any, i: number) => (
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

                  {/* Proyección MRR mes a mes */}
                  {predictionData.mrr.projection && (
                    <div className="mt-6">
                      <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-3">Proyección MRR mes a mes</h4>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-gray-200 dark:border-gray-700">
                              <th className="text-left py-2 px-1 text-gray-500">Mes</th>
                              <th className="text-right py-2 px-1 text-gray-500">Inicio</th>
                              <th className="text-right py-2 px-1 text-red-500">Churn examen</th>
                              <th className="text-right py-2 px-1 text-orange-500">Churn natural</th>
                              <th className="text-right py-2 px-1 text-green-500">Nuevas</th>
                              <th className="text-right py-2 px-1 text-gray-500">Final</th>
                              <th className="text-right py-2 px-1 font-bold text-gray-700 dark:text-gray-300">MRR</th>
                            </tr>
                          </thead>
                          <tbody>
                            {predictionData.mrr.projection.map((m: any, i: number) => (
                              <tr key={i} className={`border-b border-gray-100 dark:border-gray-800 ${m.examChurn > 0 ? 'bg-red-50 dark:bg-red-900/10' : ''}`}>
                                <td className="py-1.5 px-1 font-medium">{m.month}</td>
                                <td className="text-right py-1.5 px-1">{m.startSubs}</td>
                                <td className="text-right py-1.5 px-1 text-red-600 font-medium">{m.examChurn > 0 ? `-${m.examChurn}` : '-'}</td>
                                <td className="text-right py-1.5 px-1 text-orange-500">{m.naturalChurn > 0 ? `-${m.naturalChurn}` : '-'}</td>
                                <td className="text-right py-1.5 px-1 text-green-600">+{m.newSubs}</td>
                                <td className="text-right py-1.5 px-1 font-medium">{m.endSubs}</td>
                                <td className="text-right py-1.5 px-1 font-bold">{m.mrr.toLocaleString('es-ES', { maximumFractionDigits: 0 })}€</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Premisas del modelo */}
                  {predictionData.mrr.premises && (
                    <div className="mt-4 text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 rounded p-3 space-y-1">
                      <div className="font-semibold text-gray-700 dark:text-gray-300 mb-2">Premisas:</div>
                      <div>Churn post-examen: <strong>{(predictionData.mrr.premises.postExamChurnRate * 100)}%</strong> <span className="text-orange-500">({predictionData.mrr.premises.postExamChurnSource})</span></div>
                      <div>Churn natural mensual: <strong>{predictionData.mrr.premises.naturalMonthlyChurn}%</strong> ({predictionData.mrr.premises.naturalChurnSource})</div>
                      <div>Nuevas subs/mes: <strong>{predictionData.mrr.premises.newSubsPerMonth}</strong> ({predictionData.mrr.premises.newSubsFormula}) <span className="text-green-600">(datos reales últimos 7 días)</span></div>
                      <div>MRR por sub: <strong>{predictionData.mrr.premises.mrrPerSub}€</strong> ({predictionData.mrr.premises.mrrPerSubSource})</div>
                      {predictionData.mrr.premises.examDatesUsed && Object.keys(predictionData.mrr.premises.examDatesUsed).length > 0 && (
                        <div className="mt-1">
                          Exámenes contemplados: {Object.entries(predictionData.mrr.premises.examDatesUsed).map(([slug, date]: [string, any]) => {
                            const subs = predictionData.mrr.premises.currentPremiumByOpos?.[slug.replace(/-/g, '_')] || 0;
                            return subs > 0 ? `${slug} (${date}, ${subs} subs)` : null;
                          }).filter(Boolean).join(', ') || 'Ninguno con suscriptores activos'}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}


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
