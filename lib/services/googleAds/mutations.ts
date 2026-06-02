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
