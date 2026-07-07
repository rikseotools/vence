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

/** Precio (céntimos) de un `offers` (objeto o array). */
function offerPriceCents(offersRaw: unknown): number | null {
  const offer = Array.isArray(offersRaw) ? offersRaw[0] : (offersRaw as Record<string, unknown> | undefined);
  const price = offer?.['price'];
  if (price == null) return null;
  const v = parseFloat(String(price));
  return Number.isFinite(v) ? Math.round(v * 100) : null;
}

/** Extrae name + price del JSON-LD Course/Product (PURA). ADAMS anida el precio
 *  en `hasCourseInstance[].offers`, no siempre en `offers` de nivel superior. */
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
      if (priceCents == null) priceCents = offerPriceCents(node.offers);
      // ADAMS: offer dentro de hasCourseInstance[]
      const instances = node.hasCourseInstance;
      const instArr = Array.isArray(instances) ? instances : instances ? [instances] : [];
      for (const inst of instArr as Record<string, unknown>[]) {
        if (priceCents == null) priceCents = offerPriceCents(inst?.offers);
      }
    }
  }
  return { name, priceCents };
}

export function parseAdamsCourse(url: string, html: string): ParsedCourse | null {
  const ld = parseAdamsJsonLd(html);
  const name = ld.name || nameFromTitle(html) || nameFromSlug(url);
  if (!name) return null;
  // Producto retirado → ADAMS sirve su página de buscador (título genérico). No es
  // un curso real: descartar para no ensuciar el catálogo.
  if (/^buscador de oposiciones$/i.test(name.trim())) return null;
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
