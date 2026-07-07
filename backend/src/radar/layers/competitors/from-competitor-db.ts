// backend/src/radar/layers/competitors/from-competitor-db.ts
//
// Capa 3 — adapter que NO scrapea: LEE del subsistema "Analizador de
// Competidores" (competitor_courses). El crawl de competidores vive una sola vez
// en ese subsistema (cron 05:00 UTC); el radar (07:00) consume sus datos frescos.
//
// Solo surface cursos con MOVIMIENTO reciente (recién añadidos o página cambiada)
// → pista de posible convocatoria nueva. El dedupeKey es estable por curso para
// no re-emitir la misma señal cada día.
//
// Es un FACTORY (necesita el CompetitorQueriesService inyectado), no un const:
// el orquestador lo registra dinámicamente. Diseño: docs/roadmap/analizador-competidores.md

import { SourceAdapter, RawCandidate, ScanContext } from '../../core/types';
import type { RegionalOep } from '../../../oep-signals/oep-signals.schemas';
import type { CompetitorQueriesService } from '../../../competitors/competitor-queries.service';

function slug(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

export function makeCompetitorDbAdapter(
  queries: CompetitorQueriesService,
): SourceAdapter {
  return {
    key: 'competitor-db',
    layer: 'competitor',
    priority: 320, // tras oposiciones-es (300); es una pista, no dato oficial
    sensorType: 'competitor',
    regionName: 'España (competidores)',

    async scan(_ctx: ScanContext): Promise<RawCandidate[]> {
      // Solo huecos (gaps) únicos a catalogar, con nº de competidores que los imparten.
      const rows = await queries.getRadarCandidates(7);
      return rows.map((r) => {
        const demanda =
          r.nCompetitors > 1 ? ` (${r.nCompetitors} competidores la imparten)` : ' (1 competidor la imparte)';
        const oep: RegionalOep = {
          name: r.rawName,
          positionGroup: null,
          year: null,
          plazas: null,
          bocRef: null,
          fechaInscripcionFin: null,
          estado: null,
          url: r.url ?? null,
        };
        return {
          sourceUrl: r.url ?? 'https://www.vence.es',
          officialUrl: null,
          text: `${r.rawName}${demanda}`,
          rawName: r.rawName,
          regionName: r.region ?? null,
          preExtracted: [oep],
          // Dedup por identidad de hueco (getRadarCandidates ya agrupa) → 1 señal por oposición-gap.
          dedupeKey: `competitor:${slug(r.rawName)}`,
        };
      });
    },
  };
}
