// backend/src/radar/core/telemetry.ts
//
// ★ Observabilidad TOTAL del radar. Saber en todo momento qué adapter/boletín/
// competidor corrió, cuál falló, cuál encontró cosas y dónde hay gaps.
//
// Doble escritura:
//   1) tabla `radar_adapter_runs` (histórico + dashboard /admin/radar-salud)
//   2) `observable_events` vía ObservabilityService (espina cross-runtime)
//
// Regla innegociable: TODO run deja rastro, aunque no encuentre nada
// (un adapter 'empty' es información: distingue "no hay convocatorias" de
// "el fetch se rompió"). Ningún adapter puede tumbar la pasada.
//
// Spec: docs/roadmap/radar-multicapa.md §4

import { Injectable, Logger } from '@nestjs/common';
import { ObservabilityService } from '../../observability/observability.service';
import { OepSignalsQueriesService } from '../../oep-signals/oep-signals-queries.service';
import type { AdapterRunResult, Layer } from './types';

const DEGRADED_STREAK = 3; // N fallos seguidos → proveedor degradado (rojo)

@Injectable()
export class RadarTelemetry {
  private readonly logger = new Logger(RadarTelemetry.name);

  constructor(
    private readonly obs: ObservabilityService,
    private readonly queries: OepSignalsQueriesService,
  ) {}

  /** Marca el inicio de una pasada del orquestador. */
  async runStarted(runId: string, adapterCount: number): Promise<void> {
    await this.obs.emit({
      source: 'fargate',
      severity: 'info',
      eventType: 'radar_run',
      endpoint: 'radar/orchestrator',
      metadata: { runId, phase: 'start', adapterCount },
    });
  }

  /**
   * Registra el resultado de UN adapter: en la tabla dedicada + evento.
   * `failed`/`timeout` → warn. Racha de fallos → `radar_provider_degraded` (error).
   */
  async adapterFinished(r: AdapterRunResult): Promise<void> {
    // 1) histórico para el dashboard
    await this.queries.insertRadarAdapterRun(r).catch((e) =>
      this.logger.error(`insertRadarAdapterRun falló: ${asMsg(e)}`),
    );

    // 2) evento de observabilidad
    const eventType =
      r.status === 'ok'
        ? 'radar_adapter_ok'
        : r.status === 'empty'
          ? 'radar_adapter_empty'
          : r.status === 'timeout'
            ? 'radar_adapter_timeout'
            : r.status === 'skipped'
              ? 'radar_adapter_ok'
              : 'radar_adapter_failed';
    const severity =
      r.status === 'failed' || r.status === 'timeout' ? 'warn' : 'debug';

    await this.obs.emit({
      source: 'fargate',
      severity,
      eventType,
      endpoint: `radar/${r.layer}/${r.adapterKey}`,
      durationMs: r.durationMs,
      httpStatus: r.httpStatus ?? undefined,
      errorMessage: r.errorMessage ?? undefined,
      metadata: {
        runId: r.runId,
        layer: r.layer,
        adapterKey: r.adapterKey,
        status: r.status,
        itemsScanned: r.itemsScanned,
        candidates: r.candidates,
        signalsNew: r.signalsNew,
        signalsDupe: r.signalsDupe,
      },
    });

    // 3) racha de fallos → proveedor degradado
    if (r.status === 'failed' || r.status === 'timeout') {
      const streak = await this.queries
        .radarAdapterFailStreak(r.adapterKey)
        .catch(() => 0);
      if (streak >= DEGRADED_STREAK) {
        await this.obs.emit({
          source: 'fargate',
          severity: 'error',
          eventType: 'radar_provider_degraded',
          endpoint: `radar/${r.layer}/${r.adapterKey}`,
          errorMessage: r.errorMessage ?? undefined,
          metadata: { runId: r.runId, adapterKey: r.adapterKey, streak },
        });
      }
    }
  }

  /** Una señal nueva insertada: qué encontró el radar. */
  async signalNew(
    runId: string,
    layer: Layer,
    adapterKey: string,
    summary: string,
    officialRef: string | null,
  ): Promise<void> {
    await this.obs.emit({
      source: 'fargate',
      severity: 'info',
      eventType: 'radar_signal_new',
      endpoint: `radar/${layer}/${adapterKey}`,
      metadata: { runId, layer, adapterKey, summary, officialRef },
    });
  }

  /**
   * GAP: un competidor detectó una convocatoria que NINGUNA capa oficial vio →
   * nos falta un boletín. Es el mecanismo anti-gaps del sistema (§4.2).
   */
  async gapDetected(
    runId: string,
    cuerpo: string,
    boletinFaltante: string | null,
    officialUrl: string | null,
  ): Promise<void> {
    await this.obs.emit({
      source: 'fargate',
      severity: 'warn',
      eventType: 'radar_gap_detected',
      endpoint: 'radar/coverage-audit',
      metadata: { runId, cuerpo, boletinFaltante, officialUrl },
    });
    this.logger.warn(`GAP: "${cuerpo}" solo visto por competidor (falta ${boletinFaltante ?? '?'})`);
  }

  /** Cierre de la pasada con totales por capa. */
  async runFinished(
    runId: string,
    totals: { candidates: number; signalsNew: number; failed: number; gaps: number },
  ): Promise<void> {
    await this.obs.emit({
      source: 'fargate',
      severity: totals.failed > 0 ? 'warn' : 'info',
      eventType: 'radar_run',
      endpoint: 'radar/orchestrator',
      metadata: { runId, phase: 'end', ...totals },
    });
  }
}

function asMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
