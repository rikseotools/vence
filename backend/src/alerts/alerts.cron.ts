import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DRIZZLE, type DrizzleDB } from '../db/database.module';
import { ObservabilityService } from '../observability/observability.service';
import { ALERT_RULES, type AlertRule } from './alert-rules';
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

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    @Inject(NOTIFICATION_ADAPTER)
    private readonly notifier: NotificationAdapter,
    private readonly observability: ObservabilityService,
  ) {}

  @Cron('*/5 * * * *', { name: 'alerts-engine', timeZone: 'UTC' })
  async handle(): Promise<void> {
    const startedAt = Date.now();
    let fired = 0;
    let evaluated = 0;
    let skipped = 0;

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

        // Ejecutar query
        const result = await this.db.execute(rule.query);
        // `result` es un Array de filas en postgres-js
        const rows = Array.isArray(result) ? result : [];

        if (!rule.shouldFire(rows)) continue;

        // Construir notificación
        const partial = rule.buildNotification(rows);

        // Enviar
        await this.notifier.send({
          rule: rule.name,
          severity: rule.severity,
          ...partial,
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
      },
    });
  }
}
