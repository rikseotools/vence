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
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState('pending') // 'pending', 'all', 'confirmed'

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
      // Cargar resumen
      const { data: summaryData } = await supabase
        .from('settlement_summary')
        .select('*')
        .single()
      setSummary(summaryData)

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

        {/* Resumen */}
        {summary && (
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

        {/* Filtros */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
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
            <button
              onClick={loadData}
              className="ml-auto px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
            >
              Actualizar
            </button>
          </div>
        </div>

        {/* Tabla de pagos */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-gray-500">Cargando...</div>
          ) : settlements.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No hay pagos en esta categoría</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Usuario</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Bruto</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Fee Stripe</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Neto</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Manuel (90%)</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Armando (10%)</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Estado</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {settlements.map((s) => (
                    <tr key={s.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm">{formatDate(s.payment_date)}</td>
                      <td className="px-4 py-3 text-sm">{s.user_email || '-'}</td>
                      <td className="px-4 py-3 text-sm text-right">{formatCurrency(s.amount_gross)}</td>
                      <td className="px-4 py-3 text-sm text-right text-red-600">-{formatCurrency(s.stripe_fee)}</td>
                      <td className="px-4 py-3 text-sm text-right font-medium">{formatCurrency(s.amount_net)}</td>
                      <td className="px-4 py-3 text-sm text-right text-green-600 font-medium">{formatCurrency(s.manuel_amount)}</td>
                      <td className="px-4 py-3 text-sm text-right text-blue-600 font-medium">{formatCurrency(s.armando_amount)}</td>
                      <td className="px-4 py-3 text-center">
                        {s.manuel_confirmed_received ? (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            Confirmado
                          </span>
                        ) : s.armando_marked_paid ? (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                            Pagado
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            Pendiente
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {!s.armando_marked_paid && !s.manuel_confirmed_received && (
                          <button
                            onClick={() => markAsPaid(s.id)}
                            className="px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600 transition"
                          >
                            Marcar pagado
                          </button>
                        )}
                        {s.armando_marked_paid && !s.manuel_confirmed_received && (
                          <span className="text-gray-400 text-sm">Esperando confirmación</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Leyenda */}
        <div className="mt-6 bg-white rounded-lg shadow p-4">
          <h3 className="font-medium mb-2">Flujo de liquidación:</h3>
          <ol className="list-decimal list-inside text-sm text-gray-600 space-y-1">
            <li><span className="text-red-600 font-medium">Pendiente</span> - Pago recibido, aún no has pagado a Manuel</li>
            <li><span className="text-yellow-600 font-medium">Pagado</span> - Has marcado que pagaste a Manuel, esperando su confirmación</li>
            <li><span className="text-green-600 font-medium">Confirmado</span> - Manuel confirmó que recibió el pago</li>
          </ol>
        </div>
      </div>
    </div>
  )
}
