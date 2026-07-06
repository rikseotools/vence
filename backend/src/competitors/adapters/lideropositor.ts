// backend/src/competitors/adapters/lideropositor.ts
//
// Adapter del competidor Líder Opositor (academia, foco Málaga). Sondeado 06/07/2026.
//
//   WordPress (Apache) SIN WAF, bajo /web/ → fetch plano, server-rendered.
//   Fuente:  sitemap_index en /web/sitemap_index.xml (Yoast; oposiciones mezcladas
//            en los post-sitemaps → se filtran por URL).
//   Oposiciones: jerárquicas /web/oposiciones/<cat>/<subcat?>/<oposicion>/.
//            Regla: bajo /oposiciones/ con ≥2 segmentos = HOJA (oposición); 0-1 =
//            categoría. (Algunas categorías profundas caen como oposición → gap,
//            aceptable.)
//   Precio:  NO publican en la web → prices vacío (no se inventa).

import { CompetitorAdapter, ParsedCourse, UrlType } from './types';

const BASE = 'https://lideropositor.com';
const STOP = new Set(['de', 'del', 'la', 'las', 'el', 'los', 'y', 'en', 'a', 'para', 'por']);

function titleCase(slug: string): string {
  return slug
    .replace(/-/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => (STOP.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ')
    .trim();
}

export function classifyLiderUrl(url: string): UrlType {
  let path: string;
  try {
    path = new URL(url).pathname;
  } catch {
    return 'other';
  }
  if (path.startsWith('/web/oposiciones')) {
    const rest = path.replace(/^\/web\/oposiciones\/?/, '').replace(/\/$/, '');
    const segs = rest ? rest.split('/').filter(Boolean).length : 0;
    return segs >= 2 ? 'oposicion' : 'categoria';
  }
  if (/^\/web\/\d{4}\//.test(path)) return 'post';
  return 'page';
}

export function parseLiderCourse(url: string, html: string): ParsedCourse | null {
  // Nombre: primero del <title> ("Oposiciones a X en Málaga"), si no del slug hoja.
  let name = '';
  const t = html.match(/<title>([\s\S]*?)<\/title>/i);
  if (t) {
    const m = t[1].match(/Oposiciones\s+(?:a|de|para)\s+(.+?)\s+en\s+/i);
    if (m) name = m[1].trim();
  }
  if (!name) {
    let path: string;
    try {
      path = new URL(url).pathname;
    } catch {
      return null;
    }
    const slug = path.replace(/\/$/, '').split('/').pop() ?? '';
    name = titleCase(slug);
  }
  if (!name) return null;
  return { rawName: name, modalidad: null, region: null, prices: [] };
}

export const lideropositorAdapter: CompetitorAdapter = {
  key: 'lideropositor',
  name: 'Líder Opositor',
  baseUrl: `${BASE}/web/`,
  tipo: 'academia_presencial',
  region: 'Málaga',
  classifyUrl: classifyLiderUrl,
  parseCourse: parseLiderCourse,
};
