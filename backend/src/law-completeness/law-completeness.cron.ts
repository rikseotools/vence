import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import {
  getLastTickMsAgo,
  runWithHeartbeat,
} from '../heartbeat/heartbeat.helpers';
import { HeartbeatRegistry } from '../heartbeat/heartbeat.registry';
import { ObservabilityService } from '../observability/observability.service';
import { LawCompletenessService } from './law-completeness.service';

/**
 * Cron `law-completeness-sweep` — Capa 4 del sistema de completitud de leyes.
 *
 * Semanal (lunes 09:00 UTC). Emite el snapshot honesto del estado de completitud
 * a `observable_events` y ALERTA si el backlog de leyes sin verificar sube
 * (regresión). Es el latido que cierra el loop: junto con el guard anti-falso-
 * verde y el trigger de invalidación, garantiza que el backlog solo baje y que,
 * si algo lo hace subir (ley nueva sin verificar, drift), se detecte solo — sin
 * esperar a que lo reporte un usuario. Hermano de `check-boe-changes` (reforma
 * de fecha BOE), sin solaparse (esto es completitud + regionales).
 */
@Injectable()
export class LawCompletenessCron {
  private readonly logger = new Logger(LawCompletenessCron.name);
  public lastTickAtMs: number | null = null;

  constructor(
    private readonly service: LawCompletenessService,
    private readonly observability: ObservabilityService,
    heartbeatRegistry: HeartbeatRegistry,
  ) {
    heartbeatRegistry.register(
      'law-completeness-sweep',
      () => getLastTickMsAgo(this, 'lastTickAtMs'),
      { thresholdMs: 8 * 24 * 60 * 60 * 1000, gracePeriodMs: 120_000 },
    );
  }

  @Cron('0 9 * * 1', { name: 'law-completeness-sweep', timeZone: 'UTC' })
  async handle(): Promise<void> {
    await runWithHeartbeat(this, 'lastTickAtMs', async () => this.runImpl(), {
      name: 'law-completeness-sweep',
      observability: this.observability,
    });
  }

  private async runImpl(): Promise<void> {
    this.logger.log('Cron law-completeness-sweep disparado');
    const result = await this.service.runSweep();
    this.logger.log(
      `law-completeness-sweep OK: ${result.servingLive} sin verificar${result.regressed ? ' (⚠️ REGRESIÓN)' : ''}`,
    );
  }
}
