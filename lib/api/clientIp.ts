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
  /**
   * Ids de bordes **que NO son el nuestro** cuya cabecera venía en la petición.
   *
   * Estando detrás de un solo CDN, esto debería estar SIEMPRE vacío: nadie tiene
   * motivo para mandar `cf-connecting-ip` si el borde es CloudFront. Si aparece,
   * solo hay dos explicaciones y las dos hay que verlas:
   *   · alguien **inyecta** cabeceras de borde (llegó al origen saltándose el CDN), o
   *   · nos hemos **equivocado de `TRUSTED_EDGE`** tras un cambio de proveedor.
   *
   * Es el punto ciego que quedaba: sin `TRUSTED_EDGE`, una cabecera falsificada de
   * OTRO proveedor se aceptaba como buena y no se distinguía de la legítima. Con
   * `TRUSTED_EDGE` deja de aceptarse, pero seguiría siendo invisible — por eso se
   * REPORTA además de ignorarse. Volumen esperado: **cero**, así que emitirlo no
   * escala mal; si deja de ser cero, es justo lo que queremos saber.
   */
  foreignEdgeHeaders: string[];
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

  // Cabeceras de borde AJENO presentes. Solo tiene sentido cuando sabemos cuál es el
  // nuestro: sin `TRUSTED_EDGE` no hay "ajeno" que valga y se deja vacío (no inventamos
  // una alarma que no podemos justificar).
  const foreignEdgeHeaders = trustedEdge
    ? EDGE_PROVIDERS.filter((p) => p.id !== trustedEdge && headers.get(p.header)).map((p) => p.id)
    : [];

  for (const p of permitidos) {
    const raw = headers.get(p.header);
    if (raw) {
      const ip = p.parse(raw);
      if (ip) return { ip, trust: 'trusted', source: p.id, foreignEdgeHeaders };
    }
  }

  // Ojo: si `TRUSTED_EDGE` nombra un borde y su cabecera NO viene, lo que llegue por
  // x-forwarded-for NO asciende a "trusted". Es el caso de "me saltaron el CDN".
  for (const h of FALLBACK_HEADERS) {
    const raw = headers.get(h);
    if (raw) {
      const ip = raw.split(',')[0]?.trim();
      if (ip) return { ip, trust: 'untrusted', source: h, foreignEdgeHeaders };
    }
  }

  return { ip: 'unknown', trust: 'unknown', source: 'none', foreignEdgeHeaders };
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

/**
 * La IP **solo si sirve para decidir**, o `null`.
 *
 * Para eso está el `trust` que advierte `getClientIp` justo arriba, y aquí se aplica de verdad:
 * la corroboración por IP del límite por dispositivo ([T-657]) AGRUPA cuentas, así que una IP
 * falsificable la puede esquivar quien quiera —basta con mandar un `x-forwarded-for` distinto por
 * cuenta— y el límite se vuelve decorativo. Solo cuenta la que pone el borde.
 *
 * Y descarta el `'unknown'` que devuelve `resolveClientIp` cuando no hay ninguna cabecera: pasarlo
 * como si fuera una IP agruparía entre sí a todos los desconocidos, que es el error contrario y
 * peor (cortarle el cupo a gente que no tiene nada que ver, que es justo lo que se está
 * arreglando).
 */
export function ipDeConfianza(request: { headers: HeaderReader }): string | null {
  const r = resolveClientIp(request.headers);
  if (r.trust !== 'trusted') return null;
  if (!r.ip || r.ip === 'unknown') return null;
  return r.ip;
}
