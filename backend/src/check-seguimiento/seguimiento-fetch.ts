/**
 * Helpers puros de red y extracción para el monitoreo de páginas de seguimiento.
 * Portado de `lib/api/seguimiento-convocatorias/queries.ts` — solo las partes
 * de red/hashing; sin DI, sin estado, fáciles de testear.
 */

import * as crypto from 'crypto';
import * as https from 'https';

/** Hosts cuyo servidor no envía cadena intermedia y Node no puede validar. */
const INSECURE_TLS_HOSTS = new Set<string>([
  'www.dpz.es', // FNMT-RCM intermedio no servido (15-may-2026)
]);

const USER_AGENT =
  'Mozilla/5.0 (compatible; VenceBot/1.0; +https://www.vence.es)';

const FETCH_HEADERS = {
  'User-Agent': USER_AGENT,
  Accept: 'text/html,application/xhtml+xml',
  'Accept-Language': 'es-ES,es;q=0.9',
};

/** Limpia HTML para obtener solo texto relevante (sin scripts, styles, headers, footers dinámicos). */
function extractRelevantText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/&#\d+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Genera hash SHA-256 del contenido relevante de una página. */
export function hashContent(html: string): string {
  const text = extractRelevantText(html);
  return crypto.createHash('sha256').update(text).digest('hex');
}

/** Extrae preview del contenido (primeros 2000 chars de texto limpio). */
export function getContentPreview(html: string): string {
  return extractRelevantText(html).slice(0, 2000);
}

/**
 * Detecta páginas de bloqueo de WAF que devuelven HTTP 200 con cuerpo de error.
 * Su hash cambia en cada check por tokens dinámicos → generarían señales infinitas.
 * Solo se considera bloqueo si el texto es corto (una ficha real tiene miles de chars).
 */
export function isBlockedPage(html: string): boolean {
  const text = extractRelevantText(html).toLowerCase();
  if (text.length > 1500) return false;
  return /access denied|forbidden|you don't have permission|request blocked|captcha|are you a robot/.test(
    text,
  );
}

/**
 * Fetch HTTPS sin validar TLS para servidores que no envían cadena intermedia.
 * Sigue hasta 5 redirects.
 */
function fetchInsecureTls(
  url: string,
  headers: Record<string, string>,
  redirectsLeft = 5,
): Promise<{ html: string; status: number }> {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request(
      {
        host: u.host,
        path: u.pathname + u.search,
        method: 'GET',
        headers,
        rejectUnauthorized: false,
        timeout: 30000,
      },
      (res) => {
        const status = res.statusCode ?? 0;
        const loc = res.headers.location;
        if (loc && status >= 300 && status < 400 && redirectsLeft > 0) {
          res.resume();
          const nextUrl = new URL(loc, url).toString();
          fetchInsecureTls(nextUrl, headers, redirectsLeft - 1).then(resolve, reject);
          return;
        }
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () =>
          resolve({ html: Buffer.concat(chunks).toString('utf-8'), status }),
        );
        res.on('error', reject);
      },
    );
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
    req.end();
  });
}

export interface FetchPageResult {
  html: string;
  httpStatus: number;
  error: string | null;
}

/**
 * Descarga la página de seguimiento con timeout de 30s.
 * Maneja automáticamente los hosts con TLS incompleto.
 */
export async function fetchSeguimientoPage(url: string): Promise<FetchPageResult> {
  try {
    const host = new URL(url).host;

    if (INSECURE_TLS_HOSTS.has(host)) {
      const { html, status } = await fetchInsecureTls(url, FETCH_HEADERS);
      return { html, httpStatus: status, error: null };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    let response: Response;
    try {
      response = await fetch(url, {
        signal: controller.signal,
        headers: FETCH_HEADERS,
      });
    } finally {
      clearTimeout(timeout);
    }

    const html = await response.text();
    return { html, httpStatus: response.status, error: null };
  } catch (err) {
    return {
      html: '',
      httpStatus: 0,
      error: (err as Error).message,
    };
  }
}
