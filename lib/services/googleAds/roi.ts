// lib/services/googleAds/roi.ts
//
// Cruce coste↔ingreso POR CAMPAÑA: une el coste de la API de Google Ads
// (campaign.id numérico) con los ingresos reales de la BD (user_acquisition
// ⋈ conversion_events.amount). Sirve para decidir dónde subir presupuesto
// MANTENIENDO puja por clic (no toca pujas).
//
// Agnóstico: lee la BD vía Drizzle (getReadDb), no supabase.
//
// Caveat de cohorte: el coste es de la ventana elegida; el ingreso son los
// pagos en esa misma ventana atribuidos a la campaña. Hay lag clic→pago, así
// que ventanas cortas infra-cuentan ingreso. La atribución solo existe para
// registros posteriores al despliegue de /api/acquisition.

import { and, eq, gte, ilike, inArray, isNotNull, sql } from 'drizzle-orm'
import type { Customer } from 'google-ads-api'
import { getReadDb } from '@/db/client'
import { userAcquisition, conversionEvents, convocatoriaHitos, oposiciones } from '@/db/schema'
import { getGoogleAdsCustomer } from './client'
import { getCampaignPerformance, type DateRange } from './reports'

const RANGE_DAYS: Record<DateRange, number> = {
  TODAY: 1,
  YESTERDAY: 2,
  LAST_7_DAYS: 7,
  LAST_14_DAYS: 14,
  LAST_30_DAYS: 30,
  THIS_MONTH: 31,
  LAST_MONTH: 31,
}

export interface CampaignRoi {
  campaignId: string
  name: string
  status: string
  costEur: number
  clicks: number
  impressions: number
  avgCpcEur: number
  /** Registros (conversiones que cuenta Google; la acción activa es "Registro"). */
  registrations: number
  /** Coste por registro = coste / registros. null si 0 registros. */
  costPerRegistrationEur: number | null
  revenueEur: number
  /** Nº de pagos atribuidos a la campaña en la ventana. */
  payments: number
  /** Coste por adquisición = coste / pagos. null si 0 pagos. */
  cpaEur: number | null
  /** Retorno = ingreso / coste. null si coste 0. */
  roi: number | null
  /** Slug de la oposición que anuncia la campaña (de la URL final). */
  examSlug: string | null
  /** Fecha del examen relevante (próximo, o último pasado) YYYY-MM-DD. */
  examDate: string | null
  /** Días hasta el examen (negativo = ya pasado). null si sin fecha. */
  daysToExam: number | null
}

/** Ingresos reales por campaña (google_ads) desde la BD, en una ventana. */
async function revenueByCampaign(
  cutoffIso: string
): Promise<Map<string, { revenue: number; payments: number }>> {
  const db = getReadDb()
  const rows = await db
    .select({
      campaignId: userAcquisition.utmCampaign,
      payments: sql<number>`count(distinct ${conversionEvents.userId})`,
      revenue: sql<number>`coalesce(sum((${conversionEvents.eventData} ->> 'amount')::numeric), 0)`,
    })
    .from(userAcquisition)
    .innerJoin(conversionEvents, eq(conversionEvents.userId, userAcquisition.userId))
    .where(
      and(
        eq(userAcquisition.channel, 'google_ads'),
        isNotNull(userAcquisition.utmCampaign),
        eq(conversionEvents.eventType, 'payment_completed'),
        gte(conversionEvents.createdAt, cutoffIso)
      )
    )
    .groupBy(userAcquisition.utmCampaign)

  const map = new Map<string, { revenue: number; payments: number }>()
  for (const r of rows) {
    map.set(String(r.campaignId), { revenue: Number(r.revenue), payments: Number(r.payments) })
  }
  return map
}

/** Extrae el slug de oposición del primer segmento de la URL final del anuncio. */
function slugFromUrl(u: string): string | null {
  try {
    const seg = new URL(u).pathname.replace(/^\/+/, '').replace(/\/.*$/, '')
    return seg || null
  } catch {
    return null
  }
}

/** Mapea campaignId → slug de oposición leyendo las URLs finales de sus anuncios. */
async function campaignSlugMap(customer: Customer): Promise<Map<string, string>> {
  const rows = await customer.query(`
    SELECT campaign.id, ad_group_ad.ad.final_urls
    FROM ad_group_ad
    WHERE campaign.status != 'REMOVED'
  `)
  const map = new Map<string, string>()
  for (const r of rows) {
    const id = String(r.campaign?.id ?? '')
    if (map.has(id)) continue
    const urls = (r.ad_group_ad?.ad?.final_urls ?? []) as string[]
    for (const u of urls) {
      const slug = slugFromUrl(u)
      if (slug) {
        map.set(id, slug)
        break
      }
    }
  }
  return map
}

/**
 * Para cada slug, la fecha de examen relevante: el próximo examen (fecha >= hoy);
 * si no hay, el último pasado. De `convocatoria_hitos` (titulo con "examen").
 */
async function examDateBySlug(slugs: string[], nowIso: string): Promise<Map<string, string>> {
  if (slugs.length === 0) return new Map()
  const db = getReadDb()
  const rows = await db
    .select({ slug: oposiciones.slug, fecha: convocatoriaHitos.fecha })
    .from(convocatoriaHitos)
    .innerJoin(oposiciones, eq(oposiciones.id, convocatoriaHitos.oposicionId))
    .where(
      and(
        inArray(oposiciones.slug, slugs),
        ilike(convocatoriaHitos.titulo, '%examen%'),
        isNotNull(convocatoriaHitos.fecha)
      )
    )

  const today = nowIso.slice(0, 10)
  const bySlug = new Map<string, string[]>()
  for (const r of rows) {
    const slug = r.slug as string
    const fecha = String(r.fecha).slice(0, 10)
    if (!bySlug.has(slug)) bySlug.set(slug, [])
    bySlug.get(slug)!.push(fecha)
  }
  const result = new Map<string, string>()
  for (const [slug, dates] of bySlug) {
    const sorted = [...dates].sort()
    const upcoming = sorted.find((d) => d >= today)
    const chosen = upcoming ?? sorted[sorted.length - 1] // próximo, o último pasado
    if (chosen) result.set(slug, chosen)
  }
  return result
}

/**
 * ROI por campaña en una ventana. Une coste (API) con ingreso (BD) por
 * campaign.id. Incluye campañas con coste sin ingreso (revenue 0) y al revés.
 * Ordenado por coste descendente.
 *
 * @param nowIso  fecha actual ISO (inyectable; en CLI/server pásala con new Date()).
 */
export async function getCampaignRoi(
  range: DateRange = 'LAST_30_DAYS',
  nowIso: string = new Date().toISOString()
): Promise<CampaignRoi[]> {
  const cutoffMs = new Date(nowIso).getTime() - RANGE_DAYS[range] * 24 * 60 * 60 * 1000
  const cutoffIso = new Date(cutoffMs).toISOString()

  const customer = getGoogleAdsCustomer()
  const [perf, revenue] = await Promise.all([
    getCampaignPerformance(range, customer),
    revenueByCampaign(cutoffIso),
  ])

  const byId = new Map<string, CampaignRoi>()
  for (const p of perf) {
    const rev = revenue.get(p.campaignId)
    const revenueEur = rev?.revenue ?? 0
    const payments = rev?.payments ?? 0
    byId.set(p.campaignId, {
      campaignId: p.campaignId,
      name: p.name,
      status: p.status,
      costEur: p.costEur,
      clicks: p.clicks,
      impressions: p.impressions,
      avgCpcEur: p.avgCpcEur,
      registrations: p.conversions,
      costPerRegistrationEur: p.conversions > 0 ? p.costEur / p.conversions : null,
      revenueEur,
      payments,
      cpaEur: payments > 0 ? p.costEur / payments : null,
      roi: p.costEur > 0 ? revenueEur / p.costEur : null,
      examSlug: null,
      examDate: null,
      daysToExam: null,
    })
  }
  // Campañas con ingreso pero sin coste en la ventana (pausadas/antiguas)
  for (const [campaignId, rev] of revenue) {
    if (byId.has(campaignId)) continue
    byId.set(campaignId, {
      campaignId,
      name: `(campaña ${campaignId})`,
      status: 'UNKNOWN',
      costEur: 0,
      clicks: 0,
      impressions: 0,
      avgCpcEur: 0,
      registrations: 0,
      costPerRegistrationEur: null,
      revenueEur: rev.revenue,
      payments: rev.payments,
      cpaEur: null,
      roi: null,
      examSlug: null,
      examDate: null,
      daysToExam: null,
    })
  }

  // Enriquecer con la fecha de examen (campaña → slug de la URL final → hito de examen)
  const slugMap = await campaignSlugMap(customer)
  const slugs = [...new Set([...slugMap.values()])]
  const examMap = await examDateBySlug(slugs, nowIso)
  const today = nowIso.slice(0, 10)
  for (const c of byId.values()) {
    const slug = slugMap.get(c.campaignId) ?? null
    c.examSlug = slug
    const ed = slug ? examMap.get(slug) ?? null : null
    c.examDate = ed
    c.daysToExam = ed
      ? Math.round(
          (new Date(`${ed}T00:00:00Z`).getTime() - new Date(`${today}T00:00:00Z`).getTime()) /
            86_400_000
        )
      : null
  }

  return [...byId.values()].sort((a, b) => b.costEur - a.costEur)
}
