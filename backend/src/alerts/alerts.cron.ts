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
import {
  LAST_FIRED_QUERY,
  isInCooldown,
  mergeLastFired,
  parseLastFired,
  type LastFiredRow,
} from './alert-cooldown';

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
 * Cooldown: `lastFiredAt` por regla, PERSISTIDO en `observable_events`
 * (T-258). Hasta el 29/07 vivía solo en memoria del proceso y cada reinicio
 * —cada deploy— lo borraba, así que el canal de email se volvía spam:
 * `canary_pdf_queue_failed` disparó 37 veces en 31 h con `cooldownMin: 60`,
 * cuando el techo teórico eran 31. Ahora se hidrata por tick desde los propios
 * `alert_fired` que este cron ya escribe, lo que además lo hace correcto con
 * varias instancias (el caso que esta cabecera dejaba pendiente para Redis)
 * sin infraestructura nueva. Fail-open: si la consulta falla se sigue con el
 * Map en memoria, es decir, el comportamiento de antes del cambio.
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
    // De los silenciados, cuántos lo están GRACIAS a la persistencia (el proceso
    // no tenía memoria de ese disparo). Es la medida directa del spam evitado:
    // sin T-258 estos habrían mandado correo.
    let skippedPorPersistencia = 0;

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

    // Cooldown persistido (T-258). Se hidrata desde los `alert_fired` que este
    // mismo cron escribe, para que un reinicio del proceso no reabra el grifo.
    // Fail-open: si la consulta falla nos quedamos con el Map en memoria, que
    // es exactamente el comportamiento anterior al cambio.
    let cooldownHidratado = false;
    let lastFired = new Map(this.lastFiredAt);
    try {
      const lfResult = await this.readDb.execute(LAST_FIRED_QUERY);
      const lfRows = (Array.isArray(lfResult) ? lfResult : []) as LastFiredRow[];
      lastFired = mergeLastFired(this.lastFiredAt, parseLastFired(lfRows));
      cooldownHidratado = true;
    } catch (err) {
      this.logger.warn(
        `Hidratación del cooldown falló (fail-open, se usa el estado en memoria): ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    for (const rule of ALERT_RULES) {
      evaluated++;
      try {
        // Cooldown check — contra el estado hidratado (memoria ∪ BD), no solo memoria.
        if (isInCooldown(lastFired.get(rule.name), rule.cooldownMin, Date.now())) {
          skipped++;
          if (!this.lastFiredAt.has(rule.name)) skippedPorPersistencia++;
          continue;
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
        lastFired.set(rule.name, Date.now());
        fired++;
        this.logger.warn(
          `Regla '${rule.name}' [${rule.severity}] DISPARADA: ${partial.title}`,
        );
      } catch (err) {
        // ⚠️ QUIÉN VIGILA AL VIGILANTE (27/07/2026, cabo de T-162).
        // Hasta hoy esto era SOLO una línea de log, y por eso `traffic_drop`
        // (255 fallos), `cron_overdue` (132) y `materialized_stats_stale` (110)
        // llevaban MÁS DE UN DÍA sin evaluarse sin que nadie se enterara: el
        // panel de salud y las alertas leen `observable_events`, y aquí no se
        // escribía nada. Una regla caída es indistinguible de una regla que no
        // dispara — el peor modo de fallo posible en un motor de alertas.
        //
        // Ahora el fallo queda en la tabla, consultable como cualquier otra
        // señal y disponible para que una regla lo alerte
        // (RULE_ALERT_RULE_FAILING). Fire-and-forget: nunca puede tumbar el
        // tick ni convertir un fallo de una regla en un fallo del motor.
        //
        // `cause` se emite aparte a propósito: Drizzle envuelve el error en
        // "Failed query: <sql>" y el mensaje del driver (el que dice si fue
        // timeout, sintaxis o conflicto de recovery) queda DENTRO de `cause`.
        // Sin desenvolverlo, el diagnóstico obliga a reproducir a mano — que es
        // exactamente lo que costó media tarde el 27/07.
        const msg = err instanceof Error ? err.message : String(err);
        const cause =
          err instanceof Error && err.cause instanceof Error
            ? err.cause.message
            : undefined;
        this.logger.error(
          `Regla '${rule.name}' falló: ${msg}${cause ? ` | causa: ${cause}` : ''}`,
        );
        this.observability.emitFireAndForget({
          source: 'fargate',
          severity: 'error',
          eventType: 'alert_rule_failed',
          endpoint: `alert:${rule.name}`,
          errorMessage: cause ?? msg,
          metadata: { rule: rule.name, cause, message: msg.slice(0, 500) },
        });
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
        // T-258: el silencio también se mide. Sin esto, "no dispara" y "está
        // callado a propósito" son indistinguibles desde fuera — y un motor de
        // alertas que se calla sin dejar rastro es el fallo de T-162 otra vez.
        rulesSkippedByPersistedCooldown: skippedPorPersistencia,
        cooldownHydrated: cooldownHidratado,
        deployWindowActive: deployWindow.active,
        deployWindowReasons: deployWindow.reasons,
      },
    });
  }
}
