// backend/src/radar/layers/aggregators/pag-empleo.ts
//
// Capa 2 — adapter del agregador oficial administracion.gob.es (PAG). Reutiliza
// `fetchPagGrupo` de detect-pag-empleo. Como el PAG devuelve convocatorias YA
// ESTRUCTURADas (jsonDetalle), rellena `preExtracted` → salta el LLM.
//
// Fase 0 "catalogar TODO": recorre A1/A2/B/C1/C2/AP (idGrupo 1-6), plazo abierto.

import { fetchPagGrupo } from '../../../detect-pag-empleo/pag-empleo';
import type { RegionalOep } from '../../../oep-signals/oep-signals.schemas';
import { RawCandidate, ScanContext, SourceAdapter } from '../../core/types';

const GRUPOS = [1, 2, 3, 4, 5, 6];
const PLAZO_ABIERTO = 1;

function detailUrl(id: string): string {
  return `https://administracion.gob.es/pagFront/ofertasempleopublico/detalleEmpleo.htm?idConvocatoria=${id}&tipoBusqueda=CONVOCATORIAS`;
}

export const pagEmpleoAdapter: SourceAdapter = {
  key: 'pag-empleo',
  layer: 'aggregator',
  priority: 200,
  sensorType: 'pag_empleo',
  regionName: 'España (PAG)',

  async scan(_ctx: ScanContext): Promise<RawCandidate[]> {
    const out: RawCandidate[] = [];
    for (const grupo of GRUPOS) {
      let convs;
      try {
        convs = await fetchPagGrupo(grupo, PLAZO_ABIERTO);
      } catch {
        continue; // fail-open por grupo
      }
      for (const c of convs) {
        const url = detailUrl(c.id);
        const oep: RegionalOep = {
          name: c.cuerpo,
          positionGroup: c.grupo || null,
          year: null,
          plazas: c.plazas,
          bocRef: null,
          fechaInscripcionFin: c.plazoHasta,
          estado: 'inscripcion_abierta', // idPlazo=1
          url,
        };
        out.push({
          sourceUrl: url,
          officialUrl: url,
          text: `${c.cuerpo} — ${c.organismo} (${c.ccaa})`,
          rawName: c.cuerpo,
          regionName: c.ccaa,
          preExtracted: [oep],
          dedupeKey: `pag:${c.id}`, // misma clave que el cron legacy → sin duplicar
        });
      }
    }
    return out;
  },
};
