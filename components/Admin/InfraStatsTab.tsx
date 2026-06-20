'use client'

import { useState, useEffect, useCallback } from 'react'
import { adminFetch } from '@/lib/api/adminFetch'
import { useAuth } from '@/contexts/AuthContext'
import { getAuthHeaders } from '@/lib/api/authHeaders'

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
  canary?: {
    endpointsInPooler: string[]
    statsByEndpoint: { endpoint: string; errors1h: number; errors24h: number; inCanary: boolean }[]
    summary: {
      canaryErrors24h: number
      canaryErrors1h: number
      nonCanaryErrors24h: number
      nonCanaryErrors1h: number
    }
  }
  endpoints?: Array<{
    endpoint: string
    totalErrors24h: number
    errors5xx24h: number
    errors4xx24h: number
    avgDurationMs: number
    maxDurationMs: number
    inCanary: boolean
  }>
  pooler?:
    | {
        available: true
        clActive: number; clWaiting: number
        svActive: number; svIdle: number; svUsed: number
        maxwaitMs: number; poolMode: string
        queryCount: number; bytesReceived: number; bytesSent: number
        avgQueryTimeMs: number; avgWaitTimeMs: number
      }
    | { available: false }
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
      const authHeaders = await getAuthHeaders()
      if (!authHeaders['Authorization']) { setError('No autenticado'); return }

      // Timeout 20s: si el server cuelga, mostramos error en lugar de spinner infinito.
      // 8 queries paralelas en /api/admin/infra-stats deberían tardar <3s en condiciones normales.
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 20000)

      try {
        const res = await adminFetch('/api/admin/infra-stats', {
          headers: authHeaders,
          signal: controller.signal,
        })
        clearTimeout(timeoutId)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        setStats(data)
      } finally {
        clearTimeout(timeoutId)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido'
      // Detectar AbortError para mensaje más claro
      if (err instanceof Error && err.name === 'AbortError') {
        setError('Timeout: el servidor tardó >20s en responder. Refresca para reintentar.')
      } else {
        setError(msg)
      }
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

      {/* Guía rápida — cómo leer este panel */}
      <details className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <summary className="text-sm font-semibold text-blue-900 dark:text-blue-100 cursor-pointer">
          📖 ¿Cómo leer este panel? (clic para expandir)
        </summary>
        <div className="mt-3 space-y-3 text-xs text-gray-700 dark:text-gray-300">
          <div>
            <strong className="text-blue-700 dark:text-blue-300">🟢 Todo bien si:</strong>
            <ul className="list-disc list-inside mt-1 space-y-0.5 ml-2">
              <li><strong>Conexiones BD &lt; 50%</strong> (verde) — pool de Supabase con margen</li>
              <li><strong>Pooler propio · maxwait = 0</strong> — nadie espera por conexión</li>
              <li><strong>Pooler propio · cl_waiting = 0</strong> — sin saturación</li>
              <li><strong>Canary 0/0/0/0</strong> — sin errores 5xx en 1h ni 24h</li>
            </ul>
          </div>
          <div>
            <strong className="text-yellow-700 dark:text-yellow-400">🟡 Atención si:</strong>
            <ul className="list-disc list-inside mt-1 space-y-0.5 ml-2">
              <li><strong>Conexiones BD 50-75%</strong> (naranja) — vigilar tendencia, considerar migrar más al pooler</li>
              <li><strong>Pooler · Avg wait &gt; 5ms</strong> — pool empieza a saturar</li>
              <li><strong>Algún endpoint del pooler con 5xx</strong> en tabla — investigar bug</li>
            </ul>
          </div>
          <div>
            <strong className="text-red-700 dark:text-red-400">🔴 Acción inmediata si:</strong>
            <ul className="list-disc list-inside mt-1 space-y-0.5 ml-2">
              <li><strong>Conexiones BD &gt; 75%</strong> (rojo) — riesgo cercano de rechazo de conexiones (max 90)</li>
              <li><strong>Pooler · maxwait &gt; 100ms</strong> — pool saturado, subir <code>default_pool_size</code> en pgbouncer.ini</li>
              <li><strong>Pooler · cl_waiting &gt; 0 sostenido</strong> — clientes esperando, blip o saturación</li>
              <li><strong>Errores 5xx en endpoints del pooler</strong> &gt; baseline — toggle <code>USE_SELF_HOSTED_POOLER=false</code> y avisar a Claude</li>
            </ul>
          </div>
          <div>
            <strong className="text-gray-700 dark:text-gray-300">🔄 Rollback global (&lt;30s):</strong> Vercel → Settings → Environment Variables → cambiar <code>USE_SELF_HOSTED_POOLER</code> a <code>false</code> → redeploy. Tráfico vuelve al Supavisor regional.
          </div>
        </div>
      </details>

      {/* Cards principales */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card
          label="Conexiones BD"
          value={`${db.totalConnections}/${db.maxConnections}`}
          sub={`${db.usagePercent}% uso · ideal <50%`}
          color={usageColor}
          hint="Conexiones abiertas a Supabase Postgres ahora mismo. Max 90 (Pro plan)."
        />
        <Card
          label="Usuarios hoy"
          value={traffic.usersToday.toString()}
          sub={`${traffic.sessionsToday} sesiones`}
          hint="DAU (daily active users) — resetea a medianoche UTC."
        />
        <Card
          label="Preguntas hoy"
          value={traffic.questionsToday.toLocaleString('es-ES')}
          sub={`${Math.round(traffic.questionsToday / Math.max(traffic.usersToday, 1))} por usuario`}
          hint="Total preguntas respondidas hoy. >10 por usuario = engagement saludable."
        />
        <Card
          label="Pico concurrente"
          value={traffic.peakConcurrent.toString()}
          sub="sesiones simultáneas"
          hint="Máximo simultáneo del día. Útil para capacity planning."
        />
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

      {/* Self-hosted Pooler — stats vivos del pgbouncer */}
      {stats.pooler && stats.pooler.available && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-blue-200 dark:border-blue-800 p-4">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            Pooler propio — pooler.vence.es:6543 (PgBouncer)
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
            Stats en vivo desde la admin DB del PgBouncer self-hosted en AWS Lightsail London.
            Si <code className="text-xs">maxwait</code> sube de 50ms consistentemente → considera subir <code className="text-xs">default_pool_size</code> en pgbouncer.ini.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <PoolerCard label="Clientes activos" value={stats.pooler.clActive} hint="lambdas Vercel conectadas ahora" />
            <PoolerCard label="Clientes en espera" value={stats.pooler.clWaiting} alert={stats.pooler.clWaiting > 0} hint="esperando conexión upstream" />
            <PoolerCard label="Server activas" value={stats.pooler.svActive} hint="conexiones a Supabase ocupadas" />
            <PoolerCard label="Server idle" value={stats.pooler.svIdle} hint="listas para usar" />
            <PoolerCard label="Maxwait" value={`${stats.pooler.maxwaitMs}ms`} alert={stats.pooler.maxwaitMs > 100} hint="máx. tiempo que un cliente esperó" />
            <PoolerCard label="Avg query" value={`${stats.pooler.avgQueryTimeMs}ms`} hint="latencia media (pooler→Supabase)" />
            <PoolerCard label="Avg wait" value={`${stats.pooler.avgWaitTimeMs}ms`} hint="espera media en pool" />
            <PoolerCard label="Queries totales" value={stats.pooler.queryCount.toLocaleString('es-ES')} hint="desde último restart" />
          </div>

          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 border-t border-gray-100 dark:border-gray-700 pt-3">
            <span>
              Tráfico: <span className="font-mono">{(stats.pooler.bytesReceived / 1024 / 1024).toFixed(1)} MB</span> in /
              {' '}<span className="font-mono">{(stats.pooler.bytesSent / 1024 / 1024).toFixed(1)} MB</span> out
            </span>
            <span>Modo pool: <code>{stats.pooler.poolMode}</code></span>
          </div>
        </div>
      )}

      {stats.pooler && !stats.pooler.available && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Pooler propio</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No disponible. <code>DATABASE_URL_SELF_POOLER</code> no configurada o conexión a admin DB falló.
          </p>
        </div>
      )}

      {/* Canary self-hosted pooler */}
      {stats.canary && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            Canary self-hosted pooler — comparativa 5xx por endpoint
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
            Endpoints en pooler propio (<code className="text-xs">pooler.vence.es</code>) vs los que siguen contra Supavisor regional.
            Si la hipótesis del canary funciona, los del pooler deberían tener 0 errores mientras los del Supavisor pueden mostrar blips.
            <br />
            <span className="italic">⚠️ El contador agrega todos los métodos HTTP por endpoint (validation_error_logs no guarda el método). Endpoints con migración parcial significativa (ej: <code className="text-xs">/api/questions/filtered</code> POST no migrado) se excluyen del flag canary para no falsear el panel.</span>
          </p>

          {/* Resumen comparativo */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <CanarySummaryCard
              label="Pooler propio · 1h"
              value={stats.canary.summary.canaryErrors1h}
              isPooler
            />
            <CanarySummaryCard
              label="Pooler propio · 24h"
              value={stats.canary.summary.canaryErrors24h}
              isPooler
            />
            <CanarySummaryCard
              label="Supavisor · 1h"
              value={stats.canary.summary.nonCanaryErrors1h}
            />
            <CanarySummaryCard
              label="Supavisor · 24h"
              value={stats.canary.summary.nonCanaryErrors24h}
            />
          </div>

          {/* Tabla detallada */}
          {stats.canary.statsByEndpoint.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                  <tr>
                    <th className="text-left py-2 font-normal">Endpoint</th>
                    <th className="text-center py-2 font-normal">Pooler propio</th>
                    <th className="text-right py-2 font-normal">5xx 1h</th>
                    <th className="text-right py-2 font-normal">5xx 24h</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.canary.statsByEndpoint.map((r) => (
                    <tr key={r.endpoint} className="border-b border-gray-100 dark:border-gray-800">
                      <td className="py-2 font-mono text-xs text-gray-700 dark:text-gray-300">{r.endpoint}</td>
                      <td className="py-2 text-center">
                        {r.inCanary ? (
                          <span className="inline-block px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">Sí</span>
                        ) : (
                          <span className="inline-block px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400">No (Supavisor)</span>
                        )}
                      </td>
                      <td className="py-2 text-right">
                        <ErrorBadge count={r.errors1h} />
                      </td>
                      <td className="py-2 text-right">
                        <ErrorBadge count={r.errors24h} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-green-600 dark:text-green-400">
              Sin errores 5xx en las últimas 24h en ningún endpoint. Todo limpio.
            </p>
          )}
        </div>
      )}

      {/* Endpoints — tabla detallada con routing + duración + errores 24h */}
      {stats.endpoints && stats.endpoints.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            Endpoints — routing + errores 24h + latencia (cuando hay error)
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
            Top 30 endpoints con errores en las últimas 24h. Solo se loguean errores; las duraciones son de respuestas que fallaron.
            Si un endpoint del pooler propio aparece con errores 5xx → algo va mal en el pooler. Si aparecen muchos en Supavisor → blip regional confirmado.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="text-left py-2 font-normal">Endpoint</th>
                  <th className="text-center py-2 font-normal">Routing</th>
                  <th className="text-right py-2 font-normal">5xx</th>
                  <th className="text-right py-2 font-normal">4xx</th>
                  <th className="text-right py-2 font-normal">Avg ms</th>
                  <th className="text-right py-2 font-normal">Max ms</th>
                </tr>
              </thead>
              <tbody>
                {stats.endpoints.map((r) => (
                  <tr key={r.endpoint} className="border-b border-gray-100 dark:border-gray-800">
                    <td className="py-2 font-mono text-xs text-gray-700 dark:text-gray-300 truncate max-w-md">{r.endpoint}</td>
                    <td className="py-2 text-center">
                      {r.inCanary ? (
                        <span className="inline-block px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">Pooler</span>
                      ) : (
                        <span className="inline-block px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400">Supavisor</span>
                      )}
                    </td>
                    <td className="py-2 text-right"><ErrorBadge count={r.errors5xx24h} /></td>
                    <td className="py-2 text-right text-xs text-gray-500 dark:text-gray-400 font-mono">{r.errors4xx24h}</td>
                    <td className="py-2 text-right text-xs font-mono">
                      <DurationBadge ms={r.avgDurationMs} />
                    </td>
                    <td className="py-2 text-right text-xs font-mono">
                      <DurationBadge ms={r.maxDurationMs} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
                  <span className="text-gray-400">{new Date(e.date).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
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

function Card({ label, value, sub, color, hint }: { label: string; value: string; sub?: string; color?: string; hint?: string }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color || 'text-gray-900 dark:text-white'}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
      {hint && <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-2 leading-tight italic">{hint}</p>}
    </div>
  )
}

function StateIndicator({ state }: { state: string }) {
  const color = state === 'active' ? 'bg-green-500'
    : state === 'idle' ? 'bg-gray-400'
    : 'bg-yellow-500'
  return <span className={`inline-block w-2 h-2 rounded-full ${color} mr-1`} />
}

function ErrorBadge({ count }: { count: number }) {
  if (count === 0) {
    return <span className="text-xs text-green-600 dark:text-green-400 font-mono">0</span>
  }
  const color = count > 10
    ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
    : count > 3
    ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
    : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
  return (
    <span className={`inline-block px-2 py-0.5 text-xs rounded font-mono ${color}`}>
      {count}
    </span>
  )
}

function PoolerCard({ label, value, hint, alert }: { label: string; value: string | number; hint?: string; alert?: boolean }) {
  const valueColor = alert ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'
  const borderColor = alert ? 'border-red-200 dark:border-red-800 bg-red-50/30 dark:bg-red-900/10' : 'border-gray-200 dark:border-gray-700'
  return (
    <div className={`rounded-lg border ${borderColor} p-3`}>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{label}</p>
      <p className={`text-lg font-bold ${valueColor}`}>{value}</p>
      {hint && <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1 leading-tight">{hint}</p>}
    </div>
  )
}

function DurationBadge({ ms }: { ms: number }) {
  if (!ms || ms === 0) return <span className="text-gray-400">—</span>
  const color = ms > 5000
    ? 'text-red-600 dark:text-red-400'
    : ms > 2000
    ? 'text-orange-600 dark:text-orange-400'
    : ms > 500
    ? 'text-yellow-600 dark:text-yellow-400'
    : 'text-gray-700 dark:text-gray-300'
  return <span className={color}>{ms.toLocaleString('es-ES')}</span>
}

function CanarySummaryCard({ label, value, isPooler }: { label: string; value: number; isPooler?: boolean }) {
  const valueColor = value === 0
    ? 'text-green-600 dark:text-green-400'
    : value > 10
    ? 'text-red-600 dark:text-red-400'
    : value > 3
    ? 'text-orange-600 dark:text-orange-400'
    : 'text-yellow-600 dark:text-yellow-400'
  const borderColor = isPooler
    ? 'border-blue-200 dark:border-blue-800 bg-blue-50/30 dark:bg-blue-900/10'
    : 'border-gray-200 dark:border-gray-700'
  return (
    <div className={`rounded-lg border ${borderColor} p-3`}>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{label}</p>
      <p className={`text-xl font-bold ${valueColor}`}>{value}</p>
    </div>
  )
}
