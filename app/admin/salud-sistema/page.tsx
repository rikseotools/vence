// app/admin/salud-sistema/page.tsx
// Panel admin de salud del sistema: 5 indicadores con semáforo.
//
//   1) Errores 5xx últimas 24h
//   2) Drift de contadores materializados últimas 24h
//   3) Latencia INSERT a test_questions (proxy_p95 desde pg_stat_statements)
//   4) Salud del cron de drift (¿corrió en últimas 36h?)
//   5) Capacidad pool BD — leading indicator (sampler 1×/min desde 2026-06-01)
//
// El runbook docs/runbooks/health-check.md explica qué hacer cuando un
// indicador se pone ámbar o rojo.
'use client'

import { useState, useEffect, useCallback } from 'react'
import { getAuthHeaders } from '@/lib/api/authHeaders'

type Status = 'green' | 'amber' | 'red' | 'unknown'

// Capacidad pool BD (endpoint /api/admin/pool-capacity desde 2026-06-01).
// Leading indicator: la tabla pool_capacity_samples se llena cada 1 min con
// el estado del pool postgres. Si vemos saturación SOSTENIDA antes del 5xx,
// el sistema avisa por aquí (y por las 4 alertas asociadas en alert-rules.ts).
interface PoolCapacityResponse {
  success: boolean
  generatedAt: string
  window: string
  currentStatus: 'green' | 'amber' | 'red' | null
  currentSample: {
    sample_at: string
    total_conns: number
    active_conns: number
    idle_in_tx_over_5s: number
    long_active_over_5s: number
    hung_clientread_over_10s: number
    frontend_active_conns: number
    ageSec: number
  } | null
  aggregate: {
    status: 'green' | 'amber' | 'red'
    samplesCount: number
    redCount: number
    amberCount: number
    greenCount: number
    maxActiveConns: number
    maxFrontendActive: number
    totalIdleInTxFlags: number
    totalHungCrFlags: number
    peakFrontendSaturationPct: number
  }
  samplerHealth: {
    lastSampleAt: string | null
    ageSec: number | null
    stale: boolean
  }
}

interface SystemHealthResponse {
  success: boolean
  generatedAt: string
  indicators: {
    errors_5xx: {
      status: Status
      count: number | null
      samples: Array<{ endpoint: string; error_type: string; created_at: string }>
      thresholds: { amber: number; red: number }
    }
    drift: {
      status: Status
      count: number | null
      samples: Array<{
        target_table: string
        field_name: string
        drift_pct: number | null
        user_id: string
        checked_at: string
        notes: string | null
      }>
      thresholds: { amber: number; red: number }
    }
    exam_integrity: {
      status: Status
      affected: number | null
      empty: number | null
      worst_missing: number | null
      last_detected_at: string | null
      samples: Array<{
        test_id?: string
        total_questions?: number
        row_count?: number
        missing?: number
        completed_at?: string | null
      }>
      thresholds: { amber: number; red: number }
      note: string
    }
    insert_latency: {
      status: Status
      mean_ms: number | null
      variants: Array<{
        mean_ms: number | string
        proxy_p95_ms: number | string
        max_ms: number | string
        stddev_ms: number | string
        calls: number
        query_snippet: string
      }>
      thresholds: { amber: number; red: number }
      note: string
    }
    drift_cron: {
      status: Status
      last_run_at: string | null
      stale_hours: number | null
      thresholds: { amber: string; red: string }
    }
  }
  error?: string
}

const STATUS_BADGE: Record<Status, string> = {
  green: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 border-green-300',
  amber: 'bg-yellow-100 text-yellow-900 dark:bg-yellow-900 dark:text-yellow-100 border-yellow-300',
  red: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100 border-red-400',
  unknown: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200 border-gray-300',
}

const STATUS_LABEL: Record<Status, string> = {
  green: 'OK',
  amber: 'Atención',
  red: 'Problema',
  unknown: 'Sin datos',
}

export default function SaludSistemaPage() {
  const [data, setData] = useState<SystemHealthResponse | null>(null)
  const [pool, setPool] = useState<PoolCapacityResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchHealth = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const headers = await getAuthHeaders()
      // Paralelo: system-health (4 indicadores existentes) + pool-capacity
      // (5º indicador). Si pool-capacity falla, el panel sigue mostrando los
      // 4 primeros — degradación elegante.
      const [healthRes, poolRes] = await Promise.allSettled([
        fetch('/api/admin/system-health', { headers }),
        fetch('/api/admin/pool-capacity?window=1h', { headers }),
      ])

      if (healthRes.status === 'fulfilled') {
        const json = (await healthRes.value.json()) as SystemHealthResponse
        if (!healthRes.value.ok) throw new Error(json.error || `HTTP ${healthRes.value.status}`)
        setData(json)
      } else {
        throw new Error(healthRes.reason instanceof Error ? healthRes.reason.message : 'system-health failed')
      }

      if (poolRes.status === 'fulfilled' && poolRes.value.ok) {
        const poolJson = (await poolRes.value.json()) as PoolCapacityResponse
        setPool(poolJson)
      } else {
        // pool-capacity opcional — si falla, indicador queda en "unknown" y
        // el resto del panel funciona. Comportamiento desde 2026-06-01:
        // mientras el endpoint no esté desplegado o haya error, mostramos el
        // resto sin romper el panel.
        setPool(null)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchHealth()
    // Auto-refresh cada 60s para que el panel esté siempre actualizado
    // sin tener que recargar a mano
    const t = setInterval(fetchHealth, 60_000)
    return () => clearInterval(t)
  }, [fetchHealth])

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
            Salud del sistema
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            4 indicadores en tiempo real. Auto-refresh cada 60s. Runbook:{' '}
            <code className="text-xs bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded">
              docs/runbooks/health-check.md
            </code>
          </p>
        </div>
        <button
          onClick={fetchHealth}
          disabled={loading}
          className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded transition-colors"
        >
          {loading ? 'Cargando…' : 'Refrescar ahora'}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-sm text-red-700 dark:text-red-300">
          Error: {error}
        </div>
      )}

      {data && (
        <>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
            Generado: {new Date(data.generatedAt).toLocaleString('es-ES')}
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 1) Errores 5xx */}
            <IndicatorCard
              title="Errores 5xx últimas 24h"
              status={data.indicators.errors_5xx.status}
              metric={String(data.indicators.errors_5xx.count ?? '—')}
              hint={`Umbrales: ámbar ≥${data.indicators.errors_5xx.thresholds.amber}, rojo ≥${data.indicators.errors_5xx.thresholds.red}`}
            >
              {data.indicators.errors_5xx.samples.length > 0 ? (
                <ul className="text-xs space-y-1 mt-2 max-h-48 overflow-y-auto">
                  {data.indicators.errors_5xx.samples.map((s, i) => (
                    <li key={i} className="text-gray-600 dark:text-gray-300">
                      <span className="font-mono">{s.endpoint}</span> · {s.error_type} ·{' '}
                      {new Date(s.created_at).toLocaleString('es-ES', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Sin errores críticos en 24h.</p>
              )}
            </IndicatorCard>

            {/* 2) Drift */}
            <IndicatorCard
              title="Drift contadores 24h (>5%)"
              status={data.indicators.drift.status}
              metric={String(data.indicators.drift.count ?? '—')}
              hint={`Umbrales: ámbar ≥${data.indicators.drift.thresholds.amber}, rojo ≥${data.indicators.drift.thresholds.red}`}
            >
              {data.indicators.drift.samples.length > 0 ? (
                <ul className="text-xs space-y-1 mt-2 max-h-48 overflow-y-auto">
                  {data.indicators.drift.samples.map((s, i) => (
                    <li key={i} className="text-gray-600 dark:text-gray-300">
                      <span className="font-mono">{s.target_table}.{s.field_name}</span>{' '}
                      · drift {s.drift_pct}% · user {s.user_id.slice(0, 8)}…
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  Sin drift significativo en 24h.
                </p>
              )}
            </IndicatorCard>

            {/* 2bis) Integridad de exámenes (filas test_questions vs total) */}
            <IndicatorCard
              title="Integridad exámenes 24h"
              status={data.indicators.exam_integrity.status}
              metric={String(data.indicators.exam_integrity.affected ?? '—')}
              hint={`Umbrales: ámbar ≥${data.indicators.exam_integrity.thresholds.amber}, rojo ≥${data.indicators.exam_integrity.thresholds.red}`}
            >
              {data.indicators.exam_integrity.affected && data.indicators.exam_integrity.affected > 0 ? (
                <>
                  <p className="text-xs text-gray-600 dark:text-gray-300 mt-2">
                    {data.indicators.exam_integrity.empty ?? 0} vacíos · faltan hasta{' '}
                    {data.indicators.exam_integrity.worst_missing ?? 0} preguntas en el peor caso
                  </p>
                  <ul className="text-xs space-y-1 mt-2 max-h-48 overflow-y-auto">
                    {data.indicators.exam_integrity.samples.map((s, i) => (
                      <li key={i} className="text-gray-600 dark:text-gray-300">
                        <span className="font-mono">{(s.test_id ?? '').slice(0, 8)}…</span>{' '}
                        · {s.row_count}/{s.total_questions} filas · faltan {s.missing}
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  Todos los exámenes con sus filas completas en 24h.
                </p>
              )}
            </IndicatorCard>

            {/* 3) Latencia INSERT */}
            <IndicatorCard
              title="Latencia INSERT test_questions"
              status={data.indicators.insert_latency.status}
              metric={
                data.indicators.insert_latency.mean_ms != null
                  ? `${data.indicators.insert_latency.mean_ms.toFixed(1)}ms`
                  : '—'
              }
              hint={`Umbrales mean: ámbar ≥${data.indicators.insert_latency.thresholds.amber}ms, rojo ≥${data.indicators.insert_latency.thresholds.red}ms`}
            >
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 italic">
                {data.indicators.insert_latency.note}
              </p>
              {data.indicators.insert_latency.variants.length > 0 && (
                <div className="mt-2 space-y-1 text-xs">
                  {data.indicators.insert_latency.variants.slice(0, 3).map((v, i) => (
                    <div key={i} className="text-gray-600 dark:text-gray-300">
                      <span className="font-mono">{Number(v.calls).toLocaleString()} calls</span>{' '}
                      · mean {Number(v.mean_ms).toFixed(2)}ms · max {Number(v.max_ms).toFixed(1)}ms
                    </div>
                  ))}
                </div>
              )}
            </IndicatorCard>

            {/* 4) Salud cron de drift */}
            <IndicatorCard
              title="Cron de drift (¿vivo?)"
              status={data.indicators.drift_cron.status}
              metric={
                data.indicators.drift_cron.stale_hours != null
                  ? `hace ${data.indicators.drift_cron.stale_hours}h`
                  : 'nunca'
              }
              hint={`Umbrales: ámbar ${data.indicators.drift_cron.thresholds.amber}, rojo ${data.indicators.drift_cron.thresholds.red}`}
            >
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                Última ejecución:{' '}
                {data.indicators.drift_cron.last_run_at
                  ? new Date(data.indicators.drift_cron.last_run_at).toLocaleString('es-ES')
                  : '—'}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Workflow: <code>.github/workflows/check-stats-drift.yml</code> · 04:00 UTC diario
              </p>
            </IndicatorCard>

            {/* 5) Capacidad pool BD — leading indicator (Acción 2 observability-capacity) */}
            <PoolCapacityCard pool={pool} />
          </div>
        </>
      )}
    </div>
  )
}

/**
 * Card para el 5º indicador "Capacidad pool BD".
 *
 * Status (calculado por el endpoint sobre los samples de la última 1h):
 *   - red: ≥1 muestra con idle-in-tx>5s o hung_clientread>10s o frontend_active≥13
 *   - amber: ≥3 muestras AMBER (long_active>5s sostenido, etc.)
 *   - green: todo limpio
 *   - unknown: endpoint no responde / sampler muerto (samplerHealth.stale=true)
 *
 * Métricas mostradas:
 *   - "ageSec" del último sample: si >180s = sampler muerto (RED forzado)
 *   - peakFrontendSaturationPct: %% del techo del pool (2 tasks × max:8 = 16)
 *   - Contadores agregados de banderas rojas en última hora
 */
function PoolCapacityCard({ pool }: { pool: PoolCapacityResponse | null }) {
  if (!pool) {
    return (
      <IndicatorCard
        title="Capacidad pool BD"
        status="unknown"
        metric="—"
        hint="Endpoint /api/admin/pool-capacity no responde (¿cron pool-capacity-sampler muerto?)"
      >
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 italic">
          Sin datos del sampler. Investigar:{' '}
          <code className="text-xs">SELECT MAX(sample_at) FROM pool_capacity_samples;</code>
        </p>
      </IndicatorCard>
    )
  }

  // Si el sampler está stale, override a 'red' independientemente del status
  // calculado (lo más prudente — sin datos no podemos saber si hay problema).
  const effectiveStatus: Status = pool.samplerHealth.stale
    ? 'red'
    : (pool.currentStatus ?? 'unknown')

  const metric =
    pool.currentSample != null
      ? `${pool.currentSample.frontend_active_conns}/16 conns frontend`
      : '—'

  const sat = pool.aggregate.peakFrontendSaturationPct
  return (
    <IndicatorCard
      title="Capacidad pool BD (sampler 1×/min)"
      status={effectiveStatus}
      metric={metric}
      hint={`Pico saturación últ. 1h: ${sat}% (techo: 2 tasks × max:8 = 16 conns)`}
    >
      {pool.samplerHealth.stale ? (
        <p className="text-xs text-red-700 dark:text-red-300 mt-2 font-medium">
          ⚠️ Sampler stale: última muestra hace{' '}
          {pool.samplerHealth.ageSec != null ? `${pool.samplerHealth.ageSec}s` : 'nunca'}
          . Esperado &lt; 180s. Cron pool-capacity-sampler probablemente muerto.
        </p>
      ) : (
        <div className="mt-2 space-y-1 text-xs text-gray-600 dark:text-gray-300">
          <div>
            <span className="font-medium">Última muestra:</span>{' '}
            hace {pool.currentSample?.ageSec ?? '?'}s · {pool.aggregate.samplesCount} samples en 1h
          </div>
          <div>
            <span className="font-medium">Distribución 1h:</span>{' '}
            <span className="text-green-700 dark:text-green-400">{pool.aggregate.greenCount} 🟢</span>
            {pool.aggregate.amberCount > 0 && (
              <>
                {' · '}
                <span className="text-yellow-700 dark:text-yellow-400">{pool.aggregate.amberCount} 🟡</span>
              </>
            )}
            {pool.aggregate.redCount > 0 && (
              <>
                {' · '}
                <span className="text-red-700 dark:text-red-400 font-bold">{pool.aggregate.redCount} 🔴</span>
              </>
            )}
          </div>
          {(pool.aggregate.totalIdleInTxFlags > 0 ||
            pool.aggregate.totalHungCrFlags > 0) && (
            <div className="text-red-700 dark:text-red-300">
              ⚠️ Banderas rojas 1h: idle-in-tx={pool.aggregate.totalIdleInTxFlags} ·
              hung-ClientRead={pool.aggregate.totalHungCrFlags}
            </div>
          )}
        </div>
      )}
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 italic">
        Roadmap: <code>docs/roadmap/observability-capacity.md</code> Acción 2.
        Detalle SQL: <code>SELECT * FROM v_pool_capacity_last_15min;</code>
      </p>
    </IndicatorCard>
  )
}

function IndicatorCard({
  title,
  status,
  metric,
  hint,
  children,
}: {
  title: string
  status: Status
  metric: string
  hint: string
  children?: React.ReactNode
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-medium text-gray-900 dark:text-gray-100">{title}</h3>
        <span
          className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_BADGE[status]}`}
        >
          {STATUS_LABEL[status]}
        </span>
      </div>
      <p className="text-3xl font-semibold text-gray-900 dark:text-gray-50 mt-3">
        {metric}
      </p>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{hint}</p>
      {children}
    </div>
  )
}
