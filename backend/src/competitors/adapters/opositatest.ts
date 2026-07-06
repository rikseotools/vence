// backend/src/competitors/adapters/opositatest.ts
//
// Adapter del competidor OpositaTest (plataforma online nacional). Sondeado
// 06/07/2026.
//
//   Tras Cloudflare, pero el UA del bot pasa sin challenge (HTTP 200).
//   Fuente:   sitemap.cursos.xml → /productos/<slug> (44 productos = cursos por
//             oposición, SERVER-rendered → nombre extraíble con fetch plano).
//   Precio:   NO está en la página; es SUSCRIPCIÓN GLOBAL dinámica (checkout en
//             /payment/, bloqueado en robots; se carga por JS/API). Por eso el
//             adapter deja `prices: []` y marca `techHints.rendering='js'` — el
//             precio se capturará luego por el headless-fetcher. NO se inventan
//             precios (comparativa engañosa si no).
//
// Valor inmediato: catálogo de qué oposiciones cubre opositatest + gaps +
// cruce con nuestras oposiciones (el nexo común).

import { CompetitorAdapter, ParsedCourse, UrlType } from './types';

const BASE = 'https://www.opositatest.com';

function stripTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function classifyOpositatestUrl(url: string): UrlType {
  let path: string;
  try {
    path = new URL(url).pathname;
  } catch {
    return 'other';
  }
  if (/^\/productos\/[^/]+\/?$/.test(path)) return 'oposicion';
  if (/^\/oposiciones\/categorias\/[^/]+\/?$/.test(path)) return 'categoria';
  return 'page';
}

export function parseOpositatestCourse(url: string, html: string): ParsedCourse | null {
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  let name = h1 ? stripTags(h1[1]) : '';
  if (!name) {
    const slug = url.replace(/\/$/, '').split('/').pop() ?? '';
    name = slug.replace(/-/g, ' ').trim();
  }
  if (!name) return null;
  // Limpia el envoltorio comercial ("Curso de … - Preparación integral") para un
  // raw_name más limpio; el matcher normaliza igual, pero mejora la legibilidad.
  name = name
    .replace(/^Curso\s+(?:de\s+|del\s+|de\s+la\s+)?/i, '')
    .replace(/\s*[-–]\s*Preparaci[oó]n.*$/i, '')
    .trim();
  return {
    rawName: name,
    modalidad: 'online', // plataforma 100% online
    region: null,
    prices: [], // suscripción global dinámica → se captará por headless (techHints)
  };
}

export const opositatestAdapter: CompetitorAdapter = {
  key: 'opositatest',
  name: 'OpositaTest',
  baseUrl: BASE,
  tipo: 'plataforma_online',
  region: 'España',
  // El precio es una suscripción dinámica tras Cloudflare/JS → marcar para que el
  // futuro captador de precios use el headless-fetcher, no fetch plano.
  techHints: { rendering: 'js', pricing: 'subscription' },
  classifyUrl: classifyOpositatestUrl,
  parseCourse: parseOpositatestCourse,
};
