// backend/src/sim-canary/sim-canary.cron.ts
//
// Cron del canary Vence Sim (Fargate in-process, como el resto de canaries). Corre los
// journeys de API cada hora, emite un evento `sim_journey_result` por journey a
// observabilidad (source 'fargate'), y registra heartbeat para el liveness del radar de
// crons. Un journey en rojo → evento severity 'error' → lo recoge el alerts-engine.

import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { getLastTickMsAgo, runWithHeartbeat } from '../heartbeat/heartbeat.helpers';
import { HeartbeatRegistry } from '../heartbeat/heartbeat.registry';
import { ObservabilityService } from '../observability/observability.service';
import { SimCanaryService } from './sim-canary.service';

@Injectable()
export class SimCanaryCron {
  private readonly logger = new Logger(SimCanaryCron.name);
  public lastTickAtMs: number | null = null;

  constructor(
    private readonly service: SimCanaryService,
    private readonly observability: ObservabilityService,
    heartbeatRegistry: HeartbeatRegistry,
  ) {
    heartbeatRegistry.register(
      'sim-canary',
      () => getLastTickMsAgo(this, 'lastTickAtMs'),
      // corre cada hora → un tick perdido tolerable; alerta si >2h sin tick.
      { thresholdMs: 7_200_000, gracePeriodMs: 120_000 },
    );
  }

  @Cron('23 * * * *', { name: 'sim-canary', timeZone: 'UTC' })
  async handle(): Promise<void> {
    await runWithHeartbeat(this, 'lastTickAtMs', async () => this.runImpl(), {
      name: 'sim-canary',
      observability: this.observability,
    });
  }

  private async runImpl(): Promise<void> {
    this.logger.log('Cron sim-canary disparado');
    const results = await this.service.run();
    for (const r of results) {
      await this.observability.emit({
        source: 'fargate',
        severity: r.passed ? 'info' : 'error', // skipped tiene passed=true → info
        eventType: 'sim_journey_result',
        endpoint: `/sim/${r.journey}`,
        durationMs: r.durationMs,
        errorMessage: r.passed ? null : (r.firstFailure ?? r.error ?? 'fallo'),
        metadata: {
          journey: r.journey,
          passed: r.passed,
          skipped: r.skipped ?? false,
          skipReason: r.skipReason ?? null,
          firstFailure: r.firstFailure ?? null,
          failedInvariants: r.invariants.filter((i) => !i.ok).map((i) => i.name),
        },
      });
    }
    const failed = results.filter((r) => !r.passed && !r.skipped);
    if (failed.length > 0) {
      this.logger.warn(`sim-canary: ${failed.length}/${results.length} journeys en rojo`);
    }
  }
}
