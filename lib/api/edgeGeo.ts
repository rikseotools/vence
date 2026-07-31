// lib/api/edgeGeo.ts
//
// Geolocalización que el borde (CloudFront / Vercel legacy) inyecta en las cabeceras del request.
// Síncrono y sin red: son datos que ya vienen puestos.
//
// Vivía dentro de `app/api/auth/track-session-ip/route.ts`. Se saca aquí porque desde T-314 hay
// DOS sitios que estampan la sesión —el que la CREA y el que la corrige más tarde— y dos copias
// de esta lectura se separarían a la primera cabecera nueva del borde.

export interface EdgeGeo {
  country_code: string
  region: string
  city: string
  lat: number | null
  lon: number | null
}

interface HeaderReader {
  get(name: string): string | null
}

/**
 * Preferencia: CloudFront (infra actual desde la migración) → Vercel (legacy).
 *
 * CloudFront-Viewer-* requieren una origin request policy que reenvíe las geo headers
 * (p.ej. Managed-AllViewerAndCloudFrontHeaders-2022-06). Las de Vercel traen el city
 * url-encoded; las de CloudFront, no.
 *
 * En dev local no existe ninguna → `null`, y la sesión se guarda sin geo. Es lo esperado.
 */
export function extractEdgeGeo(headers: HeaderReader): EdgeGeo | null {
  const cfCountry = headers.get('cloudfront-viewer-country')
  if (cfCountry) {
    return {
      country_code: cfCountry,
      region: headers.get('cloudfront-viewer-country-region') || '',
      city: headers.get('cloudfront-viewer-city') || '',
      lat: parseFloatOrNull(headers.get('cloudfront-viewer-latitude')),
      lon: parseFloatOrNull(headers.get('cloudfront-viewer-longitude')),
    }
  }

  const country = headers.get('x-vercel-ip-country')
  if (!country) return null

  const cityEncoded = headers.get('x-vercel-ip-city')
  return {
    country_code: country,
    region: headers.get('x-vercel-ip-country-region') || '',
    city: cityEncoded ? safeDecodeURIComponent(cityEncoded) : '',
    lat: parseFloatOrNull(headers.get('x-vercel-ip-latitude')),
    lon: parseFloatOrNull(headers.get('x-vercel-ip-longitude')),
  }
}

function safeDecodeURIComponent(s: string): string {
  try {
    return decodeURIComponent(s)
  } catch {
    return s
  }
}

function parseFloatOrNull(s: string | null): number | null {
  if (!s) return null
  const n = parseFloat(s)
  return isFinite(n) ? n : null
}
