'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'

interface InfraStats {
  database: {
    maxConnections: number
    totalConnections: number
    usagePercent: number
    connectionsByState: { state: string; count: number }[]
    connectionsByApp: { app: string; state: string; count: number }[]
  }
  traffic: {
    sessionsToday: number
    usersToday: number
    questionsToday: number
    peakConcurrent: number
  }
  errors: { endpoint: string; message: string; date: string }[]
  timestamp: string
}

export default function InfraStatsTab() {
  const [stats, setStats] = useState<InfraStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { supabase } = useAuth()

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setError('No autenticado'); return }

      const res = await fetch('/api/admin/infra-stats', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setStats(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-700 dark:text-red-300">
          Error: {error}
        </div>
      </div>
    )
  }

  if (!stats) return null

  const db = stats.database
  const traffic = stats.traffic

  // Color del uso de conexiones
  const usageColor = db.usagePercent < 50 ? 'text-green-600 dark:text-green-400'
    : db.usagePercent < 75 ? 'text-yellow-600 dark:text-yellow-400'
    : 'text-red-600 dark:text-red-400'

  const barColor = db.usagePercent < 50 ? 'bg-green-500'
    : db.usagePercent < 75 ? 'bg-yellow-500'
    : 'bg-red-500'

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header con refresh */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">Infraestructura</h2>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400">
            {new Date(stats.timestamp).toLocaleTimeString('es-ES')}
          </span>
          <button
            onClick={fetchStats}
            className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            Actualizar
          </button>
        </div>
      </div>

      {/* Cards principales */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card label="Conexiones BD" value={`${db.totalConnections}/${db.maxConnections}`} sub={`${db.usagePercent}% uso`} color={usageColor} />
        <Card label="Usuarios hoy" value={traffic.usersToday.toString()} sub={`${traffic.sessionsToday} sesiones`} />
        <Card label="Preguntas hoy" value={traffic.questionsToday.toLocaleString('es-ES')} sub={`${Math.round(traffic.questionsToday / Math.max(traffic.usersToday, 1))} por usuario`} />
        <Card label="Pico concurrente" value={traffic.peakConcurrent.toString()} sub="sesiones simultaneas" />
      </div>

      {/* Barra de uso de conexiones */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Uso de conexiones</h3>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4 mb-2">
          <div className={`${barColor} h-4 rounded-full transition-all`} style={{ width: `${db.usagePercent}%` }} />
        </div>
        <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
          <span>{db.totalConnections} usadas</span>
          <span>{db.maxConnections - db.totalConnections} libres</span>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Conexiones por estado */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Conexiones por estado</h3>
          <div className="space-y-2">
            {db.connectionsByState.map((c, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">
                  <StateIndicator state={c.state} /> {c.state}
                </span>
                <span className="font-mono font-semibold text-gray-900 dark:text-white">{c.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Conexiones por aplicacion */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Conexiones por servicio</h3>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {db.connectionsByApp.map((c, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400 truncate mr-2">
                  {c.app}
                  <span className="text-xs text-gray-400 ml-1">({c.state})</span>
                </span>
                <span className="font-mono font-semibold text-gray-900 dark:text-white flex-shrink-0">{c.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Errores recientes */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
          Errores de conexion recientes
          {stats.errors.length === 0 && <span className="ml-2 text-green-500 font-normal">Sin errores</span>}
        </h3>
        {stats.errors.length > 0 ? (
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {stats.errors.map((e, i) => (
              <div key={i} className="text-xs border-l-2 border-red-400 pl-3 py-1">
                <div className="flex justify-between">
                  <span className="font-mono text-gray-600 dark:text-gray-400">{e.endpoint}</span>
                  <span className="text-gray-400">{new Date(e.date).toLocaleDateString('es-ES')}</span>
                </div>
                <div className="text-red-600 dark:text-red-400 truncate">{e.message}</div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400">Sin errores de timeout o conexion en los ultimos registros.</p>
        )}
      </div>
    </div>
  )
}

function Card({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color || 'text-gray-900 dark:text-white'}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  )
}

function StateIndicator({ state }: { state: string }) {
  const color = state === 'active' ? 'bg-green-500'
    : state === 'idle' ? 'bg-gray-400'
    : 'bg-yellow-500'
  return <span className={`inline-block w-2 h-2 rounded-full ${color} mr-1`} />
}
