// lib/services/googleAds/account.ts
//
// Configuración de TRACKING de la cuenta — la pieza que hace robusta la
// atribución coste↔ingreso por campaña.
//
// Con auto-tagging activo, Google añade `gclid` a cada clic. Añadiendo
// `utm_campaign={campaignid}` al final_url_suffix de cada campaña, toda visita
// llega con el ID NUMÉRICO real de la campaña → clave de JOIN exacta contra
// `campaign.id` de la API (en vez de texto a mano, frágil).
//
// NOTA: el recurso `customer` (suffix a nivel de cuenta) no es mutable por el
// endpoint estándar de la librería, así que se aplica por campaña — que además
// es más preciso. Para campañas nuevas, usar `setCampaignFinalUrlSuffix`.

import type { Customer } from 'google-ads-api'
import { getGoogleAdsCustomer } from './client'
import { normalizeGoogleAdsError } from './errors'

export interface CustomerInfo {
  id: string
  descriptiveName: string
  currencyCode: string
  autoTaggingEnabled: boolean
  finalUrlSuffix: string | null
  trackingUrlTemplate: string | null
}

/**
 * Suffix recomendado. Clave de JOIN = `{campaignid}` (ID numérico, casa exacto
 * con `campaign.id` de la API). `gclid` llega solo por auto-tagging.
 * utm_source/medium para poder filtrar tráfico de Google/CPC.
 */
export const RECOMMENDED_FINAL_URL_SUFFIX =
  'utm_source=google&utm_medium=cpc&utm_campaign={campaignid}'

export async function getCustomerInfo(
  customer: Customer = getGoogleAdsCustomer()
): Promise<CustomerInfo> {
  try {
    const rows = await customer.query(`
      SELECT
        customer.id,
        customer.descriptive_name,
        customer.currency_code,
        customer.auto_tagging_enabled,
        customer.final_url_suffix,
        customer.tracking_url_template
      FROM customer
      LIMIT 1
    `)
    const c = rows[0]?.customer ?? {}
    return {
      id: String(c.id ?? ''),
      descriptiveName: c.descriptive_name ?? '',
      currencyCode: c.currency_code ?? '',
      autoTaggingEnabled: Boolean(c.auto_tagging_enabled),
      finalUrlSuffix: c.final_url_suffix || null,
      trackingUrlTemplate: c.tracking_url_template || null,
    }
  } catch (e) {
    throw normalizeGoogleAdsError(e)
  }
}

export interface TrackingApplyResult {
  applied: boolean
  dryRun: boolean
  suffix: string
  /** Campañas afectadas (no se tocan las REMOVED). */
  campaigns: Array<{ id: string; name: string; previousSuffix: string | null }>
}

/**
 * Aplica el final_url_suffix a TODAS las campañas no eliminadas, en una sola
 * llamada batch. dryRun (default) valida contra Google sin aplicar.
 *
 * No gasta dinero (es tracking), pero modifica las URLs de los anuncios → va
 * detrás del mismo flag de seguridad que las demás escrituras.
 */
export async function applyTrackingSuffixToAllCampaigns(
  suffix: string,
  opts: { dryRun?: boolean; customer?: Customer } = {}
): Promise<TrackingApplyResult> {
  const dryRun = opts.dryRun ?? true
  const customer = opts.customer ?? getGoogleAdsCustomer()

  try {
    const rows = await customer.query(`
      SELECT campaign.id, campaign.name, campaign.final_url_suffix
      FROM campaign
      WHERE campaign.status != 'REMOVED'
      ORDER BY campaign.id
    `)

    const campaigns = rows.map((r) => ({
      id: String(r.campaign?.id ?? ''),
      name: r.campaign?.name ?? '',
      previousSuffix: r.campaign?.final_url_suffix || null,
      resourceName: r.campaign?.resource_name as string,
    }))

    if (campaigns.length > 0) {
      await customer.campaigns.update(
        campaigns.map((c) => ({ resource_name: c.resourceName, final_url_suffix: suffix })),
        { validate_only: dryRun }
      )
    }

    return {
      applied: !dryRun,
      dryRun,
      suffix,
      campaigns: campaigns.map(({ id, name, previousSuffix }) => ({ id, name, previousSuffix })),
    }
  } catch (e) {
    throw normalizeGoogleAdsError(e)
  }
}
