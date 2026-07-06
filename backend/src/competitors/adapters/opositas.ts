// backend/src/competitors/adapters/opositas.ts
//
// Opositas — academia online nacional (WordPress + WooCommerce). nginx, SIN WAF,
// server-rendered (gzip). Sondeado 06/07/2026.
//   Fuente: oposiciones-sitemap.xml (62 URLs; hoja = /oposiciones/<cat>/<opo>/).
//   Precio: en los productos /preparacion/, NO en la ficha de oposición → sin
//           precio a nivel oposición (cruce con producto = follow-up).

import { CompetitorAdapter, ParsedCourse, UrlType } from './types';
import { nameFromSlug, nameFromTitle } from './_shared';

const BASE = 'https://www.opositas.com';

export function classifyOpositasUrl(url: string): UrlType {
  let path: string;
  try {
    path = new URL(url).pathname;
  } catch {
    return 'other';
  }
  if (path.startsWith('/oposiciones/')) {
    const segs = path.replace(/^\/oposiciones\/?/, '').replace(/\/$/, '').split('/').filter(Boolean).length;
    if (segs >= 2) return 'oposicion';
    if (segs === 1) return 'categoria';
  }
  return 'page';
}

export function parseOpositasCourse(url: string, html: string): ParsedCourse | null {
  const name = nameFromTitle(html) || nameFromSlug(url);
  if (!name) return null;
  return { rawName: name, modalidad: 'online', region: null, prices: [] };
}

export const opositasAdapter: CompetitorAdapter = {
  key: 'opositas',
  name: 'Opositas',
  baseUrl: BASE,
  tipo: 'plataforma_online',
  region: 'España',
  classifyUrl: classifyOpositasUrl,
  parseCourse: parseOpositasCourse,
};
