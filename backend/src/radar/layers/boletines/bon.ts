// backend/src/radar/layers/boletines/bon.ts
//
// Capa 1 — BON (Boletín Oficial de Navarra). Primer boletín CCAA nuevo del radar
// multi-capa (§16bis). Server-rendered plain-fetch (verificado 04/07/2026).
//
// GOTCHA (verificado): la URL con ?anio&mes&dia NO filtra por fecha real —
// devuelve el sumario VIGENTE (misma página para cualquier fecha). Por eso NO
// se recorre ventana de días: se lee 1 vez el sumario actual, y el dedup por
// ref oficial (aguas abajo) hace autosanador (una convocatoria = una señal
// aunque se relea a diario). Patrón "leer lo último + dedup", como BOPV.
//
// Reutiliza el extractor de detect-boletines (trocea por RESOLUCIÓN/ORDEN/
// ACUERDO/EXTRACTO — encabezados estándar de todos los boletines).

import { RawCandidate, ScanContext, SourceAdapter } from '../../core/types';
import {
  extractCandidatesFromSumarioText,
  htmlToText,
} from '../../../detect-boletines/boletines';

const UA =
  'Mozilla/5.0 (X11; Linux x86_64; rv:120.0) Gecko/20100101 Firefox/120.0';

async function scanDay(date: Date): Promise<{ url: string; text: string } | null> {
  const url = `https://bon.navarra.es/es/boletin?anio=${date.getUTCFullYear()}&mes=${
    date.getUTCMonth() + 1
  }&dia=${date.getUTCDate()}`;
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA } });
    if (r.status !== 200) return null;
    const html = await r.text();
    if (html.length < 3000) return null; // día sin boletín / página corta
    return { url, text: html };
  } catch {
    return null; // fail-open por día
  }
}

export const bonAdapter: SourceAdapter = {
  key: 'bon',
  layer: 'boletin',
  priority: 110,
  sensorType: 'regional_scan',
  regionName: 'Navarra (BON)',

  async scan(ctx: ScanContext): Promise<RawCandidate[]> {
    // Un solo fetch del sumario vigente (la URL no filtra por fecha; ver gotcha).
    const hit = await scanDay(ctx.today);
    if (!hit) return [];
    const candidates = extractCandidatesFromSumarioText(htmlToText(hit.text));
    if (candidates.length === 0) return [];
    return [
      {
        sourceUrl: hit.url,
        officialUrl: hit.url, // el boletín ES la fuente oficial
        text: candidates.join('\n'),
        regionName: 'Navarra (BON)',
        publishedDate: ctx.today,
      },
    ];
  },
};
