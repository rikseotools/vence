'use client'

import { useState, useEffect } from 'react'
import supabase from '@/lib/supabase'

// Contraseña para acceso de Armando
const ARMANDO_PASSWORD = 'V3nc3!Arm@nd0$2026#Liq'

export default function ArmandoPage() {
  const [authenticated, setAuthenticated] = useState(false)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [stripeTransactions, setStripeTransactions] = useState([])
  const [stripeBalance, setStripeBalance] = useState(null)
  const [payoutTransfers, setPayoutTransfers] = useState([])
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('envios') // 'envios', 'stripe'

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
  }, [authenticated])

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
      // Cargar transacciones desde Stripe API
      const response = await fetch('/api/admin/stripe-fees-summary')
      const data = await response.json()
      if (data.success) {
        setStripeTransactions(data.transactions || [])
        setStripeBalance(data.currentBalance || null)
      }

      // Cargar registro de envíos a Manuel
      const { data: transfers } = await supabase
        .from('payout_transfers')
        .select('*')
        .order('payout_date', { ascending: false })
      setPayoutTransfers(transfers || [])
    } catch (err) {
      console.error('Error loading data:', err)
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
      loadData()
    }
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

  const formatDayHeader = (dateStr) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  }

  const formatTime = (dateStr) => {
    return new Date(dateStr).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
  }

  // Obtener payouts exitosos de las transacciones
  const getSuccessfulPayouts = () => {
    const failedPayoutIds = stripeTransactions
      .filter(t => t.type === 'payout_failure')
      .map(t => {
        const match = t.description?.match(/po_[A-Za-z0-9]+/)
        return match ? match[0] : t.source
      })
      .filter(Boolean)

    return stripeTransactions.filter(t => {
      if (t.type !== 'payout') return false
      if (failedPayoutIds.includes(t.source)) return false
      return true
    })
  }

  // Verificar si un payout ya fue marcado como enviado
  const isPayoutSent = (payoutId) => {
    return payoutTransfers.some(t => t.stripe_payout_id === payoutId && t.sent_to_manuel)
  }

  // Calcular totales pendientes
  const getPendingTotals = () => {
    const payouts = getSuccessfulPayouts()
    let totalPending = 0
    let totalManuel = 0

    payouts.forEach(p => {
      if (!isPayoutSent(p.source)) {
        const netAmount = Math.abs(p.amount) - p.fee
        totalPending += netAmount
        totalManuel += Math.round(netAmount * 0.9)
      }
    })

    return { totalPending, totalManuel }
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

  const payouts = getSuccessfulPayouts()
  const pendingTotals = getPendingTotals()

  // Panel principal
  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Panel de Armando</h1>
          <button
            onClick={handleLogout}
            className="text-gray-600 hover:text-gray-800"
          >
            Cerrar sesión
          </button>
        </div>

        {/* Saldo de Stripe */}
        {stripeBalance && (
          <div className="bg-gray-800 text-white rounded-lg p-6 mb-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <p className="text-gray-400 text-sm">Saldo disponible en Stripe</p>
                <p className="text-4xl font-bold">{formatCurrency(stripeBalance.available)}</p>
              </div>
              {stripeBalance.pending > 0 && (
                <div className="text-right">
                  <p className="text-gray-400 text-sm">Pendiente de disponibilidad</p>
                  <p className="text-2xl font-medium">{formatCurrency(stripeBalance.pending)}</p>
                </div>
              )}
              {pendingTotals.totalManuel > 0 && (
                <div className="bg-yellow-500 text-yellow-900 rounded-lg p-4">
                  <p className="text-sm font-medium">Pendiente enviar a Manuel</p>
                  <p className="text-2xl font-bold">{formatCurrency(pendingTotals.totalManuel)}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Pestañas */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('envios')}
              className={`px-6 py-2 rounded-lg font-medium transition ${
                activeTab === 'envios'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              💸 Envíos a Manuel
            </button>
            <button
              onClick={() => setActiveTab('stripe')}
              className={`px-6 py-2 rounded-lg font-medium transition ${
                activeTab === 'stripe'
                  ? 'bg-gray-800 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              💳 Transacciones Stripe
            </button>
            <button
              onClick={loadData}
              className="ml-auto px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
            >
              🔄 Actualizar
            </button>
          </div>
        </div>

        {/* Tab: Envíos a Manuel */}
        {activeTab === 'envios' && (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="p-4 border-b bg-gray-50">
              <h2 className="font-bold text-lg">Payouts recibidos → Envíos a Manuel</h2>
              <p className="text-sm text-gray-600">
                Por cada transferencia que recibes de Stripe, debes enviar el 90% a Manuel.
              </p>
            </div>

            {loading ? (
              <div className="p-8 text-center text-gray-500">Cargando...</div>
            ) : payouts.length === 0 ? (
              <div className="p-8 text-center text-gray-500">No hay payouts registrados</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha Payout</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Recibido</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Fee Stripe</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase bg-blue-50">Neto</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase bg-green-50">Manuel (90%)</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase bg-blue-50">Tu parte (10%)</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {payouts.map((p) => {
                    const netAmount = Math.abs(p.amount) - p.fee
                    const manuelAmount = Math.round(netAmount * 0.9)
                    const armandoAmount = netAmount - manuelAmount
                    const isSent = isPayoutSent(p.source)

                    return (
                      <tr key={p.id} className={`hover:bg-gray-50 ${isSent ? 'bg-green-50' : ''}`}>
                        <td className="px-4 py-3">{formatDate(p.date)}</td>
                        <td className="px-4 py-3 text-right font-medium">{formatCurrency(Math.abs(p.amount))}</td>
                        <td className="px-4 py-3 text-right text-red-600">
                          {p.fee > 0 ? `-${formatCurrency(p.fee)}` : '-'}
                        </td>
                        <td className="px-4 py-3 text-right font-bold bg-blue-50">{formatCurrency(netAmount)}</td>
                        <td className="px-4 py-3 text-right font-bold text-green-700 bg-green-50">
                          {formatCurrency(manuelAmount)}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-blue-700 bg-blue-50">
                          {formatCurrency(armandoAmount)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {isSent ? (
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              ✓ Enviado
                            </span>
                          ) : (
                            <button
                              onClick={() => markAsSent(p.source, p.amount, p.fee, p.date)}
                              className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition font-medium"
                            >
                              Marcar enviado
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot className="bg-gray-100 font-medium">
                  <tr>
                    <td className="px-4 py-3 text-right">TOTALES:</td>
                    <td className="px-4 py-3 text-right">
                      {formatCurrency(payouts.reduce((sum, p) => sum + Math.abs(p.amount), 0))}
                    </td>
                    <td className="px-4 py-3 text-right text-red-600">
                      -{formatCurrency(payouts.reduce((sum, p) => sum + p.fee, 0))}
                    </td>
                    <td className="px-4 py-3 text-right font-bold bg-blue-50">
                      {formatCurrency(payouts.reduce((sum, p) => sum + (Math.abs(p.amount) - p.fee), 0))}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-green-700 bg-green-50">
                      {formatCurrency(payouts.reduce((sum, p) => {
                        const net = Math.abs(p.amount) - p.fee
                        return sum + Math.round(net * 0.9)
                      }, 0))}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-blue-700 bg-blue-50">
                      {formatCurrency(payouts.reduce((sum, p) => {
                        const net = Math.abs(p.amount) - p.fee
                        return sum + (net - Math.round(net * 0.9))
                      }, 0))}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            )}

            {/* Leyenda */}
            <div className="p-4 bg-gray-50 border-t">
              <h4 className="font-medium text-sm mb-2">Cómo funciona:</h4>
              <ol className="text-sm text-gray-600 list-decimal list-inside space-y-1">
                <li>Stripe transfiere dinero a tu banco (Payout)</li>
                <li>El payout aparece aquí con el importe neto (después de fee)</li>
                <li>Calculas el 90% para Manuel y se lo envías</li>
                <li>Marcas como &quot;Enviado&quot; para llevar el registro</li>
              </ol>
            </div>
          </div>
        )}

        {/* Tab: Transacciones Stripe */}
        {activeTab === 'stripe' && (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="p-4 border-b bg-gray-50">
              <p className="text-sm text-gray-600">
                Historial de transacciones de Stripe (pagos, transferencias, comisiones).
              </p>
            </div>

            {loading ? (
              <div className="p-8 text-center text-gray-500">Cargando...</div>
            ) : stripeTransactions.length === 0 ? (
              <div className="p-8 text-center text-gray-500">No hay transacciones</div>
            ) : (
              <div className="p-4 space-y-4">
                {(() => {
                  // Filtrar transacciones relevantes
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

                  // Calcular saldo acumulado
                  const reversed = [...filtered].reverse()
                  let runningBalance = 0
                  const withBalanceReversed = reversed.map(t => {
                    runningBalance += t.net
                    return { ...t, balanceAfter: runningBalance }
                  })
                  const withBalance = withBalanceReversed.reverse()

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

                  return Object.entries(groupedByDay).map(([day, transactions]) => (
                    <div key={day} className="border-2 border-gray-300 rounded-lg overflow-hidden">
                      <div className="bg-gray-50 px-4 py-2 border-b border-gray-300">
                        <span className="font-bold text-gray-700 capitalize">{formatDayHeader(day)}</span>
                      </div>
                      <table className="w-full text-sm">
                        <tbody>
                          {transactions.map((t, index) => (
                            <tr key={t.id || index} className={`hover:bg-gray-50 ${index < transactions.length - 1 ? 'border-b border-gray-200' : ''} ${t.type === 'stripe_fee' ? 'bg-red-50' : ''}`}>
                              <td className="px-4 py-2 text-gray-500 w-14">{formatTime(t.date)}</td>
                              <td className="px-2 py-2 w-24">
                                <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${getTypeStyle(t.type)}`}>
                                  {getTypeName(t.type)}
                                </span>
                              </td>
                              <td className="px-2 py-2 text-gray-600 truncate max-w-[180px]" title={t.description}>
                                {t.description || '-'}
                              </td>
                              <td className={`px-2 py-2 text-right w-24 ${t.amount < 0 ? 'text-red-600' : 'text-green-600'}`}>
                                {t.amount < 0 ? '-' : '+'}{formatCurrency(Math.abs(t.amount))}
                              </td>
                              <td className="px-2 py-2 text-right text-orange-600 w-20">
                                {t.fee > 0 ? `-${formatCurrency(t.fee)}` : '0.00 €'}
                              </td>
                              <td className={`px-2 py-2 text-right font-bold w-24 ${t.net < 0 ? 'text-red-600' : 'text-green-600'}`}>
                                {t.net < 0 ? '-' : '+'}{formatCurrency(Math.abs(t.net))}
                              </td>
                              <td className="px-4 py-2 text-right font-bold w-24 bg-gray-50 text-gray-800">
                                {formatCurrency(t.balanceAfter)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ))
                })()}
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
        )}
      </div>
    </div>
  )
}
