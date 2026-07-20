// lib/browser/inAppBrowser.ts
// Detección de navegadores embebidos (in-app) que bloquean window.print() en silencio.
//
// Contexto: el botón "Imprimir PDF" del temario usa window.print(). Los navegadores
// embebidos dentro de apps (app de Google/GSA, Instagram, Facebook, TikTok…) bloquean
// esa llamada SIN error → el botón no hace nada y el usuario cree que está roto
// (caso María, feedback feb79fc5: 100% de sus sesiones fueron GSA in-app en iPhone).
// Por ahí entra mucho tráfico de Google/redes, así que conviene detectarlo y avisar.
//
// Puro y testeable: acepta un userAgent explícito; en cliente lee navigator.userAgent.

// Cada patrón identifica el token que estas apps inyectan en el user agent.
const IN_APP_PATTERNS: RegExp[] = [
  /FBAN|FBAV|FB_IAB|FBIOS|FBDV|Messenger/, // Facebook / Messenger
  /Instagram/,                              // Instagram
  /\bGSA\//,                                // App de Google (GSA) en iOS — el caso de María
  /\bLine\//,                               // LINE
  /\b(Twitter|TwitterAndroid)\b/,           // Twitter / X
  /musical_ly|Bytedance|TikTok/i,           // TikTok
  /Snapchat/,                               // Snapchat
  /LinkedInApp/,                            // LinkedIn
  /\bWhatsApp/,                             // WhatsApp
  /Pinterest/,                              // Pinterest
]

// Navegadores REALES de iOS. En iOS todo webview embebido usa WebKit, así que
// "es iOS" no basta; pero un navegador de verdad (Safari, Chrome=CriOS,
// Firefox=FxiOS, Edge=EdgiOS, Opera=OPT) SÍ deja imprimir. Si es iOS y NO es
// ninguno de estos, es casi seguro un WKWebView embebido (que bloquea print),
// aunque la app no esté en el allowlist de arriba → heurística anti-falso-negativo.
const IOS_UA = /iPhone|iPad|iPod/
const IOS_REAL_BROWSER = /CriOS|FxiOS|EdgiOS|OPT\//
// Safari "de verdad" pone "Version/x.y ... Safari/"; los WKWebView embebidos
// suelen omitir el token "Version/". Distinguimos así el Safari real del webview.
const IOS_SAFARI_REAL = /Version\/[\d.]+ Mobile\/\w+ Safari/

/**
 * True si el user agent corresponde a un navegador embebido (in-app) que bloquea
 * window.print(). Combina dos señales:
 *  1) allowlist de apps conocidas (Instagram, Facebook, GSA…), en iOS y Android;
 *  2) heurística iOS: es iPhone/iPad pero NO es un navegador real → WKWebView.
 * Devuelve false si no hay UA disponible (SSR) → nunca falsea el flujo normal.
 */
export function isInAppBrowser(ua?: string): boolean {
  const s = ua ?? (typeof navigator !== 'undefined' ? navigator.userAgent : '')
  if (!s) return false
  if (IN_APP_PATTERNS.some((re) => re.test(s))) return true
  // Heurística iOS: webview embebido = iOS, no es Chrome/Firefox/Edge/Opera, y
  // tampoco es el Safari real (sin token "Version/… Safari").
  if (IOS_UA.test(s) && !IOS_REAL_BROWSER.test(s) && !IOS_SAFARI_REAL.test(s)) {
    return true
  }
  return false
}
