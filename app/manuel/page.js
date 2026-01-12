'use client'

import { useState, useEffect } from 'react'
import supabase from '@/lib/supabase'

// Contraseña para acceso de Manuel (actualizada)
const MANUEL_PASSWORD = 'V3nc3!M@nu3l$2026#Admin'

export default function ManuelPage() {
  const [authenticated, setAuthenticated] = useState(false)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [payouts, setPayouts] = useState([])
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState('awaiting') // 'awaiting', 'all', 'confirmed'

  useEffect(() => {
    const isAuth = sessionStorage.getItem('manuel_auth') === 'true'
    if (isAuth) {
      setAuthenticated(true)
    }
  }, [])

  useEffect(() => {
    if (authenticated) {
      loadData()
    }
  }, [authenticated, filter])

  const handleLogin = (e) => {
    e.preventDefault()
    if (password === MANUEL_PASSWORD) {
      sessionStorage.setItem('manuel_auth', 'true')
      setAuthenticated(true)
      setError('')
    } else {
      setError('Contraseña incorrecta')
    }
  }

  const handleLogout = () => {
    sessionStorage.removeItem('manuel_auth')
    setAuthenticated(false)
  }

  const loadData = async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('payout_transfers')
        .select('*')
        .order('payout_date', { ascending: false })

      if (filter === 'awaiting') {
        // Payouts que Armando marcó como enviados pero Manuel no ha confirmado
        query = query.eq('sent_to_manuel', true).eq('manuel_confirmed', false)
      } else if (filter === 'confirmed') {
        query = query.eq('manuel_confirmed', true)
      } else if (filter === 'all') {
        // Solo mostrar los que Armando ha marcado como enviados (no los pendientes)
        query = query.eq('sent_to_manuel', true)
      }

      const { data: payoutsData, error: queryError } = await query

      if (queryError) {
        console.error('Error loading payouts:', queryError)
      }

      setPayouts(payoutsData || [])
    } catch (err) {
      console.error('Error loading data:', err)
    }
    setLoading(false)
  }

  const confirmReceived = async (id) => {
    const { error } = await supabase
      .from('payout_transfers')
      .update({
        manuel_confirmed: true,
        manuel_confirmed_date: new Date().toISOString()
      })
      .eq('id', id)

    if (!error) {
      loadData()
    }
  }

  const confirmAllAwaiting = async () => {
    const awaitingIds = payouts
      .filter(p => p.sent_to_manuel && !p.manuel_confirmed)
      .map(p => p.id)

    if (awaitingIds.length === 0) return

    const { error } = await supabase
      .from('payout_transfers')
      .update({
        manuel_confirmed: true,
        manuel_confirmed_date: new Date().toISOString()
      })
      .in('id', awaitingIds)

    if (!error) {
      loadData()
    }
  }

  const formatCurrency = (cents) => {
    return (cents / 100).toFixed(2) + ' €'
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  const formatDateTime = (dateStr) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

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

  // Calcular estadísticas
  const awaitingPayouts = payouts.filter(p => p.sent_to_manuel && !p.manuel_confirmed)
  const awaitingCount = awaitingPayouts.length
  const awaitingTotal = awaitingPayouts.reduce((sum, p) => sum + p.manuel_amount, 0)

  const confirmedPayouts = payouts.filter(p => p.manuel_confirmed)
  const confirmedTotal = confirmedPayouts.reduce((sum, p) => sum + p.manuel_amount, 0)

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Panel de Manuel</h1>
          <button
            onClick={handleLogout}
            className="text-gray-600 hover:text-gray-800"
          >
            Cerrar sesión
          </button>
        </div>

        {/* Resumen */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg shadow p-4">
            <p className="text-yellow-700 text-sm">Por confirmar</p>
            <p className="text-2xl font-bold text-yellow-700">{formatCurrency(awaitingTotal)}</p>
            <p className="text-yellow-600 text-xs mt-1">{awaitingCount} pago(s)</p>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg shadow p-4">
            <p className="text-green-700 text-sm">Total confirmado</p>
            <p className="text-2xl font-bold text-green-700">{formatCurrency(confirmedTotal)}</p>
            <p className="text-green-600 text-xs mt-1">{confirmedPayouts.length} pago(s)</p>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg shadow p-4">
            <p className="text-blue-700 text-sm">Tu porcentaje</p>
            <p className="text-2xl font-bold text-blue-700">90%</p>
            <p className="text-blue-600 text-xs mt-1">de cada payout de Stripe</p>
          </div>
        </div>

        {/* Filtros */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setFilter('awaiting')}
              className={`px-4 py-2 rounded-lg transition ${
                filter === 'awaiting'
                  ? 'bg-yellow-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Por confirmar ({awaitingCount})
            </button>
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-lg transition ${
                filter === 'all'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Todos los envíos
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
            <button
              onClick={loadData}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
            >
              Actualizar
            </button>
            {filter === 'awaiting' && awaitingCount > 0 && (
              <button
                onClick={confirmAllAwaiting}
                className="ml-auto px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Confirmar todos ({formatCurrency(awaitingTotal)})
              </button>
            )}
          </div>
        </div>

        {/* Tabla de payouts */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-gray-500">Cargando...</div>
          ) : payouts.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              {filter === 'awaiting'
                ? 'No hay pagos pendientes de confirmar'
                : 'No hay pagos en esta categoría'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha Payout</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Payout Stripe</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Tu parte (90%)</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Enviado</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Estado</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {payouts.map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm">{formatDate(p.payout_date)}</td>
                      <td className="px-4 py-3 text-sm text-right">{formatCurrency(p.payout_amount)}</td>
                      <td className="px-4 py-3 text-sm text-right text-green-600 font-bold">{formatCurrency(p.manuel_amount)}</td>
                      <td className="px-4 py-3 text-sm text-center text-gray-500">
                        {formatDate(p.sent_date)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {p.manuel_confirmed ? (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            ✓ Confirmado
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                            Pendiente
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {!p.manuel_confirmed ? (
                          <button
                            onClick={() => confirmReceived(p.id)}
                            className="px-3 py-1 bg-green-500 text-white text-sm rounded hover:bg-green-600 transition"
                          >
                            Confirmar recibido
                          </button>
                        ) : (
                          <span className="text-green-600 text-xs">
                            {formatDateTime(p.manuel_confirmed_date)}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Explicación del flujo */}
        <div className="mt-6 bg-white rounded-lg shadow p-4">
          <h3 className="font-medium mb-2">¿Cómo funciona?</h3>
          <ol className="list-decimal list-inside text-sm text-gray-600 space-y-1">
            <li>Armando recibe un payout de Stripe en su cuenta bancaria</li>
            <li>Armando te transfiere el 90% de ese payout</li>
            <li>Armando marca el pago como "Enviado" en su panel</li>
            <li>Tú confirmas aquí que lo has recibido</li>
          </ol>
        </div>

        {/* Notas si las hay */}
        {payouts.some(p => p.notes) && (
          <div className="mt-6 bg-white rounded-lg shadow p-4">
            <h3 className="font-medium mb-2">Notas de pagos</h3>
            <div className="space-y-2">
              {payouts.filter(p => p.notes).map(p => (
                <div key={p.id} className="text-sm border-l-2 border-blue-500 pl-3">
                  <span className="text-gray-500">{formatDate(p.payout_date)}:</span>{' '}
                  <span className="text-gray-700">{p.notes}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
