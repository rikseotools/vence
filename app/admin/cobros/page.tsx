'use client'

import { useState, useEffect } from 'react'
import supabase from '@/lib/supabase'

export default function CobrosPage() {
  const [stripeTransactions, setStripeTransactions] = useState<any[]>([])
  const [stripeBalance, setStripeBalance] = useState<any>(null)
  const [payoutTransfers, setPayoutTransfers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [apiError, setApiError] = useState<string | null>(null)
  const [stripeCommission, setStripeCommission] = useState({ pct: 10, netVolume4w: 0 })
  const [eurUsdRate, setEurUsdRate] = useState<number | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    setApiError(null)
    try {
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
        if (data.stripeCommissionPct != null) {
          setStripeCommission({ pct: data.stripeCommissionPct, netVolume4w: data.netVolume4w || 0 })
        }
      } else {
        setApiError(data.error || 'Error al cargar datos de Stripe')
      }

      const { data: transfers, error: dbError } = await supabase
        .from('payout_transfers')
        .select('*')
        .order('payout_date', { ascending: false })

      if (dbError) {
        console.error('Error loading transfers:', dbError)
      }
      setPayoutTransfers(transfers || [])

      // Tipo de cambio EUR→USD (con fallback)
      try {
        const fxRes = await fetch('https://api.frankfurter.app/latest?from=EUR&to=USD')
        const fxData = await fxRes.json()
        if (fxData.rates?.USD) {
          setEurUsdRate(fxData.rates.USD)
        } else {
          setEurUsdRate(1.12) // fallback razonable
        }
      } catch {
        setEurUsdRate(1.12) // fallback si API no responde
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setApiError('Timeout: La API de Stripe tardó demasiado')
      } else {
        setApiError('Error de conexión: ' + err.message)
      }
    }
    setLoading(false)
  }

  const markAsConfirmed = async (payoutId: string) => {
    const now = new Date().toISOString()
    const { error } = await supabase
      .from('payout_transfers')
      .update({
        manuel_confirmed: true,
        manuel_confirmed_date: now
      })
      .eq('stripe_payout_id', payoutId)

    if (!error) {
      setPayoutTransfers(prev => prev.map(t =>
        t.stripe_payout_id === payoutId
          ? { ...t, manuel_confirmed: true, manuel_confirmed_date: now }
          : t
      ))
    }
  }

  const getPayoutStatus = (payoutId: string) => {
    const transfer = payoutTransfers.find((t: any) => t.stripe_payout_id === payoutId)
    if (!transfer) return { sent: false, confirmed: false, sentDate: null, confirmedDate: null }
    return {
      sent: transfer.sent_to_manuel,
      confirmed: transfer.manuel_confirmed,
      sentDate: transfer.sent_date,
      confirmedDate: transfer.manuel_confirmed_date,
      cryptoTxHash: transfer.crypto_tx_hash,
      cryptoAmount: transfer.crypto_amount_received,
    }
  }

  const formatCurrency = (cents: number) => (cents / 100).toFixed(2) + ' €'

  const formatDayHeader = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  }

  const formatTime = (dateStr: string) =>
    new Date(dateStr).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })

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

  const currentTotalBalance = (stripeBalance?.available || 0) + (stripeBalance?.pending || 0)
  let runningBalance = currentTotalBalance
  const withBalance = filtered.map(t => {
    const balanceAfter = runningBalance
    runningBalance = runningBalance - t.net
    return { ...t, balanceAfter }
  })

  const groupedByDay = withBalance.reduce((groups: Record<string, any[]>, t) => {
    const day = t.date.split('T')[0]
    if (!groups[day]) groups[day] = []
    groups[day].push(t)
    return groups
  }, {})

  const getTypeStyle = (type: string) => {
    switch (type) {
      case 'charge': return 'bg-green-100 text-green-800'
      case 'payout': return 'bg-blue-100 text-blue-800'
      case 'stripe_fee': return 'bg-red-100 text-red-800'
      case 'refund': return 'bg-orange-100 text-orange-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getTypeName = (type: string) => {
    switch (type) {
      case 'charge': return 'Pago'
      case 'payout': return 'Transfer.'
      case 'stripe_fee': return 'Comisión'
      case 'refund': return 'Reembolso'
      default: return type
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Cobros y Liquidaciones</h1>
          <p className="text-sm text-gray-500">
            Comisión Armando: <span className="font-medium text-blue-600">{stripeCommission.pct}%</span>
            {' '}(vol. neto 4 sem: {(stripeCommission.netVolume4w / 100).toFixed(2)}€)
          </p>
        </div>
        <button
          onClick={loadData}
          className="px-4 py-2 bg-white text-gray-700 rounded-lg hover:bg-gray-50 border"
        >
          Actualizar
        </button>
      </div>

      {/* Saldo de Stripe */}
      {stripeBalance && (
        <div className="bg-white border-2 border-blue-200 rounded-lg p-6 shadow">
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
            Confirma los pagos que Armando te haya enviado.
          </p>
        </div>

        {/* Cabecera */}
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
            <button onClick={loadData} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
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
                  {transactions.map((t: any, index: number) => {
                    const isPayout = t.type === 'payout'
                    const payoutStatus = isPayout ? getPayoutStatus(t.source) : { sent: false, confirmed: false, sentDate: null, confirmedDate: null }
                    const netAmount = isPayout ? Math.abs(t.amount) - t.fee : 0
                    const manuelAmount = isPayout ? Math.round(netAmount * (100 - stripeCommission.pct) / 100) : 0
                    const armandoAmount = isPayout ? netAmount - manuelAmount : 0

                    return (
                      <div key={t.id || index} className={`${t.type === 'stripe_fee' ? 'bg-red-50' : ''} ${isPayout && payoutStatus.confirmed ? 'bg-green-50' : isPayout && payoutStatus.sent ? 'bg-yellow-50' : ''}`}>
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
                          {/* Estado del payout */}
                          {isPayout && !payoutStatus.sent && (
                            <span className="ml-3 px-3 py-1 bg-gray-100 text-gray-600 text-xs rounded font-medium">
                              Pendiente dividir
                            </span>
                          )}
                          {isPayout && payoutStatus.sent && !payoutStatus.confirmed && (
                            <div className="ml-3 flex items-center gap-2">
                              {eurUsdRate && (
                                <span className="text-yellow-800 text-xs">
                                  Aprox. ${(manuelAmount / 100 * eurUsdRate).toFixed(2)}
                                </span>
                              )}
                              <button
                                onClick={() => markAsConfirmed(t.source)}
                                className="px-3 py-1 bg-yellow-500 text-yellow-900 text-xs rounded hover:bg-yellow-600 transition font-medium"
                              >
                                Confirmar recibido
                              </button>
                            </div>
                          )}
                          {isPayout && payoutStatus.confirmed && (
                            <span className="ml-3 px-3 py-1 bg-green-100 text-green-800 text-xs rounded font-medium">
                              Confirmado
                            </span>
                          )}
                          {!isPayout && <span className="w-20"></span>}
                        </div>

                        {/* Detalle de división realizada */}
                        {isPayout && payoutStatus.sent && (
                          <div className="flex items-center justify-between px-4 py-2 bg-green-50 border-t border-green-200 text-sm">
                            <span className="text-green-800">
                              Manuel ({100 - stripeCommission.pct}%): <strong>{formatCurrency(manuelAmount)}</strong>{eurUsdRate && <span className="text-blue-600 font-medium"> → Aprox. ${(manuelAmount / 100 * eurUsdRate).toFixed(2)} USD</span>} · Armando ({stripeCommission.pct}%): <strong>{formatCurrency(armandoAmount)}</strong>
                              {(payoutStatus as any).cryptoTxHash && (
                                <span className="ml-2 text-green-600 text-xs">
                                  (USDT: ${(payoutStatus as any).cryptoAmount?.toFixed(2)} · <a href={`https://bscscan.com/tx/${(payoutStatus as any).cryptoTxHash}`} target="_blank" rel="noopener noreferrer" className="underline">tx</a>)
                                </span>
                              )}
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
  )
}
