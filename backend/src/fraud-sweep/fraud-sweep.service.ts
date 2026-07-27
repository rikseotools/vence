import { Inject, Injectable, Logger } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../db/database.module';
import { ObservabilityService } from '../observability/observability.service';
import { classifyHarvest } from './harvest-signals';

/**
 * Barrido ANTIFRAUDE → señales en `fraud_alerts` (status='new') → badge 🚨 + revisión.
 *
 * PORT IN-PROCESS de `scripts/fraud-sweep.cjs` (gemelo CLI para DRY/manual — MANTENER
 * EN SYNC). Corre como @Cron del backend NestJS, igual que content-health-sweep.
 * READ-ONLY sobre datos de usuario: solo DETECTA y alerta, NO bloquea (el enforcement
 * es fase F1/F2). Runbook: docs/runbooks/revisar-fraudes.md.
 *
 * Detectores: multi_account_device, multi_account_reg_ip, device_daily_farming,
 * COSECHA (curl_scraping / harvest_no_answer, por ratio respondidas/servidas),
 * premium_sharing. Umbrales por env (mismos defaults que el .cjs).
 *
 * ⚠️ ESTE es el que corre en PRODUCCIÓN (@Cron 03:15 UTC dentro del backend en
 * Fargate). NO hay workflow de GitHub Actions: `fraud-sweep.yml` no existe. Un
 * cambio aquí necesita DEPLOY DE BACKEND; tocar solo el `.cjs` no cambia nada en
 * prod — error real cometido el 27/07/2026, inducido por el runbook, que decía
 * "cron GHA diario" cuando ya se había migrado a @Cron en `e5cfe988b`.
 */
export interface FraudSweepSummary {
  found: number;
  inserted: number;
  refreshed: number;
  skipped: number;
  pending: number;
}

function rows(r: unknown): any[] {
  return Array.isArray(r) ? r : (r as { rows?: unknown[] }).rows || [];
}
function envInt(name: string, def: number): number {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? v : def;
}

@Injectable()
export class FraudSweepService {
  private readonly logger = new Logger(FraudSweepService.name);

  private readonly DEVICE_ACCOUNTS = envInt('FRAUD_DEVICE_ACCOUNTS', 3);
  private readonly IP_ACCOUNTS = envInt('FRAUD_IP_ACCOUNTS', 5);
  private readonly DEVICE_DAILY_Q = envInt('FRAUD_DEVICE_DAILY_Q', 60);
  // Volumen mínimo de SERVIDAS para que el ratio signifique algo. Sustituye a
  // FRAUD_SCRAPE_MIN_Q/MAX_PV, que medían respuestas guardadas y eran ciegos.
  private readonly SCRAPE_MIN_SERVED = envInt('FRAUD_SCRAPE_MIN_SERVED', 300);
  private readonly WINDOW_DAYS = envInt('FRAUD_WINDOW_DAYS', 30);
  private readonly REVIEW_TTL_DAYS = envInt('FRAUD_REVIEW_TTL_DAYS', 30);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly observability: ObservabilityService,
  ) {}

  private sevFor(kind: string, n: number): string {
    if (kind === 'curl_scraping') return 'critical';
    if (kind === 'multi_account_device') return n >= 6 ? 'critical' : 'high';
    if (kind === 'multi_account_reg_ip') return n >= 10 ? 'critical' : 'high';
    if (kind === 'device_daily_farming' || kind === 'premium_sharing')
      return 'high';
    return 'medium';
  }

  /** Upsert idempotente por match_criteria=kind:subject. */
  private async upsert(
    kind: string,
    subject: string,
    userIds: string[],
    details: Record<string, unknown>,
    n: number,
    severityOverride?: string,
  ): Promise<'inserted' | 'refreshed' | 'skipped'> {
    const match = `${kind}:${subject}`;
    // severityOverride: el detector de cosecha decide con más contexto del que
    // tiene sevFor (ratio, navegador, huella).
    const severity = severityOverride ?? this.sevFor(kind, n);
    const detailsJson = JSON.stringify(details);
    const adj = rows(
      await this.db.execute(sql`
      SELECT id FROM fraud_alerts WHERE match_criteria=${match} AND status IN ('reviewed','dismissed','confirmed')
        AND COALESCE(reviewed_at, detected_at) > now() - (${String(this.REVIEW_TTL_DAYS)}||' days')::interval LIMIT 1`),
    );
    if (adj.length) return 'skipped';
    const cur = rows(
      await this.db.execute(
        sql`SELECT id FROM fraud_alerts WHERE match_criteria=${match} AND status='new' LIMIT 1`,
      ),
    );
    if (cur.length) {
      await this.db.execute(
        sql`UPDATE fraud_alerts SET details=${detailsJson}::jsonb, severity=${severity}, user_ids=${userIds}, detected_at=now() WHERE id=${cur[0].id}`,
      );
      return 'refreshed';
    }
    await this.db.execute(sql`
      INSERT INTO fraud_alerts (alert_type, severity, status, user_ids, details, match_criteria, detected_at)
      VALUES (${kind}, ${severity}, 'new', ${userIds}, ${detailsJson}::jsonb, ${match}, now())`);
    return 'inserted';
  }

  async run(): Promise<FraudSweepSummary> {
    const t = { inserted: 0, refreshed: 0, skipped: 0 };
    const bump = (r: 'inserted' | 'refreshed' | 'skipped') => {
      t[r]++;
    };
    let found = 0;
    const W = String(this.WINDOW_DAYS);

    // D1 multi_account_device
    for (const r of rows(
      await this.db.execute(sql`
      SELECT device_id, count(DISTINCT user_id)::int accounts, array_agg(DISTINCT user_id) users, max(last_seen_at) last_seen
      FROM user_devices WHERE last_seen_at >= now() - (${W}||' days')::interval
      GROUP BY device_id HAVING count(DISTINCT user_id) >= ${this.DEVICE_ACCOUNTS}`),
    )) {
      found++;
      const emails = rows(
        await this.db.execute(
          sql`SELECT email, plan_type, created_at::date d FROM user_profiles WHERE id = ANY(${r.users}) ORDER BY created_at`,
        ),
      );
      bump(
        await this.upsert(
          'multi_account_device',
          r.device_id,
          r.users,
          {
            device_id: r.device_id,
            accounts: Number(r.accounts),
            last_seen: r.last_seen,
            emails: emails.map((e) => e.email),
            plans: emails.map((e) => e.plan_type),
            same_day_signups:
              emails.length > 0 &&
              emails.every((e) => String(e.d) === String(emails[0].d)),
          },
          Number(r.accounts),
        ),
      );
    }

    // D2 multi_account_reg_ip — afinado (falsos positivos 21/07): excluye rangos CDN/proxy
    // (Cloudflare) y exige CORRELACIÓN DE DISPOSITIVO (≥2 cuentas de la IP comparten device
    // = granja; CGNAT/red compartida no comparte device), con escape para lo egregio (≥20).
    for (const r of rows(
      await this.db.execute(sql`
      WITH ip_users AS (
        SELECT registration_ip, array_agg(id) users, count(*)::int accounts
        FROM user_profiles
        WHERE registration_ip ~ '^(\\d{1,3}\\.){3}\\d{1,3}$'
          AND NOT (registration_ip::inet <<= ANY(ARRAY['173.245.48.0/20','103.21.244.0/22','103.22.200.0/22','103.31.4.0/22','141.101.64.0/18','108.162.192.0/18','190.93.240.0/20','188.114.96.0/20','197.234.240.0/22','198.41.128.0/17','162.158.0.0/15','104.16.0.0/12','172.64.0.0/13','131.0.72.0/22']::inet[]))
        GROUP BY registration_ip HAVING count(*) >= ${this.IP_ACCOUNTS})
      SELECT iu.registration_ip, iu.accounts, iu.users
      FROM ip_users iu
      WHERE EXISTS (SELECT 1 FROM user_devices d WHERE d.user_id = ANY(iu.users)
                    GROUP BY d.device_id HAVING count(DISTINCT d.user_id) >= 2)
         OR iu.accounts >= 20
      ORDER BY iu.accounts DESC LIMIT 200`),
    )) {
      found++;
      bump(
        await this.upsert(
          'multi_account_reg_ip',
          r.registration_ip,
          r.users,
          { registration_ip: r.registration_ip, accounts: Number(r.accounts) },
          Number(r.accounts),
        ),
      );
    }

    // D3 device_daily_farming
    for (const r of rows(
      await this.db.execute(sql`
      WITH dev AS (
        SELECT device_id, array_agg(DISTINCT user_id) users FROM user_devices
        WHERE last_seen_at >= now() - (${W}||' days')::interval
        GROUP BY device_id HAVING count(DISTINCT user_id) >= 2)
      SELECT d.device_id, d.users, max(day_q.q)::int max_dia
      FROM dev d
      JOIN LATERAL (
        SELECT du.usage_date, sum(du.questions_answered) q FROM daily_question_usage du
        WHERE du.user_id = ANY(d.users) AND du.usage_date >= (CURRENT_DATE - (${this.WINDOW_DAYS})::int) GROUP BY du.usage_date
      ) day_q ON true
      GROUP BY d.device_id, d.users HAVING max(day_q.q) > ${this.DEVICE_DAILY_Q}`),
    )) {
      found++;
      bump(
        await this.upsert(
          'device_daily_farming',
          r.device_id,
          r.users,
          {
            device_id: r.device_id,
            accounts: r.users.length,
            max_questions_one_day: Number(r.max_dia),
            threshold: this.DEVICE_DAILY_Q,
          },
          Number(r.max_dia),
        ),
      );
    }

    // ── D4: COSECHA de preguntas (servidas vs respondidas) ────────────────────
    //
    // Reescrito 27/07/2026. Medía el volumen con `daily_question_usage`
    // (respuestas GUARDADAS) y por eso era ciego: cosechar no requiere responder.
    // El usuario `anferbar987` tuvo ese contador en 2 el 16/05 mientras se le
    // servían 5.495 preguntas — y este detector no disparó NUNCA en toda su vida.
    //
    // Ahora el volumen sale de `daily_questions_served` (rollup duradero de
    // SERVIDAS) y la firma es el RATIO respondidas/servidas. La clasificación vive
    // en `harvest-signals.ts`, espejo del núcleo de la raíz con test de paridad.
    //
    // Se excluyen las cuentas SINTÉTICAS: los canaries cargan preguntas para
    // comprobar endpoints y no las contestan nunca → ratio 0,00, que es
    // literalmente la firma que buscamos. `smoke@vence.es` acumuló 1.860 servidas
    // en unas horas; sin esta exclusión el primer barrido habría abierto una
    // alerta crítica contra nuestro propio canario.
    const served = rows(
      await this.db.execute(sql`
      SELECT s.subject_key AS user_id, sum(s.served)::int AS served
        FROM daily_questions_served s
       WHERE s.subject_kind = 'user' AND s.usage_date >= CURRENT_DATE - ${this.WINDOW_DAYS}::int
         AND NOT EXISTS (SELECT 1 FROM user_profiles up
                          WHERE up.id::text = s.subject_key AND up.email LIKE 'smoke@%')
       GROUP BY 1`),
    );

    // FALSO VERDE: sin rollup no es que no haya cosechadores, es que no miramos.
    // Se DENUNCIA con severidad real; el heartbeat `cron_run` es 'info' y el
    // catch-all de /admin/salud-sistema solo cuenta error/warn, así que meterlo
    // ahí dentro sería construir la alarma y dejarla muda.
    if (served.length === 0) {
      this.logger.warn(
        'daily_questions_served VACÍO en la ventana → detección de cosecha CIEGA',
      );
      await this.observability.emit({
        source: 'fargate',
        severity: 'warn',
        eventType: 'fraud_detection_blind',
        endpoint: 'fraud-sweep',
        errorMessage:
          'daily_questions_served sin filas en la ventana: la detección de cosecha no está midiendo',
        metadata: { detector: 'harvest', window_days: this.WINDOW_DAYS },
      });
    }

    for (const s of served) {
      const uid = String(s.user_id);
      if (!/^[0-9a-f-]{36}$/i.test(uid)) continue;
      // ⚠️ El denominador sale de `test_questions`, NO de `daily_question_usage`.
      // Ese contador solo se incrementa en el camino del LÍMITE DIARIO, y los
      // premium lo esquivan: medido el 27/07, 77 usuarios premium respondieron
      // 5.598 preguntas ese día y su contador marcaba 0. Con él como denominador,
      // TODO premium activo que pasara de 300 servidas salía como
      // `harvest_no_answer` — un falso positivo ESTRUCTURAL contra justo los
      // clientes de pago (caso violeta.adm11@: 309 servidas, contador 0,
      // respuestas REALES 3.269).
      const meta = rows(
        await this.db.execute(sql`
        SELECT up.email, up.plan_type,
               (SELECT count(*) FROM test_questions t
                 WHERE t.user_id=up.id AND t.created_at > now() - (${this.WINDOW_DAYS}::int || ' days')::interval
                   AND t.user_answer IS NOT NULL AND t.user_answer <> '' AND t.user_answer <> 'BLANK')::int AS answered,
               (SELECT count(*) FROM user_interactions ui
                 WHERE ui.user_id=up.id AND ui.event_type='page_view'
                   AND ui.created_at > now() - (${this.WINDOW_DAYS}::int || ' days')::interval)::int AS page_views,
               EXISTS (SELECT 1 FROM user_devices d WHERE d.user_id=up.id) AS has_device
          FROM user_profiles up WHERE up.id = ${uid}::uuid`),
      )[0];
      if (!meta) continue;

      const verdict = classifyHarvest(
        {
          served: Number(s.served),
          answered: Number(meta.answered),
          pageViews: Number(meta.page_views),
          hasDevice: Boolean(meta.has_device),
        },
        { minServed: this.SCRAPE_MIN_SERVED },
      );
      if (!verdict) continue;

      found++;
      bump(
        await this.upsert(
          verdict.kind,
          uid,
          [uid],
          {
            user_id: uid,
            email: meta.email,
            plan_type: meta.plan_type,
            served: Number(s.served),
            answered: Number(meta.answered),
            answer_ratio: Number(verdict.ratio.toFixed(4)),
            page_views: Number(meta.page_views),
            has_device: Boolean(meta.has_device),
            window_days: this.WINDOW_DAYS,
            reasons: verdict.reasons,
          },
          Number(s.served),
          verdict.severity,
        ),
      );
    }

    // D5 premium_sharing
    for (const r of rows(
      await this.db.execute(sql`
      WITH dev AS (
        SELECT device_id, array_agg(DISTINCT user_id) users FROM user_devices
        WHERE last_seen_at >= now() - (${W}||' days')::interval
        GROUP BY device_id HAVING count(DISTINCT user_id) >= 2)
      SELECT d.device_id, d.users,
             count(*) FILTER (WHERE up.plan_type LIKE 'premium%' OR up.plan_type='trial')::int premium_n
      FROM dev d JOIN user_profiles up ON up.id = ANY(d.users)
      GROUP BY d.device_id, d.users HAVING count(*) FILTER (WHERE up.plan_type LIKE 'premium%' OR up.plan_type='trial') >= 1 AND array_length(d.users,1) >= 2`),
    )) {
      found++;
      const emails = rows(
        await this.db.execute(
          sql`SELECT email, plan_type FROM user_profiles WHERE id = ANY(${r.users})`,
        ),
      );
      bump(
        await this.upsert(
          'premium_sharing',
          r.device_id,
          r.users,
          {
            device_id: r.device_id,
            accounts: r.users.length,
            premium_accounts: Number(r.premium_n),
            emails: emails.map((e) => e.email),
            plans: emails.map((e) => e.plan_type),
          },
          r.users.length,
        ),
      );
    }

    const pending = Number(
      rows(
        await this.db.execute(
          sql`SELECT count(*)::int n FROM fraud_alerts WHERE status='new'`,
        ),
      )[0]?.n ?? 0,
    );
    this.logger.log(
      `fraud-sweep: ${found} hallazgos · ins=${t.inserted} ref=${t.refreshed} skip=${t.skipped} · pending=${pending}`,
    );
    return {
      found,
      inserted: t.inserted,
      refreshed: t.refreshed,
      skipped: t.skipped,
      pending,
    };
  }
}
