// Cron del worker outbox-processor.
//
// Tick cada 1 segundo (configurable). Cada tick procesa un batch de hasta
// 100 eventos del outbox con `FOR UPDATE SKIP LOCKED` para tolerar múltiples
// instancias paralelas.
//
// Métricas emitidas a `observable_events` (source=fargate):
//   - `cron_run` por cada tick (success/error con stats del batch)
//   - `outbox_dlq` cuando un evento entra en DLQ (retry_count >= maxRetries)
//   - `outbox_lag_warning` cuando el evento más antiguo pendiente tiene > 30s
//
// FASE 1.2: el cron procesa batches pero sin handlers reales (no-op).
// Sirve para validar la infra en producción antes de añadir lógica.

import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { ObservabilityService } from '../observability/observability.service';
import { OutboxProcessorService } from './outbox-processor.service';

@Injectable()
export class OutboxProcessorCron {
  private readonly logger = new Logger(OutboxProcessorCron.name);
  /** Umbral de lag en segundos por encima del cual emitimos warning. */
  private readonly LAG_WARNING_THRESHOLD_SECONDS = 30;
  /** Cada cuántos ticks emitimos heartbeat observable (cada 60s con interval 5s). */
  private readonly HEARTBEAT_EVERY_TICKS = 12;

  /**
   * Heartbeat in-memory: timestamp del último tick que retornó.
   * Lo lee el HealthController para exponer last_tick_ms_ago a la liveness
   * probe de ECS. Si la liveness probe ve >30s sin tick, ECS mata el container
   * y relanza — auto-recovery sin necesidad de watchdog externo.
   *
   * NULL al arrancar (antes del primer tick exitoso) → health endpoint
   * devuelve 503 hasta que el worker esté operativo.
   */
  private lastTickAtMs: number | null = null;
  /** Counter de ticks para heartbeat observable cada N ticks. */
  private tickCounter = 0;

  constructor(
    private readonly service: OutboxProcessorService,
    private readonly observability: ObservabilityService,
  ) {}

  /** Lectura para HealthController. Devuelve ms desde último tick o null si nunca. */
  getLastTickMsAgo(): number | null {
    if (this.lastTickAtMs === null) return null;
    return Date.now() - this.lastTickAtMs;
  }

  /**
   * Tick cada 5 segundos. CAMBIADO 29/05 04:11 UTC de @Cron(EVERY_SECOND) a
   * @Interval(5000) tras detectar que EVERY_SECOND con processBatch() que
   * incluye SELECT FOR UPDATE SKIP LOCKED (transacción) y emit a observable_events
   * (insert) podía solaparse y saturar el scheduler de NestJS, lo cual rompió
   * TODOS los crons del backend (incl. canaries) entre 21:50 UTC del 28/05 y
   * el deploy de este fix.
   *
   * @Interval garantiza no-overlap: espera a que el tick anterior termine
   * antes de lanzar el siguiente. 5s × batch 10 = capacidad 120/min,
   * suficiente para >10k DAU activos.
   *
   * DESIGN ROBUSTO POST 30/05/2026 (incidente cuelgue worker 21:54 UTC):
   * Tres niveles de defensa contra cuelgue silencioso:
   *
   *   1. statement_timeout=30s en cliente postgres (config DatabaseModule)
   *      → si query BD cuelga, Postgres la mata y libera el slot.
   *   2. Heartbeat in-memory en cada tick + endpoint /health/outbox
   *      → liveness probe ECS lo lee, mata container si >30s sin tick.
   *   3. Emit observable cron_run cada 12 ticks (60s) AUN si batch vacío
   *      → dashboard ve "alive but idle" distinto de "muerto".
   */
  @Interval(5000)
  async tick(): Promise<void> {
    const startedAt = Date.now();
    this.tickCounter += 1;
    try {
      const result = await this.service.processBatch();

      // Marcar heartbeat in-memory PARA EL HEALTH ENDPOINT.
      // Se hace SIEMPRE (vivo aunque batch vacío) — clave para distinguir
      // "worker silencioso por falta de trabajo" de "worker colgado".
      this.lastTickAtMs = Date.now();

      // Log + observable si batch no vacío.
      if (result.size > 0) {
        this.logger.log(
          `Batch ${result.size} eventos: ${result.succeeded} OK, ${result.failed} fail` +
            (result.movedToDlq > 0 ? `, ${result.movedToDlq} → DLQ` : '') +
            ` (${result.durationMs}ms)`,
        );

        this.observability.emitFireAndForget({
          source: 'fargate',
          severity: result.failed > 0 ? 'warn' : 'info',
          eventType: 'cron_run',
          endpoint: 'outbox-processor',
          durationMs: result.durationMs,
          metadata: {
            status: result.failed > 0 ? 'partial_failure' : 'success',
            size: result.size,
            succeeded: result.succeeded,
            failed: result.failed,
            movedToDlq: result.movedToDlq,
          },
        });
      } else if (this.tickCounter % this.HEARTBEAT_EVERY_TICKS === 0) {
        // Heartbeat observable cada 60s aunque queue esté vacía.
        // SLO clave: si han pasado más de 60s sin cron_run de este endpoint
        // → worker silencioso (cuelgue) → page alert.
        this.observability.emitFireAndForget({
          source: 'fargate',
          severity: 'info',
          eventType: 'cron_run',
          endpoint: 'outbox-processor',
          durationMs: result.durationMs,
          metadata: { status: 'heartbeat', size: 0 },
        });
      }

      // Check de lag cada 2 ticks (~10s con interval 5s).
      if (this.tickCounter % 2 === 0) {
        const stats = await this.service.getStats();
        if (
          stats.oldestPendingAgeSeconds != null &&
          stats.oldestPendingAgeSeconds > this.LAG_WARNING_THRESHOLD_SECONDS
        ) {
          this.logger.warn(
            `Outbox lag elevado: ${stats.oldestPendingAgeSeconds.toFixed(0)}s ` +
              `(pending=${stats.pending}, dlq=${stats.dlq})`,
          );
          this.observability.emitFireAndForget({
            source: 'fargate',
            severity: 'warn',
            eventType: 'outbox_lag_warning',
            endpoint: 'outbox-processor',
            durationMs: 0,
            metadata: {
              oldestPendingAgeSeconds: stats.oldestPendingAgeSeconds,
              pending: stats.pending,
              dlq: stats.dlq,
            },
          });
        }
      }
    } catch (error) {
      // Marcar heartbeat AUN si el batch falló — el worker SIGUE VIVO.
      // Solo NO se marca si el await del processBatch nunca retorna (cuelgue).
      this.lastTickAtMs = Date.now();
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Cron outbox-processor falló: ${errorMessage}`);
      this.observability.emitFireAndForget({
        source: 'fargate',
        severity: 'error',
        eventType: 'cron_run',
        endpoint: 'outbox-processor',
        durationMs: Date.now() - startedAt,
        errorMessage,
        metadata: { status: 'failure' },
      });
    }
  }
}
