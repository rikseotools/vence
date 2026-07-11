// backend/src/competitors/adapters/temariosoficiales.ts
//
// Temarios Oficiales — editorial: venta de temarios en PDF (WooCommerce/WordPress).
// Sondeado 11/07/2026. Modelo editorial (como TemariosenPDF / Editorial MAD): el
// "curso" es un temario/PDF de pago único por oposición.
//   Fuente: /sitemap_index.xml (Yoast) → hijos product-sitemap{,2,3}.xml. Se
//           declara `sitemap_index`; el motor sigue los hijos (product-*).
//   Precio: JSON-LD Product en la hoja (WooCommerce emite `offers.price`) →
//           jsonLdPrice. Producto VARIABLE (95/165/260€ según opción) → se toma
//           el precio del offer que resuelve jsonLdPrice (el base/"desde").
//   URL-hoja: /product/<slug>/ ; categoría: /product-category/<slug>/.
//   <title>: "<oposición> -" (marca vacía tras el guión) → nameFromTitle la quita.
//   Vende, entre otros, TAI del Estado (95–260€) y muchas otras oposiciones.

import { CompetitorAdapter, ParsedCourse, ParsedPrice, UrlType } from './types';
import { jsonLdPrice, nameFromTitle, nameFromSlug } from './_shared';

const BASE = 'https://temariosoficiales.com';

export function classifyTemariosoficialesUrl(url: string): UrlType {
  let path: string;
  try {
    path = new URL(url).pathname;
  } catch {
    return 'other';
  }
  // Lo específico ANTES que lo genérico (gotcha §5 del runbook: /product/ es hoja).
  if (/^\/product\/[a-z0-9-]+\/?$/.test(path)) return 'oposicion';
  if (/^\/product-category\/[a-z0-9-]+\/?$/.test(path)) return 'categoria';
  return 'page';
}

export function parseTemariosoficialesCourse(url: string, html: string): ParsedCourse | null {
  const name = (nameFromTitle(html) || nameFromSlug(url)).trim();
  if (!name) return null;
  const prices: ParsedPrice[] = [];
  const cents = jsonLdPrice(html);
  if (cents != null) {
    // Temario/PDF a precio único (producto variable → precio "desde").
    prices.push({ kind: 'material', audience: null, amountCents: cents, period: 'unico', raw: `${cents / 100}€` });
  }
  return { rawName: name, modalidad: null, region: null, prices };
}

export const temariosoficialesAdapter: CompetitorAdapter = {
  key: 'temarios-oficiales', // == competitors.slug
  name: 'Temarios Oficiales',
  baseUrl: BASE,
  tipo: 'plataforma_online', // editorial; el tipo cerrado no tiene "editorial"
  region: 'España',
  techHints: { model: 'editorial', ecommerce: 'woocommerce' },
  classifyUrl: classifyTemariosoficialesUrl,
  parseCourse: parseTemariosoficialesCourse,
};
