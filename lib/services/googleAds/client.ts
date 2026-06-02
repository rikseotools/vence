// lib/services/googleAds/client.ts
//
// Cliente singleton de Google Ads para la cuenta "Vence" (Customer ID
// 914-896-7335). Construido a partir de la config validada (`config.ts`).
// Cacheado por proceso: la instancia es stateless salvo credenciales.

import { GoogleAdsApi, type Customer } from 'google-ads-api'
import { loadAdsConfig, type GoogleAdsConfig } from './config'

let cachedCustomer: Customer | null = null
let cachedFor: string | null = null

/**
 * Devuelve el `Customer` operable. Cacheado por (customerId+loginCustomerId)
 * para no reconstruir en cada llamada. Lanza si la config está incompleta.
 *
 * @param overrideConfig  inyectable en tests; por defecto lee de process.env.
 */
export function getGoogleAdsCustomer(overrideConfig?: GoogleAdsConfig): Customer {
  const config = overrideConfig ?? loadAdsConfig()
  const cacheKey = `${config.customerId}:${config.loginCustomerId ?? ''}`

  if (cachedCustomer && cachedFor === cacheKey) return cachedCustomer

  const api = new GoogleAdsApi({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    developer_token: config.developerToken,
  })

  cachedCustomer = api.Customer({
    customer_id: config.customerId,
    login_customer_id: config.loginCustomerId,
    refresh_token: config.refreshToken,
  })
  cachedFor = cacheKey

  return cachedCustomer
}

/** Limpia la caché del cliente (tests / rotación de credenciales). */
export function resetGoogleAdsCustomer(): void {
  cachedCustomer = null
  cachedFor = null
}
