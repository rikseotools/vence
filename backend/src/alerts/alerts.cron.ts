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
import {
  EMAIL_HISTORY_QUERY,
  decideEmail,
  parseEmailHistory,
  parseMinSeverity,
  problemKey,
  type AlertSeverity,
  type EmailHistoryRow,
} from './email-policy';
import type { AlertNotification } from './notification-adapter';

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
 * Política de EMAIL (T-272, 30/07): que una regla DISPARE y que además mande
 * CORREO son dos decisiones distintas. El cooldown gobierna la primera; la
 * segunda la decide `email-policy.ts` (severidad mínima + backoff por problema)
 * y los supervivientes del tick viajan en UN correo. Motivo: 392 correos en 7
 * días para 28 problemas distintos = 14 por problema; a ese ritmo el correo de
 * la caída real llega al mismo sitio que el ruido. **El disparo se sigue
 * registrando siempre** (`alert_fired` con `emailed`/`emailSkipped` dentro): si
 * se suprimiera la señal y no el correo, el panel dejaría de ver que el problema
 * sigue vivo — el modo de fallo de T-162.
 *
 * El propio cron emite `cron_run` a observable_events — meta-observability
 * (si las alertas dejan de funcionar, lo veremos en queries).
 */
@Injectable()
export class AlertsCron {
  private readonly logger = new Logger(AlertsCron.name);
  private readonly lastFiredAt = new Map<string, number>();
  public lastTickAtMs: number | null = null;

  /**
   * Severidad mínima que llega al buzón. Env para poder cambiar de criterio sin
   * desplegar código (`ALERT_EMAIL_MIN_SEVERITY=warn` devuelve el
   * comportamiento anterior a T-272). Un valor inválido cae al default en vez de
   * apagar el canal — un typo no puede dejar a nadie sin avisos.
   */
  private readonly minEmailSeverity: AlertSeverity;

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    @Inject(DRIZZLE_READ) private readonly readDb: DrizzleDB,
    @Inject(NOTIFICATION_ADAPTER)
    private readonly notifier: NotificationAdapter,
    private readonly observability: ObservabilityService,
    private readonly cronSchedule: CronScheduleService,
    private readonly heartbeatRegistry: HeartbeatRegistry,
  ) {
    this.minEmailSeverity = parseMinSeverity(
      process.env.ALERT_EMAIL_MIN_SEVERITY,
    );
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
      const lfRows = (
        Array.isArray(lfResult) ? lfResult : []
      ) as LastFiredRow[];
      lastFired = mergeLastFired(this.lastFiredAt, parseLastFired(lfRows));
      cooldownHidratado = true;
    } catch (err) {
      this.logger.warn(
        `Hidratación del cooldown falló (fail-open, se usa el estado en memoria): ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    // Historial de lo YA EMAILEADO por problema, para el backoff (T-272).
    // Fail-open a propósito: sin historial legible se emailea, que es el
    // comportamiento anterior. Un motor que se calla porque no pudo leer su
    // propio historial sería peor que el spam que esto arregla.
    let emailHistory = new Map<string, number[]>();
    let emailHistoryHidratado = false;
    try {
      const ehResult = await this.readDb.execute(EMAIL_HISTORY_QUERY);
      const ehRows = (
        Array.isArray(ehResult) ? ehResult : []
      ) as EmailHistoryRow[];
      emailHistory = parseEmailHistory(ehRows);
      emailHistoryHidratado = true;
    } catch (err) {
      this.logger.warn(
        `Hidratación del historial de email falló (fail-open, se emailea): ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    // Avisos de ESTE tick que van al buzón. Se acumulan y salen en un correo al
    // final: un incidente que enciende 6 reglas es 1 correo, no 6.
    const paraEnviar: AlertNotification[] = [];
    let emailsSuprimidosPorSeveridad = 0;
    let emailsSuprimidosPorBackoff = 0;

    for (const rule of ALERT_RULES) {
      evaluated++;
      try {
        // Cooldown check — contra el estado hidratado (memoria ∪ BD), no solo memoria.
        if (
          isInCooldown(lastFired.get(rule.name), rule.cooldownMin, Date.now())
        ) {
          skipped++;
          if (!this.lastFiredAt.has(rule.name)) skippedPorPersistencia++;
          continue;
        }

        // Ejecutar query. Regla de pool/pooler → primario (monitoriza la instancia
        // real); resto → réplica (agregación que tolera staleness). Capa 3.
        const ruleDb = PRIMARY_ONLY_RULES.has(rule.name)
          ? this.db
          : this.readDb;
        const result = await ruleDb.execute(rule.query);
        // `result` es un Array de filas en postgres-js
        const rows = Array.isArray(result) ? result : [];

        if (!rule.shouldFire(rows, ctx)) continue;

        // Construir notificación
        const partial = rule.buildNotification(rows, ctx);
        const fingerprint = partial.fingerprint ?? rule.name;

        // ¿Además de disparar, va por correo? (T-272). El disparo ya está
        // decidido; esto solo elige el canal, y queda registrado abajo.
        const decision = decideEmail({
          severity: rule.severity,
          minSeverity: this.minEmailSeverity,
          emailAlways: rule.emailAlways,
          sentAtMs: emailHistory.get(problemKey(rule.name, fingerprint)),
          nowMs: Date.now(),
        });

        if (decision.email) {
          paraEnviar.push({
            rule: rule.name,
            severity: rule.severity,
            ...partial,
          });
          // Se apunta YA en el historial en memoria para que dos reglas con el
          // mismo fingerprint en el mismo tick no cuenten como dos correos.
          const clave = problemKey(rule.name, fingerprint);
          emailHistory.set(clave, [
            ...(emailHistory.get(clave) ?? []),
            Date.now(),
          ]);
        } else if (decision.skippedBy === 'severity') {
          emailsSuprimidosPorSeveridad++;
        } else {
          emailsSuprimidosPorBackoff++;
        }

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
            fingerprint,
            // T-272: `alert_fired` ya NO es 1:1 con la bandeja de entrada, así
            // que la diferencia tiene que estar EN el dato, no en la cabeza de
            // nadie. La bandeja es `emailed = 'true'`; el resto es señal que
            // solo vive en el panel, con el motivo del silencio al lado.
            emailed: decision.email,
            emailSkipped: decision.skippedBy,
            emailStreak: decision.racha,
            ...(decision.faltanMin !== undefined
              ? { emailNextInMin: decision.faltanMin }
              : {}),
            ...(partial.metadata ?? {}),
          },
        });

        this.lastFiredAt.set(rule.name, Date.now());
        lastFired.set(rule.name, Date.now());
        fired++;
        this.logger.warn(
          `Regla '${rule.name}' [${rule.severity}] DISPARADA: ${partial.title}` +
            (decision.email
              ? ''
              : ` · correo OMITIDO (${decision.skippedBy}${
                  decision.faltanMin ? `, faltan ${decision.faltanMin}min` : ''
                })`),
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

    // UN correo con todo lo que sobrevivió a la política. Fuera del bucle a
    // propósito: es lo que funde en un solo aviso el incidente que enciende
    // varias reglas a la vez.
    if (paraEnviar.length) {
      try {
        await this.notifier.send(paraEnviar);
      } catch (err) {
        // El adapter promete no lanzar, pero si el canal se rompe de otra forma
        // el fallo NO puede quedarse en un log: sin esto, "no llegó el correo"
        // sería indistinguible de "no había nada que avisar" — el mismo modo de
        // fallo que T-162. Con la señal, `senal_error_sin_vigilancia` lo ve.
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error(`Envío del lote de alertas falló: ${msg}`);
        this.observability.emitFireAndForget({
          source: 'fargate',
          severity: 'error',
          eventType: 'alert_email_failed',
          endpoint: 'alerts-engine',
          errorMessage: msg,
          metadata: {
            avisos: paraEnviar.length,
            reglas: paraEnviar.map((n) => n.rule),
          },
        });
      }
    }

    const durationMs = Date.now() - startedAt;
    if (fired > 0 || evaluated !== ALERT_RULES.length) {
      this.logger.log(
        `alerts-engine: ${fired} disparadas, ${skipped} en cooldown, ` +
          `${paraEnviar.length ? 1 : 0} correo(s) con ${paraEnviar.length} aviso(s), ` +
          `${emailsSuprimidosPorSeveridad} sin correo por severidad, ${emailsSuprimidosPorBackoff} por backoff, ` +
          `${evaluated}/${ALERT_RULES.length} evaluadas en ${durationMs}ms`,
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
        // T-272: el canal de email también se mide. `emailsSent` es el número de
        // CORREOS (0 o 1 por tick), `emailAlertsBatched` los avisos que iban
        // dentro — su diferencia es lo que ahorró la agrupación. Sin estas tres
        // cifras, "hoy me han llegado menos correos" no se puede distinguir de
        // "el canal está roto y no manda nada".
        emailsSent: paraEnviar.length ? 1 : 0,
        emailAlertsBatched: paraEnviar.length,
        emailsSkippedBySeverity: emailsSuprimidosPorSeveridad,
        emailsSkippedByBackoff: emailsSuprimidosPorBackoff,
        emailMinSeverity: this.minEmailSeverity,
        emailHistoryHydrated: emailHistoryHidratado,
        deployWindowActive: deployWindow.active,
        deployWindowReasons: deployWindow.reasons,
      },
    });
  }
}
