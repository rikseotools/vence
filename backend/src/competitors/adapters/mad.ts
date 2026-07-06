// backend/src/competitors/adapters/mad.ts
//
// Editorial MAD — editorial nacional de temarios (tienda PrestaShop). Apache,
// SIN WAF, server-rendered. Sondeado 06/07/2026.
//   Fuente: /1_es_0_sitemap.xml (5.577 URLs; <loc> en CDATA). Las oposiciones
//           son la taxonomía /oposiciones/<area>/<oposicion>/ (~197); las .html
//           son libros individuales (se rastrean como página, no como curso).
//   Precio: por LIBRO (JSON-LD), no por oposición-taxonomía → oposición sin precio.

import { CompetitorAdapter, ParsedCourse, UrlType } from './types';
import { nameFromSlug, nameFromTitle } from './_shared';

const BASE = 'https://mad.es';

export function classifyMadUrl(url: string): UrlType {
  let path: string;
  try {
    path = new URL(url).pathname;
  } catch {
    return 'other';
  }
  if (path.endsWith('.html')) return 'page'; // ficha de libro (producto)
  if (path.startsWith('/oposiciones/')) {
    const segs = path.replace(/^\/oposiciones\/?/, '').replace(/\/$/, '').split('/').filter(Boolean).length;
    if (segs >= 2) return 'oposicion';
    if (segs === 1) return 'categoria';
  }
  return 'page';
}

export function parseMadCourse(url: string, html: string): ParsedCourse | null {
  const name = nameFromTitle(html) || nameFromSlug(url);
  if (!name) return null;
  return { rawName: name, modalidad: null, region: null, prices: [] };
}

export const madAdapter: CompetitorAdapter = {
  key: 'mad',
  name: 'Editorial MAD',
  baseUrl: BASE,
  tipo: 'plataforma_online', // editorial + preparación online; tipo cerrado no tiene "editorial"
  region: 'España',
  techHints: { model: 'editorial', ecommerce: 'prestashop' },
  classifyUrl: classifyMadUrl,
  parseCourse: parseMadCourse,
};
