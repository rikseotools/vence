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
import { runbookForKind, runbookGuideRows } from '@/lib/admin/runbookRegistry'
import { LANDING_SURFACES } from '@/lib/admin/landingSurfaces'
import { adminFetch } from '@/lib/api/adminFetch'
import { getAuthHeaders } from '@/lib/api/authHeaders'

type Status = 'green' | 'amber' | 'red' | 'unknown'

// Capacidad pool BD (endpoint /api/admin/pool-capacity desde 2026-06-01).
// Leading indicator: la tabla pool_capacity_samples se llena cada 1 min con
// el estado del pool postgres. Si vemos saturación SOSTENIDA antes del 5xx,
// el sistema avisa por aquí (y por las 4 alertas asociadas en alert-rules.ts).
interface ContentHealthFinding { severity: string; oposicion_slug: string | null; kind: string; message: string }
interface ContentHealthResponse {
  counts: { appError: number; contentError: number; contentWarn: number }
  status: 'green' | 'amber' | 'red'
  badge: number
  computedAt: string | null
  stale: boolean
  content: ContentHealthFinding[]
  app: ContentHealthFinding[]
}

interface OepConsistencyResponse {
  status: 'green' | 'amber' | 'red'
  generatedAt: string
  checks: {
    estados_stale: { status: Status; count: number; detail: string; sample: { slug: string | null; estado: string | null; deadline: string | null }[] }
    pending_anejas: { status: Status; count: number; detail: string }
    activas_sin_hitos: { status: Status; count: number; detail: string; sample: (string | null)[] }
  }
}

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
    /**
     * CATCH-ALL de señales (el endpoint ya lo calculaba desde el 05/07 con la garantía
     * "sin gaps por diseño"… pero el panel NO lo pintaba, así que nadie lo veía. Es lo
     * que dejó 13 tipos de evento graves un mes sin triar, entre ellos 991
     * `server_render_error`). Auditoría 29/07/2026.
     */
    error_signals?: {
      status: Status
      actionableCount: number
      signals: Array<{
        source: string
        eventType: string
        severity: string
        count: number
        topEndpoint: string | null
        benign: boolean
        /** Tiene regla de alerta propia → suena el email por su umbral fino. */
        vigilada?: boolean
      }>
      thresholds: { amber: string; red: string }
      note?: string
    }
    // ─── LA FLOTA DE TRABAJADORES (T-486) ───
    // `flota` puede no venir: el endpoint es resiliente por indicador y este puede quedar
    // `unknown` sin tumbar el panel. Opcional a propósito.
    flota?: {
      status: Status
      vivos: number | null
      esperados: number | null
      entregas_esperando: number | null
      borradores_esperando: number | null
      turnos_muertos_3h: number | null
      espera_max_h: number | null
      detalle: string | null
    }
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
    endpoint_latency: {
      status: Status
      bucketMinutes: number
      minSamples: number
      thresholds: { user_facing: { amber: number; red: number }; admin: { amber: number; red: number } }
      measured: number
      degraded: Array<{
        endpoint: string
        status: Status
        p95_ms: number
        samples: number
        category: 'admin' | 'user_facing'
        small_sample: boolean
        worst_bucket_at: string
      }>
      sustained: Array<{
        endpoint: string
        desde: string
        buckets: number
        minutos: number
        peorP95Ms: number
      }>
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
    cache: {
      status: Status
      provider: string | null
      latencyMs: number | null
      last_at: string | null
      thresholds: { amber: string; red: string }
      note: string
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
  const [oep, setOep] = useState<OepConsistencyResponse | null>(null)
  const [content, setContent] = useState<ContentHealthResponse | null>(null)
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
      const [healthRes, poolRes, oepRes, contentRes] = await Promise.allSettled([
        adminFetch('/api/admin/system-health', { headers }),
        adminFetch('/api/admin/pool-capacity?window=1h', { headers }),
        adminFetch('/api/admin/oep-consistency', { headers }),
        adminFetch('/api/admin/content-health', { headers }),
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

      // OEP consistency (6º indicador) — opcional, degradación elegante.
      if (oepRes.status === 'fulfilled' && oepRes.value.ok) {
        setOep((await oepRes.value.json()) as OepConsistencyResponse)
      } else {
        setOep(null)
      }

      // Salud de contenido (indicador nuevo) — lee el snapshot del sweep nocturno.
      if (contentRes.status === 'fulfilled' && contentRes.value.ok) {
        setContent((await contentRes.value.json()) as ContentHealthResponse)
      } else {
        setContent(null)
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
            8 indicadores en tiempo real. Auto-refresh cada 60s. Runbook:{' '}
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
            {/* 0) LA FLOTA — va la primera porque una flota parada NO SE NOTA: sigue en el
                registro, nadie recibe una queja, y puede estar así horas. (T-486) */}
            {data.indicators.flota && (
              <IndicatorCard
                title="🤖 Flota de trabajadores"
                status={data.indicators.flota.status}
                metric={
                  data.indicators.flota.esperados
                    ? `${data.indicators.flota.vivos ?? '—'}/${data.indicators.flota.esperados}`
                    : '—'
                }
                hint="Trabajadores dando señal. El detalle vivo (¿está ejecutando?): npm run flota"
              >
                <p className="text-xs text-gray-600 dark:text-gray-300 mt-2">
                  {data.indicators.flota.detalle ?? 'sin datos'}
                </p>
                <ul className="text-xs space-y-1 mt-2 text-gray-600 dark:text-gray-300">
                  <li>
                    🙋 <strong>{data.indicators.flota.entregas_esperando ?? '—'}</strong> entrega(s) esperando revisión
                    {data.indicators.flota.espera_max_h != null && ` · la más vieja, ${data.indicators.flota.espera_max_h} h`}
                  </li>
                  <li>
                    📝 <strong>{data.indicators.flota.borradores_esperando ?? '—'}</strong> borrador(es) esperando tu OK
                    {' '}<span className="text-gray-400">(nada de eso se ha enviado)</span>
                  </li>
                  <li>
                    ↻ <strong>{data.indicators.flota.turnos_muertos_3h ?? '—'}</strong> turno(s) muerto(s) con la tarea cogida (3 h)
                  </li>
                </ul>
              </IndicatorCard>
            )}

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

            {/* 3-bis) Latencia POR ENDPOINT (T-254) — el agregado global daba VERDE mientras
                `answer-and-save` estaba a 25 s. Aquí manda el PEOR endpoint, no el promedio. */}
            <IndicatorCard
              title="Latencia por endpoint (peor cubo 5 min)"
              status={data.indicators.endpoint_latency.status}
              metric={
                data.indicators.endpoint_latency.degraded.length > 0
                  ? `${data.indicators.endpoint_latency.degraded[0].p95_ms.toLocaleString('es-ES')}ms`
                  : '—'
              }
              hint={`user-facing: ámbar ≥${data.indicators.endpoint_latency.thresholds.user_facing.amber}ms, rojo ≥${data.indicators.endpoint_latency.thresholds.user_facing.red}ms · ${data.indicators.endpoint_latency.measured} endpoints medidos`}
            >
              {data.indicators.endpoint_latency.sustained.length > 0 && (
                <div className="mt-2 space-y-1 text-xs">
                  <p className="font-semibold text-red-700 dark:text-red-400">
                    Degradación sostenida (esto es lo que alerta):
                  </p>
                  {data.indicators.endpoint_latency.sustained.slice(0, 3).map((s, i) => (
                    <div key={i} className="text-gray-700 dark:text-gray-300">
                      <span className="font-mono">{s.endpoint}</span> · {s.minutos} min ·
                      peor p95 {s.peorP95Ms.toLocaleString('es-ES')}ms
                      <span className="text-gray-500"> ({new Date(s.desde).toLocaleString('es-ES')})</span>
                    </div>
                  ))}
                </div>
              )}
              {data.indicators.endpoint_latency.degraded.length > 0 ? (
                <div className="mt-2 space-y-1 text-xs">
                  {data.indicators.endpoint_latency.degraded.slice(0, 6).map((d, i) => (
                    <div key={i} className="text-gray-600 dark:text-gray-300">
                      <span className={d.status === 'red' ? 'text-red-600' : 'text-amber-600'}>
                        {d.status === 'red' ? '🔴' : '🟠'}
                      </span>{' '}
                      <span className="font-mono">{d.endpoint}</span> · p95{' '}
                      {d.p95_ms.toLocaleString('es-ES')}ms · n={d.samples}
                      {d.category === 'admin' && <span className="text-gray-400"> (admin)</span>}
                      {d.small_sample && (
                        <span className="text-gray-400" title="Menos de 20 muestras: este p95 es en realidad el máximo del cubo. Los 2xx/3xx se muestrean al 10%, así que una petición lenta observada son ~10 reales.">
                          {' '}· muestra corta (p95 = máx)
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  Ningún endpoint degradado en la ventana.
                </p>
              )}
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 italic">
                {data.indicators.endpoint_latency.note}
              </p>
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

            {/* Caché (ElastiCache/Upstash) — fallo SILENCIOSO (cae a BD sin error) */}
            <IndicatorCard
              title="Caché (ElastiCache)"
              status={data.indicators.cache.status}
              metric={
                data.indicators.cache.latencyMs != null
                  ? `${data.indicators.cache.latencyMs}ms`
                  : data.indicators.cache.status === 'unknown'
                    ? 'sin datos'
                    : 'OK'
              }
              hint={`Proveedor: ${data.indicators.cache.provider ?? '—'} · ámbar ${data.indicators.cache.thresholds.amber}, rojo ${data.indicators.cache.thresholds.red}`}
            >
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                Último canary:{' '}
                {data.indicators.cache.last_at
                  ? new Date(data.indicators.cache.last_at).toLocaleString('es-ES')
                  : '—'}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Canary <code>canary-redis-upstash</code> (SET+GET+verify cada 5 min). Fallo = caché caída → la app degrada a BD sin error visible.
              </p>
            </IndicatorCard>

            {/* 5) Capacidad pool BD — leading indicator (Acción 2 observability-capacity) */}
            <PoolCapacityCard pool={pool} />

            {/* 6) Coherencia OEP — estados stale, señales pending añejas, activas sin hitos (16/06/2026) */}
            <OepConsistencyCard oep={oep} />

            {/* 7) Salud de CONTENIDO — snapshot del sweep nocturno (tarjetas de plazas/temas, dual-write, cobertura). Calidad, no fallos de app. */}
            <ContentHealthCard content={content} />

            {/* 8) TODAS las señales (catch-all). El endpoint ya las calculaba; faltaba
                enseñarlas. Aquí es donde aparece cualquier evento nuevo sin tener que
                crear una tarjeta por cada uno: se ve, y se tría desde aquí. */}
            <ErrorSignalsCard signals={data.indicators.error_signals} />
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

/**
 * Card del 6º indicador "Coherencia OEP" (endpoint /api/admin/oep-consistency).
 * Vigila incoherencias en datos de convocatorias (16/06/2026):
 *   - estados stale (plazo vencido sin avanzar — ¿cron advance-estado?)
 *   - señales OEP pending >7d sin revisar (cola de triaje estancada)
 *   - oposiciones activas sin hitos (timeline vacío)
 */
function OepConsistencyCard({ oep }: { oep: OepConsistencyResponse | null }) {
  if (!oep) {
    return (
      <IndicatorCard
        title="Coherencia OEP"
        status="unknown"
        metric="—"
        hint="Endpoint /api/admin/oep-consistency no responde"
      >
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 italic">
          Sin datos. Panel <code>/admin/oep-signals</code>.
        </p>
      </IndicatorCard>
    )
  }

  const c = oep.checks
  const total = c.estados_stale.count + c.pending_anejas.count + c.activas_sin_hitos.count
  const metric = total === 0 ? 'Sin incidencias' : `${total} incidencia(s)`
  return (
    <IndicatorCard
      title="Coherencia OEP"
      status={oep.status}
      metric={metric}
      hint="Estados stale · señales pending añejas · activas sin hitos"
    >
      <div className="mt-2 space-y-1 text-xs text-gray-600 dark:text-gray-300">
        <div>
          <span className="font-medium">Estados stale:</span>{' '}
          {c.estados_stale.count === 0 ? '0 🟢' : `${c.estados_stale.count} ⚠️`}
          {c.estados_stale.count > 0 && (
            <span className="text-gray-500"> ({c.estados_stale.sample.map((s) => s.slug).filter(Boolean).join(', ')})</span>
          )}
        </div>
        <div>
          <span className="font-medium">Señales pending &gt;7d:</span>{' '}
          {c.pending_anejas.count === 0 ? '0 🟢' : `${c.pending_anejas.count} ⚠️`}
        </div>
        <div>
          <span className="font-medium">Activas sin hitos:</span>{' '}
          {c.activas_sin_hitos.count === 0 ? '0 🟢' : `${c.activas_sin_hitos.count} ⚠️`}
          {c.activas_sin_hitos.count > 0 && (
            <span className="text-gray-500"> ({c.activas_sin_hitos.sample.filter(Boolean).join(', ')})</span>
          )}
        </div>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 italic">
        Gestión: <code>/admin/oep-signals</code>. Cron <code>advance-estado</code> 06:30 UTC.
      </p>
    </IndicatorCard>
  )
}

/**
 * Card CATCH-ALL: toda señal error/warn agrupada por tipo.
 *
 * Existe porque el endpoint ya devolvía `error_signals` con la garantía "sin gaps por
 * diseño" y el panel no lo mostraba: la señal estaba y nadie la veía. Las benignas se
 * listan igual (nada oculto) pero en gris y sin contar para el semáforo, para que lo
 * accionable no se pierda entre el ruido.
 */
function ErrorSignalsCard({ signals }: { signals?: SystemHealthResponse['indicators']['error_signals'] }) {
  if (!signals) {
    return (
      <IndicatorCard title="Todas las señales (24h)" status="unknown" metric="—" hint="El endpoint no devolvió el catch-all">
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 italic">Sin datos.</p>
      </IndicatorCard>
    )
  }
  type Senal = NonNullable<SystemHealthResponse['indicators']['error_signals']>['signals'][number]
  const accionables = signals.signals.filter((s: Senal) => !s.benign)
  const benignas = signals.signals.filter((s: Senal) => s.benign)
  return (
    <IndicatorCard
      title="Todas las señales (24h)"
      status={signals.status}
      metric={String(signals.actionableCount)}
      hint={`Ámbar ${signals.thresholds.amber}, rojo ${signals.thresholds.red}. Las benignas se listan abajo pero no cuentan. Triaje: runbook §1.ter.a`}
    >
      {accionables.length > 0 ? (
        <ul className="text-xs space-y-1 mt-2 max-h-56 overflow-y-auto">
          {accionables.map((s: Senal, i: number) => (
            <li key={i} className="text-gray-700 dark:text-gray-200 flex items-start gap-2">
              <span className="font-mono shrink-0 tabular-nums">{s.count}</span>
              <span>
                <span className="font-medium">{s.eventType}</span>
                <span className="text-gray-400"> · {s.source} · {s.severity}</span>
                {s.topEndpoint ? <span className="text-gray-500 font-mono"> · {s.topEndpoint}</span> : null}
                {s.vigilada
                  ? <span className="ml-1 text-[10px] text-green-600 dark:text-green-400">✉ alerta propia</span>
                  : <span className="ml-1 text-[10px] text-amber-600 dark:text-amber-400">solo catch-all (≥150/h)</span>}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Sin señales accionables en 24h.</p>
      )}
      {benignas.length > 0 && (
        <details className="mt-3">
          <summary className="text-xs text-gray-400 cursor-pointer">
            {benignas.length} señal(es) benigna(s) conocida(s)
          </summary>
          <ul className="text-xs space-y-1 mt-2 max-h-40 overflow-y-auto">
            {benignas.map((s: Senal, i: number) => (
              <li key={i} className="text-gray-400">
                <span className="font-mono tabular-nums">{s.count}</span> · {s.eventType}
              </li>
            ))}
          </ul>
        </details>
      )}
    </IndicatorCard>
  )
}

/**
 * Card de Salud de CONTENIDO (endpoint /api/admin/content-health, snapshot del sweep
 * nocturno). Calidad de datos (tarjetas de plazas/temas, dual-write, cobertura), NO
 * fallos de app. Rojo = incoherencia (❌), ámbar = menores (🟡), verde = limpio.
 */
function ContentHealthCard({ content }: { content: ContentHealthResponse | null }) {
  if (!content) {
    return (
      <IndicatorCard title="Salud del contenido" status="unknown" metric="—" hint="Endpoint /api/admin/content-health no responde (¿sweep aún no corrió?)">
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 italic">Sin datos del sweep nocturno.</p>
      </IndicatorCard>
    )
  }
  const { counts } = content
  const metric = content.badge === 0 ? 'Sin incidencias' : `${counts.contentError} ❌ / ${counts.contentWarn} 🟡`
  const when = content.computedAt ? new Date(content.computedAt).toLocaleString('es-ES', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) : '—'
  return (
    <IndicatorCard title="Salud del contenido" status={content.status} metric={metric} hint={`Sweep: ${when}${content.stale ? ' · ⚠️ stale (>36h)' : ''} · calidad, no fallos de app`}>
      {content.content.length > 0 ? (
        <ul className="text-xs space-y-1 mt-2 max-h-56 overflow-y-auto">
          {content.content.map((f, i) => {
            const rb = runbookForKind(f.kind)
            return (
              <li key={i} className={f.severity === 'error' ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'}>
                {f.severity === 'error' ? '❌' : '🟡'}{' '}
                {f.oposicion_slug && <span className="font-mono">{f.oposicion_slug}</span>} · {f.message}
                {rb && (
                  <span
                    className="ml-1 inline-block px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-[11px] whitespace-nowrap"
                    title={`Runbook: ${rb.runbook ?? '—'} · ${rb.claudeHace}`}
                  >
                    → dile a Claude: «{rb.triggerPhrase}»
                  </span>
                )}
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Contenido coherente (0 incoherencias).</p>
      )}
      <RunbookGuide />
      <LandingCoverage />
    </IndicatorCard>
  )
}

/**
 * Cobertura de la landing: qué ve el opositor ↔ qué detector lo vigila, y DÓNDE hay hueco.
 * Data-driven desde lib/admin/landingSurfaces.ts (fuente única, con guardarraíl en CI).
 *
 * Por qué está aquí y no en un documento: la guía de arriba contesta "tengo un hallazgo, ¿qué
 * hago?"; esta contesta la pregunta que nadie podía hacer antes de T-134 — "¿qué parte de la
 * landing NO está vigilada por nadie?". El caso que lo motivó (el botón oficial llevando al portal
 * en inglés con el plazo abierto) fue invisible durante semanas porque esa pregunta no tenía sitio.
 */
function LandingCoverage() {
  const [open, setOpen] = useState(false)
  const surfaces = Object.entries(LANDING_SURFACES)
  const huecos = surfaces.filter(([, s]) => s.hueco).length
  return (
    <div className="mt-3 border-t border-gray-200 dark:border-gray-700 pt-2">
      <button
        onClick={() => setOpen((o) => !o)}
        className="text-xs text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400"
      >
        {open ? '▾' : '▸'} Cobertura de la landing ({surfaces.length} superficies
        {huecos > 0 ? `, ${huecos} con hueco declarado` : ''}) — qué ve el opositor y quién lo vigila
      </button>
      {open && (
        <div className="mt-2 overflow-x-auto">
          <table className="min-w-full text-[11px]">
            <thead>
              <tr className="text-left text-gray-500 dark:text-gray-400">
                <th className="pr-3 py-1 font-medium">Superficie</th>
                <th className="pr-3 py-1 font-medium">Detectores</th>
                <th className="py-1 font-medium">Hueco conocido</th>
              </tr>
            </thead>
            <tbody>
              {surfaces.map(([id, s]) => (
                <tr key={id} className="border-t border-gray-100 dark:border-gray-800 align-top">
                  <td className="pr-3 py-1 text-gray-700 dark:text-gray-300">{s.titulo}</td>
                  <td className="pr-3 py-1 font-mono text-gray-600 dark:text-gray-400">
                    {s.kinds.length ? s.kinds.join(', ') : <span className="text-amber-600 dark:text-amber-400">sin detector</span>}
                  </td>
                  <td className="py-1 text-gray-500 dark:text-gray-400">
                    {s.hueco ? (
                      <>
                        <span className="text-amber-600 dark:text-amber-400">⚠ </span>
                        {s.hueco}
                        {s.tarea ? <span className="ml-1 font-mono text-gray-400">[{s.tarea}]</span> : null}
                      </>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1 italic">
            Fuente: <code>lib/admin/landingSurfaces.ts</code>. El guardarraíl de CI exige que cada
            superficie tenga detector o hueco declarado, y que todo detector de landing esté asignado.
          </p>
        </div>
      )}
    </div>
  )
}

/**
 * Guía de runbooks: mapa finding → frase-gatillo → qué hace Claude → runbook.
 * Data-driven desde lib/admin/runbookRegistry.ts (fuente única). Resuelve la
 * "confluencia": muchos kinds de salud, cada uno con su remediación distinta.
 */
function RunbookGuide() {
  const [open, setOpen] = useState(false)
  const rows = runbookGuideRows()
  return (
    <div className="mt-3 border-t border-gray-200 dark:border-gray-700 pt-2">
      <button
        onClick={() => setOpen((o) => !o)}
        className="text-xs text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400"
      >
        {open ? '▾' : '▸'} Guía de runbooks ({rows.length}) — qué frase decirle a Claude por cada hallazgo
      </button>
      {open && (
        <div className="mt-2 overflow-x-auto">
          <table className="min-w-full text-[11px]">
            <thead>
              <tr className="text-left text-gray-500 dark:text-gray-400">
                <th className="pr-3 py-1 font-medium">Hallazgo</th>
                <th className="pr-3 py-1 font-medium">Dile a Claude</th>
                <th className="pr-3 py-1 font-medium">Qué hace</th>
                <th className="py-1 font-medium">Runbook</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.triggerPhrase} className="border-t border-gray-100 dark:border-gray-800 align-top">
                  <td className="pr-3 py-1 text-gray-700 dark:text-gray-300">{r.title}</td>
                  <td className="pr-3 py-1 font-mono text-blue-700 dark:text-blue-300 whitespace-nowrap">«{r.triggerPhrase}»</td>
                  <td className="pr-3 py-1 text-gray-600 dark:text-gray-400">{r.claudeHace}</td>
                  <td className="py-1 text-gray-500 dark:text-gray-400">
                    {r.runbook ? <code>{r.runbook.replace('docs/runbooks/', '')}</code> : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1 italic">
            Verificar siempre contra boletín oficial. Fuente: <code>lib/admin/runbookRegistry.ts</code>.
          </p>
        </div>
      )}
    </div>
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
