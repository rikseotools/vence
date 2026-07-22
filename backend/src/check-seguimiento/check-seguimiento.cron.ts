import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { Cron, SchedulerRegistry } from '@nestjs/schedule';
import {
  getLastTickMsAgo,
  runWithHeartbeat,
} from '../heartbeat/heartbeat.helpers';
import { HeartbeatRegistry } from '../heartbeat/heartbeat.registry';
import { ObservabilityService } from '../observability/observability.service';
import { CheckSeguimientoService } from './check-seguimiento.service';

/**
 * Disparador del cron `check-seguimiento` — **RETIRADO por defecto (20/07)**.
 *
 * ## Por qué se retira
 *
 * El sensor `hash_change` (detectar cambios de convocatoria hasheando la página de seguimiento)
 * es, con diferencia, el peor del radar multicapa. Medido el 20/07 sobre `oep_detection_signals`:
 *
 * | sensor            | aplicadas | útil |
 * |-------------------|-----------|------|
 * | pag_empleo        | 140       | 79%  |
 * | boe_api           | 33        | 60%  |
 * | timeline_silence  | 17        | 55%  |
 * | regional_scan     | 76        | 40%  |
 * | llm_semantic      | 137       | 35%  |
 * | **hash_change**   | **32**    | **4%** |
 *
 * 32 aciertos de 835 señales. Su emisión de señales ya se desconectó el **26/06** por redundante,
 * su panel `/admin/seguimiento-convocatorias` está marcado "solo histórica", y **nada aguas abajo
 * consume su resultado**: el detector semántico NO se dispara por el hash. Lo único que seguía
 * produciendo era ruido: 46 de 468 fuentes marcaban "cambio" a diario y 2.266 checks sin revisar.
 *
 * La cobertura real de cambios de convocatoria la dan `llm_semantic` (capa semántica),
 * `pag_empleo`, `boe_api` y `regional_scan`.
 *
 * ## Cómo revivirlo
 *
 * `CHECK_SEGUIMIENTO_ENABLED=true` en SSM. No hace falta tocar código. Al reactivarlo vuelve
 * también su heartbeat; mientras esté retirado NO se registra, para que el panel de salud no
 * dé rojo por un cron que hemos apagado a propósito.
 *
 * Horario cuando está activo: L-V a las 09:00 UTC.
 *
 * ## Por qué se DES-registra del SchedulerRegistry cuando está retirado (22/07)
 *
 * El decorador de cron registra SIEMPRE el job en `SchedulerRegistry` (el gate `isEnabled()`
 * vive dentro de `handle()`, se ejecuta demasiado tarde). La regla de alerta `cron_overdue`
 * (`alert-rules.ts` → `CronScheduleService.listCronJobs`) enumera ESE registro, no el heartbeat:
 * veía `check-seguimiento` con su expresión `0 9 * * 1-5`, comprobaba que no emitió `cron_run`
 * en su último tick y lo marcaba overdue → un `[Vence CRITICAL] cron overdue` CADA día laborable
 * durante 60 días (ventana de la query), pese a estar apagado a propósito (incidente 22/07).
 * Quitar solo el heartbeat (arriba) no bastaba. Por eso, si está retirado, en
 * `onApplicationBootstrap` (cuando el job ya está en el registro) lo BORRAMOS: desaparece de
 * `listCronJobs` → ni `cron_overdue` ni el panel de salud lo ven. Reactivar con el flag lo
 * vuelve a registrar con normalidad.
 */
@Injectable()
export class CheckSeguimientoCron implements OnApplicationBootstrap {
  private readonly logger = new Logger(CheckSeguimientoCron.name);
  public lastTickAtMs: number | null = null;

  constructor(
    private readonly service: CheckSeguimientoService,
    private readonly observability: ObservabilityService,
    heartbeatRegistry: HeartbeatRegistry,
    private readonly schedulerRegistry: SchedulerRegistry,
  ) {
    // Solo se vigila si el cron está activo: registrar el heartbeat de un cron retirado
    // haría que el panel de salud diese ROJO a los 4 días por un job que apagamos a propósito.
    if (CheckSeguimientoCron.isEnabled()) {
      // L-V daily → threshold 4 días.
      heartbeatRegistry.register(
        'check-seguimiento',
        () => getLastTickMsAgo(this, 'lastTickAtMs'),
        { thresholdMs: 345_600_000, gracePeriodMs: 120_000 },
      );
    } else {
      this.logger.log(
        'check-seguimiento RETIRADO (sensor hash_change: 4% de acierto). ' +
          'Reactivar con CHECK_SEGUIMIENTO_ENABLED=true.',
      );
    }
  }

  /**
   * Cuando está retirado, des-registrar el job del `SchedulerRegistry` para que
   * NO lo vea `cron_overdue` (que enumera el registro, no el heartbeat). Se hace en
   * `onApplicationBootstrap` porque el `ScheduleExplorer` añade los jobs en su
   * `onModuleInit` (antes de este hook), así que aquí el job ya existe. Best-effort:
   * si no estuviera registrado, `deleteCronJob` lanza → lo tragamos (idempotente).
   */
  onApplicationBootstrap(): void {
    if (CheckSeguimientoCron.isEnabled()) return;
    try {
      this.schedulerRegistry.deleteCronJob('check-seguimiento');
      this.logger.log(
        'check-seguimiento des-registrado del SchedulerRegistry (retirado) ' +
          '→ silenciado en cron_overdue y panel de salud.',
      );
    } catch {
      // Ya no estaba registrado (o el explorer no lo añadió): nada que hacer.
    }
  }

  /** El sensor está retirado salvo que se pida explícitamente. */
  static isEnabled(): boolean {
    return process.env.CHECK_SEGUIMIENTO_ENABLED === 'true';
  }

  @Cron('0 9 * * 1-5', { name: 'check-seguimiento', timeZone: 'UTC' })
  async handle(): Promise<void> {
    if (!CheckSeguimientoCron.isEnabled()) return; // retirado — ver cabecera
    await runWithHeartbeat(this, 'lastTickAtMs', async () => this.runImpl(), {
      name: 'check-seguimiento',
      observability: this.observability,
    });
  }

  private async runImpl(): Promise<void> {
    this.logger.log('Cron check-seguimiento disparado');
    const startedAt = Date.now();
    try {
      const result = await this.service.run();
      this.observability.emitFireAndForget({
        source: 'fargate',
        severity: 'info',
        eventType: 'cron_run',
        endpoint: 'check-seguimiento',
        durationMs: Date.now() - startedAt,
        metadata: {
          status: 'success',
          total: result.total,
          checked: result.checked,
          changed: result.changed,
          errors: result.errors,
          unchanged: result.unchanged,
        },
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Cron check-seguimiento falló: ${errorMessage}`);
      this.observability.emitFireAndForget({
        source: 'fargate',
        severity: 'error',
        eventType: 'cron_run',
        endpoint: 'check-seguimiento',
        durationMs: Date.now() - startedAt,
        errorMessage,
        metadata: { status: 'failure' },
      });
    }
  }
}
