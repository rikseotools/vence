import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import {
  getLastTickMsAgo,
  runWithHeartbeat,
} from '../heartbeat/heartbeat.helpers';
import { HeartbeatRegistry } from '../heartbeat/heartbeat.registry';
import { ObservabilityService } from '../observability/observability.service';
import { RadarOrchestrator } from './orchestrator';

/**
 * Cron del RADAR multi-capa. Corre el orquestador (Capa 1 boletines + Capa 3
 * competidores; Capa 2 PAG sigue como sensor propio hasta Fase 2). Toda la
 * telemetría por adapter va a `radar_adapter_runs` + `observable_events`.
 *
 * Schedule: diario 07:00 UTC (tras detect-boletines 06:30). Diseño:
 * docs/roadmap/radar-multicapa.md
 */
@Injectable()
export class RadarCron {
  private readonly logger = new Logger(RadarCron.name);
  public lastTickAtMs: number | null = null;

  constructor(
    private readonly orchestrator: RadarOrchestrator,
    private readonly observability: ObservabilityService,
    heartbeatRegistry: HeartbeatRegistry,
  ) {
    heartbeatRegistry.register(
      'radar',
      () => getLastTickMsAgo(this, 'lastTickAtMs'),
      { thresholdMs: 172_800_000, gracePeriodMs: 120_000 }, // 2 días
    );
  }

  @Cron('0 7 * * *', { name: 'radar', timeZone: 'UTC' })
  async handle(): Promise<void> {
    await runWithHeartbeat(this, 'lastTickAtMs', async () => this.runImpl(), {
      name: 'radar',
      observability: this.observability,
    });
  }

  private async runImpl(): Promise<void> {
    this.logger.log('Cron radar disparado');
    const startedAt = Date.now();
    try {
      const { runId } = await this.orchestrator.run();
      await this.observability.emit({
        source: 'fargate',
        severity: 'info',
        eventType: 'cron_run',
        endpoint: 'radar',
        durationMs: Date.now() - startedAt,
        metadata: { status: 'success', runId },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Cron radar falló: ${errorMessage}`);
      await this.observability.emit({
        source: 'fargate',
        severity: 'error',
        eventType: 'cron_run',
        endpoint: 'radar',
        durationMs: Date.now() - startedAt,
        errorMessage,
        metadata: { status: 'failure' },
      });
    }
  }
}
