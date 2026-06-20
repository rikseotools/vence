'use client'

// app/armando/page.tsx
// Panel de Liquidaciones — usado SOLO por Armando para dividir payouts.
// Manuel ya no entra aquí: confirma desde /admin/cobros con su user admin.
//
// Auth: cookie httpOnly server-side (POST /api/armando/auth con password).
// Datos: APIs en /api/finance/transfers/* (service_role server-side).
// La RLS de payout_transfers queda cerrada para anon/authenticated.

import { useState, useEffect, useCallback } from 'react'

interface PayoutTransfer {
  id: string
  stripe_payout_id: string
  payout_date: string
  payout_amount: number
  payout_fee: number
  manuel_amount: number
  armando_amount: number
  sent_to_manuel: boolean
  sent_date: string | null
  manuel_confirmed: boolean
  manuel_confirmed_date: string | null
  notes: string | null
  expected_usd: number | null
  crypto_tx_hash: string | null
  crypto_amount_received: number | null
}

interface StripeTransaction {
  id?: string
  type: string
  source: string
  amount: number
  fee: number
  net: number
  date: string
  description?: string
  balanceAfter?: number
}

interface StripeBalance {
  available: number
  pending: number
}

interface PayoutStatus {
  sent: boolean
  confirmed: boolean
  sentDate?: string | null
  confirmedDate?: string | null
}

export default function ArmandoPage() {
  const [authenticated, setAuthenticated] = useState(false)
  const [authChecked, setAuthChecked] = useState(false)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [stripeTransactions, setStripeTransactions] = useState<StripeTransaction[]>([])
  const [stripeBalance, setStripeBalance] = useState<StripeBalance | null>(null)
  const [payoutTransfers, setPayoutTransfers] = useState<PayoutTransfer[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedPayouts, setExpandedPayouts] = useState<Record<string, boolean>>({})
  const [apiError, setApiError] = useState<string | null>(null)
  const [transfersError, setTransfersError] = useState<string | null>(null)
  const [fxError, setFxError] = useState<string | null>(null)
  const [stripeCommission, setStripeCommission] = useState<{ pct: number | null, netVolume4w: number }>({ pct: null, netVolume4w: 0 })
  const [eurUsdRate, setEurUsdRate] = useState<number | null>(null)

  // Verificar sesión server-side al montar (cookie httpOnly)
  useEffect(() => {
    const checkSession = async () => {
      try {
        const res = await fetch('/api/armando/me', { method: 'GET' })
        if (res.ok) {
          setAuthenticated(true)
        }
      } catch {
        // sin sesión, mostrar login
      } finally {
        setAuthChecked(true)
        if (!authenticated) setLoading(false)
      }
    }
    checkSession()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadData = useCallback(async () => {
    console.log('🔄 [Armando] Iniciando carga de datos...')
    setLoading(true)
    setApiError(null)
    setTransfersError(null)
    setFxError(null)
    try {
      const controller = new AbortController()
      // Timeout amplio (35s) — endpoint puede tardar hasta 30s legítimamente cuando
      // el caché de netVolume4w está frío y debe esperar al Stripe Reporting API
      const timeoutId = setTimeout(() => controller.abort(), 35000)

      // La cookie httpOnly de armando viaja automáticamente (sameSite=strict, mismo origen)
      const response = await fetch('/api/admin/stripe-fees-summary', { signal: controller.signal })
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

      // Cargar payouts vía API server-side
      try {
        const transfersRes = await fetch('/api/finance/transfers', { method: 'GET' })
        if (transfersRes.status === 401) {
          setAuthenticated(false)
          return
        }
        if (!transfersRes.ok) {
          const txt = await transfersRes.text().catch(() => '')
          throw new Error(`HTTP ${transfersRes.status}: ${txt.slice(0, 200)}`)
        }
        const transfersJson = await transfersRes.json()
        if (transfersJson.success) {
          setPayoutTransfers(transfersJson.transfers || [])
        } else {
          throw new Error(transfersJson.error || 'Error desconocido cargando payouts')
        }
      } catch (err: unknown) {
        setTransfersError('Error cargando payouts: ' + (err instanceof Error ? err.message : String(err)))
      }

      // Tipo de cambio EUR→USD — si falla, USD no se muestra y se avisa al usuario
      try {
        const fxRes = await fetch('https://api.frankfurter.dev/v1/latest?from=EUR&to=USD')
        if (!fxRes.ok) throw new Error(`HTTP ${fxRes.status}`)
        const fxData = await fxRes.json()
        if (fxData.rates?.USD) {
          setEurUsdRate(fxData.rates.USD)
        } else {
          setFxError('Frankfurter devolvió respuesta sin USD')
        }
      } catch (err: unknown) {
        setFxError('No se pudo obtener tipo de cambio EUR/USD: ' + (err instanceof Error ? err.message : String(err)))
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        setApiError('Timeout: La API de Stripe tardó demasiado en responder')
      } else {
        setApiError('Error de conexión: ' + (err instanceof Error ? err.message : String(err)))
      }
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    if (authenticated) {
      loadData()
    }
  }, [authenticated, loadData])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      const res = await fetch('/api/armando/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setAuthenticated(true)
        setPassword('')
      } else {
        setError(data.error || 'Contraseña incorrecta')
      }
    } catch {
      setError('Error de conexión')
    }
  }

  const handleLogout = async () => {
    try {
      await fetch('/api/armando/logout', { method: 'POST' })
    } catch {
      // noop
    }
    setAuthenticated(false)
    setPayoutTransfers([])
    setStripeTransactions([])
  }

  // Marcar un payout como enviado a Manuel
  const markAsSent = async (
    payoutId: string,
    payoutAmount: number,
    payoutFee: number,
    payoutDate: string,
  ) => {
    if (stripeCommission.pct == null) return
    const netAmount = Math.abs(payoutAmount) - payoutFee
    const manuelPct = (100 - stripeCommission.pct) / 100
    const manuelAmount = Math.round(netAmount * manuelPct)
    const armandoAmount = netAmount - manuelAmount
    const expectedUsd = eurUsdRate ? Math.round(manuelAmount * eurUsdRate) / 100 : null

    const res = await fetch('/api/finance/transfers/mark-sent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        stripe_payout_id: payoutId,
        payout_date: payoutDate,
        payout_amount: Math.abs(payoutAmount),
        payout_fee: payoutFee,
        manuel_amount: manuelAmount,
        armando_amount: armandoAmount,
        expected_usd: expectedUsd,
      }),
    })

    if (res.ok) {
      setExpandedPayouts(prev => ({ ...prev, [payoutId]: false }))
      loadData()
      if (expectedUsd) {
        console.log(`⏰ Auto-confirm scheduled in 5 min for ${expectedUsd} USDT`)
        setTimeout(() => verifyUsdtReceived(payoutId, expectedUsd), 5 * 60 * 1000)
      }
    } else {
      const data = await res.json().catch(() => ({} as { error?: string }))
      const msg = `Error marcando como enviado (HTTP ${res.status}): ${data.error || 'sin detalle'}`
      console.error(msg)
      alert(msg)
    }
  }

  // Verificar recepción USDT en BSC Smart Chain (auto-confirm)
  const verifyUsdtReceived = async (payoutId: string, expectedUsd: number) => {
    try {
      const WALLET = '0x8f80bcE9C6012048e6c248Cb5471145fcFD17291'
      const USDT_CONTRACT = '0x55d398326f99059fF775485246999027B3197955'
      const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'
      const RECIPIENT_TOPIC = '0x000000000000000000000000' + WALLET.slice(2).toLowerCase()

      const blockRes = await fetch('https://bsc-dataseed.binance.org/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_blockNumber', params: [], id: 1 }),
      }).then(r => r.json())

      const currentBlock = parseInt(blockRes.result, 16)
      const fromBlock = '0x' + (currentBlock - 28800).toString(16)

      const logsRes = await fetch('https://bsc-dataseed.binance.org/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_getLogs',
          params: [{ fromBlock, toBlock: 'latest', address: USDT_CONTRACT, topics: [TRANSFER_TOPIC, null, RECIPIENT_TOPIC] }],
          id: 2,
        }),
      }).then(r => r.json())

      const transfers = logsRes.result || []
      console.log(`🔍 [USDT] ${transfers.length} transfers found, expecting ~$${expectedUsd}`)

      const tolerance = 0.05
      const match = transfers.find((log: { data: string; transactionHash: string }) => {
        const amount = Number(BigInt(log.data)) / 1e18
        return Math.abs(amount - expectedUsd) / expectedUsd <= tolerance
      })

      if (match) {
        const amount = (Number(BigInt(match.data)) / 1e18).toFixed(2)
        const txHash = match.transactionHash
        console.log(`✅ [USDT] Match! ${amount} USDT received. Auto-confirming payout ${payoutId}`)

        const res = await fetch('/api/finance/transfers/auto-confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            stripe_payout_id: payoutId,
            crypto_tx_hash: txHash,
            crypto_amount_received: parseFloat(amount),
          }),
        })

        if (res.ok) {
          loadData()
        } else {
          const txt = await res.text().catch(() => '')
          const msg = `Error auto-confirmando USDT (HTTP ${res.status}): ${txt.slice(0, 200)}`
          console.error(msg)
          alert(msg)
        }
      } else {
        console.log(`⏳ [USDT] No matching transfer found for $${expectedUsd}. Manual confirmation needed.`)
      }
    } catch (err) {
      const msg = '❌ [USDT] Error checking blockchain: ' + (err instanceof Error ? err.message : String(err))
      console.error(msg)
      alert(msg)
    }
  }

  const getPayoutStatus = (payoutId: string): PayoutStatus => {
    const transfer = payoutTransfers.find(t => t.stripe_payout_id === payoutId)
    if (!transfer) return { sent: false, confirmed: false }
    return {
      sent: transfer.sent_to_manuel,
      confirmed: transfer.manuel_confirmed,
      sentDate: transfer.sent_date,
      confirmedDate: transfer.manuel_confirmed_date,
    }
  }

  const formatCurrency = (cents: number): string => (cents / 100).toFixed(2) + ' €'
  const formatDayHeader = (dateStr: string): string =>
    new Date(dateStr).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const formatTime = (dateStr: string): string =>
    new Date(dateStr).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })

  // Pantalla de "verificando sesión"
  if (!authChecked) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Verificando sesión...</p>
        </div>
      </div>
    )
  }

  // Pantalla de login
  if (!authenticated) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
          <h1 className="text-2xl font-bold text-center mb-6">Panel de Liquidaciones</h1>
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
            {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
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

  const groupedByDay = withBalance.reduce<Record<string, typeof withBalance>>((groups, t) => {
    const day = t.date.split('T')[0]
    if (!groups[day]) groups[day] = []
    groups[day].push(t)
    return groups
  }, {})

  const getTypeStyle = (type: string): string => {
    switch (type) {
      case 'charge': return 'bg-green-100 text-green-800'
      case 'payout': return 'bg-blue-100 text-blue-800'
      case 'stripe_fee': return 'bg-red-100 text-red-800'
      case 'refund': return 'bg-orange-100 text-orange-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getTypeName = (type: string): string => {
    switch (type) {
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
        {/* Banner de errores no-críticos */}
        {(transfersError || fxError) && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800 space-y-1">
            {transfersError && <p>⚠️ {transfersError}</p>}
            {fxError && <p>⚠️ {fxError} — los importes en USD no se mostrarán.</p>}
          </div>
        )}

        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold">Panel de Liquidaciones</h1>
            <p className="text-sm text-gray-500">
              Conectado como: <span className="font-medium text-gray-700">Armando</span>
              {' · '}Comisión Armando: <span className="font-medium text-blue-600">{stripeCommission.pct != null ? `${stripeCommission.pct}%` : 'Calculando...'}</span>
              {stripeCommission.pct != null && <>{' '}(vol. neto 4 sem: {(stripeCommission.netVolume4w / 100).toFixed(2)}€)</>}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={loadData}
              className="px-4 py-2 bg-white text-gray-700 rounded-lg hover:bg-gray-50 border"
            >
              🔄 Actualizar
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
              Historial completo. En las transferencias a banco, marca cuando envíes el {stripeCommission.pct != null ? `${100 - stripeCommission.pct}%` : '...'} a Manuel.
            </p>
          </div>

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
              <p className="text-red-500 mb-4">❌ {apiError}</p>
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
                      const pctReady = stripeCommission.pct != null
                      const manuelAmount = isPayout && pctReady ? Math.round(netAmount * (100 - stripeCommission.pct!) / 100) : 0
                      const armandoAmount = isPayout && pctReady ? netAmount - manuelAmount : 0

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
                            {/* Estado del payout — solo flujo Armando */}
                            {isPayout && !payoutStatus.sent && !expandedPayouts[t.source] && pctReady && (
                              <button
                                onClick={() => setExpandedPayouts(prev => ({ ...prev, [t.source]: true }))}
                                className="ml-3 px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition font-medium"
                              >
                                Dividir
                              </button>
                            )}
                            {isPayout && payoutStatus.sent && !payoutStatus.confirmed && (
                              <span className="ml-3 px-3 py-1 bg-yellow-100 text-yellow-800 text-xs rounded font-medium">
                                Esperando confirmación
                              </span>
                            )}
                            {isPayout && payoutStatus.confirmed && (
                              <span className="ml-3 px-3 py-1 bg-green-100 text-green-800 text-xs rounded font-medium">
                                ✓ Confirmado
                              </span>
                            )}
                            {!isPayout && <span className="w-20"></span>}
                          </div>

                          {/* Fila expandida con reparto 90/10 */}
                          {isPayout && !payoutStatus.sent && expandedPayouts[t.source] && pctReady && (
                            <div className="bg-blue-50 border-t border-blue-200 p-4">
                              <div className="flex items-center justify-between mb-3">
                                <span className="text-blue-800 font-medium">Reparto de {formatCurrency(netAmount)}</span>
                                <button
                                  onClick={() => setExpandedPayouts(prev => ({ ...prev, [t.source]: false }))}
                                  className="text-gray-500 hover:text-gray-700 text-sm"
                                >
                                  ✕ Cerrar
                                </button>
                              </div>
                              <div className="grid grid-cols-2 gap-4 mb-4">
                                <div className="bg-green-100 rounded-lg p-4 text-center">
                                  <p className="text-green-800 text-sm font-medium">Manuel ({100 - stripeCommission.pct!}%)</p>
                                  <p className="text-green-900 text-2xl font-bold">{formatCurrency(manuelAmount)}</p>
                                  {eurUsdRate && (
                                    <p className="text-green-700 text-sm mt-1">Aprox. ${(manuelAmount / 100 * eurUsdRate).toFixed(2)} USD <span className="text-green-600 text-xs">(tipo: {eurUsdRate.toFixed(4)})</span></p>
                                  )}
                                </div>
                                <div className="bg-blue-100 rounded-lg p-4 text-center">
                                  <p className="text-blue-800 text-sm font-medium">Armando ({stripeCommission.pct!}%)</p>
                                  <p className="text-blue-900 text-2xl font-bold">{formatCurrency(armandoAmount)}</p>
                                </div>
                              </div>
                              <button
                                onClick={() => markAsSent(t.source, t.amount, t.fee, t.date)}
                                className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium"
                              >
                                ✓ Armando envió a Manuel ({formatCurrency(manuelAmount)}{eurUsdRate ? ` · Aprox. $${(manuelAmount / 100 * eurUsdRate).toFixed(2)} USD` : ''})
                              </button>
                            </div>
                          )}

                          {/* Detalle de división realizada */}
                          {isPayout && payoutStatus.sent && (
                            <div className="flex items-center justify-between px-4 py-2 bg-green-50 border-t border-green-200 text-sm">
                              <span className="text-green-800">
                                → Manuel: <strong>{formatCurrency(manuelAmount)}</strong> · Armando: <strong>{formatCurrency(armandoAmount)}</strong>
                              </span>
                              <span className="text-green-600 text-xs">
                                {payoutStatus.confirmed ? '✓ Confirmado' : 'Pendiente confirmar'}
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

          <div className="p-4 bg-gray-50 border-t">
            <div className="flex flex-wrap gap-4 text-xs">
              <span className="inline-flex items-center gap-1">
                <span className="w-3 h-3 rounded bg-green-100"></span>
                Pago = cobro de cliente
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-3 h-3 rounded bg-blue-100"></span>
                Transfer. = payout a tu banco
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
