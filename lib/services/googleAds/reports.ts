// lib/services/googleAds/reports.ts
//
// Operaciones de LECTURA (reporting) sobre Google Ads. Tipadas y agnósticas
// de quién las llama (script CLI o endpoint admin). Lanzan `GoogleAdsError`
// normalizado en caso de fallo de la API.

import { enums, type Customer } from 'google-ads-api'
import { getGoogleAdsCustomer } from './client'
import { normalizeGoogleAdsError } from './errors'

/** Traduce un valor de enum numérico a su nombre legible (p.ej. 2 → 'ENABLED'). */
function enumName(enumObj: Record<number, string>, value: unknown): string {
  const name = typeof value === 'number' ? enumObj[value] : undefined
  return name ?? String(value ?? '')
}

/** Rangos de fecha soportados por GAQL (`segments.date DURING ...`). */
export type DateRange =
  | 'TODAY'
  | 'YESTERDAY'
  | 'LAST_7_DAYS'
  | 'LAST_14_DAYS'
  | 'LAST_30_DAYS'
  | 'THIS_MONTH'
  | 'LAST_MONTH'

export interface CampaignPerformance {
  campaignId: string
  name: string
  status: string
  /** Estrategia de puja (útil para diagnosticar campañas "limitadas"). */
  biddingStrategyType: string
  costEur: number
  clicks: number
  impressions: number
  conversions: number
  conversionsValueEur: number
  /** Coste por clic medio en euros (0 si no hubo clics). */
  avgCpcEur: number
  /** Retorno de la inversión publicitaria (valor / coste). null si coste 0. */
  roas: number | null
  /** Presupuesto diario de la campaña (€). */
  budgetEur: number
  /** % de impresiones perdidas por presupuesto bajo (0-1). Alto = se queda corta de dinero. */
  budgetLostIS: number
  /** % de impresiones perdidas por ranking/puja (0-1). Alto = CPC demasiado bajo para ganar. */
  rankLostIS: number
}

const microsToEur = (micros: number | string | null | undefined): number =>
  Number(micros ?? 0) / 1_000_000

/**
 * Rendimiento por campaña en un rango de fechas.
 *
 * @param range    rango GAQL (default LAST_7_DAYS)
 * @param customer cliente inyectable (tests); por defecto el singleton.
 */
export async function getCampaignPerformance(
  range: DateRange = 'LAST_7_DAYS',
  customer: Customer = getGoogleAdsCustomer()
): Promise<CampaignPerformance[]> {
  try {
    const rows = await customer.query(`
      SELECT
        campaign.id,
        campaign.name,
        campaign.status,
        campaign.bidding_strategy_type,
        campaign_budget.amount_micros,
        metrics.cost_micros,
        metrics.clicks,
        metrics.impressions,
        metrics.conversions,
        metrics.conversions_value,
        metrics.search_budget_lost_impression_share,
        metrics.search_rank_lost_impression_share
      FROM campaign
      WHERE segments.date DURING ${range}
      ORDER BY metrics.cost_micros DESC
    `)

    return rows.map((r): CampaignPerformance => {
      const costEur = microsToEur(r.metrics?.cost_micros)
      const clicks = Number(r.metrics?.clicks ?? 0)
      const conversionsValueEur = Number(r.metrics?.conversions_value ?? 0)
      return {
        campaignId: String(r.campaign?.id ?? ''),
        name: r.campaign?.name ?? '(sin nombre)',
        status: enumName(enums.CampaignStatus, r.campaign?.status),
        biddingStrategyType: enumName(enums.BiddingStrategyType, r.campaign?.bidding_strategy_type),
        costEur,
        clicks,
        impressions: Number(r.metrics?.impressions ?? 0),
        conversions: Number(r.metrics?.conversions ?? 0),
        conversionsValueEur,
        avgCpcEur: clicks > 0 ? costEur / clicks : 0,
        roas: costEur > 0 ? conversionsValueEur / costEur : null,
        budgetEur: microsToEur(r.campaign_budget?.amount_micros),
        budgetLostIS: Number(r.metrics?.search_budget_lost_impression_share ?? 0),
        rankLostIS: Number(r.metrics?.search_rank_lost_impression_share ?? 0),
      }
    })
  } catch (e) {
    throw normalizeGoogleAdsError(e)
  }
}
