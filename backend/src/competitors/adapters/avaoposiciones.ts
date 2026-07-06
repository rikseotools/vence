// backend/src/competitors/adapters/avaoposiciones.ts
//
// Adapter del competidor AvA Oposiciones (academia, foco Córdoba/Andalucía).
// Sondeado 06/07/2026.
//
//   WordPress (nginx/PHP/Plesk) SIN Cloudflare → fetch plano.
//   Fuente:  wp-sitemap-posts-course-1.xml → /course/<slug> (3 cursos).
//   Nombre:  las páginas /course/ tienen h1/título GENÉRICO ("AUTONÓMICAS"), así
//            que el SLUG es la fuente fiable del nombre (no el h1).
//   Precio:  NO lo publican en la web → prices vacío (no se inventa).

import { CompetitorAdapter, ParsedCourse, UrlType } from './types';

const BASE = 'https://avaoposiciones.net';
const STOP = new Set(['de', 'del', 'la', 'las', 'el', 'los', 'y', 'en', 'a', 'the']);

export function classifyAvaUrl(url: string): UrlType {
  let path: string;
  try {
    path = new URL(url).pathname;
  } catch {
    return 'other';
  }
  if (/^\/course\/[^/]+\/?$/.test(path)) return 'oposicion';
  if (/^\/course-category\/[^/]+\/?$/.test(path)) return 'categoria';
  if (/^\/\d{4}\//.test(path)) return 'post'; // posts con fecha
  return 'page';
}

/** Nombre desde el slug (title-case con stopwords en minúscula). */
function nameFromSlug(url: string): string {
  const slug = (url.replace(/\/$/, '').split('/').pop() ?? '').replace(/-/g, ' ').trim();
  return slug
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => (STOP.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ')
    .trim();
}

export function parseAvaCourse(url: string, _html: string): ParsedCourse | null {
  const rawName = nameFromSlug(url);
  if (!rawName) return null;
  return {
    rawName,
    modalidad: null,
    region: null,
    prices: [], // AvA no publica precios en la web
  };
}

export const avaoposicionesAdapter: CompetitorAdapter = {
  key: 'avaoposiciones',
  name: 'AvA Oposiciones',
  baseUrl: BASE,
  tipo: 'academia_presencial',
  region: 'Córdoba',
  classifyUrl: classifyAvaUrl,
  parseCourse: parseAvaCourse,
};
