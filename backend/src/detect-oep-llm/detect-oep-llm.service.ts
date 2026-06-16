import { Injectable, Logger } from '@nestjs/common';
import { OepSignalsLlmService } from '../oep-signals/oep-signals-llm.service';
import { OepSignalsQueriesService } from '../oep-signals/oep-signals-queries.service';
import {
  baseScoreBySensor,
  buildDedupeKey,
  type LlmExtraction,
} from '../oep-signals/oep-signals.schemas';
import type { OposicionToScan } from '../oep-signals/oep-signals-queries.types';

export interface DetectOepLlmStats {
  total: number;
  scanned: number;
  withExtraction: number;
  signals: number;
  errors: number;
}

/**
 * Sensor 1: LLM semántico sobre páginas oficiales de seguimiento.
 *
 * Para cada oposición activa con seguimiento_url:
 *  1. Descarga el HTML de la página oficial
 *  2. Claude Haiku extrae entidades OEP estructuradas
 *  3. Compara con estado BD — solo genera señal si hay novedad
 *
 * Portado de `app/api/cron/detect-oep-llm/route.ts`.
 */
@Injectable()
export class DetectOepLlmService {
  private readonly logger = new Logger(DetectOepLlmService.name);

  constructor(
    private readonly queries: OepSignalsQueriesService,
    private readonly llm: OepSignalsLlmService,
  ) {}

  async run(): Promise<DetectOepLlmStats> {
    const startTime = Date.now();
    this.logger.log('Iniciando escaneo semántico LLM...');

    const oposiciones = await this.queries.getOposicionesForLlmScan();
    this.logger.log(`${oposiciones.length} oposiciones con seguimiento_url`);

    let scanned = 0;
    let withExtraction = 0;
    let signals = 0;
    let errors = 0;

    for (const opo of oposiciones) {
      const label = opo.shortName ?? opo.nombre;
      this.logger.debug(`Escaneando: ${label}`);
      scanned++;

      // 1. Fetch HTML
      // Sprint 2: usa Lambda Playwright si la oposición está marcada como
      // headless_required (URL JS-rendered según audit Fase 0).
      const fetchResult = await this.llm.fetchPageHtml(
        opo.seguimientoUrl,
        undefined,
        opo.fetcherType === 'headless' ? 'headless' : 'http',
      );
      if (!fetchResult.html) {
        this.logger.warn(`Fetch error ${label}: ${fetchResult.error}`);
        errors++;
        continue;
      }

      // 2. LLM extract
      const knownContext = buildKnownContext(opo);
      const extraction = await this.llm.extractOepFromHtml(
        fetchResult.html,
        knownContext,
      );
      if (!extraction || !extraction.hasOepInfo) {
        this.logger.debug(`Sin OEP clara en ${label}`);
        continue;
      }

      withExtraction++;

      // 3. Compare con estado BD
      const { isNovel, reasons } = computeNovelty(extraction, opo);
      if (!isNovel) {
        this.logger.debug(`${label}: coincide con BD, sin señal`);
        continue;
      }

      // 4. Score + insert
      const baseScore = baseScoreBySensor('llm_semantic');
      const score = adjustScore(baseScore, extraction, reasons);

      const dedupeKey = buildDedupeKey({
        sensorType: 'llm_semantic',
        oposicionId: opo.id,
        year: extraction.year,
        bocRef: extraction.bocRef,
      });

      const cuerpoNota = extraction.cuerpoDetectado
        ? ` · Cuerpo detectado: ${extraction.cuerpoDetectado}`
        : '';
      const summary = `${extraction.summary}${cuerpoNota} · Diff: ${reasons.join('; ')}`;

      const { inserted } = await this.queries.insertSignal({
        oposicionId: opo.id,
        sensorType: 'llm_semantic',
        sourceUrl: opo.seguimientoUrl,
        detectedYear: extraction.year,
        detectedPlazasLibre: extraction.plazasLibre,
        detectedPlazasDiscapacidad: extraction.plazasDiscapacidad,
        detectedPlazasPromocionInterna: extraction.plazasPromocionInterna,
        detectedBocRef: extraction.bocRef,
        detectedFechaPublicacion: extraction.fechaPublicacion,
        detectedFechaInscripcionFin: extraction.fechaInscripcionFin,
        detectedFechaExamen: extraction.fechaExamen,
        detectedEstado: extraction.estado,
        confidenceScore: score,
        isNovel,
        signalSummary: summary,
        rawExtraction: {
          extraction,
          noveltyReasons: reasons,
          knownContext,
        } as Record<string, unknown>,
        dedupeKey,
      });

      if (inserted) {
        signals++;
        this.logger.warn(
          `SEÑAL score=${score} novel=${isNovel}: ${extraction.summary}`,
        );
      } else {
        this.logger.debug(`${label}: señal duplicada (ya existe pending)`);
      }

      // Pausa entre oposiciones para no saturar el LLM ni los fetches
      await delay(1000);
    }

    const duration = `${((Date.now() - startTime) / 1000).toFixed(1)}s`;
    const stats = { total: oposiciones.length, scanned, withExtraction, signals, errors };
    this.logger.log(`Completado en ${duration}: ${JSON.stringify(stats)}`);

    return stats;
  }
}

// ============================================
// HELPERS PUROS (sin DI)
// ============================================

function buildKnownContext(opo: OposicionToScan): string {
  const parts: string[] = [];
  parts.push(`Nombre: ${opo.nombre}`);
  if (opo.convocatoriaNumero)
    parts.push(`Convocatoria actual BD: ${opo.convocatoriaNumero}`);
  if (opo.oepFecha) parts.push(`OEP fecha BD: ${opo.oepFecha}`);
  if (opo.plazasLibres !== null)
    parts.push(`Plazas libres BD: ${opo.plazasLibres}`);
  if (opo.plazasDiscapacidad !== null)
    parts.push(`Plazas discap BD: ${opo.plazasDiscapacidad}`);
  if (opo.estadoProceso) parts.push(`Estado BD: ${opo.estadoProceso}`);
  return parts.join(' | ');
}

function computeNovelty(
  extraction: LlmExtraction,
  opo: OposicionToScan,
): { isNovel: boolean; reasons: string[] } {
  const reasons: string[] = [];

  if (extraction.year) {
    const currentYear = opo.oepFecha
      ? new Date(opo.oepFecha).getFullYear()
      : null;
    if (currentYear && extraction.year > currentYear) {
      reasons.push(`año ${extraction.year} > BD ${currentYear}`);
    }
  }
  if (
    extraction.bocRef &&
    opo.convocatoriaNumero &&
    extraction.bocRef !== opo.convocatoriaNumero
  ) {
    reasons.push(`BOC ref ${extraction.bocRef} ≠ BD ${opo.convocatoriaNumero}`);
  }
  if (extraction.bocRef && !opo.convocatoriaNumero) {
    reasons.push(
      `BOC ref detectado: ${extraction.bocRef} (BD sin convocatoria)`,
    );
  }
  if (
    extraction.plazasLibre !== null &&
    opo.plazasLibres !== null &&
    extraction.plazasLibre !== opo.plazasLibres
  ) {
    reasons.push(
      `plazas ${extraction.plazasLibre} ≠ BD ${opo.plazasLibres}`,
    );
  }

  return { isNovel: reasons.length > 0, reasons };
}

function adjustScore(
  base: number,
  extraction: LlmExtraction,
  noveltyReasons: string[],
): number {
  let score = base;
  if (extraction.bocRef) score += 15;
  if (extraction.year) score += 5;
  if (extraction.plazasLibre !== null) score += 5;
  if (extraction.fechaInscripcionFin) score += 5;
  if (noveltyReasons.length >= 2) score += 10;
  return Math.min(100, score);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
