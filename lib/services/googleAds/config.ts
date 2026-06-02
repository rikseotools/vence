// lib/services/googleAds/config.ts
//
// Configuración tipada y validada (fail-fast) de la integración con Google Ads.
// Fuente única de verdad para las credenciales — la consumen el cliente
// (`client.ts`), los scripts CLI y los futuros endpoints de /admin.
//
// Filosofía: si falta config, fallar de inmediato con un mensaje que liste
// TODO lo que falta de golpe (no un error por variable, que obliga a iterar).
// Ver setup en scripts/google-ads/README.md.

export interface GoogleAdsConfig {
  clientId: string
  clientSecret: string
  developerToken: string
  refreshToken: string
  /** Cuenta operada (con las campañas). 10 dígitos sin guiones. */
  customerId: string
  /** Cuenta Manager (MCC) desde la que se autentica. Sin guiones. Opcional
   *  si la cuenta operada no cuelga de una MCC. */
  loginCustomerId?: string
}

/** Normaliza un Customer ID con guiones a dígitos puros (914-896-7335 → 9148967335). */
export function normalizeCustomerId(id: string | undefined | null): string | undefined {
  const clean = id?.replace(/\D/g, '')
  return clean && clean.length > 0 ? clean : undefined
}

/**
 * Carga y valida la config completa para OPERAR con la API (lectura/escritura).
 * Lanza un error agregado si falta cualquier credencial obligatoria.
 *
 * NOTA: el bootstrap del refresh token (`get-refresh-token.ts`) NO usa esto:
 * solo necesita client_id/secret y aún no existe ni el developer token ni el
 * propio refresh token.
 */
export function loadAdsConfig(env: NodeJS.ProcessEnv = process.env): GoogleAdsConfig {
  const clientId = env.GOOGLE_ADS_CLIENT_ID || env.GOOGLE_CLIENT_ID
  const clientSecret = env.GOOGLE_ADS_CLIENT_SECRET || env.GOOGLE_CLIENT_SECRET
  const developerToken = env.GOOGLE_ADS_DEVELOPER_TOKEN
  const refreshToken = env.GOOGLE_ADS_REFRESH_TOKEN
  const customerId = normalizeCustomerId(env.GOOGLE_ADS_CUSTOMER_ID)
  const loginCustomerId = normalizeCustomerId(env.GOOGLE_ADS_LOGIN_CUSTOMER_ID)

  const missing: string[] = []
  if (!clientId) missing.push('GOOGLE_ADS_CLIENT_ID (o GOOGLE_CLIENT_ID)')
  if (!clientSecret) missing.push('GOOGLE_ADS_CLIENT_SECRET (o GOOGLE_CLIENT_SECRET)')
  if (!developerToken) missing.push('GOOGLE_ADS_DEVELOPER_TOKEN')
  if (!refreshToken) missing.push('GOOGLE_ADS_REFRESH_TOKEN')
  if (!customerId) missing.push('GOOGLE_ADS_CUSTOMER_ID')

  if (missing.length > 0) {
    throw new Error(
      `Config de Google Ads incompleta. Faltan: ${missing.join(', ')}. ` +
        `Revisa .env.local (ver scripts/google-ads/README.md).`
    )
  }

  return {
    clientId: clientId!,
    clientSecret: clientSecret!,
    developerToken: developerToken!,
    refreshToken: refreshToken!,
    customerId: customerId!,
    loginCustomerId,
  }
}
