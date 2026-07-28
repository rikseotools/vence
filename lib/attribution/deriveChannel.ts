// lib/attribution/deriveChannel.ts — de un toque a un CANAL de marketing.
//
// Extraído de `app/api/acquisition/route.ts` (T-243, 28/07/2026), donde estaba atrapado: no
// se podía testear ni simular sobre los datos ya guardados.
//
// ⚠️ ÚNICO cambio de comportamiento respecto al original, y va explícito para que se pueda
// discutir en vez de colarse en un refactor: **`copilot.` pasa a contar como `ai_referral`**
// (antes caía en `referral`). Motivo: en los datos hay altas con `copilot.com` como origen —
// pocas, 4 en 12 días, pero es el mismo canal que ChatGPT/Perplexity y separarlo del SEO es
// justo el punto de tener `ai_referral`. Todo lo demás se mantiene idéntico.
//
// Contexto de por qué importa: este clasificador **ya sabía** distinguir buscadores, IA y
// referidos, pero durante meses no recibió ni un toque orgánico porque el emisor los
// filtraba antes (ver `touchPolicy.ts`). Estaba construido y en ayunas.

export interface ChannelSignals {
  gclid?: string | null
  gbraid?: string | null
  wbraid?: string | null
  fbclid?: string | null
  ttclid?: string | null
  msclkid?: string | null
  utmSource?: string | null
  utmMedium?: string | null
  referrer?: string | null
}

/** Host del referrer, o `null` si no es una URL legible. */
function hostDe(referrer: string): string | null {
  try {
    return new URL(referrer).hostname.toLowerCase()
  } catch {
    return null
  }
}

/**
 * Referrers `android-app://<package>`: el "host" es el nombre del paquete, donde `.google.`
 * NO implica buscador. Se resuelven por paquete conocido y, si no, `referral` — nunca
 * `organic`, que es el error que se estaba cometiendo con Gmail.
 */
function canalDeApp(paquete: string): string {
  if (paquete === 'com.google.android.googlequicksearchbox') return 'organic' // app de Google
  if (paquete === 'com.google.android.gm') return 'email' // Gmail: un clic en un correo
  if (paquete === 'com.android.chrome' || paquete === 'com.google.android.apps.chrome') return 'direct'
  if (/whatsapp|telegram|facebook|instagram|twitter|linkedin/.test(paquete)) return 'social'
  return 'referral'
}

/** Buscadores → `organic`. Se aplica sobre el HOST (ver nota en `deriveChannel`). */
const RE_BUSCADOR = /(?:^|\.)(google|bing|duckduckgo|yahoo|ecosia|yandex|brave|startpage|baidu)\.|(?:^|\.)search\./
/** Asistentes de IA → `ai_referral` (canal propio: crece y conviene no mezclarlo con SEO). */
const RE_IA = /chatgpt\.com|perplexity\.|bard\.|gemini\.|copilot\./

/**
 * Deriva el canal a partir de los click-IDs / UTM / referrer de un toque.
 *
 * Orden deliberado: los click-IDs mandan sobre los UTM (un anuncio puede traer ambos y el
 * click-id es el dato duro), y el referrer solo decide cuando no hay campaña.
 */
export function deriveChannel(t: ChannelSignals): string {
  if (t.gclid || t.gbraid || t.wbraid) return 'google_ads'
  if (t.fbclid) return 'meta_ads'
  if (t.ttclid) return 'tiktok_ads'
  if (t.msclkid) return 'bing_ads'
  const src = (t.utmSource || '').toLowerCase()
  const med = (t.utmMedium || '').toLowerCase()
  if (src === 'google' && med === 'cpc') return 'google_ads'
  if (['facebook', 'instagram', 'meta'].includes(src) || src.includes('fb') || src.includes('meta')) return 'meta_ads'
  if (src || med) return src ? `${src}${med ? '/' + med : ''}` : 'referral'
  // Sin UTM ni click-id → clasificar por el referrer, mirando el HOST.
  const ref = (t.referrer || '').toLowerCase()
  if (ref && !ref.includes('vence.es') && !ref.includes('localhost')) {
    // ⚠️ Se compara contra el HOSTNAME, no contra la URL entera. El original probaba
    // `(?:^|\.)google\.` sobre el texto completo, donde `^` es el principio de
    // `"https://…"`: por eso `https://duckduckgo.com/` (sin `www.`) caía en `referral`
    // en vez de `organic`. Con el filtro viejo daba igual —esos toques ni se guardaban—,
    // pero ahora que por fin llega tráfico orgánico sí importa, y mucho: media internet
    // manda el referrer sin `www.`.
    const host = hostDe(ref)
    const objetivo = host ?? ref
    // Apps Android: el "host" es el package name, y ahí `.google.` no significa buscador.
    // Lo destapó la simulación sobre datos reales (`sim-captura-ampliada.ts`):
    // `android-app://com.google.android.gm/` es **Gmail** y se estaba contando como
    // `organic` — 121 casos en 7 días. Un clic desde el correo NO es SEO, y con la captura
    // ampliada iban a llegar muchos más.
    if (ref.startsWith('android-app://')) return canalDeApp(objetivo)
    if (RE_IA.test(objetivo)) return 'ai_referral'
    if (RE_BUSCADOR.test(objetivo)) return 'organic'
    return 'referral'
  }
  return 'direct' // sin referrer ni campaña = tráfico directo (antes devolvía 'organic', incorrecto)
}
