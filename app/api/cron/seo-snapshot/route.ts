// app/api/cron/seo-snapshot/route.ts
// Cron semanal: snapshot de posición orgánica (Google Search Console) de cada
// keyword objetivo activa → tabla seo_keyword_snapshots. Construye el histórico
// para medir progreso y correlacionar acción→ranking (ver seo_actions).
//
// Flujo:
//   1) GHA llama este endpoint semanal con Bearer CRON_SECRET.
//   2) Carga las keywords activas de seo_keyword_targets.
//   3) Una sola query a GSC (ventana ~28d terminando hace 3) y cruza por keyword.
//   4) Upsert (keyword, captured_on) → snapshot. position NULL = sin impresiones
//      (no rankea aún) — guardarlo es la señal de la transición cuando empiece.
//
// AGNÓSTICO: escribe vía Drizzle (getAdminDb), sin RPC. Lee GSC (lib/services).
// Doc: docs/roadmap/seo-keywords-competidores.md, docs/runbooks/seo-oportunidades.md

import { NextRequest, NextResponse } from 'next/server'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { getAdminDb } from '@/db/client'
import { eq, sql } from 'drizzle-orm'
import { seoKeywordTargets, seoKeywordSnapshots } from '@/db/schema'
import { querySearchAnalytics } from '@/lib/services/googleSearchConsole'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/** Ventana estándar de orgánico: 28 días terminando hace 3 (GSC tiene ~3d de lag). */
function organicWindow(): { startDate: string; endDate: string; capturedOn: string } {
  const end = new Date(Date.now() - 3 * 86_400_000)
  const start = new Date(end.getTime() - 28 * 86_400_000)
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
    capturedOn: end.toISOString().slice(0, 10), // fechamos el snapshot por el fin de ventana
  }
}

async function handler(request: NextRequest) {
  // Auth: solo GHA con CRON_SECRET (mismo patrón que el resto de crons).
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const started = Date.now()
  const db = getAdminDb()

  // 1) Keywords objetivo activas.
  const targets = await db
    .select({ keyword: seoKeywordTargets.keyword })
    .from(seoKeywordTargets)
    .where(eq(seoKeywordTargets.isActive, true))

  if (targets.length === 0) {
    return NextResponse.json({
      success: true, snapshotted: 0, ranking: 0, notRanking: 0,
      message: 'Sin keywords objetivo activas', timestamp: new Date().toISOString(),
    })
  }

  // 2) Una sola query a GSC: todas las queries con impresiones en la ventana.
  const { startDate, endDate, capturedOn } = organicWindow()
  const rows = await querySearchAnalytics({ startDate, endDate, dimensions: ['query'], rowLimit: 25000 })
  const byQuery = new Map(rows.map((r) => [r.keys[0].toLowerCase(), r]))

  // 3) Upsert un snapshot por keyword objetivo (rankee o no).
  const values = targets.map((t) => {
    const r = byQuery.get(t.keyword.toLowerCase())
    return {
      keyword: t.keyword,
      capturedOn,
      position: r ? String(r.position) : null,
      impressions: r ? Math.round(r.impressions) : 0,
      clicks: r ? Math.round(r.clicks) : 0,
      ctr: r ? String(r.ctr) : null,
      source: 'gsc',
    }
  })

  await db
    .insert(seoKeywordSnapshots)
    .values(values)
    .onConflictDoUpdate({
      target: [seoKeywordSnapshots.keyword, seoKeywordSnapshots.capturedOn],
      set: {
        position: sqlExcluded('position'),
        impressions: sqlExcluded('impressions'),
        clicks: sqlExcluded('clicks'),
        ctr: sqlExcluded('ctr'),
      },
    })

  const ranking = values.filter((v) => v.position !== null).length
  return NextResponse.json({
    success: true,
    snapshotted: values.length,
    ranking,
    notRanking: values.length - ranking,
    window: `${startDate}…${endDate}`,
    capturedOn,
    duration: `${((Date.now() - started) / 1000).toFixed(1)}s`,
    timestamp: new Date().toISOString(),
  })
}

// Helper: referencia a la fila propuesta (EXCLUDED) en el ON CONFLICT DO UPDATE.
function sqlExcluded(col: string) {
  return sql.raw(`excluded.${col}`)
}

export const GET = withErrorLogging('/api/cron/seo-snapshot', handler)
