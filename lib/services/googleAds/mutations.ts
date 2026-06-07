// lib/services/googleAds/mutations.ts
//
// Operaciones de ESCRITURA sobre Google Ads (pausar/activar campañas, ajustar
// presupuestos). Gastan dinero real → toda función soporta `dryRun` y, cuando
// es dryRun, usa `validate_only` para que Google VALIDE el cambio sin aplicarlo
// (detecta errores reales sin tocar la cuenta).
//
// Regla de seguridad: los callers (CLI/endpoint) deben tener dryRun=true por
// defecto y exigir un flag explícito para aplicar. Ver scripts/google-ads/campaign.ts.

import { enums, type Customer } from 'google-ads-api'
import { getGoogleAdsCustomer } from './client'
import { loadAdsConfig } from './config'
import { normalizeGoogleAdsError } from './errors'

export interface MutationResult {
  applied: boolean
  dryRun: boolean
  resourceName: string
  /** Descripción legible del cambio (para logs/confirmación). */
  change: string
}

const eurToMicros = (eur: number): number => Math.round(eur * 1_000_000)

function campaignResourceName(customerId: string, campaignId: string | number): string {
  return `customers/${customerId}/campaigns/${campaignId}`
}

/** Cambia el estado de una campaña (ENABLED / PAUSED). */
export async function setCampaignStatus(
  campaignId: string | number,
  status: 'ENABLED' | 'PAUSED',
  opts: { dryRun?: boolean; customer?: Customer } = {}
): Promise<MutationResult> {
  const dryRun = opts.dryRun ?? true
  const customer = opts.customer ?? getGoogleAdsCustomer()
  const customerId = loadAdsConfig().customerId
  const resourceName = campaignResourceName(customerId, campaignId)

  try {
    await customer.campaigns.update(
      [{ resource_name: resourceName, status: enums.CampaignStatus[status] }],
      { validate_only: dryRun }
    )
    return {
      applied: !dryRun,
      dryRun,
      resourceName,
      change: `campaña ${campaignId} → ${status}`,
    }
  } catch (e) {
    throw normalizeGoogleAdsError(e)
  }
}

export const pauseCampaign = (
  campaignId: string | number,
  opts?: { dryRun?: boolean; customer?: Customer }
) => setCampaignStatus(campaignId, 'PAUSED', opts)

export const enableCampaign = (
  campaignId: string | number,
  opts?: { dryRun?: boolean; customer?: Customer }
) => setCampaignStatus(campaignId, 'ENABLED', opts)

/** Fija el final_url_suffix (tracking) de UNA campaña. Útil al crear campañas nuevas. */
export async function setCampaignFinalUrlSuffix(
  campaignId: string | number,
  suffix: string,
  opts: { dryRun?: boolean; customer?: Customer } = {}
): Promise<MutationResult> {
  const dryRun = opts.dryRun ?? true
  const customer = opts.customer ?? getGoogleAdsCustomer()
  const customerId = loadAdsConfig().customerId
  const resourceName = campaignResourceName(customerId, campaignId)

  try {
    await customer.campaigns.update(
      [{ resource_name: resourceName, final_url_suffix: suffix }],
      { validate_only: dryRun }
    )
    return {
      applied: !dryRun,
      dryRun,
      resourceName,
      change: `tracking campaña ${campaignId} → "${suffix}"`,
    }
  } catch (e) {
    throw normalizeGoogleAdsError(e)
  }
}

/**
 * Ajusta el TECHO de CPC (puja máxima por clic) de una campaña con estrategia
 * "Maximizar clics" (TARGET_SPEND). NO cambia la estrategia de puja — sigue
 * siendo puja por clic, solo sube/baja el límite máximo que se paga por clic.
 *
 * Sirve para campañas limitadas por RANKING (no por presupuesto): cuando una
 * campaña pierde el grueso de las subastas por `search_rank_lost_impression_share`
 * y gasta muy por debajo de su presupuesto, subir el techo le permite ganar más
 * subastas (más presencia), no mejorar posición. El presupuesto diario sigue
 * siendo el tope de gasto, así que el riesgo está acotado por construcción.
 *
 * ⚠️ Solo aplica a campañas TARGET_SPEND. Si la campaña usa otra estrategia,
 * Google rechazará el `validate_only` (que es justo lo que queremos detectar).
 */
export async function setCampaignCpcCeiling(
  campaignId: string | number,
  ceilingEur: number,
  opts: { dryRun?: boolean; customer?: Customer } = {}
): Promise<MutationResult> {
  const dryRun = opts.dryRun ?? true
  const customer = opts.customer ?? getGoogleAdsCustomer()
  const customerId = loadAdsConfig().customerId
  const resourceName = campaignResourceName(customerId, campaignId)

  try {
    const rows = await customer.query(`
      SELECT
        campaign.id,
        campaign.name,
        campaign.bidding_strategy_type,
        campaign.target_spend.cpc_bid_ceiling_micros
      FROM campaign
      WHERE campaign.id = ${campaignId}
      LIMIT 1
    `)
    const row = rows[0]
    if (!row?.campaign) {
      throw new Error(`No se encontró la campaña ${campaignId}`)
    }
    const strategy = row.campaign.bidding_strategy_type
    const currentMicros = row.campaign.target_spend?.cpc_bid_ceiling_micros
    const currentLabel =
      currentMicros == null ? '(sin techo)' : `${(Number(currentMicros) / 1_000_000).toFixed(3)}€`

    await customer.campaigns.update(
      [
        {
          resource_name: resourceName,
          target_spend: { cpc_bid_ceiling_micros: eurToMicros(ceilingEur) },
        },
      ],
      { validate_only: dryRun }
    )

    return {
      applied: !dryRun,
      dryRun,
      resourceName,
      change:
        `techo CPC campaña ${campaignId} (${row.campaign.name ?? ''}) ` +
        `${currentLabel} → ${ceilingEur.toFixed(3)}€` +
        (strategy !== enums.BiddingStrategyType.TARGET_SPEND
          ? ` ⚠️ estrategia ${strategy} (no es Maximizar clics)`
          : ''),
    }
  } catch (e) {
    throw normalizeGoogleAdsError(e)
  }
}

/**
 * Ajusta el presupuesto diario de una campaña (en euros). Resuelve primero el
 * recurso de presupuesto asociado a la campaña y luego lo actualiza.
 *
 * ⚠️ Si el presupuesto es compartido por varias campañas, el cambio afecta a
 * todas. La función avisa en `change` cuando detecta presupuesto compartido.
 */
export async function setCampaignDailyBudget(
  campaignId: string | number,
  amountEur: number,
  opts: { dryRun?: boolean; customer?: Customer } = {}
): Promise<MutationResult> {
  const dryRun = opts.dryRun ?? true
  const customer = opts.customer ?? getGoogleAdsCustomer()

  try {
    const rows = await customer.query(`
      SELECT
        campaign.id,
        campaign.name,
        campaign_budget.resource_name,
        campaign_budget.amount_micros,
        campaign_budget.explicitly_shared
      FROM campaign
      WHERE campaign.id = ${campaignId}
      LIMIT 1
    `)
    const row = rows[0]
    if (!row?.campaign_budget?.resource_name) {
      throw new Error(`No se encontró presupuesto para la campaña ${campaignId}`)
    }
    const budgetResourceName = row.campaign_budget.resource_name
    const currentEur = Number(row.campaign_budget.amount_micros ?? 0) / 1_000_000
    const shared = row.campaign_budget.explicitly_shared

    await customer.campaignBudgets.update(
      [{ resource_name: budgetResourceName, amount_micros: eurToMicros(amountEur) }],
      { validate_only: dryRun }
    )

    return {
      applied: !dryRun,
      dryRun,
      resourceName: budgetResourceName,
      change:
        `presupuesto campaña ${campaignId} (${row.campaign?.name ?? ''}) ` +
        `${currentEur.toFixed(2)}€ → ${amountEur.toFixed(2)}€/día` +
        (shared ? ' ⚠️ PRESUPUESTO COMPARTIDO (afecta a varias campañas)' : ''),
    }
  } catch (e) {
    throw normalizeGoogleAdsError(e)
  }
}
