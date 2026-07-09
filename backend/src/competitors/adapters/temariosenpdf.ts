// backend/src/competitors/adapters/temariosenpdf.ts
//
// TemariosenPDF — editorial: venta de temarios en PDF (tienda Shopify). Sondeado
// 09/07/2026. Modelo editorial (como Editorial MAD): el "curso" es un temario/PDF.
//   Fuente: índice /sitemap.xml (Shopify) → hijo sitemap_products_1.xml (~420
//           productos). Se declara `sitemap_index`; el motor sigue el hijo (que
//           lleva la query ?from=&to= obligatoria — sin ella da 400).
//   Precio: JSON-LD Product en la hoja, con `offers` de tipo **AggregateOffer**
//           (Shopify: lowPrice/highPrice, NO `price`) → lo resuelve jsonLdPrice.
//           El precio NO está en texto plano SSR (lo pinta JS); el JSON-LD sí.
//   URL-hoja: /products/<slug>. Vende, entre otros, el temario de Aux. de Servicios
//             de la Universidad de Murcia (19,95€).

import { CompetitorAdapter, ParsedCourse, ParsedPrice, UrlType } from './types';
import { jsonLdPrice, nameFromTitle, nameFromSlug } from './_shared';

const BASE = 'https://www.temariosenpdf.es';

export function classifyTemariosenpdfUrl(url: string): UrlType {
  let path: string;
  try {
    path = new URL(url).pathname;
  } catch {
    return 'other';
  }
  if (/^\/products\/[a-z0-9-]+\/?$/.test(path)) return 'oposicion';
  if (/^\/collections\/[a-z0-9-]+\/?$/.test(path)) return 'categoria';
  return 'page';
}

export function parseTemariosenpdfCourse(url: string, html: string): ParsedCourse | null {
  // Los <title> son "TEMARIO/PACK/TEST PDF <oposición> …". nameFromTitle ya quita
  // el prefijo "Temario"; limpiamos el residuo "PDF "/"PACK "/"TEST " que queda
  // (marca del formato, no de la oposición) para que el matcher no lo arrastre.
  const name = (nameFromTitle(html) || nameFromSlug(url))
    .replace(/^(?:PACK\s+)?(?:TEMARIO\s+)?(?:TESTS?\s+)?(?:PDF\s+)/i, '')
    .trim();
  if (!name) return null;
  const prices: ParsedPrice[] = [];
  const cents = jsonLdPrice(html);
  if (cents != null) {
    // Temario/PDF a precio único.
    prices.push({ kind: 'material', audience: null, amountCents: cents, period: 'unico', raw: `${cents / 100}€` });
  }
  return { rawName: name, modalidad: null, region: null, prices };
}

export const temariosenpdfAdapter: CompetitorAdapter = {
  key: 'temariosenpdf',
  name: 'TemariosenPDF',
  baseUrl: BASE,
  tipo: 'plataforma_online', // editorial; el tipo cerrado no tiene "editorial"
  region: 'España',
  techHints: { model: 'editorial', ecommerce: 'shopify' },
  classifyUrl: classifyTemariosenpdfUrl,
  parseCourse: parseTemariosenpdfCourse,
};
