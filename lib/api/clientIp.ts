/**
 * IP del cliente, AGNÓSTICA del proveedor de borde. Pura: sin red, sin BD.
 *
 * ## Por qué existe (27/07/2026)
 *
 * La versión anterior sabía de **un solo** proveedor: leía `CloudFront-Viewer-Address`
 * y, si no estaba, caía a `x-forwarded-for` — que su propio comentario marcaba como
 * *"spoofable"*. Eso tiene dos problemas, y el segundo es de seguridad:
 *
 * 1. **Acoplamiento.** Cambiar de CDN obligaba a tocar código de aplicación.
 * 2. **Degradación SILENCIOSA.** Al mover el sitio detrás de otro borde, la cabecera de
 *    confianza desaparece y todo pasa a fiarse de una que el cliente puede falsificar,
 *    **sin que nada avise**. Y encima de la IP corre el antifraude (`multi_account_reg_ip`,
 *    `curl_scraping`, IP de registro): un control de seguridad debilitado en silencio es
 *    peor que uno roto, porque el roto se nota.
 *
 * ## El contrato
 *
 * `resolveClientIp()` no devuelve solo la IP: devuelve **de dónde salió y cuánto vale**.
 * Quien la use para seguridad puede exigir `trust === 'trusted'`; quien la use para un
 * rate-limit best-effort puede conformarse con menos. Antes eso no se podía distinguir.
 *
 * ## Cambiar de proveedor
 *
 * Añadir un borde = **una fila** en `EDGE_PROVIDERS`. Y `TRUSTED_EDGE` (variable de
 * entorno) fija cuál es el bueno: con ella puesta, SOLO se confía en esa cabecera y las
 * demás pasan a ser no fiables. Eso es lo que convierte un cambio de CDN en un cambio de
 * configuración.
 *
 * ## ⚠️ Precondición de infraestructura (sin esto, `trusted` es mentira)
 *
 * Una cabecera de borde solo es de fiar si **el origen NO es alcanzable directamente**:
 * si cualquiera puede llegar a la app saltándose el CDN, puede inventarse
 * `CF-Connecting-IP` igual que `x-forwarded-for`. En CloudFront lo garantiza que el
 * origen solo acepta su tráfico; con un Cloudflare propio hay que **cortafuegos al rango
 * del CDN**. Este módulo no puede verificarlo — solo dejarlo escrito.
 *
 * @module lib/api/clientIp
 */

/** Cuánto vale la IP que devolvemos. */
export type IpTrust =
  /** Cabecera inyectada por un borde de confianza (ver precondición). */
  | 'trusted'
  /** Cabecera que el cliente puede falsificar. Vale para rate-limit, NO para seguridad. */
  | 'untrusted'
  /** No hay ninguna cabecera de IP. */
  | 'unknown';

export interface ClientIp {
  /** La IP, o `'unknown'` si no hay ninguna. */
  ip: string;
  trust: IpTrust;
  /** Qué la produjo (`cloudfront`, `cloudflare`, `x-forwarded-for`…). Para trazas. */
  source: string;
}

/** Sólo lo que necesitamos de `Request`: así se puede testear sin fabricar uno. */
export interface HeaderReader {
  get(name: string): string | null;
}

/**
 * Registro de bordes conocidos. **Añadir un proveedor = una fila.**
 *
 * `CloudFront-Viewer-Address` llega como `IP:puerto` (también en IPv6), así que el puerto
 * se corta por el ÚLTIMO `:`. Los demás mandan la IP pelada.
 */
export const EDGE_PROVIDERS: ReadonlyArray<{
  id: string;
  header: string;
  parse: (raw: string) => string;
}> = [
  { id: 'cloudfront', header: 'cloudfront-viewer-address', parse: stripPort },
  { id: 'cloudflare', header: 'cf-connecting-ip', parse: (v) => v.trim() },
  { id: 'fastly', header: 'fastly-client-ip', parse: (v) => v.trim() },
  { id: 'akamai', header: 'true-client-ip', parse: (v) => v.trim() },
];

function stripPort(raw: string): string {
  const v = raw.trim();
  const i = v.lastIndexOf(':');
  return i > 0 ? v.slice(0, i) : v;
}

/** Cabeceras de respaldo: el cliente puede anteponerles lo que quiera. */
const FALLBACK_HEADERS = ['x-forwarded-for', 'x-real-ip'] as const;

/**
 * Resuelve la IP del cliente y **cuánto vale**.
 *
 * @param headers  Cualquier cosa con `.get(name)` (un `Request.headers` sirve).
 * @param trustedEdge  Id del borde ante el que estamos. Si se indica, **solo** esa
 *   cabecera cuenta como de confianza. Por defecto se lee de `TRUSTED_EDGE`; si no está,
 *   se acepta cualquier borde conocido (comportamiento histórico, menos estricto).
 */
export function resolveClientIp(
  headers: HeaderReader,
  trustedEdge: string | undefined = process.env.TRUSTED_EDGE,
): ClientIp {
  const permitidos = trustedEdge
    ? EDGE_PROVIDERS.filter((p) => p.id === trustedEdge)
    : EDGE_PROVIDERS;

  for (const p of permitidos) {
    const raw = headers.get(p.header);
    if (raw) {
      const ip = p.parse(raw);
      if (ip) return { ip, trust: 'trusted', source: p.id };
    }
  }

  // Ojo: si `TRUSTED_EDGE` nombra un borde y su cabecera NO viene, lo que llegue por
  // x-forwarded-for NO asciende a "trusted". Es el caso de "me saltaron el CDN".
  for (const h of FALLBACK_HEADERS) {
    const raw = headers.get(h);
    if (raw) {
      const ip = raw.split(',')[0]?.trim();
      if (ip) return { ip, trust: 'untrusted', source: h };
    }
  }

  return { ip: 'unknown', trust: 'unknown', source: 'none' };
}

/**
 * Sólo la IP, sin el veredicto. Compatibilidad con los ~15 llamadores existentes.
 *
 * ⚠️ Para decisiones de SEGURIDAD (antifraude, bloqueos) usa `resolveClientIp()` y
 * comprueba `trust`: esta función devuelve igual una IP falsificable que una de confianza,
 * que es justo la ambigüedad que motivó el módulo.
 */
export function getClientIp(request: { headers: HeaderReader }): string {
  return resolveClientIp(request.headers).ip;
}
