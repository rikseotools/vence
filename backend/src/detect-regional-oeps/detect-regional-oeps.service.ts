import { Injectable, Logger } from '@nestjs/common';
import { OepSignalsLlmService } from '../oep-signals/oep-signals-llm.service';
import { OepSignalsQueriesService } from '../oep-signals/oep-signals-queries.service';
import { baseScoreBySensor, buildDedupeKey } from '../oep-signals/oep-signals.schemas';

export interface DetectRegionalOepsStats {
  totalSources: number;
  scanned: number;
  extractionOk: number;
  novelSignals: number;
  existingSignals: number;
  errors: number;
}

/**
 * Sensor 2 (regional_scan): escanea listados de convocatorias de entidades
 * (CCAA/ayuntamientos) y detecta OEPs C1/C2 nuevas que no están en BD.
 *
 * Portado de `app/api/cron/detect-regional-oeps/route.ts`.
 */
@Injectable()
export class DetectRegionalOepsService {
  private readonly logger = new Logger(DetectRegionalOepsService.name);

  constructor(
    private readonly queries: OepSignalsQueriesService,
    private readonly llm: OepSignalsLlmService,
  ) {}

  async run(): Promise<DetectRegionalOepsStats> {
    const startTime = Date.now();
    this.logger.log('Iniciando escaneo regional...');

    const sources = await this.queries.getActiveSources();
    this.logger.log(`${sources.length} fuentes activas`);

    let scanned = 0;
    let extractionOk = 0;
    let novelSignals = 0;
    let existingSignals = 0;
    let errors = 0;

    for (const source of sources) {
      const label = `${source.regionName} (${source.sourceType})`;
      this.logger.debug(`Escaneando: ${label}`);
      scanned++;

      // Fetch
      const fetchResult = await this.llm.fetchPageHtml(source.listingUrl, 20000);
      if (!fetchResult.html) {
        this.logger.warn(`Fetch error ${label}: ${fetchResult.error}`);
        errors++;
        await this.queries.updateSourceCheckResult({
          sourceId: source.id,
          newHash: null,
          error: fetchResult.error ?? 'fetch failed',
        });
        continue;
      }

      // Extract
      const extraction = await this.llm.extractRegionalOeps(
        fetchResult.html,
        source.regionName,
      );
      if (!extraction) {
        this.logger.warn(`Sin extracción para ${label}`);
        await this.queries.updateSourceCheckResult({
          sourceId: source.id,
          newHash: null,
          error: 'extraction_failed',
        });
        continue;
      }

      extractionOk++;
      this.logger.debug(`${label}: ${extraction.oeps.length} OEPs extraídas`);

      const allowedGroups = source.positionGroups ?? ['C1', 'C2'];

      for (const oep of extraction.oeps) {
        // Filtrar por grupo si el LLM lo detectó
        if (
          oep.positionGroup &&
          !allowedGroups.includes(oep.positionGroup)
        ) {
          continue;
        }

        // Match contra BD
        const match = await this.queries.matchDetectedOepToOposicion({
          detectedName: oep.name,
          regionName: source.regionName,
          bocRef: oep.bocRef,
        });

        if (match.matched) {
          existingSignals++;
          continue;
        }

        // NUEVA OEP detectada
        const score =
          baseScoreBySensor('regional_scan') +
          (oep.bocRef ? 15 : 0) +
          (oep.plazas ? 5 : 0) +
          (oep.year ? 5 : 0);

        const dedupeKey = buildDedupeKey({
          sensorType: 'regional_scan',
          oposicionId: source.id,
          year: oep.year,
          bocRef: oep.bocRef ?? oep.name,
        });

        const summary = `NUEVA ${oep.name} (${oep.positionGroup ?? '?'}) en ${source.regionName}${oep.plazas ? ` · ${oep.plazas} plazas` : ''}${oep.bocRef ? ` · ${oep.bocRef}` : ''}`;

        const { inserted } = await this.queries.insertSignal({
          oposicionId: null,
          sourceId: source.id,
          regionName: source.regionName,
          positionCategory: oep.positionGroup,
          detectedOposicionName: oep.name,
          sensorType: 'regional_scan',
          sourceUrl: oep.url ?? source.listingUrl,
          detectedYear: oep.year,
          detectedPlazasLibre: oep.plazas,
          detectedBocRef: oep.bocRef,
          detectedFechaInscripcionFin: oep.fechaInscripcionFin,
          detectedEstado: oep.estado,
          confidenceScore: Math.min(100, score),
          isNovel: true,
          signalSummary: summary,
          rawExtraction: {
            oep,
            sourceRegion: source.regionName,
          } as Record<string, unknown>,
          dedupeKey,
        });

        if (inserted) {
          novelSignals++;
          this.logger.warn(`NUEVA OEP: ${oep.name} en ${source.regionName}`);
        }
      }

      await this.queries.updateSourceCheckResult({
        sourceId: source.id,
        newHash: null,
        error: null,
      });

      // Pausa entre fuentes
      await delay(1500);
    }

    const duration = `${((Date.now() - startTime) / 1000).toFixed(1)}s`;
    const stats = {
      totalSources: sources.length,
      scanned,
      extractionOk,
      novelSignals,
      existingSignals,
      errors,
    };
    this.logger.log(`Completado en ${duration}: ${JSON.stringify(stats)}`);

    return stats;
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
