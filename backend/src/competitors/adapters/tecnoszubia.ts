// backend/src/competitors/adapters/tecnoszubia.ts
//
// Adapter del competidor Tecnos Zubia (academia híbrida, La Zubia, Granada).
// WordPress con sitemap index limpio (oposiciones-sitemap.xml). Un fichero por
// competidor: aquí vive TODO lo específico del sitio (esquema de URLs + markup de
// precios). Sondeado 06/07/2026.
//
//   URLs de curso:    /oposiciones/<slug>/
//   URLs de categoría:/oposicion/<slug>/   (singular)
//   Precios:          panel "Precio de matrícula: <del>120€</del> 60€"
//                     tabla "Nuevos/Antiguos alumnos" → cuota mensual (125/105)
//                     tabla verano                    → intensivo (60/50)
//                     "Tasa de examen: 15,57 €"
//
// El parser está ACOTADO a los paneles de precio para no tragarse ruido (el
// sueldo "1.500 € – 1.900 €" del cuerpo del artículo NO es un precio del curso).

import { CompetitorAdapter, ParsedCourse, ParsedPrice, UrlType } from './types';

const BASE = 'https://www.tecnoszubia.es';

/** Céntimos desde un literal en formato español ("120€", "15,57 €", "1.500€"). */
export function euroToCents(raw: string): number | null {
  const m = raw.match(/([\d.]*\d)(?:,(\d{1,2}))?\s*€/);
  if (!m) return null;
  const intPart = m[1].replace(/\./g, '');
  const dec = m[2] ? m[2].padEnd(2, '0') : '00';
  const cents = parseInt(intPart, 10) * 100 + parseInt(dec, 10);
  return Number.isFinite(cents) ? cents : null;
}

function stripTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Primer importe €a partir de la etiqueta dada (dentro de una tabla). */
function amountAfterLabel(html: string, label: RegExp): ParsedPrice['raw'] | null {
  const idx = html.search(label);
  if (idx < 0) return null;
  const rest = html.slice(idx);
  const a = rest.match(/[\d.]*\d(?:,\d{1,2})?\s*€/);
  return a ? a[0] : null;
}

function price(
  kind: ParsedPrice['kind'],
  audience: ParsedPrice['audience'],
  period: ParsedPrice['period'],
  raw: string,
): ParsedPrice {
  return { kind, audience, period, raw: raw.trim(), amountCents: euroToCents(raw) };
}

/** Precios de las tablas "Nuevos/Antiguos alumnos" (cuota mensual o intensivo). */
function parseAlumnoTables(html: string): ParsedPrice[] {
  const out: ParsedPrice[] = [];
  const tableRe = /<table[\s\S]*?<\/table>/gi;
  let tm: RegExpExecArray | null;
  while ((tm = tableRe.exec(html)) !== null) {
    const table = tm[0];
    const before = stripTags(html.slice(Math.max(0, tm.index - 500), tm.index));
    // El intensivo de verano viene rotulado como reducido / meses de verano.
    const isIntensivo = /intensiv|verano|jun[io]|julio|agosto|reducid/i.test(before);
    const kind = isIntensivo ? 'intensivo' : 'cuota';
    const nuevo = amountAfterLabel(table, /nuevos?\s+alumnos/i);
    const antiguo = amountAfterLabel(table, /antiguos?\s+alumnos/i);
    if (nuevo) out.push(price(kind, 'nuevo', 'mensual', nuevo));
    if (antiguo) out.push(price(kind, 'antiguo', 'mensual', antiguo));
  }
  return out;
}

/** Matrícula: "<del>120€</del> 60€" → el importe fuera del tachado es el vigente. */
function parseMatricula(html: string): ParsedPrice | null {
  const m = html.match(
    /Precio de matr[ií]cula[^:]*:\s*(?:<del>\s*([\d.,]+)\s*€\s*<\/del>\s*)?([\d.,]+)\s*€/i,
  );
  if (!m) return null;
  const current = `${m[2]}€`;
  const original = m[1] ? `${m[1]}€ (antes) ` : '';
  // amountCents se calcula del importe VIGENTE, no del `raw` (que lleva el
  // tachado delante → euroToCents cogería el original por error).
  return {
    kind: 'matricula',
    audience: 'general',
    period: 'unico',
    raw: `${original}${current}`.trim(),
    amountCents: euroToCents(current),
  };
}

function parseTasa(html: string): ParsedPrice | null {
  const m = html.match(/Tasa de examen[^:]*:\s*([\d.]*\d(?:,\d{1,2})?)\s*€/i);
  return m ? price('tasa', 'general', 'unico', `${m[1]} €`) : null;
}

function parseName(html: string, url: string): string {
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1) {
    const name = stripTags(h1[1]);
    if (name) return name;
  }
  // Fallback: del slug de la URL.
  const slug = url.replace(/\/$/, '').split('/').pop() ?? '';
  return slug.replace(/-/g, ' ').trim();
}

function parseModalidad(html: string): ParsedCourse['modalidad'] {
  const text = stripTags(html).toLowerCase();
  const pres = /presencial/.test(text);
  const online = /online|a distancia|en directo|videoconferencia/.test(text);
  if (pres && online) return 'mixta';
  if (pres) return 'presencial';
  if (online) return 'online';
  return null;
}

export function classifyTecnoszubiaUrl(url: string): UrlType {
  let path: string;
  try {
    path = new URL(url).pathname;
  } catch {
    return 'other';
  }
  if (/^\/oposiciones\/[^/]+\/?$/.test(path)) return 'oposicion';
  if (/^\/oposicion\/[^/]+\/?$/.test(path)) return 'categoria';
  if (/^\/(blog|actualidad|noticias)\//.test(path)) return 'post';
  return 'page';
}

export function parseTecnoszubiaCourse(url: string, html: string): ParsedCourse | null {
  const rawName = parseName(html, url);
  if (!rawName) return null;
  const prices = [
    parseMatricula(html),
    ...parseAlumnoTables(html),
    parseTasa(html),
  ].filter((p): p is ParsedPrice => p !== null);
  return {
    rawName,
    modalidad: parseModalidad(html),
    region: null, // la ubicación de la academia vive en competitors.region
    prices,
  };
}

export const tecnoszubiaAdapter: CompetitorAdapter = {
  key: 'tecnoszubia',
  name: 'Tecnos Zubia',
  baseUrl: BASE,
  tipo: 'hibrida',
  region: 'Granada (La Zubia)',
  classifyUrl: classifyTecnoszubiaUrl,
  parseCourse: parseTecnoszubiaCourse,
};
