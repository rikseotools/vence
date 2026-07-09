// backend/src/radar/layers/competitors/oposiciones-es.ts
//
// Capa 3 — adapter del competidor oposiciones.es (un fichero por competidor).
//
// Por qué funciona con fetch plano (manual §0.2): Apache + WordPress SIN
// Cloudflare/WAF; la URL filtrada `?fwp_convocatorias_estado=convocatorias-abiertas`
// SERVER-renderiza las convocatorias abiertas, y cada página de detalle enlaza
// al BOLETÍN OFICIAL (DOGC/BOE/BOIB…). Sondeado 04/07/2026.
//
// Rol: red de seguridad + DETECTOR DE GAPS. Solo es una PISTA: el dato real se
// verifica luego en el boletín oficial (`officialUrl`), nunca se cataloga desde
// el agregador. Sus números mienten (Jaén 31 vs 35) → jamás fiarse de ellos.

import { SourceAdapter, RawCandidate, ScanContext } from '../../core/types';
import type { RegionalOep } from '../../../oep-signals/oep-signals.schemas';

const ABIERTAS_URL =
  'https://oposiciones.es/convocatorias/?fwp_convocatorias_estado=convocatorias-abiertas';

const UA =
  'VenceRadar/1.0 (+https://www.vence.es; radar de convocatorias) Mozilla/5.0';

/** PURA: parsea el título de una tarjeta ("20 plazas de X en Y") a nombre + plazas. */
export function parseCard(rawName: string): { name: string; plazas: number | null } {
  const m = rawName.match(/^([\d.\s]+?)\s*plazas?\s+(?:de |al |para (?:el |la )?|del |a )?(.+)$/i);
  if (!m) return { name: cap(rawName), plazas: null };
  const plazas = parseInt(m[1].replace(/[.\s]/g, ''), 10);
  return { name: cap(m[2].trim()), plazas: Number.isFinite(plazas) ? plazas : null };
}
function cap(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

/** PURA y testeable: extrae las tarjetas de convocatoria del HTML del listado. */
export function parseListado(html: string): RawCandidate[] {
  const out: RawCandidate[] = [];
  const seen = new Set<string>();
  // Cada convocatoria es un enlace a /convocatorias/<slug>/ cuyo slug empieza
  // por el nº de plazas ("20-plazas-de-administrativo-en-...") — así se separan
  // de las páginas de categoría (/convocatorias/oposiciones-asturias/).
  const re =
    /href="(https:\/\/oposiciones\.es\/convocatorias\/(\d+[a-z0-9-]*plazas[a-z0-9-]*)\/)"/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const url = m[1];
    if (seen.has(url)) continue;
    seen.add(url);
    const rawName = slugToName(m[2]);
    const { name, plazas } = parseCard(rawName);
    // La tarjeta ya trae nombre + plazas → preExtracted (salta el LLM).
    // El enlace oficial se resuelve del detalle en scan() y se inyecta aquí.
    const oep: RegionalOep = {
      name,
      organismo: null,
      positionGroup: null,
      year: null,
      plazas,
      bocRef: null,
      fechaInscripcionFin: null,
      // NO afirmar estado sin fecha de cierre: la lista dice "convocatorias
      // abiertas" pero no trae el plazo → asegurarlo aquí produce estado sin
      // fecha (patrón de las 83, tarjeta invisible). El estado se DERIVA de las
      // fechas verificadas del boletín oficial en el triaje (advance-estado).
      estado: null,
      url,
    };
    out.push({ sourceUrl: url, officialUrl: null, text: rawName, rawName, preExtracted: [oep] });
  }
  return out;
}

/** PURA: saca el enlace al boletín oficial de una página de detalle. */
export function parseOfficialLink(detailHtml: string): string | null {
  const m = detailHtml.match(
    /https?:\/\/[a-z0-9.-]*(?:boe\.es|dogc|gencat|caib|borm\.es|jcyl|xunta|gva|juntadeandalucia|navarra|euskadi|larioja|castillalamancha|gobcan|cantabria|madrid|dip[a-z]*|bop[a-z]*)[^"'\s]*/i,
  );
  return m ? m[0] : null;
}

function slugToName(slug: string): string {
  return slug.replace(/-/g, ' ').replace(/\bplazas\b/g, 'plazas').trim();
}

async function get(url: string, signal?: AbortSignal): Promise<string> {
  const res = await fetch(url, { headers: { 'User-Agent': UA }, signal });
  if (!res.ok) throw new Error(`HTTP ${res.status} en ${url}`);
  return res.text();
}

export const oposicionesEsAdapter: SourceAdapter = {
  key: 'oposiciones-es',
  layer: 'competitor',
  priority: 300,
  regionName: 'España (agregador)',

  async scan(ctx: ScanContext): Promise<RawCandidate[]> {
    const html = await get(ABIERTAS_URL, ctx.signal);
    const cards = parseListado(html);
    // Resuelve el enlace oficial de cada detalle (secuencial + educado).
    // Si el detalle falla, la tarjeta sigue viva sin officialUrl (fail-open).
    for (const c of cards) {
      try {
        const detail = await get(c.sourceUrl, ctx.signal);
        c.officialUrl = parseOfficialLink(detail);
      } catch {
        c.officialUrl = null;
      }
      // el enlace oficial (DOGC/BOE…) es la fuente real de la señal
      if (c.officialUrl && c.preExtracted?.[0]) c.preExtracted[0].url = c.officialUrl;
    }
    return cards;
  },
};
