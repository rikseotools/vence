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

import { sql, and, eq, gte, isNotNull } from 'drizzle-orm'
import { getReadDb } from '@/db/client'
import { userAcquisition, conversionEvents } from '@/db/schema'
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
  costEur: number
  revenueEur: number
  /** Nº de pagos atribuidos a la campaña en la ventana. */
  payments: number
  /** Coste por adquisición = coste / pagos. null si 0 pagos. */
  cpaEur: number | null
  /** Retorno = ingreso / coste. null si coste 0. */
  roi: number | null
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

  const [perf, revenue] = await Promise.all([
    getCampaignPerformance(range),
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
      costEur: p.costEur,
      revenueEur,
      payments,
      cpaEur: payments > 0 ? p.costEur / payments : null,
      roi: p.costEur > 0 ? revenueEur / p.costEur : null,
    })
  }
  // Campañas con ingreso pero sin coste en la ventana (pausadas/antiguas)
  for (const [campaignId, rev] of revenue) {
    if (byId.has(campaignId)) continue
    byId.set(campaignId, {
      campaignId,
      name: `(campaña ${campaignId})`,
      costEur: 0,
      revenueEur: rev.revenue,
      payments: rev.payments,
      cpaEur: null,
      roi: null,
    })
  }

  return [...byId.values()].sort((a, b) => b.costEur - a.costEur)
}
