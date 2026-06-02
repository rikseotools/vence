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
