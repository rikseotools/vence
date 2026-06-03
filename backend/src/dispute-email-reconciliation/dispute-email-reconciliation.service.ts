import { Inject, Injectable, Logger } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../db/database.module';

/**
 * Reconciliación de notificaciones de impugnaciones (Gap 17 del manual de
 * observabilidad).
 *
 * Origen: incidente 03/06/2026 — `/api/v2/dispute/resolve` cerró la impugnación
 * de Eva (`cfc85dd3`) pero CloudFront/ALB cortó por timeout (502→504) antes de
 * `sendEmailV2`. El email NUNCA se intentó → 0 filas en `email_events`. El
 * monitoreo de email solo detecta `event_type='failed'` (intentado y fallido),
 * así que el "nunca intentado" era invisible.
 *
 * Esta invariante lo hace visible: TODA impugnación cerrada (`resolved`/
 * `rejected`) con `admin_response` no vacío debe tener su email registrado en
 * `email_events`, salvo skip legítimo. Distingue:
 *   - `real_drop`   → email permitido (soporte activo) pero SIN fila → fallo silencioso.
 *   - `expected_skip` → soporte desactivado o usuario sin email → skip correcto.
 *
 * El email de disputa es `email_type='impugnacion_respuesta'` (categoría
 * "soporte"), bloqueado solo por `email_preferences.email_soporte_disabled`.
 */
export interface DisputeEmailReconciliationResult {
  /** Impugnaciones cerradas (en ventana) SIN fila en email_events. */
  withoutEmail: number;
  /** Subconjunto sin email cuyo envío SÍ debía ocurrir → fallo silencioso. */
  realDrops: number;
  /** Sin email pero por skip legítimo (soporte off / sin email). */
  expectedSkips: number;
  sample: Array<{
    disputeId: string;
    userId: string;
    kind: string;
    email: string;
    resolvedAt: string;
  }>;
  durationMs: number;
}

interface ReconcileRow {
  dispute_id: string;
  user_id: string;
  kind: string;
  email: string | null;
  resolved_at: string;
  verdict: 'real_drop' | 'expected_skip' | 'no_user_email';
}

@Injectable()
export class DisputeEmailReconciliationService {
  private readonly logger = new Logger(DisputeEmailReconciliationService.name);

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async run(): Promise<DisputeEmailReconciliationResult> {
    const startedAt = Date.now();

    // Ventana: cerradas hace ≥10min (gracia para no pillar envíos en curso) y
    // ≤24h (más allá, ya no es accionable / el dato de email_events caduca).
    const res = (await this.db.execute(sql`
      WITH disputes AS (
        SELECT qd.id AS dispute_id, qd.user_id, qd.resolved_at,
               'legislative'::text AS kind
        FROM question_disputes qd
        WHERE qd.status IN ('resolved', 'rejected')
          AND qd.admin_response IS NOT NULL
          AND length(btrim(qd.admin_response)) > 0
          AND qd.resolved_at >= now() - interval '24 hours'
          AND qd.resolved_at <= now() - interval '10 minutes'
        UNION ALL
        SELECT pd.id, pd.user_id, pd.resolved_at, 'psychometric'::text
        FROM psychometric_question_disputes pd
        WHERE pd.status IN ('resolved', 'rejected')
          AND pd.admin_response IS NOT NULL
          AND length(btrim(pd.admin_response)) > 0
          AND pd.resolved_at >= now() - interval '24 hours'
          AND pd.resolved_at <= now() - interval '10 minutes'
      ),
      classified AS (
        SELECT
          d.dispute_id,
          d.user_id,
          d.kind,
          d.resolved_at,
          up.email,
          COALESCE(ep.email_soporte_disabled, false) AS soporte_disabled,
          EXISTS (
            SELECT 1 FROM email_events ee
            WHERE ee.email_address = up.email
              AND ee.email_type = 'impugnacion_respuesta'
              AND ee.created_at >= d.resolved_at - interval '2 minutes'
          ) AS has_email_event
        FROM disputes d
        JOIN user_profiles up ON up.id = d.user_id
        LEFT JOIN email_preferences ep ON ep.user_id = d.user_id
      )
      SELECT dispute_id, user_id, kind, email, resolved_at,
        CASE
          WHEN email IS NULL THEN 'no_user_email'
          WHEN soporte_disabled THEN 'expected_skip'
          ELSE 'real_drop'
        END AS verdict
      FROM classified
      WHERE has_email_event = false
      ORDER BY resolved_at DESC
    `)) as unknown as { rows?: ReconcileRow[] };

    const rows = (res.rows ??
      (res as unknown as ReconcileRow[]) ??
      []) as ReconcileRow[];

    const realDropRows = rows.filter((r) => r.verdict === 'real_drop');

    const result: DisputeEmailReconciliationResult = {
      withoutEmail: rows.length,
      realDrops: realDropRows.length,
      expectedSkips: rows.length - realDropRows.length,
      sample: realDropRows.slice(0, 20).map((r) => ({
        disputeId: r.dispute_id,
        userId: r.user_id,
        kind: r.kind,
        email: r.email ?? '',
        resolvedAt: String(r.resolved_at),
      })),
      durationMs: Date.now() - startedAt,
    };

    this.logger.log(
      `Reconciliation impugnaciones: ${result.realDrops} drops reales, ` +
        `${result.expectedSkips} skips esperados (de ${result.withoutEmail} sin email)`,
    );
    return result;
  }
}
