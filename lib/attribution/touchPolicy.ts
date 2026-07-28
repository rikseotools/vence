// lib/attribution/touchPolicy.ts — QUÉ visita merece un toque de atribución.
// Núcleo PURO compartido por el emisor (navegador) y el receptor (endpoint).
//
// ## Por qué existe (T-243, 28/07/2026)
//
// La regla estaba escrita DOS VECES, con el mismo criterio equivocado:
//   · `components/tracking/AttributionCapture.tsx`  → `if (!hasSignal) return`
//   · `app/api/attribution/touch/route.ts`          → `if (!hasSignal) skipped:'no_signal'`
//
// `hasSignal` solo era cierto con click-id (gclid/fbclid/…) o UTM en la URL, o sea
// **solo el tráfico de PAGO**. La visita orgánica, la directa, el enlace de un foro y el
// de ChatGPT no dejaban rastro — aunque su `landing_path` y su `referrer` estuvieran ahí
// mismo en el navegador. Resultado medido: **el 86% de las altas quedaba como `direct`** y
// el canal `organic` aparecía 1 vez en 12 días, imposible para un sitio con SEO.
//
// Lo irónico es que `deriveChannel()` YA sabía clasificar buscadores, IA y referidos: nunca
// recibía esos toques porque se filtraban antes. El clasificador estaba construido y en ayunas.
//
// Tenerlo duplicado tenía un modo de fallo peor que el bug: al ampliar solo el cliente, el
// servidor habría seguido descartando el toque **respondiendo `success: true`** — silencio
// perfecto. Por eso la regla vive aquí y la importan los dos.
//
// ## El criterio nuevo
//
// Un toque merece guardarse si aporta información de ORIGEN:
//   1. señal de campaña (click-id / UTM) → como siempre;
//   2. **entrada de sesión**: trae `landingPath` y su `referrer` NO es nuestro propio sitio.
//      Un referrer externo dice el canal; uno vacío es tráfico directo, que también es un
//      dato. Lo que no aporta nada es la navegación INTERNA (de una página nuestra a otra),
//      y esa se sigue descartando.

/** Campos de un toque que interesan para decidir si se guarda. */
export interface TouchPayload {
  gclid?: string | null
  gbraid?: string | null
  wbraid?: string | null
  fbclid?: string | null
  ttclid?: string | null
  msclkid?: string | null
  utmSource?: string | null
  utmMedium?: string | null
  utmCampaign?: string | null
  landingPath?: string | null
  referrer?: string | null
}

/** Dominios propios: un referrer de aquí es navegación interna, no un origen. */
const HOSTS_PROPIOS = /(^|\.)vence\.es$|^localhost$/i

/** ¿Trae la URL una señal explícita de campaña? (el criterio VIEJO, que sigue valiendo) */
export function hasCampaignSignal(t: TouchPayload): boolean {
  return Boolean(
    t.gclid || t.gbraid || t.wbraid || t.fbclid || t.ttclid || t.msclkid ||
    t.utmSource || t.utmCampaign,
  )
}

/**
 * ¿El referrer es una página NUESTRA? Entonces es navegación interna y no dice nada del
 * origen. Se parsea el host de verdad en vez de un `includes('vence.es')`, que aceptaría
 * `vence.es.sitio-malicioso.com` como propio y descartaría un referido legítimo.
 */
export function esNavegacionInterna(referrer: string | null | undefined): boolean {
  if (!referrer) return false // sin referrer = entrada directa, NO es interna
  try {
    return HOSTS_PROPIOS.test(new URL(referrer).hostname)
  } catch {
    return false // referrer ilegible → no se puede afirmar que sea interno
  }
}

/**
 * Decisión final, la que aplican los dos lados.
 *
 * @returns `motivo` para poder observar por qué se guarda o se descarta (sin él, un cambio
 *          de criterio vuelve a ser invisible durante semanas, como pasó aquí).
 */
export function shouldStoreTouch(t: TouchPayload): { store: boolean; motivo: string } {
  if (hasCampaignSignal(t)) return { store: true, motivo: 'campaign' }
  if (esNavegacionInterna(t.referrer)) return { store: false, motivo: 'navegacion_interna' }
  if (t.landingPath) return { store: true, motivo: 'entrada_sesion' }
  return { store: false, motivo: 'sin_informacion' }
}
