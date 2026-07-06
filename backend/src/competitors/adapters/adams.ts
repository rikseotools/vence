// backend/src/competitors/adapters/adams.ts
//
// ADAMS — gran academia nacional (híbrida: presencial + online + libros).
// Next.js sobre Cloudflare EN MODO CDN (no challenge; el UA del bot pasa 200).
// Server-rendered con JSON-LD. Sondeado 06/07/2026.
//   Fuente: /sitemap/products/{1..5}.xml → filtrar /producto/oposiciones/ (~442).
//   Precio: SÍ, en el JSON-LD Course/Offer (price EUR). Este es el mejor caso.

import { CompetitorAdapter, ParsedCourse, ParsedPrice, UrlType } from './types';
import { nameFromSlug, nameFromTitle } from './_shared';

const BASE = 'https://www.adams.es';

export function classifyAdamsUrl(url: string): UrlType {
  let path: string;
  try {
    path = new URL(url).pathname;
  } catch {
    return 'other';
  }
  if (/^\/producto\/oposiciones\//.test(path)) return 'oposicion';
  if (/^\/producto\//.test(path)) return 'page'; // libros/cursos-profesionales/gratuitos
  if (/^\/oposiciones\//.test(path)) return 'categoria';
  return 'page';
}

/** Extrae name + price del JSON-LD Course/Product (PURA). */
export function parseAdamsJsonLd(html: string): { name: string; priceCents: number | null } {
  let name = '';
  let priceCents: number | null = null;
  const scripts = html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi);
  for (const s of scripts) {
    let data: unknown;
    try {
      data = JSON.parse(s[1].trim());
    } catch {
      continue;
    }
    const nodes = Array.isArray(data) ? data : [data];
    for (const node of nodes as Record<string, unknown>[]) {
      const type = node?.['@type'];
      if (type !== 'Course' && type !== 'Product') continue;
      if (!name && typeof node.name === 'string') name = node.name.trim();
      const offersRaw = node.offers as Record<string, unknown> | Record<string, unknown>[] | undefined;
      const offer = Array.isArray(offersRaw) ? offersRaw[0] : offersRaw;
      const price = offer?.['price'];
      if (priceCents == null && price != null) {
        const v = parseFloat(String(price));
        if (Number.isFinite(v)) priceCents = Math.round(v * 100);
      }
    }
  }
  return { name, priceCents };
}

export function parseAdamsCourse(url: string, html: string): ParsedCourse | null {
  const ld = parseAdamsJsonLd(html);
  const name = ld.name || nameFromTitle(html) || nameFromSlug(url);
  if (!name) return null;
  const prices: ParsedPrice[] =
    ld.priceCents != null
      ? [{ kind: 'curso', audience: null, amountCents: ld.priceCents, period: 'unico', raw: `${ld.priceCents / 100}€` }]
      : [];
  return { rawName: name, modalidad: 'mixta', region: null, prices };
}

export const adamsAdapter: CompetitorAdapter = {
  key: 'adams',
  name: 'ADAMS',
  baseUrl: BASE,
  tipo: 'hibrida',
  region: 'España',
  classifyUrl: classifyAdamsUrl,
  parseCourse: parseAdamsCourse,
};
