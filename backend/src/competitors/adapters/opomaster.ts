// backend/src/competitors/adapters/opomaster.ts
//
// Adapter del competidor OpoMaster. Sondeado 06/07/2026.
//
//   Sitio estático con datos servidos por FIREBASE/JS: el catálogo de oposiciones
//   y temarios se renderiza en cliente (assets/js/firebase-init.js), NO está en el
//   HTML ni en un JSON/API público. Con fetch plano solo se ve el sitemap estático
//   de páginas .html (sin oposiciones individuales).
//
//   Por eso: se REGISTRA el competidor y se vigila su sitemap (URLs de páginas),
//   pero el catálogo de oposiciones y precios requiere el headless-fetcher
//   (techHints.rendering='js'). No se inventan cursos ni precios.

import { CompetitorAdapter, ParsedCourse, UrlType } from './types';

const BASE = 'https://opomaster.com';

export function classifyOpomasterUrl(url: string): UrlType {
  let path: string;
  try {
    path = new URL(url).pathname;
  } catch {
    return 'other';
  }
  // El catálogo real va por JS (articulos.html?id=…, no en el sitemap). Las URLs
  // del sitemap son páginas estáticas (temarios/blog/contacto…).
  if (/^\/(oposiciones|temarios)\.html$/.test(path)) return 'categoria';
  return 'page';
}

export function parseOpomasterCourse(_url: string, _html: string): ParsedCourse | null {
  // No hay páginas de curso en el HTML plano (Firebase/JS). Cursos por headless.
  return null;
}

export const opomasterAdapter: CompetitorAdapter = {
  key: 'opomaster',
  name: 'OpoMaster',
  baseUrl: BASE,
  tipo: 'plataforma_online',
  region: 'España',
  // Catálogo y precios servidos por Firebase/JS → requieren headless-fetcher.
  techHints: { rendering: 'js', backend: 'firebase' },
  classifyUrl: classifyOpomasterUrl,
  parseCourse: parseOpomasterCourse,
};
