import { Injectable, Logger } from '@nestjs/common';
import { OepSignalsQueriesService } from '../oep-signals/oep-signals-queries.service';
import { baseScoreBySensor, buildDedupeKey } from '../oep-signals/oep-signals.schemas';

export interface TimelineSilenceStats {
  candidates: number;
  signals: number;
}

/**
 * Sensor 3: detector de silencio en timeline de convocatorias.
 *
 * Busca hitos con status='current' cuya fecha ya pasó hace más de 3 días
 * sin haberse actualizado a 'completed'. Genera señales `timeline_silence`
 * para alertar al admin de que se esperaba un evento y no ha ocurrido.
 *
 * Portado de `app/api/cron/detect-timeline-silence/route.ts`.
 */
@Injectable()
export class DetectTimelineSilenceService {
  private readonly logger = new Logger(DetectTimelineSilenceService.name);

  private readonly GRACE_DAYS = 3;

  constructor(private readonly queries: OepSignalsQueriesService) {}

  async run(): Promise<TimelineSilenceStats> {
    const startTime = Date.now();
    this.logger.log('Buscando hitos retrasados...');

    const candidates = await this.queries.findTimelineSilences(this.GRACE_DAYS);
    this.logger.log(`${candidates.length} candidatos encontrados`);

    let signalsInserted = 0;

    for (const c of candidates) {
      const baseScore = baseScoreBySensor('timeline_silence');
      // Más retraso = más urgente (max +30)
      const urgencyBonus = Math.min(30, c.diasRetraso * 2);
      const score = Math.min(100, baseScore + urgencyBonus);

      const year = new Date(c.hitoFecha).getFullYear();
      const dedupeKey = buildDedupeKey({
        sensorType: 'timeline_silence',
        oposicionId: c.oposicionId,
        year,
        bocRef: c.hitoId, // único por hito
      });

      const summary = `Hito "${c.hitoTitulo}" esperado ${c.hitoFecha} (+${c.diasRetraso} días retraso). Revisar página oficial.`;

      const { inserted } = await this.queries.insertSignal({
        oposicionId: c.oposicionId,
        sensorType: 'timeline_silence',
        sourceUrl: null,
        detectedYear: year,
        confidenceScore: score,
        isNovel: false,
        signalSummary: summary,
        rawExtraction: {
          hitoId: c.hitoId,
          hitoTitulo: c.hitoTitulo,
          hitoFecha: c.hitoFecha,
          diasRetraso: c.diasRetraso,
        } as Record<string, unknown>,
        dedupeKey,
      });

      if (inserted) {
        signalsInserted++;
        this.logger.warn(
          `${c.oposicionNombre}: hito "${c.hitoTitulo}" +${c.diasRetraso}d retraso (score=${score})`,
        );
      }
    }

    const duration = `${((Date.now() - startTime) / 1000).toFixed(1)}s`;
    const stats = { candidates: candidates.length, signals: signalsInserted };
    this.logger.log(`Completado en ${duration}: ${JSON.stringify(stats)}`);

    return stats;
  }
}
