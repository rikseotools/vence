import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import {
  getLastTickMsAgo,
  runWithHeartbeat,
} from '../heartbeat/heartbeat.helpers';
import { HeartbeatRegistry } from '../heartbeat/heartbeat.registry';
import { ObservabilityService } from '../observability/observability.service';
import { LawSourceWatchService } from './law-source-watch.service';

/**
 * Disparador de `law-source-watch`. [T-380]
 *
 * Corre a las 08:30 UTC, media hora después de `check-boe-changes`, para no competir con él
 * por red ni por conexiones: son el mismo trabajo sobre poblaciones complementarias — aquel
 * vigila las leyes con texto consolidado en el BOE, este las que aquel excluye (sin `boe_url`,
 * URL `doc.php` o `scope=eu`).
 *
 * Va con heartbeat registrado a propósito: un vigilante cuya muerte no avisa es indistinguible
 * de no tener vigilante, que es la lección de [T-304] (tres meses de enforcement mudo porque
 * la AUSENCIA no dispara nada por sí sola).
 */
@Injectable()
export class LawSourceWatchCron {
  private readonly logger = new Logger(LawSourceWatchCron.name);
  public lastTickAtMs: number | null = null;

  constructor(
    private readonly service: LawSourceWatchService,
    private readonly observability: ObservabilityService,
    heartbeatRegistry: HeartbeatRegistry,
  ) {
    heartbeatRegistry.register(
      'law-source-watch',
      () => getLastTickMsAgo(this, 'lastTickAtMs'),
      { thresholdMs: 90_000_000, gracePeriodMs: 120_000 },
    );
  }

  @Cron('30 8 * * *', { name: 'law-source-watch', timeZone: 'UTC' })
  async handle(): Promise<void> {
    await runWithHeartbeat(this, 'lastTickAtMs', async () => this.runImpl(), {
      name: 'law-source-watch',
      observability: this.observability,
    });
  }

  private async runImpl(): Promise<void> {
    const startedAt = Date.now();
    try {
      const r = await this.service.run();
      await this.observability.emit({
        source: 'fargate',
        severity: 'info',
        eventType: 'cron_run',
        endpoint: 'law-source-watch',
        durationMs: Date.now() - startedAt,
        metadata: {
          status: 'success',
          revisadas: r.revisadas,
          lineaBase: r.lineaBase,
          sinCambio: r.sinCambio,
          cambiadas: r.cambiadas,
          inaccesibles: r.inaccesibles,
          // Los nombres van en el evento para que el aviso sea accionable sin abrir la BD.
          cambios: r.cambios.map((c) => c.shortName),
        },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Cron law-source-watch falló: ${errorMessage}`);
      await this.observability.emit({
        source: 'fargate',
        severity: 'error',
        eventType: 'cron_run',
        endpoint: 'law-source-watch',
        durationMs: Date.now() - startedAt,
        errorMessage,
        metadata: { status: 'error' },
      });
      throw error;
    }
  }
}
