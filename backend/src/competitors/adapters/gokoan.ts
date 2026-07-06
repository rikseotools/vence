// backend/src/competitors/adapters/gokoan.ts
//
// GoKoan — plataforma de estudio nacional (suscripción). nginx/AWS, SIN WAF,
// server-rendered (jQuery/Bootstrap; NO SPA). Sondeado 06/07/2026.
//   Fuente: sitemap.xml (244 URLs; ~67 hojas de oposición). Ignora los 158
//           /esquemas-oposiciones/ (recursos, no cursos).
//   Precio: planes de plataforma (Método 135/240/300€, Mini 19,90€/mes) visibles
//           en HTML → captura como follow-up (aquí solo cobertura).
//   GOTCHA: 301 apex→www; sirve brotli/gzip (fetch de Node lo descomprime);
//           algunos slugs con tildes/':' sin encodear (fetch los normaliza).

import { CompetitorAdapter, ParsedCourse, UrlType } from './types';
import { nameFromSlug, nameFromTitle } from './_shared';

const BASE = 'https://www.gokoan.com';

export function classifyGokoanUrl(url: string): UrlType {
  let path: string;
  try {
    path = new URL(url).pathname;
  } catch {
    return 'other';
  }
  if (/^\/esquemas-oposiciones\//.test(path)) return 'page';
  // Hoja: /oposiciones/<slug> o /oposiciones-<region>/<slug>
  if (/^\/oposiciones(-[a-z-]+)?\/[^/]+\/?$/.test(path)) return 'oposicion';
  if (/^\/oposiciones(-[a-z-]+)?\/?$/.test(path)) return 'categoria';
  return 'page';
}

export function parseGokoanCourse(url: string, html: string): ParsedCourse | null {
  const name = nameFromTitle(html) || nameFromSlug(url);
  if (!name) return null;
  return { rawName: name, modalidad: 'online', region: null, prices: [] };
}

export const gokoanAdapter: CompetitorAdapter = {
  key: 'gokoan',
  name: 'GoKoan',
  baseUrl: BASE,
  tipo: 'plataforma_online',
  region: 'España',
  techHints: { model: 'subscription' },
  classifyUrl: classifyGokoanUrl,
  parseCourse: parseGokoanCourse,
};
