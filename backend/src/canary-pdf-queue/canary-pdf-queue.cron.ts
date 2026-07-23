import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { getLastTickMsAgo, runWithHeartbeat } from '../heartbeat/heartbeat.helpers';
import { jitter } from '../heartbeat/jitter.helper';
import { HeartbeatRegistry } from '../heartbeat/heartbeat.registry';
import { ObservabilityService } from '../observability/observability.service';
import { CanaryRunnerService } from '../canary-shared/canary-runner.service';
import { CanaryPdfQueueService } from './canary-pdf-queue.service';

/**
 * Cron canary-pdf-queue — lee la salud de la cola `temario_pdf_jobs` cada 15 min.
 *
 * Eventos:
 *   - canary_pdf_queue_ok (info)
 *   - canary_pdf_queue_failed (critical → RULE_CANARY_PDF_QUEUE_FAILED)
 *   - cron_run (siempre, liveness)
 *
 * Cierra el hueco 22-23/07: la cola de pre-generación de PDFs se llenó (27
 * pending + 12 DLQ) sin que nada avisara, porque su health-check no tenía
 * consumidor en producción.
 */
@Injectable()
export class CanaryPdfQueueCron {
  private readonly logger = new Logger(CanaryPdfQueueCron.name);
  public lastTickAtMs: number | null = null;

  constructor(
    private readonly service: CanaryPdfQueueService,
    private readonly runner: CanaryRunnerService,
    private readonly observability: ObservabilityService,
    heartbeatRegistry: HeartbeatRegistry,
  ) {
    // Cadencia 15 min → umbral de liveness ~2.6 ciclos (grace aparte).
    heartbeatRegistry.register(
      'canary-pdf-queue',
      () => getLastTickMsAgo(this, 'lastTickAtMs'),
      { thresholdMs: 2_400_000, gracePeriodMs: 120_000 },
    );
  }

  @Cron('*/15 * * * *', { name: 'canary-pdf-queue', timeZone: 'UTC' })
  async handle(): Promise<void> {
    // Jitter 0-20s para desacoplar del resto de crons del minuto 0/15/30/45.
    await jitter(20_000);
    await runWithHeartbeat(this, 'lastTickAtMs', async () => this.runImpl(), {
      name: 'canary-pdf-queue',
      observability: this.observability,
    });
  }

  private async runImpl(): Promise<void> {
    this.logger.log('Cron canary-pdf-queue disparado');
    await this.runner.run(this.service);
  }
}
