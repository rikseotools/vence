// lib/api/radar-salud/queries.ts
// Datos del panel /admin/radar-salud: salud por adapter, gaps abiertos y
// proveedores degradados del radar multi-capa. Lee `radar_adapter_runs`
// (histórico) + `observable_events` (gaps/degraded).
// Diseño: docs/roadmap/radar-multicapa.md §4.

import { getReadDb } from '@/db/client'
import { sql } from 'drizzle-orm'

export type RadarStatus = 'green' | 'amber' | 'red'

export interface RadarAdapterHealth {
  adapterKey: string
  layer: string
  status: RadarStatus
  lastRunStatus: string
  lastRunAt: string
  durationMs: number | null
  signalsNew7d: number
  errorMessage: string | null
}

export interface RadarGap {
  cuerpo: string | null
  boletinFaltante: string | null
  officialUrl: string | null
  at: string
}

export interface RadarHealthResponse {
  generatedAt: string
  overall: RadarStatus
  adapters: RadarAdapterHealth[]
  gaps: RadarGap[]
  degraded: string[]
}

export async function getRadarHealth(): Promise<RadarHealthResponse> {
  const db = getReadDb()

  // Último run por adapter + señales de los últimos 7 días.
  const rows = (await db.execute(sql`
    WITH last_run AS (
      SELECT DISTINCT ON (adapter_key)
        adapter_key, layer, status, started_at, created_at, duration_ms, error_message
      FROM radar_adapter_runs
      ORDER BY adapter_key, created_at DESC
    ),
    sig7d AS (
      SELECT adapter_key, COALESCE(SUM(signals_new), 0)::int AS signals_new_7d
      FROM radar_adapter_runs
      WHERE created_at > now() - interval '7 days'
      GROUP BY adapter_key
    )
    SELECT lr.adapter_key, lr.layer, lr.status, lr.duration_ms, lr.error_message,
           lr.created_at, COALESCE(s.signals_new_7d, 0) AS signals_new_7d
    FROM last_run lr LEFT JOIN sig7d s USING (adapter_key)
    ORDER BY lr.layer, lr.adapter_key
  `)) as unknown as {
    adapter_key: string
    layer: string
    status: string
    duration_ms: number | null
    error_message: string | null
    created_at: string
    signals_new_7d: number
  }[]

  // Proveedores degradados (últimos 7 días).
  const degradedRows = (await db.execute(sql`
    SELECT DISTINCT metadata->>'adapterKey' AS adapter_key
    FROM observable_events
    WHERE event_type = 'radar_provider_degraded'
      AND ts > now() - interval '7 days'
  `)) as unknown as { adapter_key: string | null }[]
  const degraded = new Set(degradedRows.map((r) => r.adapter_key).filter(Boolean) as string[])

  // Gaps abiertos (últimos 30 días).
  const gapRows = (await db.execute(sql`
    SELECT metadata->>'cuerpo' AS cuerpo,
           metadata->>'boletinFaltante' AS boletin_faltante,
           metadata->>'officialUrl' AS official_url,
           ts AS at
    FROM observable_events
    WHERE event_type = 'radar_gap_detected'
      AND ts > now() - interval '30 days'
    ORDER BY ts DESC
    LIMIT 100
  `)) as unknown as {
    cuerpo: string | null
    boletin_faltante: string | null
    official_url: string | null
    at: string
  }[]

  const adapters: RadarAdapterHealth[] = rows.map((r) => {
    let status: RadarStatus = 'green'
    if (r.status === 'failed' || r.status === 'timeout' || degraded.has(r.adapter_key)) {
      status = 'red'
    } else if (r.status === 'empty') {
      status = 'amber'
    }
    return {
      adapterKey: r.adapter_key,
      layer: r.layer,
      status,
      lastRunStatus: r.status,
      lastRunAt: r.created_at,
      durationMs: r.duration_ms,
      signalsNew7d: Number(r.signals_new_7d) || 0,
      errorMessage: r.error_message,
    }
  })

  const overall: RadarStatus = adapters.some((a) => a.status === 'red')
    ? 'red'
    : adapters.some((a) => a.status === 'amber')
      ? 'amber'
      : 'green'

  return {
    generatedAt: new Date().toISOString(),
    overall,
    adapters,
    gaps: gapRows.map((g) => ({
      cuerpo: g.cuerpo,
      boletinFaltante: g.boletin_faltante,
      officialUrl: g.official_url,
      at: g.at,
    })),
    degraded: [...degraded],
  }
}
