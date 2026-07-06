// backend/src/competitors/adapters/oposicionesflou.ts
//
// Oposiciones FLOU — preparador (foco docentes/educación), nacional. WordPress,
// Apache, SIN WAF, server-rendered. Sondeado 06/07/2026.
//   Fuente: oposicion-sitemap.xml (824 URLs, VARIAS subpáginas por oposición:
//           /que-es/,/preparar/,/academia/…). Se colapsa marcando SOLO la
//           subpágina canónica /preparar/ como oposición (evita duplicados).
//   Precio: no público (lead-gen).

import { CompetitorAdapter, ParsedCourse, UrlType } from './types';
import { titleCase } from './_shared';

const BASE = 'https://oposicionesflou.com';

export function classifyFlouUrl(url: string): UrlType {
  let path: string;
  try {
    path = new URL(url).pathname;
  } catch {
    return 'other';
  }
  // Hoja canónica: /<sector>/oposiciones-<slug>/preparar/
  if (/^\/[a-z0-9-]+\/oposiciones-[a-z0-9-]+\/preparar\/?$/.test(path)) return 'oposicion';
  if (path === '/oposiciones/' || /^\/[a-z0-9-]+\/oposiciones-[a-z0-9-]+\/?$/.test(path)) return 'categoria';
  return 'page';
}

export function parseFlouCourse(url: string, _html: string): ParsedCourse | null {
  // El slug de la oposición es el penúltimo segmento (antes de /preparar/).
  let segs: string[];
  try {
    segs = new URL(url).pathname.replace(/\/$/, '').split('/').filter(Boolean);
  } catch {
    return null;
  }
  const slug = segs[segs.length - 2] ?? ''; // …/oposiciones-<slug>/preparar
  const name = titleCase(slug).replace(/^Oposiciones\s+/i, '').trim();
  if (!name) return null;
  return { rawName: name, modalidad: null, region: null, prices: [] };
}

export const oposicionesflouAdapter: CompetitorAdapter = {
  key: 'oposicionesflou',
  name: 'Oposiciones FLOU',
  baseUrl: BASE,
  tipo: 'hibrida',
  region: 'España',
  classifyUrl: classifyFlouUrl,
  parseCourse: parseFlouCourse,
};
