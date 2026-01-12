'use client'

import { useState, useEffect } from 'react'
import supabase from '@/lib/supabase'

// Contraseña para acceso de Armando
const ARMANDO_PASSWORD = 'V3nc3!Arm@nd0$2026#Liq'

export default function ArmandoPage() {
  const [authenticated, setAuthenticated] = useState(false)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [settlements, setSettlements] = useState([])
  const [summary, setSummary] = useState(null)
  const [realFees, setRealFees] = useState(null)
  const [stripeTransactions, setStripeTransactions] = useState([])
  const [stripeBalance, setStripeBalance] = useState(null)
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState('pending') // 'pending', 'all', 'confirmed'
  const [activeTab, setActiveTab] = useState('liquidaciones') // 'liquidaciones', 'stripe'
  const [selectedPayments, setSelectedPayments] = useState(new Set())

  // Verificar si ya está autenticado (sessionStorage)
  useEffect(() => {
    const isAuth = sessionStorage.getItem('armando_auth') === 'true'
    if (isAuth) {
      setAuthenticated(true)
    }
  }, [])

  // Cargar datos cuando está autenticado
  useEffect(() => {
    if (authenticated) {
      loadData()
    }
  }, [authenticated, filter])

  const handleLogin = (e) => {
    e.preventDefault()
    if (password === ARMANDO_PASSWORD) {
      sessionStorage.setItem('armando_auth', 'true')
      setAuthenticated(true)
      setError('')
    } else {
      setError('Contraseña incorrecta')
    }
  }

  const handleLogout = () => {
    sessionStorage.removeItem('armando_auth')
    setAuthenticated(false)
  }

  const loadData = async () => {
    setLoading(true)
    try {
      // Cargar resumen desde BD (para conteos básicos)
      const { data: summaryData } = await supabase
        .from('settlement_summary')
        .select('*')
        .single()
      setSummary(summaryData)

      // Cargar fees REALES y transacciones desde Stripe API
      try {
        const response = await fetch('/api/admin/stripe-fees-summary')
        const data = await response.json()
        if (data.success) {
          setRealFees(data.summary)
          setStripeTransactions(data.transactions || [])
          setStripeBalance(data.currentBalance || null)
        }
      } catch (err) {
        console.error('Error loading real fees:', err)
      }

      // Cargar settlements según filtro
      let query = supabase
        .from('payment_settlements')
        .select('*')
        .order('payment_date', { ascending: false })

      if (filter === 'pending') {
        query = query.eq('manuel_confirmed_received', false)
      } else if (filter === 'confirmed') {
        query = query.eq('manuel_confirmed_received', true)
      }

      const { data: settlementsData } = await query
      setSettlements(settlementsData || [])
    } catch (err) {
      console.error('Error loading data:', err)
    }
    setLoading(false)
  }

  const markAsPaid = async (id) => {
    const { error } = await supabase
      .from('payment_settlements')
      .update({
        armando_marked_paid: true,
        armando_marked_paid_at: new Date().toISOString()
      })
      .eq('id', id)

    if (!error) {
      loadData()
    }
  }

  const toggleSelectPayment = (id) => {
    setSelectedPayments(prev => {
      const newSet = new Set(prev)
      if (newSet.has(id)) {
        newSet.delete(id)
      } else {
        newSet.add(id)
      }
      return newSet
    })
  }

  const selectAllPending = () => {
    const pendingIds = settlements
      .filter(s => !s.armando_marked_paid && !s.manuel_confirmed_received)
      .map(s => s.id)
    setSelectedPayments(new Set(pendingIds))
  }

  const clearSelection = () => {
    setSelectedPayments(new Set())
  }

  const markSelectedAsPaid = async () => {
    if (selectedPayments.size === 0) return

    const ids = Array.from(selectedPayments)
    const { error } = await supabase
      .from('payment_settlements')
      .update({
        armando_marked_paid: true,
        armando_marked_paid_at: new Date().toISOString()
      })
      .in('id', ids)

    if (!error) {
      setSelectedPayments(new Set())
      loadData()
    }
  }

  // Calcular totales de seleccionados (solo fee de proceso, el reparto real se ve en el resumen)
  const getSelectedTotals = () => {
    const selected = settlements.filter(s => selectedPayments.has(s.id))
    let totalBruto = 0
    let totalFees = 0
    let totalNeto = 0

    selected.forEach(s => {
      totalBruto += s.amount_gross
      totalFees += s.stripe_fee
      totalNeto += (s.amount_gross - s.stripe_fee)
    })

    return { count: selected.length, totalBruto, totalFees, totalNeto }
  }

  const formatCurrency = (cents) => {
    return (cents / 100).toFixed(2) + ' €'
  }

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // Pantalla de login
  if (!authenticated) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
          <h1 className="text-2xl font-bold text-center mb-6">Panel de Armando</h1>
          <form onSubmit={handleLogin}>
            <div className="mb-4">
              <label className="block text-gray-700 mb-2">Contraseña</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Introduce la contraseña"
              />
            </div>
            {error && (
              <p className="text-red-500 text-sm mb-4">{error}</p>
            )}
            <button
              type="submit"
              className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition"
            >
              Entrar
            </button>
          </form>
        </div>
      </div>
    )
  }

  // Panel principal
  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Panel de Liquidaciones - Armando</h1>
          <button
            onClick={handleLogout}
            className="text-gray-600 hover:text-gray-800"
          >
            Cerrar sesión
          </button>
        </div>

        {/* Resumen con fees REALES de Stripe */}
        {realFees && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-lg font-bold mb-1">Resumen Real (desde API Stripe)</h2>
            <p className="text-sm text-gray-500 mb-4">Incluye TODOS los fees: procesamiento de pagos, transferencias a banco y facturación Stripe</p>

            {/* Aviso importante sobre el flujo */}
            {realFees.pending && realFees.pending.payments > 0 && (
              <div className="bg-orange-100 border-l-4 border-orange-500 p-4 mb-6">
                <div className="flex items-start">
                  <span className="text-orange-500 text-xl mr-3">⚠️</span>
                  <div>
                    <p className="font-bold text-orange-800">Antes de pagar a Manuel:</p>
                    <p className="text-orange-700 text-sm">
                      1. Primero transfiere el dinero de Stripe a tu banco (desde el Dashboard de Stripe)<br/>
                      2. Espera a que aparezca la transferencia en la pestaña &quot;Transacciones Stripe&quot;<br/>
                      3. Así se calculará el fee real de transferencia y el importe exacto a pagar
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Lo importante: PENDIENTE DE PAGAR */}
            {realFees.pending && realFees.pending.payments > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 p-4 bg-yellow-50 rounded-lg border-2 border-yellow-300">
                <div className="text-center">
                  <p className="text-yellow-700 text-sm font-medium">Pagos sin liquidar</p>
                  <p className="text-3xl font-bold text-yellow-700">{realFees.pending.payments}</p>
                </div>
                <div className="text-center">
                  <p className="text-yellow-700 text-sm font-medium">Bruto pendiente</p>
                  <p className="text-2xl font-bold text-yellow-700">{formatCurrency(realFees.pending.gross)}</p>
                </div>
                <div className="text-center">
                  <p className="text-green-700 text-sm font-medium">A pagar a Manuel (90%)</p>
                  <p className="text-3xl font-bold text-green-700">{formatCurrency(realFees.pending.manuelAmount)}</p>
                </div>
                <div className="text-center">
                  <p className="text-blue-700 text-sm font-medium">Tu parte pendiente (10%)</p>
                  <p className="text-2xl font-bold text-blue-700">{formatCurrency(realFees.pending.armandoAmount)}</p>
                </div>
              </div>
            )}

            {/* Totales históricos */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-gray-500 text-sm">Total pagos recibidos</p>
                <p className="text-2xl font-bold">{realFees.charges.count}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-gray-500 text-sm">Bruto histórico</p>
                <p className="text-2xl font-bold">{formatCurrency(realFees.totals.grossRevenue)}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-gray-500 text-sm">Tu parte histórica (10%)</p>
                <p className="text-2xl font-bold">{formatCurrency(realFees.totals.armandoAmount)}</p>
              </div>
            </div>

            {/* Desglose de fees */}
            <div className="border-t pt-4">
              <h3 className="font-medium text-gray-700 mb-3">Desglose de comisiones de Stripe</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Fee procesamiento de pagos</span>
                    <span className="text-red-600 font-medium">-{formatCurrency(realFees.totals.chargeFees)}</span>
                  </div>
                  <p className="text-xs text-gray-400 ml-2">~2% + 0.25€ por cada pago</p>

                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Fee transferencias a banco</span>
                    <span className="text-red-600 font-medium">-{formatCurrency(realFees.totals.payoutFees)}</span>
                  </div>
                  <p className="text-xs text-gray-400 ml-2">Comisión por transferir dinero a tu cuenta</p>

                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Fee facturación (Billing)</span>
                    <span className="text-red-600 font-medium">-{formatCurrency(realFees.totals.billingFees)}</span>
                  </div>
                  <p className="text-xs text-gray-400 ml-2">Comisión de Stripe Billing por suscripciones</p>

                  <div className="flex justify-between text-sm font-bold border-t pt-2 mt-2">
                    <span>TOTAL COMISIONES</span>
                    <span className="text-red-600">-{formatCurrency(realFees.totals.totalAllFees)}</span>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Bruto</span>
                      <span className="font-medium">{formatCurrency(realFees.totals.grossRevenue)}</span>
                    </div>
                    <div className="flex justify-between text-red-600">
                      <span>- Comisiones Stripe</span>
                      <span>-{formatCurrency(realFees.totals.totalAllFees)}</span>
                    </div>
                    <div className="flex justify-between font-bold border-t pt-2">
                      <span>= NETO REAL</span>
                      <span className="text-green-600">{formatCurrency(realFees.totals.trueNet)}</span>
                    </div>
                    <div className="border-t pt-2 mt-2 space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-green-600">Manuel (90%)</span>
                        <span className="font-medium">{formatCurrency(realFees.totals.manuelAmount)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-blue-600">Armando (10%)</span>
                        <span className="font-medium">{formatCurrency(realFees.totals.armandoAmount)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Detalle de pendientes (fees) */}
            {realFees.pending && realFees.pending.payments > 0 && (
              <div className="border-t pt-4 mt-4">
                <h3 className="font-medium text-gray-700 mb-2">Detalle de fees en pagos pendientes:</h3>
                <div className="bg-gray-50 rounded-lg p-4 text-sm">
                  <div className="flex justify-between">
                    <span>Bruto pendiente</span>
                    <span className="font-medium">{formatCurrency(realFees.pending.gross)}</span>
                  </div>
                  <div className="flex justify-between text-red-600">
                    <span>- Fees procesamiento (~2% + 0.25€)</span>
                    <span>-{formatCurrency(realFees.pending.chargeFees)}</span>
                  </div>
                  <div className="flex justify-between text-orange-600">
                    <span>- Fees payout estimado (~1%)</span>
                    <span>-{formatCurrency(realFees.pending.estimatedPayoutFees)}</span>
                  </div>
                  <div className="flex justify-between font-bold border-t pt-2 mt-2">
                    <span>= Neto real estimado</span>
                    <span className="text-green-600">{formatCurrency(realFees.pending.trueNet)}</span>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-2">* El fee de payout es estimado (~1%). El fee real se conoce al transferir a banco.</p>
              </div>
            )}
          </div>
        )}

        {/* Resumen básico si no hay datos de Stripe */}
        {!realFees && summary && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-gray-500 text-sm">Total Pagos</p>
              <p className="text-2xl font-bold">{summary.total_payments}</p>
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg shadow p-4">
              <p className="text-yellow-700 text-sm">Pendientes</p>
              <p className="text-2xl font-bold text-yellow-700">{summary.pending_payments}</p>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg shadow p-4">
              <p className="text-blue-700 text-sm">Tu parte (10%)</p>
              <p className="text-2xl font-bold text-blue-700">{formatCurrency(summary.total_armando)}</p>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-lg shadow p-4">
              <p className="text-green-700 text-sm">Pendiente pagar a Manuel</p>
              <p className="text-2xl font-bold text-green-700">{formatCurrency(summary.pending_manuel)}</p>
            </div>
          </div>
        )}

        {/* Pestañas principales */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex gap-2 border-b pb-4 mb-4">
            <button
              onClick={() => setActiveTab('liquidaciones')}
              className={`px-6 py-2 rounded-t-lg font-medium transition ${
                activeTab === 'liquidaciones'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              📋 Liquidaciones
            </button>
            <button
              onClick={() => setActiveTab('stripe')}
              className={`px-6 py-2 rounded-t-lg font-medium transition ${
                activeTab === 'stripe'
                  ? 'bg-gray-800 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              💳 Transacciones Stripe ({stripeTransactions.filter(t => ['charge', 'payout', 'stripe_fee', 'refund'].includes(t.type)).length})
            </button>
            <button
              onClick={loadData}
              className="ml-auto px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
            >
              🔄 Actualizar
            </button>
          </div>

          {/* Filtros para liquidaciones */}
          {activeTab === 'liquidaciones' && (
            <div className="flex gap-2">
              <button
                onClick={() => setFilter('pending')}
                className={`px-4 py-2 rounded-lg transition ${
                  filter === 'pending'
                    ? 'bg-yellow-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Pendientes
              </button>
              <button
                onClick={() => setFilter('all')}
                className={`px-4 py-2 rounded-lg transition ${
                  filter === 'all'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Todos
              </button>
              <button
                onClick={() => setFilter('confirmed')}
                className={`px-4 py-2 rounded-lg transition ${
                  filter === 'confirmed'
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Confirmados
              </button>
            </div>
          )}

          {/* Info para transacciones Stripe */}
          {activeTab === 'stripe' && (
            <p className="text-sm text-gray-600">
              Estas son las transacciones reales de Stripe. Los fees de payout solo aparecen cuando se transfiere dinero al banco.
            </p>
          )}
        </div>

        {/* Tabla de transacciones Stripe */}
        {activeTab === 'stripe' && (
          <div className="bg-white rounded-lg shadow overflow-hidden mb-6">
            {/* Saldo actual de Stripe */}
            {stripeBalance && (
              <div className="bg-gray-800 text-white p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-400 text-sm">Saldo actual en Stripe</p>
                    <p className="text-3xl font-bold">{formatCurrency(stripeBalance.available)}</p>
                  </div>
                  {stripeBalance.pending > 0 && (
                    <div className="text-right">
                      <p className="text-gray-400 text-sm">Pendiente de disponibilidad</p>
                      <p className="text-xl font-medium">{formatCurrency(stripeBalance.pending)}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {loading ? (
              <div className="p-8 text-center text-gray-500">Cargando...</div>
            ) : stripeTransactions.length === 0 ? (
              <div className="p-8 text-center text-gray-500">No hay transacciones de Stripe</div>
            ) : (
              <div className="overflow-x-auto">
                {/* Filtrar y agrupar por día */}
                {(() => {
                  // Identificar payouts fallidos (tienen un payout_failure asociado)
                  const failedPayoutIds = stripeTransactions
                    .filter(t => t.type === 'payout_failure')
                    .map(t => {
                      // Extraer el ID del payout del source o description
                      const match = t.description?.match(/po_[A-Za-z0-9]+/)
                      return match ? match[0] : t.source
                    })
                    .filter(Boolean)

                  // Filtrar: solo pagos, transferencias exitosas y comisiones
                  const relevantTypes = ['charge', 'payout', 'stripe_fee', 'refund']
                  const filtered = stripeTransactions.filter(t => {
                    if (!relevantTypes.includes(t.type)) return false
                    // Excluir payouts fallidos
                    if (t.type === 'payout' && failedPayoutIds.includes(t.source)) return false
                    return true
                  })

                  // Calcular saldo acumulado (de más antiguo a más reciente)
                  // Primero invertimos para procesar de antiguo a reciente
                  const reversed = [...filtered].reverse()
                  let runningBalance = 0
                  const withBalanceReversed = reversed.map(t => {
                    runningBalance += t.net // Sumar el neto (positivo para cobros, negativo para pagos/fees)
                    return { ...t, balanceAfter: runningBalance }
                  })
                  // Volver al orden original (más reciente primero)
                  const withBalance = withBalanceReversed.reverse()

                  // Agrupar por día
                  const groupedByDay = withBalance.reduce((groups, t) => {
                    const day = t.date.split('T')[0] // YYYY-MM-DD
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
                      case 'charge': return 'Pago recibido'
                      case 'payout': return 'Transfer. banco'
                      case 'stripe_fee': return 'Comisión Billing'
                      case 'refund': return 'Reembolso'
                      default: return type
                    }
                  }
                  const formatDayHeader = (dateStr) => {
                    const date = new Date(dateStr)
                    return date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
                  }
                  const formatTime = (dateStr) => {
                    return new Date(dateStr).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
                  }

                  return (
                    <div className="p-4 space-y-4">
                      {Object.entries(groupedByDay).map(([day, transactions]) => {
                        return (
                          <div key={day} className="border-2 border-gray-300 rounded-lg overflow-hidden">
                            {/* Cabecera del día */}
                            <div className="bg-gray-50 px-4 py-2 border-b border-gray-300">
                              <span className="font-bold text-gray-700 capitalize">{formatDayHeader(day)}</span>
                            </div>
                            {/* Transacciones del día */}
                            <table className="w-full text-sm">
                              <tbody>
                                {transactions.map((t, index) => (
                                  <tr key={t.id || index} className={`hover:bg-gray-50 ${index < transactions.length - 1 ? 'border-b border-gray-200' : ''} ${t.type === 'stripe_fee' ? 'bg-red-50' : ''}`}>
                                    <td className="px-4 py-2 text-gray-500 w-16">{formatTime(t.date)}</td>
                                    <td className="px-2 py-2 w-32">
                                      <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${getTypeStyle(t.type)}`}>
                                        {getTypeName(t.type)}
                                      </span>
                                    </td>
                                    <td className="px-2 py-2 text-gray-600 truncate max-w-[200px]" title={t.description}>
                                      {t.description || '-'}
                                    </td>
                                    <td className={`px-2 py-2 text-right w-24 ${t.amount < 0 ? 'text-red-600' : 'text-green-600'}`}>
                                      {t.amount < 0 ? '-' : '+'}{formatCurrency(Math.abs(t.amount))}
                                    </td>
                                    <td className="px-2 py-2 text-right text-orange-600 w-20">
                                      {t.fee > 0 ? `-${formatCurrency(t.fee)}` : formatCurrency(0)}
                                    </td>
                                    <td className={`px-2 py-2 text-right font-bold w-24 ${t.net < 0 ? 'text-red-600' : 'text-green-600'}`}>
                                      {t.net < 0 ? '-' : '+'}{formatCurrency(Math.abs(t.net))}
                                    </td>
                                    <td className="px-4 py-2 text-right font-bold w-28 bg-gray-50 text-gray-800">
                                      {formatCurrency(t.balanceAfter)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )
                      })}
                    </div>
                  )
                })()}
              </div>
            )}

            {/* Leyenda tipos de transacción */}
            <div className="p-4 bg-gray-50 border-t">
              <h4 className="font-medium text-sm mb-2">Tipos de transacciones:</h4>
              <div className="flex flex-wrap gap-3 text-xs">
                <span className="inline-flex items-center gap-1">
                  <span className="w-3 h-3 rounded bg-green-100"></span>
                  <span>Pago recibido = cobro al cliente</span>
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-3 h-3 rounded bg-blue-100"></span>
                  <span>Transfer. banco = dinero a tu cuenta</span>
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-3 h-3 rounded bg-red-100"></span>
                  <span>Comisión Billing = fee mensual Stripe</span>
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Tabla de pagos/liquidaciones */}
        {activeTab === 'liquidaciones' && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {/* Barra de selección */}
          {selectedPayments.size > 0 && (
            <div className="bg-blue-600 text-white p-4 flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="font-medium">{getSelectedTotals().count} pagos</span>
                <span className="text-blue-200">|</span>
                <span>Bruto: {formatCurrency(getSelectedTotals().totalBruto)}</span>
                <span className="text-blue-200">|</span>
                <span>Neto: {formatCurrency(getSelectedTotals().totalNeto)}</span>
                <span className="text-blue-200">|</span>
                <span className="font-bold text-yellow-300">Ver reparto 90/10 en resumen superior ↑</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={clearSelection}
                  className="px-3 py-1 bg-blue-500 hover:bg-blue-400 rounded text-sm"
                >
                  Cancelar
                </button>
                <button
                  onClick={markSelectedAsPaid}
                  className="px-4 py-1 bg-green-500 hover:bg-green-400 rounded font-medium"
                >
                  ✓ Marcar {getSelectedTotals().count} como pagados
                </button>
              </div>
            </div>
          )}

          {loading ? (
            <div className="p-8 text-center text-gray-500">Cargando...</div>
          ) : settlements.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No hay pagos en esta categoría</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase w-10">
                      <button
                        onClick={selectAllPending}
                        className="text-blue-600 hover:text-blue-800 text-xs"
                        title="Seleccionar todos los pendientes"
                      >
                        Todos
                      </button>
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Usuario</th>
                    <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase">Bruto</th>
                    <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase">Fee proceso</th>
                    <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase bg-green-50">Neto</th>
                    <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {settlements.map((s) => {
                    const isSelectable = !s.armando_marked_paid && !s.manuel_confirmed_received
                    const isSelected = selectedPayments.has(s.id)

                    return (
                      <tr key={s.id} className={`hover:bg-gray-50 ${isSelected ? 'bg-blue-50' : ''}`}>
                        <td className="px-3 py-3 text-center">
                          {isSelectable && (
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelectPayment(s.id)}
                              className="w-4 h-4 text-blue-600 rounded cursor-pointer"
                            />
                          )}
                        </td>
                        <td className="px-3 py-3">{formatDate(s.payment_date)}</td>
                        <td className="px-3 py-3 truncate max-w-[120px]" title={s.user_email}>{s.user_email || '-'}</td>
                        <td className="px-3 py-3 text-right font-medium">{formatCurrency(s.amount_gross)}</td>
                        <td className="px-3 py-3 text-right text-red-600">-{formatCurrency(s.stripe_fee)}</td>
                        <td className="px-3 py-3 text-right font-bold bg-green-50">{formatCurrency(s.amount_gross - s.stripe_fee)}</td>
                        <td className="px-3 py-3 text-center">
                          {s.manuel_confirmed_received ? (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              OK
                            </span>
                          ) : s.armando_marked_paid ? (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                              Esperando
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                              Pendiente
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot className="bg-gray-100 font-medium">
                  <tr>
                    <td></td>
                    <td colSpan="2" className="px-3 py-3 text-right">TOTALES:</td>
                    <td className="px-3 py-3 text-right">
                      {formatCurrency(settlements.reduce((sum, s) => sum + s.amount_gross, 0))}
                    </td>
                    <td className="px-3 py-3 text-right text-red-600">
                      -{formatCurrency(settlements.reduce((sum, s) => sum + s.stripe_fee, 0))}
                    </td>
                    <td className="px-3 py-3 text-right font-bold bg-green-50">
                      {formatCurrency(settlements.reduce((sum, s) => sum + (s.amount_gross - s.stripe_fee), 0))}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
        )}

        {/* Leyenda */}
        <div className="mt-6 bg-white rounded-lg shadow p-4">
          <h3 className="font-medium mb-2">Flujo de liquidación:</h3>
          <ol className="list-decimal list-inside text-sm text-gray-600 space-y-1">
            <li><span className="text-red-600 font-medium">Pendiente</span> - Pago recibido, aún no has pagado a Manuel</li>
            <li><span className="text-yellow-600 font-medium">Pagado</span> - Has marcado que pagaste a Manuel, esperando su confirmación</li>
            <li><span className="text-green-600 font-medium">Confirmado</span> - Manuel confirmó que recibió el pago</li>
          </ol>

          <h3 className="font-medium mt-4 mb-2">Tipos de comisiones de Stripe:</h3>
          <ul className="text-sm text-gray-600 space-y-1">
            <li><span className="font-medium">Fee procesamiento</span> - ~2% + 0.25€ que Stripe cobra por cada pago recibido</li>
            <li><span className="font-medium">Fee transferencia</span> - ~1% que Stripe cobra por transferir dinero a tu cuenta bancaria</li>
            <li><span className="font-medium">Fee facturación</span> - Comisión de Stripe Billing por gestionar suscripciones/facturas</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
