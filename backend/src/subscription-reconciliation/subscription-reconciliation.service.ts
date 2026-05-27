import { Inject, Injectable, Logger } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import Stripe from 'stripe';
import { DRIZZLE, type DrizzleDB } from '../db/database.module';

/**
 * Reconciliación de suscripciones: Pass-1 (BD-only) + Pass-2 (Stripe directo).
 *
 * Origen: incidente 26-27/05/2026 — webhook Stripe roto durante horas.
 * Usuarios pagaban y NO se les aplicaba premium (Andrea/Rocío/Mercedes).
 * Sin el Pass-2, el cron pre-existente solo miraba BD → no detectaba el caso
 * donde Stripe tenía sub active y user_subscriptions estaba vacío.
 *
 * Pass-1 (filtro extendido post-27/05):
 *   - Buscar user_subscriptions con status IN ('active','trialing','past_due').
 *   - Para cada uno: si user_profiles.plan_type != 'premium' → corregir.
 *
 * Pass-2 (consulta Stripe directo):
 *   - stripe.subscriptions.list({status:'active', created:>30d}).
 *   - Para cada sub: si NO existe fila en user_subscriptions → INSERT + UPDATE profile.
 *
 * Migrado de GHA workflow (subscription-reconciliation.yml cada 1h) a backend
 * Fargate scheduler porque GHA sufría lag de horas bajo carga.
 */
@Injectable()
export class SubscriptionReconciliationService {
  private readonly logger = new Logger(SubscriptionReconciliationService.name);

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async run(dryRun = false): Promise<ReconciliationResult> {
    const startedAt = Date.now();
    this.logger.log(
      `Iniciando reconciliation${dryRun ? ' (DRY RUN)' : ' (LIVE)'}...`,
    );

    // ─── PASS 1 ──────────────────────────────────────────────────────────
    const pass1 = await this.runPass1(dryRun);

    // ─── PASS 2 ──────────────────────────────────────────────────────────
    let pass2: Pass2Result = { stripeMissingInDb: 0, stripeMissingFixed: 0, errors: [] };
    try {
      pass2 = await this.runPass2(dryRun);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Pass-2 falló: ${msg}`);
      pass2.errors.push(msg);
    }

    const totalDurationMs = Date.now() - startedAt;
    return { pass1, pass2, totalDurationMs };
  }

  private async runPass1(dryRun: boolean): Promise<Pass1Result> {
    // Estados que indican acceso premium activo (alineado con cancelSubscription
    // policy y con la corrección del bug Mariangeles 21/05/2026).
    const rows = (await this.db.execute(sql`
      SELECT
        us.user_id,
        us.status,
        us.stripe_subscription_id,
        us.current_period_end,
        up.email,
        up.plan_type AS profile_plan_type
      FROM user_subscriptions us
      INNER JOIN user_profiles up ON up.id = us.user_id
      WHERE us.status IN ('active', 'trialing', 'past_due')
        AND up.plan_type != 'premium'
    `)) as unknown as { rows?: Pass1Row[] };

    const inconsistencies = (rows.rows ?? (rows as unknown as Pass1Row[]) ?? []) as Pass1Row[];
    this.logger.log(`Pass-1: ${inconsistencies.length} inconsistencias`);

    if (!dryRun) {
      for (const r of inconsistencies) {
        try {
          await this.db.execute(sql`
            UPDATE user_profiles
            SET plan_type = 'premium', requires_payment = false
            WHERE id = ${r.user_id}
          `);
          r.fixed = true;
          this.logger.log(`Pass-1 fixed: ${r.email} (plan_type free → premium)`);
        } catch (err) {
          r.fixed = false;
          this.logger.error(
            `Pass-1 error corrigiendo ${r.email}: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }
    }

    return {
      detected: inconsistencies.length,
      fixed: inconsistencies.filter((i) => i.fixed).length,
      sample: inconsistencies.slice(0, 5),
    };
  }

  private async runPass2(dryRun: boolean): Promise<Pass2Result> {
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) {
      this.logger.warn('STRIPE_SECRET_KEY no configurada — Pass-2 skipped');
      return { stripeMissingInDb: 0, stripeMissingFixed: 0, errors: ['no_stripe_key'] };
    }

    const stripe = new Stripe(stripeKey);
    const since = Math.floor(Date.now() / 1000) - 30 * 24 * 3600; // 30 días

    // Paginar subs active últimos 30 días — máximo 5 páginas (500 subs) como
    // tope defensivo. Vence típicamente tiene <100 subs activas.
    // Tipos inferidos vía Awaited<ReturnType<>> porque stripe v22 no expone
    // SubscriptionListParams / Subscription desde el import default.
    type StripeSubscription = Awaited<
      ReturnType<typeof stripe.subscriptions.list>
    >['data'][number];
    let starting_after: string | undefined;
    const stripeActives: StripeSubscription[] = [];
    for (let i = 0; i < 5; i++) {
      const opts: Parameters<typeof stripe.subscriptions.list>[0] = {
        status: 'active',
        limit: 100,
        created: { gte: since },
      };
      if (starting_after) opts.starting_after = starting_after;
      const result = await stripe.subscriptions.list(opts);
      stripeActives.push(...result.data);
      if (!result.has_more) break;
      starting_after = result.data[result.data.length - 1].id;
    }

    this.logger.log(`Pass-2: ${stripeActives.length} subs active en Stripe últimos 30d`);

    const missing: Pass2MissingEntry[] = [];

    for (const sub of stripeActives) {
      const customerId =
        typeof sub.customer === 'string' ? sub.customer : sub.customer.id;

      // ¿Existe en BD?
      const existingRows = (await this.db.execute(sql`
        SELECT id FROM user_subscriptions
        WHERE stripe_subscription_id = ${sub.id}
        LIMIT 1
      `)) as unknown as Array<{ id: string }>;
      const existing = existingRows[0];
      if (existing) continue;

      // Falta — buscar user_profiles por stripe_customer_id.
      const profileRows = (await this.db.execute(sql`
        SELECT id, email FROM user_profiles
        WHERE stripe_customer_id = ${customerId}
        LIMIT 1
      `)) as unknown as Array<{ id: string; email: string }>;
      const profile = profileRows[0];

      const entry: Pass2MissingEntry = {
        stripeCustomerId: customerId,
        stripeSubscriptionId: sub.id,
        userId: profile?.id ?? null,
        email: profile?.email ?? null,
        status: sub.status,
        fixed: false,
      };

      if (!profile?.id) {
        this.logger.warn(
          `Pass-2 customer ${customerId} sin user_profiles match — sub ${sub.id} no se puede sincronizar`,
        );
        missing.push(entry);
        continue;
      }

      if (!dryRun) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const item = (sub as any).items.data[0];
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const subAny = sub as any;
          const periodStart = subAny.current_period_start ?? item?.current_period_start ?? sub.created;
          const periodEnd = subAny.current_period_end ?? item?.current_period_end ?? null;
          const interval = item?.price?.recurring?.interval;
          const planType =
            interval === 'year' ? 'premium_annual' : 'premium_monthly';

          await this.db.execute(sql`
            INSERT INTO user_subscriptions (
              user_id, stripe_customer_id, stripe_subscription_id, status,
              plan_type, trial_start, trial_end,
              current_period_start, current_period_end
            ) VALUES (
              ${profile.id}::uuid,
              ${customerId},
              ${sub.id},
              ${sub.status},
              ${planType},
              ${sub.trial_start ? new Date(sub.trial_start * 1000).toISOString() : null}::timestamptz,
              ${sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null}::timestamptz,
              ${periodStart ? new Date(periodStart * 1000).toISOString() : null}::timestamptz,
              ${periodEnd ? new Date(periodEnd * 1000).toISOString() : null}::timestamptz
            )
            ON CONFLICT (user_id) DO UPDATE SET
              stripe_subscription_id = EXCLUDED.stripe_subscription_id,
              status = EXCLUDED.status,
              plan_type = EXCLUDED.plan_type,
              current_period_end = EXCLUDED.current_period_end
          `);

          await this.db.execute(sql`
            UPDATE user_profiles
            SET plan_type = 'premium', requires_payment = false
            WHERE id = ${profile.id}::uuid
          `);

          entry.fixed = true;
          this.logger.log(
            `✅ Pass-2 RECOVERED ${profile.email} — sub ${sub.id} sincronizada + premium activado`,
          );
        } catch (err) {
          this.logger.error(
            `Pass-2 INSERT/UPDATE falló para ${profile.email}: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }

      missing.push(entry);
    }

    return {
      stripeMissingInDb: missing.length,
      stripeMissingFixed: missing.filter((m) => m.fixed).length,
      errors: [],
      sample: missing.slice(0, 5).map((m) => ({
        userId: m.userId,
        email: m.email,
        subscriptionId: m.stripeSubscriptionId,
      })),
    };
  }
}

// ─── Types ────────────────────────────────────────────────────────────────

interface Pass1Row {
  user_id: string;
  status: string;
  stripe_subscription_id: string;
  current_period_end: string | null;
  email: string;
  profile_plan_type: string;
  fixed?: boolean;
}

export interface Pass1Result {
  detected: number;
  fixed: number;
  sample: Pass1Row[];
}

interface Pass2MissingEntry {
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  userId: string | null;
  email: string | null;
  status: string;
  fixed: boolean;
}

export interface Pass2Result {
  stripeMissingInDb: number;
  stripeMissingFixed: number;
  errors: string[];
  sample?: Array<{ userId: string | null; email: string | null; subscriptionId: string }>;
}

export interface ReconciliationResult {
  pass1: Pass1Result;
  pass2: Pass2Result;
  totalDurationMs: number;
}
