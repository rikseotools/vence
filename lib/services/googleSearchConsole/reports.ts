// lib/services/googleSearchConsole/reports.ts
//
// Informes de orgánico (GSC) listos para cruzar con Ads: por oposición (slug
// de la URL) → posición media, clics e impresiones orgánicos. Y búsquedas
// reales por oposición (keywords gratis).

import { querySearchAnalytics, type GscRow } from './client'

/** Ventana estándar de orgánico: 28 días terminando hace 3 (GSC tiene ~3d de lag). */
function organicWindow(nowIso: string): { startDate: string; endDate: string } {
  const end = new Date(new Date(nowIso).getTime() - 3 * 86_400_000)
  const start = new Date(end.getTime() - 28 * 86_400_000)
  return { startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10) }
}

/** Slug de oposición = primer segmento del path de la URL de la página. */
function slugFromPage(pageUrl: string): string | null {
  try {
    const seg = new URL(pageUrl).pathname.replace(/^\/+/, '').replace(/\/.*$/, '')
    return seg || null
  } catch {
    return null
  }
}

export interface OrganicStats {
  clicks: number
  impressions: number
  /** Posición media ponderada por impresiones (1 = arriba del todo). */
  position: number
}

/**
 * Orgánico agregado POR OPOSICIÓN (slug): suma clics/impresiones de todas sus
 * páginas y posición media ponderada por impresiones. Para cruzar con Ads.
 */
export async function getOrganicByOposicion(
  nowIso: string = new Date().toISOString()
): Promise<Map<string, OrganicStats>> {
  const { startDate, endDate } = organicWindow(nowIso)
  const rows = await querySearchAnalytics({
    startDate,
    endDate,
    dimensions: ['page'],
    rowLimit: 5000,
  })

  const acc = new Map<string, { clicks: number; impressions: number; posImpr: number }>()
  for (const r of rows) {
    const slug = slugFromPage(r.keys[0])
    if (!slug) continue
    const a = acc.get(slug) ?? { clicks: 0, impressions: 0, posImpr: 0 }
    a.clicks += r.clicks
    a.impressions += r.impressions
    a.posImpr += r.position * r.impressions // para media ponderada
    acc.set(slug, a)
  }

  const out = new Map<string, OrganicStats>()
  for (const [slug, a] of acc) {
    out.set(slug, {
      clicks: a.clicks,
      impressions: a.impressions,
      position: a.impressions > 0 ? a.posImpr / a.impressions : 0,
    })
  }
  return out
}

export interface SeoOpportunity {
  query: string
  impressions: number
  clicks: number
  ctr: number
  position: number
  /** Posición en el periodo anterior (28d previos). null si no aparecía. */
  prevPosition: number | null
  /** prevPosition - position. Positivo = ha SUBIDO (mejorado). null si sin previo. */
  positionDelta: number | null
}

/**
 * Oportunidades SEO: búsquedas con DEMANDA (impresiones) donde rankeas en
 * "distancia de tiro" (posición 4-20) → mejorar contenido = tráfico gratis.
 * Incluye TENDENCIA vs el periodo anterior para ver si los cambios funcionan.
 */
export async function getSeoOpportunities(
  nowIso: string = new Date().toISOString(),
  opts: { minImpressions?: number; minPos?: number; maxPos?: number } = {}
): Promise<SeoOpportunity[]> {
  const minImpr = opts.minImpressions ?? 150
  const minPos = opts.minPos ?? 4
  const maxPos = opts.maxPos ?? 20
  const cur = organicWindow(nowIso) // [now-31, now-3]
  const prevEnd = new Date(new Date(cur.startDate).getTime() - 86_400_000)
  const prev = {
    startDate: new Date(prevEnd.getTime() - 28 * 86_400_000).toISOString().slice(0, 10),
    endDate: prevEnd.toISOString().slice(0, 10),
  }

  const [curRows, prevRows] = await Promise.all([
    querySearchAnalytics({ ...cur, dimensions: ['query'], rowLimit: 5000 }),
    querySearchAnalytics({ ...prev, dimensions: ['query'], rowLimit: 5000 }),
  ])
  const prevPos = new Map<string, number>()
  for (const r of prevRows) prevPos.set(r.keys[0], r.position)

  return curRows
    .filter(
      (r) =>
        r.position >= minPos &&
        r.position <= maxPos &&
        r.impressions >= minImpr &&
        !/vence/i.test(r.keys[0]) // excluir marca (ya rankea #1)
    )
    .map((r): SeoOpportunity => {
      const pp = prevPos.get(r.keys[0]) ?? null
      return {
        query: r.keys[0],
        impressions: r.impressions,
        clicks: r.clicks,
        ctr: r.ctr,
        position: r.position,
        prevPosition: pp,
        positionDelta: pp != null ? pp - r.position : null,
      }
    })
    .sort((a, b) => b.impressions - a.impressions)
}

export interface OrganicQuery {
  query: string
  clicks: number
  impressions: number
  ctr: number
  position: number
}

/** Búsquedas orgánicas reales que llegan a las páginas de una oposición (slug). */
export async function getTopQueriesForSlug(
  slug: string,
  nowIso: string = new Date().toISOString(),
  limit = 25
): Promise<OrganicQuery[]> {
  const { startDate, endDate } = organicWindow(nowIso)
  const rows: GscRow[] = await querySearchAnalytics({
    startDate,
    endDate,
    dimensions: ['query'],
    rowLimit: 500,
    dimensionFilterGroups: [
      { filters: [{ dimension: 'page', operator: 'includingRegex', expression: `/${slug}(/|$)` }] },
    ],
  })
  return rows
    .map((r) => ({
      query: r.keys[0],
      clicks: r.clicks,
      impressions: r.impressions,
      ctr: r.ctr,
      position: r.position,
    }))
    .sort((a, b) => b.clicks - a.clicks)
    .slice(0, limit)
}
