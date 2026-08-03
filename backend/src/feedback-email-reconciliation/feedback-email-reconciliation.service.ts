import { Inject, Injectable, Logger } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../db/database.module';
import {
  clasificarVerdicto,
  esDropReal,
} from '../dispute-email-reconciliation/verdict';

/**
 * Reconciliación de las respuestas a FEEDBACK ([T-501]).
 *
 * Gemelo de `dispute-email-reconciliation`, para el hueco que aquella ficha dejó escrito y
 * no cubría: *«el mismo salto silencioso existe para las respuestas a feedback
 * (`soporte_respuesta`) y ahí no hay reconciliador ninguno, así que nadie lo vería»*.
 *
 * Lo medido el 03/08/2026 antes de construir esto (90 días): **532 respuestas de admin, 43
 * sin fila en `email_events`** — un 8%. De esas 43, **42 se cortaron antes de enviar** (gate
 * de preferencias, `sendEmail:false` o los 5 segundos de «está mirando la app») y **1 era
 * una pérdida real**: a `garciamoyanoraquel7179@` se le contestó el 14/07 cómo evitar el
 * siguiente cobro de su plan, el envío pasó el gate (hay token) y el correo nunca salió.
 * Nadie se enteró en 20 días. Filosofía martillo: eso es un fallo de la observabilidad.
 *
 * DIFERENCIAS con el gemelo, que no son de estilo:
 *  1. **La unidad es el MENSAJE, no el feedback.** Una conversación tiene N respuestas de
 *     admin (mediana 1, pero hay hilos de 4-6). Reconciliar por `user_feedback.resolved_at`
 *     daría por buena la conversación entera en cuanto UNA de sus respuestas saliera.
 *  2. **Usa el token de baja como segunda evidencia** (ver `verdict.ts`). Aquí hace falta
 *     más que allí: el camino de feedback tiene DOS saltos legítimos que el de
 *     impugnaciones no tiene (`sendEmail:false` y `user_actively_browsing`), y el segundo
 *     depende de una ventana de CINCO SEGUNDOS sobre `user_sessions.updated_at` — la
 *     condición más efímera del sistema, imposible de releer después. Sin el token, esos
 *     saltos y una pérdida real se ven idénticos.
 *
 * Detección pura: sin red y sin escrituras. No reenvía nada — reenviar una respuesta vieja
 * es peor que no hacerlo (decisión de Manuel, 03/08); esto sirve para enterarse a tiempo.
 */
export interface FeedbackEmailReconciliationResult {
  /** Respuestas de admin (en ventana) SIN fila en email_events. */
  withoutEmail: number;
  /** Subconjunto sin email cuyo envío SÍ debía ocurrir → fallo silencioso. */
  realDrops: number;
  /** Sin email pero por salto legítimo (preferencia / flag / campana en vivo). */
  expectedSkips: number;
  /**
   * Saltos deducidos de la preferencia ACTUAL, sin evidencia del momento. Debe tender a 0
   * según entran respuestas nuevas; si no baja, el emisor de `feedback_email_skipped` no
   * está llegando a producción. Trinquete, no adorno (misma lección que [T-422]).
   */
  inferredSkips: number;
  sample: Array<{
    messageId: string;
    feedbackId: string | null;
    userId: string;
    email: string;
    sentAt: string;
    /** true = el envío pasó el gate y aun así no hay email: certeza, no sospecha. */
    conToken: boolean;
  }>;
  durationMs: number;
}

interface ReconcileRow {
  message_id: string;
  feedback_id: string | null;
  user_id: string;
  email: string | null;
  created_at: string;
  soporte_disabled: boolean;
  has_skip_event: boolean;
  has_unsubscribe_token: boolean;
}

@Injectable()
export class FeedbackEmailReconciliationService {
  private readonly logger = new Logger(FeedbackEmailReconciliationService.name);

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async run(): Promise<FeedbackEmailReconciliationResult> {
    const startedAt = Date.now();

    // Ventana: igual que el gemelo — enviadas hace ≥10min (gracia para no pillar envíos en
    // curso) y ≤24h (más allá ya no es accionable).
    const res = (await this.db.execute(sql`
      WITH msgs AS (
        SELECT m.id AS message_id,
               fc.feedback_id,
               fc.user_id,
               m.created_at
        FROM feedback_messages m
        JOIN feedback_conversations fc ON fc.id = m.conversation_id
        WHERE m.is_admin = true
          AND fc.user_id IS NOT NULL
          AND m.created_at >= now() - interval '24 hours'
          AND m.created_at <= now() - interval '10 minutes'
      ),
      classified AS (
        SELECT
          d.message_id,
          d.feedback_id,
          d.user_id,
          d.created_at,
          up.email,
          COALESCE(ep.email_soporte_disabled, false) AS soporte_disabled,
          -- El envío deja su fila casi a la vez que el mensaje; el margen generoso por
          -- arriba absorbe una cola lenta sin llegar a la siguiente respuesta del hilo.
          EXISTS (
            SELECT 1 FROM email_events ee
            WHERE ee.email_address = up.email
              AND ee.email_type = 'soporte_respuesta'
              AND ee.created_at >= d.created_at - interval '2 minutes'
              AND ee.created_at <= d.created_at + interval '30 minutes'
          ) AS has_email_event,
          -- EVIDENCIA del momento: la ruta de respuesta la emite al saltar el envío, con el
          -- messageId. Anclada al mensaje, no al reloj ni al feedback.
          EXISTS (
            SELECT 1 FROM observable_events oe
            WHERE oe.event_type = 'feedback_email_skipped'
              AND oe.metadata->>'messageId' = d.message_id::text
          ) AS has_skip_event,
          -- SEGUNDA evidencia, en dirección contraria: el token se crea DENTRO de
          -- sendEmailV2, después de canSendEmail. Si existe, el envío pasó el gate.
          EXISTS (
            SELECT 1 FROM email_unsubscribe_tokens t
            WHERE t.user_id = d.user_id
              AND t.email_type = 'soporte_respuesta'
              AND t.created_at >= d.created_at - interval '2 minutes'
              AND t.created_at <= d.created_at + interval '30 minutes'
          ) AS has_unsubscribe_token
        FROM msgs d
        JOIN user_profiles up ON up.id = d.user_id
        LEFT JOIN email_preferences ep ON ep.user_id = d.user_id
      )
      SELECT message_id, feedback_id, user_id, email, created_at,
             soporte_disabled, has_skip_event, has_unsubscribe_token
      FROM classified
      WHERE has_email_event = false
      ORDER BY created_at DESC
    `)) as unknown as { rows?: ReconcileRow[] };

    const rows = res.rows ?? (res as unknown as ReconcileRow[]) ?? [];

    // El veredicto lo decide el MISMO núcleo puro que el gemelo, a propósito: dos puertas al
    // mismo hecho con criterios distintos no protegen el doble, se contradicen.
    const juzgadas = rows.map((r) => ({
      row: r,
      verdict: clasificarVerdicto({
        email: r.email,
        soporteDisabled: r.soporte_disabled === true,
        hasEmailEvent: false, // el SQL ya filtró las que sí tienen email
        hasSkipEvent: r.has_skip_event === true,
        hasUnsubscribeToken: r.has_unsubscribe_token === true,
      }),
    }));

    const realDropRows = juzgadas
      .filter((j) => esDropReal(j.verdict))
      .map((j) => j.row);
    const inferredSkips = juzgadas.filter(
      (j) => j.verdict === 'expected_skip_inferred',
    ).length;

    const result: FeedbackEmailReconciliationResult = {
      withoutEmail: rows.length,
      realDrops: realDropRows.length,
      expectedSkips: rows.length - realDropRows.length,
      inferredSkips,
      sample: realDropRows.slice(0, 20).map((r) => ({
        messageId: r.message_id,
        feedbackId: r.feedback_id,
        userId: r.user_id,
        email: r.email ?? '',
        sentAt: String(r.created_at),
        conToken: r.has_unsubscribe_token === true,
      })),
      durationMs: Date.now() - startedAt,
    };

    this.logger.log(
      `Reconciliation feedback: ${result.realDrops} drops reales, ` +
        `${result.expectedSkips} skips esperados (${inferredSkips} inferidos sin evidencia) ` +
        `de ${result.withoutEmail} sin email`,
    );
    return result;
  }
}
