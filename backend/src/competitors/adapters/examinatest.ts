// backend/src/competitors/adapters/examinatest.ts
//
// ExaminaTest — plataforma de test online por suscripción (foro + tests + supuestos),
// mayoría estatal + algo autonómico de Murcia (CARM, SMS). Sondeado 09/07/2026.
//   Sin sitemap (todas las rutas de sitemap devuelven el 404 HTML). Fuente = el
//   listado HTML server-rendered /oposiciones (38 hojas); discoverUrls extrae los
//   enlaces /oposiciones/<slug>.
//   Precio: en HTML plano de la hoja ("Test online — Desde 9,99 €/mes"), NO JSON-LD.
//   Suscripción mensual; el importe es un "desde" (planes en /oposiciones/<slug>/suscripcion).

import { CompetitorAdapter, ParsedCourse, ParsedPrice, UrlType } from './types';
import { nameFromH1, nameFromTitle, nameFromSlug } from './_shared';

const BASE = 'https://www.examinatest.es';

export function classifyExaminatestUrl(url: string): UrlType {
  let path: string;
  try {
    path = new URL(url).pathname;
  } catch {
    return 'other';
  }
  if (/^\/oposiciones\/[a-z0-9-]+$/.test(path)) return 'oposicion';
  if (/^\/oposiciones\/?$/.test(path)) return 'categoria';
  return 'page'; // incl. /oposiciones/<slug>/suscripcion
}

/** Extrae las hojas /oposiciones/<slug> del listado HTML. */
export function discoverExaminatestUrls(html: string): string[] {
  const out = new Set<string>();
  const re = /href=["'](?:https?:\/\/(?:www\.)?examinatest\.es)?(\/oposiciones\/[a-z0-9-]+)(?:["'/?#])/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const path = m[1];
    if (/\/suscripcion$/.test(path)) continue;
    out.add(BASE + path);
  }
  return [...out];
}

/** "Desde 9,99 €/mes" → céntimos. Devuelve null si no hay importe. */
function parseExaminatestPrice(html: string): ParsedPrice | null {
  const m = html.match(/desde\s*([0-9]+(?:[.,][0-9]{1,2})?)\s*€\s*\/?\s*mes/i);
  if (!m) return null;
  const v = parseFloat(m[1].replace(',', '.'));
  if (!Number.isFinite(v) || v <= 0) return null;
  return { kind: 'cuota', audience: null, amountCents: Math.round(v * 100), period: 'mensual', raw: `Desde ${m[1]}€/mes` };
}

export function parseExaminatestCourse(url: string, html: string): ParsedCourse | null {
  const name = nameFromH1(html) || nameFromTitle(html) || nameFromSlug(url);
  if (!name) return null;
  const prices: ParsedPrice[] = [];
  const p = parseExaminatestPrice(html);
  if (p) prices.push(p);
  return { rawName: name, modalidad: 'online', region: null, prices };
}

export const examinatestAdapter: CompetitorAdapter = {
  key: 'examinatest',
  name: 'ExaminaTest',
  baseUrl: BASE,
  tipo: 'plataforma_online',
  region: 'España',
  classifyUrl: classifyExaminatestUrl,
  parseCourse: parseExaminatestCourse,
  discoverUrls: discoverExaminatestUrls,
};
