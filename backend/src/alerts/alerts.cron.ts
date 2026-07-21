import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { CronScheduleService } from '../cron-schedule/cron-schedule.service';
import { DRIZZLE, DRIZZLE_READ, type DrizzleDB } from '../db/database.module';

// Capa 3 contención RDS (15/07): las reglas de alerta que MONITORIZAN el pool/pooler
// del PRIMARIO (leen pool_capacity_samples / pgbouncer_instance_samples = estado real de
// la instancia primaria) DEBEN ejecutarse contra el primario. En un incidente el lag de
// la réplica se dispara justo cuando estas alertas son más necesarias → leerlas de la
// réplica dejaría ciega la detección. El RESTO de reglas (agregan observable_events /
// validation_error_logs, toleran staleness sub-segundo) van a la réplica.
const PRIMARY_ONLY_RULES = new Set<string>([
  'pool_idle_in_tx_detected',
  'pool_hung_clientread_detected',
  'pool_frontend_saturation_high',
  'pool_sampler_stale',
  'pooler_instance_unreachable',
  'pooler_instance_degraded',
]);
import {
  getLastTickMsAgo,
  runWithHeartbeat,
} from '../heartbeat/heartbeat.helpers';
import { jitter } from '../heartbeat/jitter.helper';
import { HeartbeatRegistry } from '../heartbeat/heartbeat.registry';
import { ObservabilityService } from '../observability/observability.service';
import { ALERT_RULES, type AlertRuleContext } from './alert-rules';
import {
  DEPLOY_WINDOW_QUERY,
  evaluateDeployWindow,
  type DeployWindow,
  type DeployWindowRow,
} from './deploy-window';
import {
  NOTIFICATION_ADAPTER,
  type NotificationAdapter,
} from './notification-adapter';

/**
 * Rules engine de alertas activas.
 *
 * Bloque 4 Gap 8 del manual de observabilidad.
 *
 * Schedule: cada 5 min. Para cada regla:
 *   1. Ejecuta `query` SQL sobre la BD.
 *   2. Pasa resultado a `shouldFire(rows)`.
 *   3. Si dispara y NO está en cooldown, llama `buildNotification(rows)`
 *      y envía vía `NotificationAdapter.send()`.
 *
 * Cooldown: tracking in-memory de `lastFiredAt` por regla. Cuando el
 * proceso se reinicia (deploy ECS), todos los cooldowns se resetean —
 * aceptable porque el primer firing tras reinicio es señal útil
 * ("¿pasó algo durante el reinicio?"). Si crece a multi-task, mover el
 * tracking a Redis con TTL == cooldownMin.
 *
 * El propio cron emite `cron_run` a observable_events — meta-observability
 * (si las alertas dejan de funcionar, lo veremos en queries).
 */
@Injectable()
export class AlertsCron {
  private readonly logger = new Logger(AlertsCron.name);
  private readonly lastFiredAt = new Map<string, number>();
  public lastTickAtMs: number | null = null;

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    @Inject(DRIZZLE_READ) private readonly readDb: DrizzleDB,
    @Inject(NOTIFICATION_ADAPTER)
    private readonly notifier: NotificationAdapter,
    private readonly observability: ObservabilityService,
    private readonly cronSchedule: CronScheduleService,
    private readonly heartbeatRegistry: HeartbeatRegistry,
  ) {
    heartbeatRegistry.register(
      'alerts-engine',
      () => getLastTickMsAgo(this, 'lastTickAtMs'),
      { thresholdMs: 720_000, gracePeriodMs: 120_000 },
    );
  }

  @Cron('*/5 * * * *', { name: 'alerts-engine', timeZone: 'UTC' })
  async handle(): Promise<void> {
    // Jitter 0-30s: cron pesado (3.2s típico, 24 reglas SQL). Evita colisión
    // XX:25:00 UTC con refresh-rankings + 4 canaries en el mismo segundo.
    await jitter(30_000);
    await runWithHeartbeat(this, 'lastTickAtMs', async () => this.runImpl(), {
      name: 'alerts-engine',
      observability: this.observability,
    });
  }

  private async runImpl(): Promise<void> {
    const startedAt = Date.now();
    let fired = 0;
    let evaluated = 0;
    let skipped = 0;

    // Detectar ventana de deploy/churn UNA vez por tick (no por regla).
    // Fail-open: si la detección falla, la ventana queda inactiva → no se
    // suprime nada (preferimos alerta de más que silencio).
    let deployWindow: DeployWindow = { active: false, reasons: [] };
    try {
      const dwResult = await this.db.execute(DEPLOY_WINDOW_QUERY);
      const dwRows = (
        Array.isArray(dwResult) ? dwResult : []
      ) as DeployWindowRow[];
      deployWindow = evaluateDeployWindow(dwRows);
    } catch (err) {
      this.logger.warn(
        `Detección de ventana de deploy falló (fail-open, no suprime): ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    const ctx: AlertRuleContext = {
      cronSchedule: this.cronSchedule,
      deployWindow,
      processStartedAtMs: this.heartbeatRegistry.getProcessStartedAtMs(),
    };

    for (const rule of ALERT_RULES) {
      evaluated++;
      try {
        // Cooldown check
        const last = this.lastFiredAt.get(rule.name);
        if (last !== undefined) {
          const elapsedMin = (Date.now() - last) / 60_000;
          if (elapsedMin < rule.cooldownMin) {
            skipped++;
            continue;
          }
        }

        // Ejecutar query. Regla de pool/pooler → primario (monitoriza la instancia
        // real); resto → réplica (agregación que tolera staleness). Capa 3.
        const ruleDb = PRIMARY_ONLY_RULES.has(rule.name) ? this.db : this.readDb;
        const result = await ruleDb.execute(rule.query);
        // `result` es un Array de filas en postgres-js
        const rows = Array.isArray(result) ? result : [];

        if (!rule.shouldFire(rows, ctx)) continue;

        // Construir notificación
        const partial = rule.buildNotification(rows, ctx);

        // Enviar
        await this.notifier.send({
          rule: rule.name,
          severity: rule.severity,
          ...partial,
        });

        // Persistir el aviso disparado a observable_events (ADITIVO al email). Antes los
        // avisos SOLO se emaileaban → "revisa la salud" no podía ver qué había saltado y
        // muestreaba métricas crudas punto-por-punto, perdiéndose los spikes intermitentes
        // (incidente 21/07: declaré "sana" entre spikes mientras el email los cazaba).
        // Ahora quedan en `alert_fired`, consultables igual que la bandeja de entrada.
        // Fire-and-forget: no bloquea ni puede romper el envío que ya se hizo arriba.
        this.observability.emitFireAndForget({
          source: 'fargate',
          severity: rule.severity,
          eventType: 'alert_fired',
          endpoint: `alert:${rule.name}`,
          errorMessage: partial.title,
          metadata: {
            rule: rule.name,
            fingerprint: partial.fingerprint ?? rule.name,
            ...(partial.metadata ?? {}),
          },
        });

        this.lastFiredAt.set(rule.name, Date.now());
        fired++;
        this.logger.warn(
          `Regla '${rule.name}' [${rule.severity}] DISPARADA: ${partial.title}`,
        );
      } catch (err) {
        this.logger.error(
          `Regla '${rule.name}' falló: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    const durationMs = Date.now() - startedAt;
    if (fired > 0 || evaluated !== ALERT_RULES.length) {
      this.logger.log(
        `alerts-engine: ${fired} disparadas, ${skipped} en cooldown, ${evaluated}/${ALERT_RULES.length} evaluadas en ${durationMs}ms`,
      );
    }

    // Meta-observability — emitir nuestro propio run
    this.observability.emitFireAndForget({
      source: 'fargate',
      severity: 'info',
      eventType: 'cron_run',
      endpoint: 'alerts-engine',
      durationMs,
      metadata: {
        status: 'success',
        rulesEvaluated: evaluated,
        rulesFired: fired,
        rulesSkippedCooldown: skipped,
        deployWindowActive: deployWindow.active,
        deployWindowReasons: deployWindow.reasons,
      },
    });
  }
}
