// backend/src/radar/layers/boletines/_wrap.ts
//
// Envuelve un `BoletinAdapter` legacy (detect-boletines, scan(date)→{url,text})
// al contrato unificado `SourceAdapter` (scan(ctx)→RawCandidate[]). Recorre la
// ventana de días y produce un candidato por día con sumario. Reutiliza todo el
// código existente de boletines sin duplicar nada.

import { RawCandidate, ScanContext, SourceAdapter } from '../../core/types';
import type { BoletinAdapter } from '../../../detect-boletines/boletines';

export function wrapBoletin(a: BoletinAdapter, priority: number): SourceAdapter {
  return {
    key: a.key,
    layer: 'boletin',
    priority,
    sensorType: a.sensorType,
    regionName: a.regionName,
    async scan(ctx: ScanContext): Promise<RawCandidate[]> {
      const out: RawCandidate[] = [];
      for (let i = 0; i < ctx.daysBack; i++) {
        const d = new Date(ctx.today);
        d.setUTCDate(d.getUTCDate() - i);
        let hit;
        try {
          hit = await a.scan(d);
        } catch {
          hit = null; // fail-open por día
        }
        if (hit && hit.candidatesText.trim()) {
          out.push({
            sourceUrl: hit.url,
            officialUrl: hit.url, // el boletín ES la fuente oficial
            text: hit.candidatesText,
            regionName: a.regionName,
            publishedDate: d,
          });
        }
      }
      return out;
    },
  };
}
