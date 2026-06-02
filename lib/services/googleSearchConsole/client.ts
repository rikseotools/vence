// lib/services/googleSearchConsole/client.ts
//
// Cliente de Google Search Console (datos de búsqueda orgánica de vence.es).
// Agnóstico: llamadas REST directas (sin librería pesada), reutiliza el mismo
// OAuth que Ads (el refresh token lleva ambos scopes: adwords + webmasters.readonly).
//
// Propiedad de DOMINIO → siteUrl = "sc-domain:vence.es".

const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GSC_API = 'https://searchconsole.googleapis.com/webmasters/v3'
const SITE_URL = 'sc-domain:vence.es'

let cachedToken: { token: string; expiresAt: number } | null = null

/** Access token a partir del refresh token (cacheado hasta ~1 min antes de expirar). */
async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.token

  const clientId = process.env.GOOGLE_ADS_CLIENT_ID || process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET
  const refreshToken = process.env.GOOGLE_ADS_REFRESH_TOKEN
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Falta GOOGLE_ADS_CLIENT_ID/SECRET/REFRESH_TOKEN para Search Console')
  }

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }).toString(),
  })
  const data = (await res.json()) as { access_token?: string; expires_in?: number; error_description?: string }
  if (!res.ok || !data.access_token) {
    throw new Error(`OAuth Search Console: ${data.error_description || JSON.stringify(data)}`)
  }
  cachedToken = { token: data.access_token, expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000 }
  return data.access_token
}

export interface GscRow {
  keys: string[]
  clicks: number
  impressions: number
  ctr: number
  position: number
}

export interface SearchAnalyticsOpts {
  startDate: string // YYYY-MM-DD
  endDate: string // YYYY-MM-DD
  dimensions: Array<'query' | 'page' | 'country' | 'device' | 'date'>
  rowLimit?: number
  /** Filtros GSC (p.ej. por página que empieza por /slug). */
  dimensionFilterGroups?: Array<{
    filters: Array<{ dimension: string; operator: string; expression: string }>
  }>
}

/**
 * Consulta Search Analytics (clics, impresiones, CTR, posición media) por las
 * dimensiones pedidas. Devuelve filas crudas de GSC.
 */
export async function querySearchAnalytics(opts: SearchAnalyticsOpts): Promise<GscRow[]> {
  const token = await getAccessToken()
  const res = await fetch(
    `${GSC_API}/sites/${encodeURIComponent(SITE_URL)}/searchAnalytics/query`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        startDate: opts.startDate,
        endDate: opts.endDate,
        dimensions: opts.dimensions,
        rowLimit: opts.rowLimit ?? 1000,
        dimensionFilterGroups: opts.dimensionFilterGroups,
      }),
    }
  )
  const data = (await res.json()) as { rows?: GscRow[]; error?: { message?: string } }
  if (!res.ok) {
    throw new Error(`Search Console API: ${data.error?.message || JSON.stringify(data)}`)
  }
  return data.rows ?? []
}
