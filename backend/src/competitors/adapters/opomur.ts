// backend/src/competitors/adapters/opomur.ts
//
// Opomur — plataforma de test por suscripción, foco Región de Murcia + estatales.
// WordPress + WooCommerce (subscriptions). Server-rendered en la hoja, PERO el
// listado de productos NO está en el sitemap (las cards de /oposiciones/ y /tienda/
// se pintan por JS). Sondeado 09/07/2026.
//   Fuente: WooCommerce Store API pública (JSON, sin auth):
//           /wp-json/wc/store/products?per_page=100  → 17 productos con `permalink`.
//           Se declara como fuente `listing_html` y discoverUrls parsea el JSON.
//   Precio: JSON-LD Product/Offer en la hoja (suscripción mensual, IVA incl.).
//           Los productos "gratuitos" (0€, pruebas) → jsonLdPrice devuelve null.

import { CompetitorAdapter, ParsedCourse, ParsedPrice, UrlType } from './types';
import { jsonLdPrice, nameFromH1, nameFromSlug } from './_shared';

const BASE = 'https://opomur.es';

export function classifyOpomurUrl(url: string): UrlType {
  let path: string;
  try {
    path = new URL(url).pathname;
  } catch {
    return 'other';
  }
  // Hoja de producto/curso: /producto/<slug>/
  if (/^\/producto\/[^/]+\/?$/.test(path)) return 'oposicion';
  if (/^\/(tienda|categoria-producto|etiqueta-producto)\b/.test(path)) return 'categoria';
  return 'page';
}

/** Descubre los permalinks desde el JSON de la WooCommerce Store API. */
export function discoverOpomurUrls(text: string): string[] {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return [];
  }
  if (!Array.isArray(data)) return [];
  const urls: string[] = [];
  for (const p of data as Record<string, unknown>[]) {
    const link = p?.['permalink'];
    if (typeof link === 'string' && /\/producto\//.test(link)) urls.push(link);
  }
  return urls;
}

export function parseOpomurCourse(url: string, html: string): ParsedCourse | null {
  // El <title> de TODAS las hojas es el genérico del sitio ("Opomur - Plataforma
  // de test..."), inútil como nombre. El nombre real está en el <h1
  // class="product_title"> de WooCommerce → nameFromH1; slug como red de seguridad.
  const name = nameFromH1(html) || nameFromSlug(url);
  if (!name) return null;
  const prices: ParsedPrice[] = [];
  const cents = jsonLdPrice(html);
  if (cents != null) {
    // Suscripción mensual (WooCommerce Subscriptions).
    prices.push({ kind: 'cuota', audience: null, amountCents: cents, period: 'mensual', raw: `${cents / 100}€/mes` });
  }
  return { rawName: name, modalidad: 'online', region: null, prices };
}

export const opomurAdapter: CompetitorAdapter = {
  key: 'opomur',
  name: 'Opomur',
  baseUrl: BASE,
  tipo: 'plataforma_online',
  region: 'Murcia',
  classifyUrl: classifyOpomurUrl,
  parseCourse: parseOpomurCourse,
  discoverUrls: discoverOpomurUrls,
};
