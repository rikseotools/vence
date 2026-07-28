import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import {
  getLastTickMsAgo,
  runWithHeartbeat,
} from '../heartbeat/heartbeat.helpers';
import { HeartbeatRegistry } from '../heartbeat/heartbeat.registry';
import { ObservabilityService } from '../observability/observability.service';
import { ContentHealthSweepService } from './content-health-sweep.service';

/**
 * Disparador del barrido de salud del contenido/app.
 *
 * PORT del `scripts/health-sweep.cjs` que NUNCA tuvo scheduler (se quedó fuera de
 * la migración GHA→Fargate del 07/07 → el panel `/admin/contenido` quedaba
 * congelado, incidente 19/07). Job pesado in-process sin límite de duración.
 * Heartbeat diario: si deja de tickar, salta `cron_overdue` en el propio panel
 * de salud → el vigilante tiene quien lo vigile.
 *
 * ⏰ **07:30 UTC, y la hora IMPORTA: va DESPUÉS de `advance-estado` (06:30).**
 * Estaba a las 03:00 —elegida solo por ser un hueco sin colisión— y eso lo dejaba
 * FUERA de la cadena que el resto de sensores ya respetaba (`advance-estado` 06:30
 * → `detect-timeline-silence` 07:00 → `check-seguimiento` 09:00, «de modo que esos
 * sensores vean ya los estados al día»).
 *
 * Consecuencia medida el 28/07: el sweep fotografiaba los estados 3½ h ANTES de que
 * el sistema se autocorrigiera, así que el badge amanecía con 4 `convocatoria_estado_
 * incoherente` en rojo —«inscripción abierta con plazo vencido»— que `advance-estado`
 * cerraba solo a las 06:30. Cuatro falsos positivos CADA DÍA, que es como se enseña a
 * ignorar un panel. El detector se añadió al badge el 27/07 sin revisar esta cadena.
 *
 * Invariante fijado en `content-health-sweep.cron.spec.ts`: si alguien mueve un cron y
 * rompe el orden, salta el test.
 */
@Injectable()
export class ContentHealthSweepCron {
  private readonly logger = new Logger(ContentHealthSweepCron.name);
  public lastTickAtMs: number | null = null;

  constructor(
    private readonly service: ContentHealthSweepService,
    private readonly observability: ObservabilityService,
    heartbeatRegistry: HeartbeatRegistry,
  ) {
    // Daily cron → threshold 25h (tolera 1h de retraso).
    heartbeatRegistry.register(
      'content-health-sweep',
      () => getLastTickMsAgo(this, 'lastTickAtMs'),
      { thresholdMs: 90_000_000, gracePeriodMs: 120_000 },
    );
  }

  @Cron('30 7 * * *', { name: 'content-health-sweep', timeZone: 'UTC' })
  async handle(): Promise<void> {
    await runWithHeartbeat(this, 'lastTickAtMs', async () => this.runImpl(), {
      name: 'content-health-sweep',
      observability: this.observability,
    });
  }

  private async runImpl(): Promise<void> {
    this.logger.log('Cron content-health-sweep disparado');
    const startedAt = Date.now();
    try {
      const result = await this.service.run();
      await this.observability.emit({
        source: 'fargate',
        severity: 'info',
        eventType: 'cron_run',
        endpoint: 'content-health-sweep',
        durationMs: Date.now() - startedAt,
        metadata: {
          status: 'success',
          total: result.total,
          appError: result.appError,
          contentError: result.contentError,
          contentWarn: result.contentWarn,
          wrote: result.wrote,
          emailsSent: result.emailsSent,
        },
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Cron content-health-sweep falló: ${errorMessage}`);
      await this.observability.emit({
        source: 'fargate',
        severity: 'error',
        eventType: 'cron_run',
        endpoint: 'content-health-sweep',
        durationMs: Date.now() - startedAt,
        errorMessage,
        metadata: { status: 'failure' },
      });
    }
  }
}
