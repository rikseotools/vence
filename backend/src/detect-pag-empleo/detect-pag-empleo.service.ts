import { Injectable, Logger } from '@nestjs/common';
import { OepSignalsQueriesService } from '../oep-signals/oep-signals-queries.service';
import { baseScoreBySensor } from '../oep-signals/oep-signals.schemas';
import {
  fetchPagGrupo,
  isRelevantPagConvocatoria,
  PAG_ADV_URL,
  PagConvocatoria,
} from './pag-empleo';

export interface DetectPagEmpleoStats {
  fetched: number;
  relevant: number;
  signals: number;
  matched: number;
  errors: number;
}

/**
 * Sensor `detect-pag-empleo`: descubre convocatorias de ingreso C1/C2 de PLAZO
 * ABIERTO en TODA España (Estado + autonómico + LOCAL) leyendo el Buscador del
 * Punto de Acceso General (administracion.gob.es). Cierra el agujero de
 * descubrimiento que `detect-boletines` no cubre (solo BOCYL + BOE = 2 de ~19
 * boletines; toda autonómica no-CyL y todas las locales quedaban ciegas).
 *
 * A diferencia de detect-boletines NO necesita LLM: el PAG entrega cada
 * convocatoria ya estructurada (jsonDetalle con cuerpo, grupo, organismo, CCAA,
 * plazas). Filtramos turno libre C1/C2, intentamos casar con el catálogo y
 * generamos señal en `oep_detection_signals` (idempotente por idConvocatoria).
 *
 * Schedule: L-V 06:00 UTC (antes que detect-boletines 06:30).
 */
@Injectable()
export class DetectPagEmpleoService {
  private readonly logger = new Logger(DetectPagEmpleoService.name);

  // idGrupo del PAG: 4=C1, 5=C2. idPlazo=1 = Plazo Abierto (barrido completo +
  // dedupe → autosanador; no dependemos de la ventana de 72h).
  private readonly GRUPOS = [4, 5];
  private readonly PLAZO_ABIERTO = 1;

  constructor(private readonly queries: OepSignalsQueriesService) {}

  async run(): Promise<DetectPagEmpleoStats> {
    const stats: DetectPagEmpleoStats = {
      fetched: 0,
      relevant: 0,
      signals: 0,
      matched: 0,
      errors: 0,
    };

    for (const grupo of this.GRUPOS) {
      let convocatorias: PagConvocatoria[];
      try {
        convocatorias = await fetchPagGrupo(grupo, this.PLAZO_ABIERTO);
      } catch (err) {
        stats.errors++;
        this.logger.warn(
          `PAG grupo ${grupo}: ${err instanceof Error ? err.message : String(err)}`,
        );
        continue;
      }
      stats.fetched += convocatorias.length;

      for (const c of convocatorias) {
        if (!isRelevantPagConvocatoria(c)) continue;
        stats.relevant++;

        // Casado estructural con el catálogo: familia (SOLO del cuerpo) + nivel
        // de administración + grupo. El organismo va aparte (clasificar familia
        // con el organismo daba falsos positivos: "Consejería de ...
        // Administración ..." disparaba la familia "administrativo").
        let oposicionId: string | null = null;
        try {
          const match = await this.queries.matchDetectedOepToOposicion({
            cuerpo: c.cuerpo,
            regionName: c.ccaa,
            grupo: c.grupo,
            admin: c.admin,
            organismo: c.organismo,
          });
          if (match.matched) {
            oposicionId = match.oposicionId;
            stats.matched++;
          }
        } catch {
          /* el match es best-effort; si falla, va como descubrimiento */
        }

        const score = Math.min(
          100,
          baseScoreBySensor('pag_empleo') + (c.plazas ? 10 : 0),
        );

        try {
          const { inserted } = await this.queries.insertSignal({
            oposicionId,
            sensorType: 'pag_empleo',
            sourceUrl: PAG_ADV_URL,
            regionName: c.ccaa,
            // Grupo C1/C2 del PAG → categoría de la señal (antes se perdía).
            positionCategory: c.grupo || null,
            detectedOposicionName: `${c.cuerpo} (${c.organismo})`,
            detectedPlazasLibre: c.plazas,
            detectedFechaInscripcionFin: c.plazoHasta,
            detectedEstado: 'inscripcion_abierta',
            confidenceScore: score,
            isNovel: oposicionId === null,
            signalSummary:
              `[${c.ccaa} · ${c.admin}] ${c.cuerpo} — ${c.organismo}` +
              `${c.plazas ? ` (${c.plazas} plazas)` : ''} · plazo hasta ${c.plazoHasta ?? '?'}`,
            rawExtraction: { pag: c },
            // dedupe estable por convocatoria: una señal por convocatoria, jamás duplica.
            dedupeKey: `pag:${c.id}`,
          });
          if (inserted) {
            stats.signals++;
            this.logger.warn(
              `SEÑAL pag_empleo ${c.id}: ${c.cuerpo} (${c.organismo})`,
            );
          }
        } catch (err) {
          stats.errors++;
          this.logger.error(
            `insertSignal falló: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }
    }

    this.logger.log(
      `detect-pag-empleo: ${stats.signals} señales nuevas (${stats.relevant} relevantes de ${stats.fetched} leídas, ${stats.matched} casadas con catálogo)`,
    );
    return stats;
  }
}
