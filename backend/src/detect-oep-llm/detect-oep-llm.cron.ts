import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { Cron, SchedulerRegistry } from '@nestjs/schedule';
import {
  getLastTickMsAgo,
  runWithHeartbeat,
} from '../heartbeat/heartbeat.helpers';
import { HeartbeatRegistry } from '../heartbeat/heartbeat.registry';
import { ObservabilityService } from '../observability/observability.service';
import { DetectOepLlmService } from './detect-oep-llm.service';

/**
 * Disparador del cron `detect-oep-llm`.
 *
 * Equivale al endpoint `app/api/cron/detect-oep-llm/route.ts`.
 * Schedule: L-V a las 10:00 UTC.
 *
 * ## Interruptor de gasto (27/07/2026)
 *
 * Este sensor manda a Claude Haiku el HTML de **todas** las oposiciones con
 * `seguimiento_url` — 2.213 filas, de las que solo 123 están activas — una por
 * llamada. Medido: **~1.700 llamadas y ~$8 por día laborable** (~$170/mes), y
 * una pasada completa dura ~169 min. El rendimiento de la última pasada entera
 * (24/07) fue **2.206 escaneadas → 424 extracciones → 10 señales**.
 *
 * ⚠️ El desperdicio NO son las oposiciones inactivas: medido a 60 días, las no
 * activas generan **98 señales aplicadas** frente a **43** de las activas —
 * descubrir convocatorias que aún no preparamos ES el trabajo del radar, así
 * que el recorte que se le hizo a `detect-notas-convocatoria` (limitar a
 * `is_active`) aquí sería un error. El desperdicio real es **re-extraer con LLM
 * páginas que no han cambiado**: el propio servicio ya tiene
 * `OepSignalsLlmService.computeContentHash()` y este sensor NUNCA lo llama.
 *
 * Se apaga con `DETECT_OEP_LLM_ENABLED=false`, fijado en `scripts/deploy-backend.sh`
 * (mismo sitio que `CHECK_SEGUIMIENTO_ENABLED`, y por el mismo motivo: parchear
 * la task viva a mano no sobrevive a una recreación del servicio y nadie sabe
 * luego por qué está así). Cambiar el valor exige editar ese script y desplegar.
 * **Por defecto sigue ENCENDIDO**: un flag que por defecto apaga convertiría
 * cualquier entorno nuevo en un radar mudo sin que nadie lo pidiera. Esto es una
 * PAUSA explícita y visible mientras se implementa la puerta de hash, no una
 * retirada — cuando el gate esté, el flag vuelve a `true` y el coste baja solo.
 *
 * ## Por qué se DES-registra del SchedulerRegistry cuando está en pausa
 *
 * Mismo motivo que en `check-seguimiento.cron.ts` (incidente 22/07): el
 * decorador registra SIEMPRE el job, y `cron_overdue` enumera ESE registro —
 * vería un cron que no emite `cron_run` y dispararía un CRITICAL cada día
 * laborable por algo que hemos apagado a propósito. Lo mismo valdría para
 * `cron_started_not_finished`. Al borrarlo del registro desaparece de
 * `listCronJobs()` y ninguna de las dos reglas lo ve.
 */
@Injectable()
export class DetectOepLlmCron implements OnApplicationBootstrap {
  private readonly logger = new Logger(DetectOepLlmCron.name);
  public lastTickAtMs: number | null = null;

  constructor(
    private readonly service: DetectOepLlmService,
    private readonly observability: ObservabilityService,
    heartbeatRegistry: HeartbeatRegistry,
    private readonly schedulerRegistry: SchedulerRegistry,
  ) {
    // Igual que check-seguimiento: no registrar el heartbeat de un cron en
    // pausa, o el panel de salud daría rojo por un job apagado a propósito.
    if (DetectOepLlmCron.isEnabled()) {
      heartbeatRegistry.register(
        'detect-oep-llm',
        () => getLastTickMsAgo(this, 'lastTickAtMs'),
        { thresholdMs: 345_600_000, gracePeriodMs: 120_000 },
      );
    } else {
      this.logger.warn(
        'detect-oep-llm EN PAUSA por coste (~$8/día laborable en Haiku). ' +
          'Reactivar con DETECT_OEP_LLM_ENABLED=true.',
      );
    }
  }

  onApplicationBootstrap(): void {
    if (DetectOepLlmCron.isEnabled()) return;
    try {
      this.schedulerRegistry.deleteCronJob('detect-oep-llm');
      this.logger.log(
        'detect-oep-llm des-registrado del SchedulerRegistry (en pausa) ' +
          '→ silenciado en cron_overdue / cron_started_not_finished.',
      );
    } catch {
      // Ya no estaba registrado: idempotente, nada que hacer.
    }
  }

  /**
   * Encendido salvo que se pida apagarlo explícitamente (por defecto ON: ver
   * cabecera — un default OFF dejaría el radar mudo en cualquier entorno nuevo).
   */
  static isEnabled(): boolean {
    return process.env.DETECT_OEP_LLM_ENABLED !== 'false';
  }

  @Cron('0 10 * * 1-5', { name: 'detect-oep-llm', timeZone: 'UTC' })
  async handle(): Promise<void> {
    if (!DetectOepLlmCron.isEnabled()) return; // en pausa — ver cabecera
    await runWithHeartbeat(this, 'lastTickAtMs', async () => this.runImpl(), {
      name: 'detect-oep-llm',
      observability: this.observability,
    });
  }

  private async runImpl(): Promise<void> {
    this.logger.log('Cron detect-oep-llm disparado');
    const startedAt = Date.now();
    try {
      const result = await this.service.run();
      await this.observability.emit({
        source: 'fargate',
        severity: 'info',
        eventType: 'cron_run',
        endpoint: 'detect-oep-llm',
        durationMs: Date.now() - startedAt,
        metadata: {
          status: 'success',
          total: result.total,
          scanned: result.scanned,
          withExtraction: result.withExtraction,
          signals: result.signals,
          errors: result.errors,
        },
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Cron detect-oep-llm falló: ${errorMessage}`);
      await this.observability.emit({
        source: 'fargate',
        severity: 'error',
        eventType: 'cron_run',
        endpoint: 'detect-oep-llm',
        durationMs: Date.now() - startedAt,
        errorMessage,
        metadata: { status: 'failure' },
      });
    }
  }
}
