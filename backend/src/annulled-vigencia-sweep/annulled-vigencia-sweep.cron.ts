// backend/src/annulled-vigencia-sweep/annulled-vigencia-sweep.cron.ts
//
// Disparador del barrido T-009 (captura retroactiva de vigencia_notes que alimenta el gate
// de T-048). Semanal (martes 04:30 UTC): hueco propio, no colisiona con content-health-sweep
// (03:00) ni con law-completeness (lunes 09:00). Trabajo pesado en red pero acotado por
// rotación (BATCH leyes/semana). Heartbeat: si deja de tickar, salta cron_overdue en el panel.

import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { getLastTickMsAgo, runWithHeartbeat } from '../heartbeat/heartbeat.helpers';
import { HeartbeatRegistry } from '../heartbeat/heartbeat.registry';
import { ObservabilityService } from '../observability/observability.service';
import { AnnulledVigenciaSweepService } from './annulled-vigencia-sweep.service';

@Injectable()
export class AnnulledVigenciaSweepCron {
  private readonly logger = new Logger(AnnulledVigenciaSweepCron.name);
  public lastTickAtMs: number | null = null;

  constructor(
    private readonly service: AnnulledVigenciaSweepService,
    private readonly observability: ObservabilityService,
    heartbeatRegistry: HeartbeatRegistry,
  ) {
    // Semanal → umbral 8 días (tolera 1 día de retraso), como law-completeness.
    heartbeatRegistry.register(
      'annulled-vigencia-sweep',
      () => getLastTickMsAgo(this, 'lastTickAtMs'),
      { thresholdMs: 8 * 24 * 60 * 60 * 1000, gracePeriodMs: 120_000 },
    );
  }

  @Cron('30 4 * * 2', { name: 'annulled-vigencia-sweep', timeZone: 'UTC' })
  async handle(): Promise<void> {
    await runWithHeartbeat(this, 'lastTickAtMs', async () => this.runImpl(), {
      name: 'annulled-vigencia-sweep',
      observability: this.observability,
    });
  }

  private async runImpl(): Promise<void> {
    this.logger.log('Cron annulled-vigencia-sweep disparado');
    const r = await this.service.runSweep();
    this.logger.log(
      `annulled-vigencia-sweep OK: +${r.articlesCaptured} capturados, ${r.liveBugs} bugs vivos` +
        `${r.regressed ? ' (⚠️ REGRESIÓN)' : ''}`,
    );
  }
}
