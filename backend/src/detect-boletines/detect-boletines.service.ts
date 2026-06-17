import { Injectable, Logger } from '@nestjs/common';
import { OepSignalsLlmService } from '../oep-signals/oep-signals-llm.service';
import { OepSignalsQueriesService } from '../oep-signals/oep-signals-queries.service';
import { baseScoreBySensor } from '../oep-signals/oep-signals.schemas';
import { BOLETIN_ADAPTERS } from './boletines';

export interface DetectBoletinesStats {
  boletines: number;
  daysScanned: number;
  candidatesDays: number;
  signals: number;
  errors: number;
}

/**
 * Sensor `detect-boletines`: descubre convocatorias de ingreso C1/C2 NUEVAS
 * leyendo los SUMARIOS de los boletines oficiales (BOCYL HTML por fecha, BOE
 * API JSON). Sustituye funcionalmente al retirado `detect-regional-oeps`, que
 * leía webs institucionales JS y daba 56% de error.
 *
 * Por qué boletín y no la web institucional: la web de la universidad (caso ULE
 * Escala Administrativa, 17/06/2026) es JS paginada y un fetch no ve la
 * convocatoria; el SUMARIO del boletín es estático/API y SIEMPRE la contiene.
 *
 * Pipeline por (boletín × día de la ventana):
 *   1. adapter.scan(date) → texto pre-filtrado de candidatos (regex barata).
 *   2. llm.extractRegionalOeps() → afina y descarta ruido (resultados, A1/A2…).
 *   3. insertSignal() con dedupeKey idempotente → panel /admin/oep-signals.
 */
@Injectable()
export class DetectBoletinesService {
  private readonly logger = new Logger(DetectBoletinesService.name);

  constructor(
    private readonly queries: OepSignalsQueriesService,
    private readonly llm: OepSignalsLlmService,
  ) {}

  private lastDays(n: number, today: Date): Date[] {
    const out: Date[] = [];
    for (let i = 0; i < n; i++) {
      const d = new Date(today);
      d.setUTCDate(d.getUTCDate() - i);
      out.push(d);
    }
    return out;
  }

  /**
   * @param daysBack ventana hacia atrás (default 4: cubre fin de semana en cron L-V).
   * @param today    inyectable para tests (default ahora).
   */
  async run(daysBack = 4, today: Date = new Date()): Promise<DetectBoletinesStats> {
    const dates = this.lastDays(daysBack, today);
    const stats: DetectBoletinesStats = {
      boletines: BOLETIN_ADAPTERS.length,
      daysScanned: 0,
      candidatesDays: 0,
      signals: 0,
      errors: 0,
    };

    for (const adapter of BOLETIN_ADAPTERS) {
      for (const date of dates) {
        stats.daysScanned++;
        let hit;
        try {
          hit = await adapter.scan(date);
        } catch (err) {
          stats.errors++;
          this.logger.warn(
            `${adapter.key} ${date.toISOString().slice(0, 10)}: ${
              err instanceof Error ? err.message : String(err)
            }`,
          );
          continue;
        }
        if (!hit || !hit.candidatesText.trim()) continue;
        stats.candidatesDays++;

        const extraction = await this.llm.extractRegionalOeps(
          hit.candidatesText,
          adapter.regionName,
        );
        if (!extraction || extraction.oeps.length === 0) continue;

        const ymd = `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, '0')}${String(
          date.getUTCDate(),
        ).padStart(2, '0')}`;

        for (const oep of extraction.oeps) {
          // Guardarraíl extra: el LLM ya filtra, pero descartamos grupos altos.
          const grp = (oep.positionGroup ?? '').toUpperCase().trim();
          if (grp && !['C1', 'C2', 'C'].includes(grp)) continue;

          const nameKey = oep.name
            .toLowerCase()
            .normalize('NFD')
            .replace(/[̀-ͯ]/g, '')
            .replace(/[^a-z0-9]+/g, '-')
            .slice(0, 80);
          const dedupeKey = `boletin:${adapter.key}:${ymd}:${nameKey}`;
          const score = Math.min(
            100,
            baseScoreBySensor(adapter.sensorType) + (oep.plazas ? 10 : 0),
          );

          try {
            const { inserted } = await this.queries.insertSignal({
              oposicionId: null,
              sensorType: adapter.sensorType,
              sourceUrl: oep.url ?? hit.url,
              regionName: adapter.regionName,
              detectedOposicionName: oep.name,
              detectedYear: oep.year ?? null,
              detectedPlazasLibre: oep.plazas ?? null,
              detectedBocRef: oep.bocRef ?? null,
              detectedFechaInscripcionFin: oep.fechaInscripcionFin ?? null,
              detectedEstado: oep.estado ?? null,
              confidenceScore: score,
              isNovel: true,
              signalSummary: `[${adapter.regionName}] ${oep.name}${
                oep.plazas ? ` (${oep.plazas} plazas)` : ''
              }`,
              rawExtraction: { boletin: adapter.key, fecha: ymd, oep },
              dedupeKey,
            });
            if (inserted) {
              stats.signals++;
              this.logger.warn(`SEÑAL ${adapter.key} ${ymd}: ${oep.name}`);
            }
          } catch (err) {
            stats.errors++;
            this.logger.error(
              `insertSignal falló: ${err instanceof Error ? err.message : String(err)}`,
            );
          }
        }
      }
    }

    this.logger.log(
      `detect-boletines: ${stats.signals} señales (${stats.candidatesDays} días con candidatos de ${stats.daysScanned} escaneados)`,
    );
    return stats;
  }
}
