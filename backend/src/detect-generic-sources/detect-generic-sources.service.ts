import { Injectable, Logger } from '@nestjs/common';
import { OepSignalsLlmService } from '../oep-signals/oep-signals-llm.service';
import { OepSignalsQueriesService } from '../oep-signals/oep-signals-queries.service';
import { baseScoreBySensor } from '../oep-signals/oep-signals.schemas';

export interface DetectGenericSourcesStats {
  total: number;
  checked: number;
  hashChanged: number;
  signals: number;
  errors: number;
}

/**
 * Sensor 4 (generic_source): monitoriza fuentes estatales de Función Pública
 * (DGFP, Secretaría Estado FP, Transparencia) que publican instrucciones,
 * acuerdos, circulares NO siempre reflejados en BOE.
 *
 * Estrategia:
 *  1. Calcula hash SHA-256 del contenido limpio de cada fuente
 *  2. Solo si el hash cambió, invoca Claude Haiku para filtrar contenido real
 *     relevante al temario (evita 95% de falsos positivos cosméticos)
 *  3. Si hay contenido normativo relevante, genera señal `generic_source`
 *
 * Portado de `app/api/cron/detect-generic-sources/route.ts`.
 */
@Injectable()
export class DetectGenericSourcesService {
  private readonly logger = new Logger(DetectGenericSourcesService.name);

  constructor(
    private readonly queries: OepSignalsQueriesService,
    private readonly llm: OepSignalsLlmService,
  ) {}

  async run(): Promise<DetectGenericSourcesStats> {
    const startTime = Date.now();

    const sources = await this.queries.getActiveGenericSources();
    this.logger.log(`${sources.length} fuentes a revisar`);

    const stats: DetectGenericSourcesStats = {
      total: sources.length,
      checked: 0,
      hashChanged: 0,
      signals: 0,
      errors: 0,
    };

    for (const src of sources) {
      this.logger.debug(`Revisando: ${src.source_name}`);
      stats.checked++;

      const fetched = await this.llm.fetchPageHtml(src.source_url, 20000);
      if (!fetched.html) {
        this.logger.warn(
          `Fetch error ${src.source_name}: ${fetched.error}`,
        );
        stats.errors++;
        continue;
      }

      const newHash = this.llm.computeContentHash(fetched.html);
      const now = new Date().toISOString();

      if (src.last_hash && src.last_hash === newHash) {
        this.logger.debug(`${src.source_name}: sin cambios`);
        await this.queries.updateGenericSourceChecked({ id: src.id, now });
        continue;
      }

      this.logger.log(
        `${src.source_name}: hash cambió — invocando LLM para filtrar relevancia...`,
      );
      stats.hashChanged++;

      const extraction = await this.llm.extractGenericSourceChanges(
        src.source_name,
        fetched.html,
        src.last_checked_at,
      );

      if (
        !extraction ||
        !extraction.hasRelevantChange ||
        extraction.items.length === 0
      ) {
        this.logger.log(
          `${src.source_name}: LLM no detecta contenido normativo relevante (cambio cosmético)`,
        );
        await this.queries.updateGenericSourceHash({
          id: src.id,
          newHash,
          now,
        });
        continue;
      }

      // Señal relevante detectada
      const altaCount = extraction.items.filter(
        (i) => i.relevance === 'alta',
      ).length;
      const score = Math.min(
        100,
        baseScoreBySensor('generic_source') + altaCount * 10,
      );

      const summary = `${src.source_name}: ${extraction.summary} (${extraction.items.length} ítems, ${altaCount} alta relevancia)`;
      const dedupeKey = `generic_source:${src.source_key}:${newHash.slice(0, 16)}`;

      const { inserted, id: signalId } = await this.queries.insertSignal({
        oposicionId: null,
        sensorType: 'generic_source',
        sourceUrl: src.source_url,
        confidenceScore: score,
        isNovel: true,
        signalSummary: summary,
        rawExtraction: {
          items: extraction.items,
          sourceName: src.source_name,
          sourceKey: src.source_key,
        } as Record<string, unknown>,
        dedupeKey,
      });

      if (inserted) {
        this.logger.warn(`SEÑAL generada score=${score}: ${summary}`);
        stats.signals++;
        await this.queries.updateGenericSourceSignal({
          id: src.id,
          newHash,
          now,
          signalId,
        });
      } else {
        this.logger.debug(
          `${src.source_name}: señal duplicada (ya existe pending)`,
        );
        await this.queries.updateGenericSourceHash({
          id: src.id,
          newHash,
          now,
        });
      }

      // Pausa entre fuentes (no saturar LLM)
      await delay(1000);
    }

    const duration = `${((Date.now() - startTime) / 1000).toFixed(1)}s`;
    this.logger.log(`Completado en ${duration}: ${JSON.stringify(stats)}`);

    return stats;
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
