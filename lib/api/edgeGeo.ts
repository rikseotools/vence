// lib/api/edgeGeo.ts
//
// Geolocalización que el borde inyecta en las cabeceras del request. Pura: sin red, sin BD.
//
// ## Por qué existe (T-314, 31/07/2026)
//
// Vivía dentro de `app/api/auth/track-session-ip/route.ts`. Se saca aquí porque desde T-314 hay
// DOS sitios que estampan la sesión —el que la CREA y el que la corrige más tarde— y dos copias
// se separarían a la primera cabecera nueva del borde.
//
// ## Por qué es un REGISTRO y no un `if` de CloudFront
//
// Es la lección de `lib/api/clientIp.ts` (T-089), aplicada a su hermana: aquella sabía de un solo
// proveedor y, al mover el sitio detrás de otro borde, **la cabecera de confianza desaparecía sin
// que nada avisara**. Aquí el daño es menor —geo, no seguridad— pero el modo de fallo es idéntico
// y esta ficha existe justo por eso: un escritor que deja de escribir no da error, da silencio.
// Con la migración a otro CDN sobre la mesa, **añadir un borde tiene que ser una fila**.
//
// ⚠️ **Cloudflare no garantiza lo mismo que CloudFront.** `CF-IPCountry` llega siempre; ciudad,
// región y coordenadas dependen del plan / de que se activen las cabeceras de ubicación. Por eso
// el país basta para dar la geo por buena y el resto se rellena si viene. Media geo es mejor que
// ninguna: `country_code` es lo que consulta el antifraude.

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
 * Registro de bordes conocidos, en orden de preferencia. **Añadir un proveedor = una fila.**
 *
 * `country` es obligatorio: sin él no hay geo que valga. El resto es opcional a propósito.
 * `decode` existe porque Vercel manda el city url-encoded y CloudFront/Cloudflare, no.
 */
export const GEO_PROVIDERS: ReadonlyArray<{
  id: string
  country: string
  region?: string
  city?: string
  lat?: string
  lon?: string
  decode?: boolean
}> = [
  {
    id: 'cloudfront',
    country: 'cloudfront-viewer-country',
    region: 'cloudfront-viewer-country-region',
    city: 'cloudfront-viewer-city',
    lat: 'cloudfront-viewer-latitude',
    lon: 'cloudfront-viewer-longitude',
  },
  {
    id: 'cloudflare',
    country: 'cf-ipcountry',
    region: 'cf-region-code',
    city: 'cf-ipcity',
    lat: 'cf-iplatitude',
    lon: 'cf-iplongitude',
  },
  {
    id: 'vercel',
    country: 'x-vercel-ip-country',
    region: 'x-vercel-ip-country-region',
    city: 'x-vercel-ip-city',
    lat: 'x-vercel-ip-latitude',
    lon: 'x-vercel-ip-longitude',
    decode: true,
  },
]

/**
 * Geo del borde, o `null` si ninguno la manda (dev local, o petición que se saltó el CDN).
 *
 * @param trustedEdge  Id del borde ante el que estamos. Si se indica, sólo se mira ese. Por
 *   defecto se lee de `TRUSTED_EDGE` —la MISMA variable que gobierna la IP en `clientIp.ts`, para
 *   que un cambio de CDN sea un cambio de configuración y no dos—; sin ella, vale el primero que
 *   conteste.
 */
export function extractEdgeGeo(
  headers: HeaderReader,
  trustedEdge: string | undefined = process.env.TRUSTED_EDGE,
): EdgeGeo | null {
  const candidatos = trustedEdge
    ? GEO_PROVIDERS.filter((p) => p.id === trustedEdge)
    : GEO_PROVIDERS

  for (const p of candidatos) {
    const country = headers.get(p.country)
    if (!country) continue
    const city = p.city ? headers.get(p.city) : null
    return {
      country_code: country,
      region: (p.region && headers.get(p.region)) || '',
      city: city ? (p.decode ? safeDecodeURIComponent(city) : city) : '',
      lat: parseFloatOrNull(p.lat ? headers.get(p.lat) : null),
      lon: parseFloatOrNull(p.lon ? headers.get(p.lon) : null),
    }
  }
  return null
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
