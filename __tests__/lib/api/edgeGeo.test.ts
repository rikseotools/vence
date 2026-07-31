/**
 * Geo del borde, agnóstica del proveedor (T-314 + la lección de T-089).
 *
 * El fallo que fija este test es de FUTURO, no de pasado: con la migración de CDN sobre la mesa,
 * una lectura que solo sepa de CloudFront devolvería `null` detrás de Cloudflare **sin dar ningún
 * error**. Es exactamente lo que le pasó a la IP de sesión: el escritor dejó de escribir y nadie
 * se enteró en 27 días.
 */
import { extractEdgeGeo, GEO_PROVIDERS } from '@/lib/api/edgeGeo'

const h = (o: Record<string, string>) => ({
  get: (n: string) => o[n.toLowerCase()] ?? null,
})

describe('extractEdgeGeo', () => {
  it('CloudFront: la geo completa, sin decodificar (no viene url-encoded)', () => {
    expect(
      extractEdgeGeo(
        h({
          'cloudfront-viewer-country': 'ES',
          'cloudfront-viewer-country-region': 'M',
          'cloudfront-viewer-city': 'Madrid',
          'cloudfront-viewer-latitude': '40.4168',
          'cloudfront-viewer-longitude': '-3.7038',
        }),
        undefined,
      ),
    ).toEqual({ country_code: 'ES', region: 'M', city: 'Madrid', lat: 40.4168, lon: -3.7038 })
  })

  it('Cloudflare: el país basta — ciudad y coordenadas dependen del plan', () => {
    // El caso que de verdad va a ocurrir el día del cutover: `CF-IPCountry` a secas.
    expect(extractEdgeGeo(h({ 'cf-ipcountry': 'ES' }), undefined)).toEqual({
      country_code: 'ES',
      region: '',
      city: '',
      lat: null,
      lon: null,
    })
  })

  it('Cloudflare con las cabeceras de ubicación activadas', () => {
    const geo = extractEdgeGeo(
      h({ 'cf-ipcountry': 'ES', 'cf-ipcity': 'Sevilla', 'cf-iplatitude': '37.38' }),
      undefined,
    )
    expect(geo?.city).toBe('Sevilla')
    expect(geo?.lat).toBe(37.38)
    expect(geo?.lon).toBeNull()
  })

  it('Vercel (legacy): el city SÍ viene url-encoded', () => {
    const geo = extractEdgeGeo(
      h({ 'x-vercel-ip-country': 'ES', 'x-vercel-ip-city': 'Las%20Palmas' }),
      undefined,
    )
    expect(geo?.city).toBe('Las Palmas')
  })

  it('un city mal codificado no tira la petición: se guarda tal cual', () => {
    const geo = extractEdgeGeo(h({ 'x-vercel-ip-country': 'ES', 'x-vercel-ip-city': '%E0%A4%A' }), undefined)
    expect(geo?.city).toBe('%E0%A4%A')
  })

  it('sin cabeceras de ningún borde → null (dev local)', () => {
    expect(extractEdgeGeo(h({}), undefined)).toBeNull()
  })

  it('CloudFront gana a los demás cuando están los dos', () => {
    const geo = extractEdgeGeo(h({ 'cloudfront-viewer-country': 'ES', 'cf-ipcountry': 'FR' }), undefined)
    expect(geo?.country_code).toBe('ES')
  })

  it('TRUSTED_EDGE fija el borde: detrás de Cloudflare NO se lee una cabecera de CloudFront', () => {
    // Un cliente puede inventarse `cloudfront-viewer-country`; si estamos tras Cloudflare, esa
    // cabecera no la pone nadie de confianza. Misma variable que gobierna la IP en clientIp.ts.
    const headers = h({ 'cloudfront-viewer-country': 'ES', 'cf-ipcountry': 'FR' })
    expect(extractEdgeGeo(headers, 'cloudflare')?.country_code).toBe('FR')
    expect(extractEdgeGeo(h({ 'cloudfront-viewer-country': 'ES' }), 'cloudflare')).toBeNull()
  })

  it('el registro cubre los bordes que ya conoce el resolutor de IP', () => {
    // Si alguien añade un borde a EDGE_PROVIDERS y no aquí, la geo se apaga sola el día del
    // cutover. Este test no lo impide, pero deja el par a la vista.
    const ids = GEO_PROVIDERS.map((p) => p.id)
    expect(ids).toEqual(expect.arrayContaining(['cloudfront', 'cloudflare']))
  })
})
