// backend/src/competitors/adapters/superaoposiciones.ts
//
// Supera Oposiciones — academia nacional. Sitio en Framer, SIN WAF,
// server-rendered (contenido en el HTML). Sondeado 06/07/2026.
//   Fuente: /sitemap.xml (334 URLs; ~79 hojas de oposición reales).
//   Precio: no público (lead-gen; los € del HTML son sueldos, no precios).

import { CompetitorAdapter, ParsedCourse, UrlType } from './types';
import { nameFromSlug, nameFromTitle } from './_shared';

const BASE = 'https://www.superaoposiciones.es';
const FAMILIES = 'administracion|hacienda|informatica|justicia|seguridad-social|ue';

export function classifySuperaUrl(url: string): UrlType {
  let path: string;
  try {
    path = new URL(url).pathname;
  } catch {
    return 'other';
  }
  if (/^\/(blog|videos)\//.test(path)) return 'post';
  // Local: /oposiciones-administracion/locales/oposiciones-<ccaa>/<oposicion>
  if (/^\/oposiciones-administracion\/locales\/oposiciones-[^/]+\/[^/]+\/?$/.test(path)) return 'oposicion';
  // Familia: /oposiciones-<familia>/<oposicion> (excluye la propia "locales")
  if (new RegExp(`^/oposiciones-(${FAMILIES})/(?!locales$)[^/]+/?$`).test(path)) return 'oposicion';
  // Sueltas top-level
  if (/^\/(controlador-aereo|ayudante-instituciones-penitenciarias)\/?$/.test(path)) return 'oposicion';
  if (/^\/oposiciones-/.test(path)) return 'categoria';
  return 'page';
}

export function parseSuperaCourse(url: string, html: string): ParsedCourse | null {
  const name = nameFromTitle(html) || nameFromSlug(url);
  if (!name) return null;
  return { rawName: name, modalidad: null, region: null, prices: [] };
}

export const superaoposicionesAdapter: CompetitorAdapter = {
  key: 'superaoposiciones',
  name: 'Supera Oposiciones',
  baseUrl: BASE,
  tipo: 'hibrida',
  region: 'España',
  classifyUrl: classifySuperaUrl,
  parseCourse: parseSuperaCourse,
};
