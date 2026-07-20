import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import {
  getLastTickMsAgo,
  runWithHeartbeat,
} from '../heartbeat/heartbeat.helpers';
import { HeartbeatRegistry } from '../heartbeat/heartbeat.registry';
import { ObservabilityService } from '../observability/observability.service';
import { InternalCronTriggersService } from './internal-cron-triggers.service';

/**
 * Migración de crons nocturnos de GitHub Actions → Fargate (AWS-native).
 *
 * Cada @Cron dispara el MISMO endpoint Next que disparaba su workflow GHA, a la
 * MISMA hora y con los MISMOS parámetros → comportamiento idéntico. Al activar
 * esto se DESACTIVA el workflow GHA correspondiente (swap atómico) para no
 * duplicar. Los 3 primeros migrados son idempotentes (read-only + observabilidad),
 * así que un solapamiento puntual en la transición es inocuo.
 *
 * Threshold heartbeat: daily (25h). Si un trigger deja de tickar, salta cron_overdue.
 */
@Injectable()
export class InternalCronTriggersCron {
  private readonly logger = new Logger(InternalCronTriggersCron.name);
  public statsDriftTickMs: number | null = null;
  public examIntegrityTickMs: number | null = null;
  public auditEstadosTickMs: number | null = null;
  public closeInactiveFeedbackTickMs: number | null = null;
  public renewalRemindersTickMs: number | null = null;

  constructor(
    private readonly service: InternalCronTriggersService,
    private readonly observability: ObservabilityService,
    heartbeatRegistry: HeartbeatRegistry,
  ) {
    const daily = { thresholdMs: 90_000_000, gracePeriodMs: 120_000 };
    heartbeatRegistry.register('trigger-check-stats-drift', () => getLastTickMsAgo(this, 'statsDriftTickMs'), daily);
    heartbeatRegistry.register('trigger-check-exam-integrity', () => getLastTickMsAgo(this, 'examIntegrityTickMs'), daily);
    heartbeatRegistry.register('trigger-audit-estados', () => getLastTickMsAgo(this, 'auditEstadosTickMs'), daily);
    heartbeatRegistry.register('trigger-close-inactive-feedback', () => getLastTickMsAgo(this, 'closeInactiveFeedbackTickMs'), daily);
    heartbeatRegistry.register('trigger-renewal-reminders', () => getLastTickMsAgo(this, 'renewalRemindersTickMs'), daily);
  }

  // 04:00 UTC — antes: .github/workflows/check-stats-drift.yml
  // SIN ?sample: usa el DEFAULT_SAMPLE_SIZE del endpoint (20), fuente única.
  // El ?sample=50 heredado del workflow GHA reactivaba el timeout del gateway
  // (~16s con 50, >8s de límite) → cron_error diario. El endpoint ya bajó a 20
  // el 26/05 (RPC O(N), postmortem #113); forzar 50 aquí deshacía ese arreglo.
  @Cron('0 4 * * *', { name: 'trigger-check-stats-drift', timeZone: 'UTC' })
  async statsDrift(): Promise<void> {
    await runWithHeartbeat(this, 'statsDriftTickMs', () => this.run('/api/cron/check-stats-drift', 'check-stats-drift'), {
      name: 'trigger-check-stats-drift',
      observability: this.observability,
    });
  }

  // 04:30 UTC — antes: .github/workflows/check-exam-integrity.yml
  @Cron('30 4 * * *', { name: 'trigger-check-exam-integrity', timeZone: 'UTC' })
  async examIntegrity(): Promise<void> {
    await runWithHeartbeat(this, 'examIntegrityTickMs', () => this.run('/api/cron/check-exam-integrity?window=24', 'check-exam-integrity'), {
      name: 'trigger-check-exam-integrity',
      observability: this.observability,
    });
  }

  // 05:00 UTC — antes: .github/workflows/audit-estados.yml
  @Cron('0 5 * * *', { name: 'trigger-audit-estados', timeZone: 'UTC' })
  async auditEstados(): Promise<void> {
    await runWithHeartbeat(this, 'auditEstadosTickMs', () => this.run('/api/cron/audit-estados', 'audit-estados'), {
      name: 'trigger-audit-estados',
      observability: this.observability,
    });
  }

  // 04:00 UTC — antes: .github/workflows/close-inactive-feedback.yml
  // Idempotente: solo cierra conversaciones inactivas (waiting_user/open/
  // waiting_admin); una 2ª pasada no re-cierra (ya no matchean). Sin emails.
  @Cron('0 4 * * *', { name: 'trigger-close-inactive-feedback', timeZone: 'UTC' })
  async closeInactiveFeedback(): Promise<void> {
    await runWithHeartbeat(this, 'closeInactiveFeedbackTickMs', () => this.run('/api/cron/close-inactive-feedback', 'close-inactive-feedback'), {
      name: 'trigger-close-inactive-feedback',
      observability: this.observability,
    });
  }

  // 09:00 UTC — antes: .github/workflows/renewal-reminders.yml
  // ENVÍA EMAILS (Resend, vía el endpoint). Idempotente entre días: el endpoint
  // guarda emailLogs y salta ('already_sent') si envió en los últimos 5 días.
  // Doble-envío solo posible por race si GHA+Fargate disparan el MISMO día → se
  // evita con swap atómico (GHA .DISABLED al activar esto). El backend NO
  // necesita RESEND_API_KEY: solo dispara el endpoint (que envía con su Resend).
  @Cron('0 9 * * *', { name: 'trigger-renewal-reminders', timeZone: 'UTC' })
  async renewalReminders(): Promise<void> {
    await runWithHeartbeat(this, 'renewalRemindersTickMs', () => this.run('/api/cron/renewal-reminders', 'renewal-reminders'), {
      name: 'trigger-renewal-reminders',
      observability: this.observability,
    });
  }

  private async run(path: string, label: string): Promise<void> {
    const startedAt = Date.now();
    const r = await this.service.trigger(path);
    if (r.ok) {
      this.logger.log(`trigger ${label} OK (${r.status})`);
      return;
    }
    // El endpoint respondió no-2xx → emitir a observable_events (el propio
    // endpoint ya emite sus hallazgos; esto señala que el DISPARO falló).
    this.logger.warn(`trigger ${label} FALLÓ (${r.status})`);
    await this.observability.emit({
      source: 'fargate',
      severity: 'error',
      eventType: 'cron_http_trigger_failed',
      endpoint: `trigger-${label}`,
      durationMs: Date.now() - startedAt,
      errorMessage: `Disparo de ${label} devolvió HTTP ${r.status}`,
      metadata: { path, status: r.status, body: r.body },
    });
  }
}
