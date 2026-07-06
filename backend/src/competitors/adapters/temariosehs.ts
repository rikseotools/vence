// backend/src/competitors/adapters/temariosehs.ts
//
// Temarios EHS — academia/editorial de Andalucía (base Córdoba). WordPress+
// Elementor, LiteSpeed, SIN WAF, server-rendered. Sondeado 06/07/2026.
//   Fuente: page-sitemap.xml (ruidoso: 82% páginas privadas de alumnos) → se
//           filtra por slug de oposición (temario-/convocadas-/N-plazas-).
//   Precio: hay € en el HTML (temario PDF) pero desglose irregular → follow-up.

import { CompetitorAdapter, ParsedCourse, UrlType } from './types';
import { nameFromSlug, nameFromTitle } from './_shared';

const BASE = 'https://temariosehs.com';
const EXCLUDE = /^\/(pagina-priv|iniciar-sesion|inscripcion|cancelacion|carrito|checkout|mi-cuenta|blog|wp-|feed)/;

export function classifyTemariosehsUrl(url: string): UrlType {
  let path: string;
  try {
    path = new URL(url).pathname;
  } catch {
    return 'other';
  }
  if (EXCLUDE.test(path)) return 'page';
  if (/^\/(temario-|convocadas-|\d+-plazas-)[^/]+\/?$/.test(path)) return 'oposicion';
  if (/^\/(temarios|oposiciones-2026|oposiciones-junta-de-andalucia-cursos)\/?$/.test(path)) return 'categoria';
  return 'page';
}

export function parseTemariosehsCourse(url: string, html: string): ParsedCourse | null {
  const name = nameFromTitle(html) || nameFromSlug(url);
  if (!name) return null;
  return { rawName: name, modalidad: null, region: null, prices: [] };
}

export const temariosehsAdapter: CompetitorAdapter = {
  key: 'temariosehs',
  name: 'Temarios EHS',
  baseUrl: BASE,
  tipo: 'hibrida',
  region: 'Andalucía (Córdoba)',
  classifyUrl: classifyTemariosehsUrl,
  parseCourse: parseTemariosehsCourse,
};
