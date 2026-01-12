'use client'

import { useState, useEffect } from 'react'
import supabase from '@/lib/supabase'

// Contraseñas de acceso
const ARMANDO_PASSWORD = 'V3nc3!Arm@nd0$2026#Liq'
const MANUEL_PASSWORD = 'V3nc3!M@nu3l$2026#Admin'

export default function ManuelPage() {
  const [authenticated, setAuthenticated] = useState(false)
  const [userRole, setUserRole] = useState(null) // 'armando' o 'manuel'
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [stripeTransactions, setStripeTransactions] = useState([])
  const [stripeBalance, setStripeBalance] = useState(null)
  const [payoutTransfers, setPayoutTransfers] = useState([])
  const [loading, setLoading] = useState(true)
  const [expandedPayouts, setExpandedPayouts] = useState({})
  const [apiError, setApiError] = useState(null)

  // Verificar si ya está autenticado (sessionStorage)
  useEffect(() => {
    const savedRole = sessionStorage.getItem('panel_role')
    if (savedRole === 'armando' || savedRole === 'manuel') {
      setUserRole(savedRole)
      setAuthenticated(true)
    } else {
      setLoading(false)
    }
  }, [])

  // Cargar datos cuando está autenticado
  useEffect(() => {
    if (authenticated) {
      loadData()
    }
  }, [authenticated])

  const handleLogin = (e) => {
    e.preventDefault()
    if (password === ARMANDO_PASSWORD) {
      sessionStorage.setItem('panel_role', 'armando')
      setUserRole('armando')
      setAuthenticated(true)
      setError('')
    } else if (password === MANUEL_PASSWORD) {
      sessionStorage.setItem('panel_role', 'manuel')
      setUserRole('manuel')
      setAuthenticated(true)
      setError('')
    } else {
      setError('Contraseña incorrecta')
    }
  }

  const handleLogout = () => {
    sessionStorage.removeItem('panel_role')
    setUserRole(null)
    setAuthenticated(false)
  }

  const loadData = async () => {
    setLoading(true)
    setApiError(null)
    try {
      // Cargar transacciones desde Stripe API
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 15000)

      const response = await fetch('/api/admin/stripe-fees-summary', {
        signal: controller.signal
      })
      clearTimeout(timeoutId)

      const data = await response.json()

      if (data.success) {
        setStripeTransactions(data.transactions || [])
        setStripeBalance(data.currentBalance || null)
      } else {
        setApiError(data.error || 'Error al cargar datos de Stripe')
      }

      // Cargar registro de envíos
      const { data: transfers, error: dbError } = await supabase
        .from('payout_transfers')
        .select('*')
        .order('payout_date', { ascending: false })

      if (dbError) {
        console.error('Error loading transfers:', dbError)
      }
      setPayoutTransfers(transfers || [])
    } catch (err) {
      console.error('Error loading data:', err)
      if (err.name === 'AbortError') {
        setApiError('Timeout: La API de Stripe tardó demasiado en responder')
      } else {
        setApiError('Error de conexión: ' + err.message)
      }
    }
    setLoading(false)
  }

  // Marcar un payout como enviado a Manuel
  const markAsSent = async (payoutId, payoutAmount, payoutFee, payoutDate) => {
    const netAmount = Math.abs(payoutAmount) - payoutFee
    const manuelAmount = Math.round(netAmount * 0.9)
    const armandoAmount = netAmount - manuelAmount

    const { error } = await supabase
      .from('payout_transfers')
      .upsert({
        stripe_payout_id: payoutId,
        payout_date: payoutDate,
        payout_amount: Math.abs(payoutAmount),
        payout_fee: payoutFee,
        manuel_amount: manuelAmount,
        armando_amount: armandoAmount,
        sent_to_manuel: true,
        sent_date: new Date().toISOString()
      }, { onConflict: 'stripe_payout_id' })

    if (!error) {
      setExpandedPayouts(prev => ({ ...prev, [payoutId]: false }))
      loadData()
    }
  }

  // Manuel confirma que recibió el pago
  const markAsConfirmed = async (payoutId) => {
    const { error } = await supabase
      .from('payout_transfers')
      .update({
        manuel_confirmed: true,
        manuel_confirmed_date: new Date().toISOString()
      })
      .eq('stripe_payout_id', payoutId)

    if (!error) {
      loadData()
    }
  }

  // Obtener estado de un payout
  const getPayoutStatus = (payoutId) => {
    const transfer = payoutTransfers.find(t => t.stripe_payout_id === payoutId)
    if (!transfer) return { sent: false, confirmed: false }
    return {
      sent: transfer.sent_to_manuel,
      confirmed: transfer.manuel_confirmed,
      sentDate: transfer.sent_date,
      confirmedDate: transfer.manuel_confirmed_date
    }
  }

  const formatCurrency = (cents) => {
    return (cents / 100).toFixed(2) + ' €'
  }

  const formatDayHeader = (dateStr) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  }

  const formatTime = (dateStr) => {
    return new Date(dateStr).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
  }

  // Pantalla de login
  if (!authenticated) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
          <h1 className="text-2xl font-bold text-center mb-6">Panel de Manuel</h1>
          <p className="text-gray-500 text-center mb-6 text-sm">
            Confirma los pagos que Armando te ha enviado
          </p>
          <form onSubmit={handleLogin}>
            <div className="mb-4">
              <label className="block text-gray-700 mb-2">Contraseña</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="Introduce la contraseña"
              />
            </div>
            {error && (
              <p className="text-red-500 text-sm mb-4">{error}</p>
            )}
            <button
              type="submit"
              className="w-full bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 transition"
            >
              Entrar
            </button>
          </form>
        </div>
      </div>
    )
  }

  // Procesar transacciones
  const failedPayoutIds = stripeTransactions
    .filter(t => t.type === 'payout_failure')
    .map(t => {
      const match = t.description?.match(/po_[A-Za-z0-9]+/)
      return match ? match[0] : t.source
    })
    .filter(Boolean)

  const relevantTypes = ['charge', 'payout', 'stripe_fee', 'refund']
  const filtered = stripeTransactions.filter(t => {
    if (!relevantTypes.includes(t.type)) return false
    if (t.type === 'payout' && failedPayoutIds.includes(t.source)) return false
    return true
  })

  // Calcular saldo real
  const currentTotalBalance = (stripeBalance?.available || 0) + (stripeBalance?.pending || 0)

  let runningBalance = currentTotalBalance
  const withBalance = filtered.map(t => {
    const balanceAfter = runningBalance
    runningBalance = runningBalance - t.net
    return { ...t, balanceAfter }
  })

  // Agrupar por día
  const groupedByDay = withBalance.reduce((groups, t) => {
    const day = t.date.split('T')[0]
    if (!groups[day]) groups[day] = []
    groups[day].push(t)
    return groups
  }, {})

  const getTypeStyle = (type) => {
    switch(type) {
      case 'charge': return 'bg-green-100 text-green-800'
      case 'payout': return 'bg-blue-100 text-blue-800'
      case 'stripe_fee': return 'bg-red-100 text-red-800'
      case 'refund': return 'bg-orange-100 text-orange-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getTypeName = (type) => {
    switch(type) {
      case 'charge': return 'Pago'
      case 'payout': return 'Transfer.'
      case 'stripe_fee': return 'Comisión'
      case 'refund': return 'Reembolso'
      default: return type
    }
  }

  // Panel principal
  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold">Panel de Liquidaciones</h1>
            <p className="text-sm text-gray-500">
              Conectado como: <span className="font-medium text-gray-700">{userRole === 'armando' ? 'Armando' : 'Manuel'}</span>
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={loadData}
              className="px-4 py-2 bg-white text-gray-700 rounded-lg hover:bg-gray-50 border"
            >
              Actualizar
            </button>
            <button
              onClick={handleLogout}
              className="text-gray-600 hover:text-gray-800 px-4 py-2"
            >
              Cerrar sesión
            </button>
          </div>
        </div>

        {/* Saldo de Stripe */}
        {stripeBalance && (
          <div className="bg-white border-2 border-blue-200 rounded-lg p-6 mb-6 shadow">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <p className="text-gray-500 text-sm">Saldo total en Stripe</p>
                <p className="text-4xl font-bold text-blue-600">{formatCurrency(stripeBalance.available + stripeBalance.pending)}</p>
              </div>
              <div className="text-right text-sm space-y-1">
                <p>
                  <span className="text-gray-500">Entrante</span>
                  <span className="text-gray-800 font-medium ml-2">{formatCurrency(stripeBalance.pending)}</span>
                </p>
                <p>
                  <span className="text-purple-600">Disponible</span>
                  <span className="text-gray-800 font-medium ml-2">{formatCurrency(stripeBalance.available)}</span>
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Transacciones */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="p-4 border-b bg-gray-50">
            <h2 className="font-bold text-lg">Transacciones de Stripe</h2>
            <p className="text-sm text-gray-600">
              {userRole === 'manuel'
                ? 'Confirma los pagos que Armando te haya enviado.'
                : 'Historial completo. En las transferencias a banco, marca cuando envíes el 90% a Manuel.'}
            </p>
          </div>

          {/* Cabecera de columnas */}
          <div className="flex items-center px-4 py-2 bg-gray-100 border-b text-xs font-medium text-gray-500 uppercase">
            <span className="w-14">Hora</span>
            <span className="w-20 text-center">Tipo</span>
            <span className="flex-1 px-2">Descripción</span>
            <span className="w-24 text-right">Importe</span>
            <span className="w-20 text-right">Fee</span>
            <span className="w-24 text-right">Neto</span>
            <span className="w-24 text-right">Saldo</span>
            <span className="w-24 text-center">Acción</span>
          </div>

          {loading ? (
            <div className="p-8 text-center text-gray-500">
              <div className="animate-spin inline-block w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mb-2"></div>
              <p>Cargando transacciones de Stripe...</p>
            </div>
          ) : apiError ? (
            <div className="p-8 text-center">
              <p className="text-red-500 mb-4">{apiError}</p>
              <button
                onClick={loadData}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Reintentar
              </button>
            </div>
          ) : Object.keys(groupedByDay).length === 0 ? (
            <div className="p-8 text-center text-gray-500">No hay transacciones</div>
          ) : (
            <div className="p-4 space-y-4">
              {Object.entries(groupedByDay).map(([day, transactions]) => (
                <div key={day} className="border-2 border-gray-300 rounded-lg overflow-hidden">
                  <div className="bg-gray-50 px-4 py-2 border-b border-gray-300">
                    <span className="font-bold text-gray-700 capitalize">{formatDayHeader(day)}</span>
                  </div>
                  <div className="divide-y divide-gray-200">
                    {transactions.map((t, index) => {
                      const isPayout = t.type === 'payout'
                      const payoutStatus = isPayout ? getPayoutStatus(t.source) : { sent: false, confirmed: false }
                      const netAmount = isPayout ? Math.abs(t.amount) - t.fee : 0
                      const manuelAmount = isPayout ? Math.round(netAmount * 0.9) : 0
                      const armandoAmount = isPayout ? netAmount - manuelAmount : 0

                      return (
                        <div key={t.id || index} className={`${t.type === 'stripe_fee' ? 'bg-red-50' : ''} ${isPayout && payoutStatus.confirmed ? 'bg-green-50' : isPayout && payoutStatus.sent ? 'bg-yellow-50' : ''}`}>
                          {/* Fila principal */}
                          <div className="flex items-center px-4 py-2 hover:bg-gray-50">
                            <span className="text-gray-500 w-14 text-sm">{formatTime(t.date)}</span>
                            <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${getTypeStyle(t.type)} w-20 justify-center`}>
                              {getTypeName(t.type)}
                            </span>
                            <span className="flex-1 px-2 text-gray-600 text-sm truncate" title={t.description}>
                              {t.description || '-'}
                            </span>
                            <span className={`w-24 text-right text-sm ${t.amount < 0 ? 'text-red-600' : 'text-green-600'}`}>
                              {t.amount < 0 ? '-' : '+'}{formatCurrency(Math.abs(t.amount))}
                            </span>
                            <span className="w-20 text-right text-orange-600 text-sm">
                              {t.fee > 0 ? `-${formatCurrency(t.fee)}` : '-'}
                            </span>
                            <span className={`w-24 text-right font-bold text-sm ${t.net < 0 ? 'text-red-600' : 'text-green-600'}`}>
                              {t.net < 0 ? '-' : '+'}{formatCurrency(Math.abs(t.net))}
                            </span>
                            <span className="w-24 text-right font-bold text-sm bg-gray-100 px-2 py-1 rounded">
                              {formatCurrency(t.balanceAfter)}
                            </span>
                            {/* Estado del payout - según rol */}
                            {isPayout && !payoutStatus.sent && !expandedPayouts[t.source] && userRole === 'armando' && (
                              <button
                                onClick={() => setExpandedPayouts(prev => ({ ...prev, [t.source]: true }))}
                                className="ml-3 px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition font-medium"
                              >
                                Dividir
                              </button>
                            )}
                            {isPayout && !payoutStatus.sent && userRole === 'manuel' && (
                              <span className="ml-3 px-3 py-1 bg-gray-100 text-gray-600 text-xs rounded font-medium">
                                Pendiente dividir
                              </span>
                            )}
                            {isPayout && payoutStatus.sent && !payoutStatus.confirmed && userRole === 'manuel' && (
                              <button
                                onClick={() => markAsConfirmed(t.source)}
                                className="ml-3 px-3 py-1 bg-yellow-500 text-yellow-900 text-xs rounded hover:bg-yellow-600 transition font-medium"
                              >
                                Confirmar recibido
                              </button>
                            )}
                            {isPayout && payoutStatus.sent && !payoutStatus.confirmed && userRole === 'armando' && (
                              <span className="ml-3 px-3 py-1 bg-yellow-100 text-yellow-800 text-xs rounded font-medium">
                                Esperando confirmación
                              </span>
                            )}
                            {isPayout && payoutStatus.confirmed && (
                              <span className="ml-3 px-3 py-1 bg-green-100 text-green-800 text-xs rounded font-medium">
                                Confirmado
                              </span>
                            )}
                            {!isPayout && <span className="w-20"></span>}
                          </div>

                          {/* Fila expandida con reparto 90/10 - solo Armando */}
                          {isPayout && !payoutStatus.sent && expandedPayouts[t.source] && userRole === 'armando' && (
                            <div className="bg-blue-50 border-t border-blue-200 p-4">
                              <div className="flex items-center justify-between mb-3">
                                <span className="text-blue-800 font-medium">Reparto de {formatCurrency(netAmount)}</span>
                                <button
                                  onClick={() => setExpandedPayouts(prev => ({ ...prev, [t.source]: false }))}
                                  className="text-gray-500 hover:text-gray-700 text-sm"
                                >
                                  Cerrar
                                </button>
                              </div>
                              <div className="grid grid-cols-2 gap-4 mb-4">
                                <div className="bg-green-100 rounded-lg p-4 text-center">
                                  <p className="text-green-800 text-sm font-medium">Manuel (90%)</p>
                                  <p className="text-green-900 text-2xl font-bold">{formatCurrency(manuelAmount)}</p>
                                </div>
                                <div className="bg-blue-100 rounded-lg p-4 text-center">
                                  <p className="text-blue-800 text-sm font-medium">Armando (10%)</p>
                                  <p className="text-blue-900 text-2xl font-bold">{formatCurrency(armandoAmount)}</p>
                                </div>
                              </div>
                              <button
                                onClick={() => markAsSent(t.source, t.amount, t.fee, t.date)}
                                className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium"
                              >
                                Armando envio a Manuel ({formatCurrency(manuelAmount)})
                              </button>
                            </div>
                          )}

                          {/* Detalle de división realizada */}
                          {isPayout && payoutStatus.sent && (
                            <div className="flex items-center justify-between px-4 py-2 bg-green-50 border-t border-green-200 text-sm">
                              <span className="text-green-800">
                                Manuel: <strong>{formatCurrency(manuelAmount)}</strong> · Armando: <strong>{formatCurrency(armandoAmount)}</strong>
                              </span>
                              <span className="text-green-600 text-xs">
                                {payoutStatus.confirmed ? 'Confirmado' : 'Pendiente confirmar'}
                              </span>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Leyenda */}
          <div className="p-4 bg-gray-50 border-t">
            <div className="flex flex-wrap gap-4 text-xs">
              <span className="inline-flex items-center gap-1">
                <span className="w-3 h-3 rounded bg-green-100"></span>
                Pago = cobro de cliente
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-3 h-3 rounded bg-blue-100"></span>
                Transfer. = payout a banco
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-3 h-3 rounded bg-red-100"></span>
                Comisión = fee de Stripe
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
