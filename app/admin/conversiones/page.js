// app/admin/conversiones/page.js - Panel completo de tracking de conversiones
'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'

export default function ConversionesPage() {
  const { supabase } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Estados para datos
  const [funnelStats, setFunnelStats] = useState([])
  const [registrationStats, setRegistrationStats] = useState({ total: 0, bySource: {} })
  const [timeAnalysis, setTimeAnalysis] = useState([])
  const [recentEvents, setRecentEvents] = useState([])
  const [dailyStats, setDailyStats] = useState([])
  const [selectedUser, setSelectedUser] = useState(null)
  const [userJourney, setUserJourney] = useState([])
  const [dateRange, setDateRange] = useState('7') // dias

  // Cargar datos
  useEffect(() => {
    if (supabase) {
      loadAllData()
    }
  }, [supabase, dateRange])

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

  // Calcular totales del funnel
  const getTotals = () => {
    const fromEvents = funnelStats.reduce((acc, row) => ({
      hit_limit: (acc.hit_limit || 0) + (row.hit_limit || 0),
      saw_modal: (acc.saw_modal || 0) + (row.saw_modal || 0),
      clicked_upgrade: (acc.clicked_upgrade || 0) + (row.clicked_upgrade || 0),
      visited_premium: (acc.visited_premium || 0) + (row.visited_premium || 0),
      started_checkout: (acc.started_checkout || 0) + (row.started_checkout || 0),
      paid: (acc.paid || 0) + (row.paid || 0)
    }), {})

    // Registros y primer test vienen de user_profiles
    return {
      registrations: registrationStats.total,
      completed_first_test: registrationStats.firstTestCompleted || 0,
      ...fromEvents
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
            Funnel de Conversiones
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Tracking completo del journey de usuario hasta el pago
          </p>
        </div>

        {/* Filtro de fecha */}
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
      </div>

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

            return (
              <div key={step.key} className="relative">
                <div className="flex items-center gap-4">
                  <div className="w-10 text-2xl">{step.icon}</div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-gray-900 dark:text-white">{step.label}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-2xl font-bold text-gray-900 dark:text-white">{value}</span>
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
                {index < arr.length - 1 && (
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
              <div className="text-3xl font-bold text-emerald-600">{totals.paid || 0}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Pagos Completados</div>
            </div>
          </div>

          {totals.registrations > 0 && totals.paid > 0 && (
            <div className="mt-4 text-center p-4 bg-gradient-to-r from-emerald-500 to-green-600 rounded-lg text-white">
              <div className="text-4xl font-bold">
                {((totals.paid / totals.registrations) * 100).toFixed(2)}%
              </div>
              <div className="text-sm opacity-90">Tasa de Conversion Total (Registro → Pago)</div>
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
    </div>
  )
}
