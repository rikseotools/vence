import { Inject, Injectable, Logger } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import Stripe from 'stripe';
import { DRIZZLE, type DrizzleDB } from '../db/database.module';
import {
  getStripeAccountKeys,
  type StripeAccount,
} from '../stripe/stripe-accounts';
import {
  isNoOp,
  pickMatch,
  profileRepairs,
  resolvePlanType,
  type MatchSource,
} from './pass2-matching';

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
    let pass2: Pass2Result = {
      stripeMissingInDb: 0,
      stripeMissingFixed: 0,
      errors: [],
    };
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

    const inconsistencies = rows.rows ?? (rows as unknown as Pass1Row[]) ?? [];
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
          this.logger.log(
            `Pass-1 fixed: ${r.email} (plan_type free → premium)`,
          );
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

  /**
   * Pass-2 sobre TODAS las cuentas Stripe conocidas.
   *
   * Antes leía `STRIPE_SECRET_KEY` a pelo (cuenta Manuel): la red de rescate no
   * cubría la cuenta por la que entran hoy TODAS las altas nuevas. Una cuenta
   * que no se puede mirar sale como `degraded`, nunca como "0 pendientes"
   * (mismo criterio que check-webhook-health).
   */
  private async runPass2(dryRun: boolean): Promise<Pass2Result> {
    const keys = getStripeAccountKeys();
    if (keys.every((k) => !k.secretKey)) {
      this.logger.warn('Ninguna cuenta Stripe configurada — Pass-2 skipped');
      return {
        stripeMissingInDb: 0,
        stripeMissingFixed: 0,
        errors: ['no_stripe_key'],
        degraded: true,
        accounts: keys.map((k) => ({
          account: k.account,
          readable: false,
          error: `Falta ${k.envVar}`,
          subsScanned: 0,
          missing: 0,
          fixed: 0,
        })),
      };
    }

    const since = Math.floor(Date.now() / 1000) - 30 * 24 * 3600; // 30 días
    const missing: Pass2MissingEntry[] = [];
    const accounts: Pass2AccountResult[] = [];
    const errors: string[] = [];

    for (const { account, secretKey, envVar } of keys) {
      if (!secretKey) {
        // Cuenta conocida que este entorno no puede mirar: se reporta, no se
        // omite (omitirla daría un "0 pendientes" que no significa nada).
        accounts.push({
          account,
          readable: false,
          error: `Falta ${envVar}`,
          subsScanned: 0,
          missing: 0,
          fixed: 0,
        });
        continue;
      }

      try {
        const result = await this.reconcileAccount(
          account,
          secretKey,
          since,
          dryRun,
        );
        missing.push(...result.entries);
        accounts.push({
          account,
          readable: true,
          subsScanned: result.scanned,
          missing: result.entries.length,
          fixed: result.entries.filter((e) => e.fixed).length,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.error(`Pass-2 cuenta '${account}' falló: ${message}`);
        errors.push(`${account}: ${message}`);
        accounts.push({
          account,
          readable: false,
          error: message,
          subsScanned: 0,
          missing: 0,
          fixed: 0,
        });
      }
    }

    return {
      stripeMissingInDb: missing.length,
      stripeMissingFixed: missing.filter((m) => m.fixed).length,
      errors,
      degraded: accounts.some((a) => !a.readable),
      accounts,
      sample: missing.slice(0, 5).map((m) => ({
        userId: m.userId,
        email: m.email,
        subscriptionId: m.stripeSubscriptionId,
        account: m.account,
        matchedBy: m.matchedBy,
      })),
    };
  }

  /** Reconcilia una cuenta Stripe concreta contra la BD. */
  private async reconcileAccount(
    account: StripeAccount,
    secretKey: string,
    since: number,
    dryRun: boolean,
  ): Promise<{ scanned: number; entries: Pass2MissingEntry[] }> {
    const stripe = this.createStripe(secretKey);

    // Paginar subs active últimos 30 días — máximo 5 páginas (500 subs) como
    // tope defensivo. Vence típicamente tiene <100 subs activas por cuenta.
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
      if (!result.has_more || result.data.length === 0) break;
      starting_after = result.data[result.data.length - 1].id;
    }

    this.logger.log(
      `Pass-2 [${account}]: ${stripeActives.length} subs active en Stripe últimos 30d`,
    );

    const entries: Pass2MissingEntry[] = [];

    for (const sub of stripeActives) {
      const customerId =
        typeof sub.customer === 'string' ? sub.customer : sub.customer.id;

      // ¿Existe en BD?
      const existingRows = (await this.db.execute(sql`
        SELECT id FROM user_subscriptions
        WHERE stripe_subscription_id = ${sub.id}
        LIMIT 1
      `)) as unknown as Array<{ id: string }>;
      if (existingRows[0]) continue;

      // Falta. Localizar al dueño por orden de fiabilidad (ver pass2-matching).
      const metadataUserId =
        sub.metadata?.supabase_user_id || sub.metadata?.user_id || null;

      const byMetadata = metadataUserId
        ? ((
            (await this.db.execute(sql`
              SELECT id FROM user_profiles WHERE id = ${metadataUserId}::uuid LIMIT 1
            `)) as unknown as Array<{ id: string }>
          )[0]?.id ?? null)
        : null;

      const byCustomerId =
        (
          (await this.db.execute(sql`
            SELECT id FROM user_profiles WHERE stripe_customer_id = ${customerId} LIMIT 1
          `)) as unknown as Array<{ id: string }>
        )[0]?.id ?? null;

      // El email cuesta una llamada extra a Stripe: solo si las otras fallan.
      let byEmail: string | null = null;
      if (!byMetadata && !byCustomerId) {
        try {
          const customer = await stripe.customers.retrieve(customerId);
          const email =
            'deleted' in customer && customer.deleted ? null : customer.email;
          if (email) {
            byEmail =
              (
                (await this.db.execute(sql`
                  SELECT id FROM user_profiles WHERE lower(email) = lower(${email}) LIMIT 1
                `)) as unknown as Array<{ id: string }>
              )[0]?.id ?? null;
          }
        } catch (err) {
          this.logger.warn(
            `Pass-2 [${account}] no se pudo leer el customer ${customerId}: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }

      const match = pickMatch({ byMetadata, byCustomerId, byEmail });

      const entry: Pass2MissingEntry = {
        account,
        stripeCustomerId: customerId,
        stripeSubscriptionId: sub.id,
        userId: match?.userId ?? null,
        email: null,
        matchedBy: match?.matchedBy ?? null,
        status: sub.status,
        fixed: false,
      };

      if (!match) {
        this.logger.warn(
          `Pass-2 [${account}] sub ${sub.id} (customer ${customerId}) sin usuario identificable — no se puede sincronizar`,
        );
        entries.push(entry);
        continue;
      }

      if (match.conflict) {
        // Dos vías apuntan a usuarios distintos: se aplica la de más prioridad
        // (metadata), pero queda registrado — son datos cruzados.
        this.logger.warn(
          `Pass-2 [${account}] sub ${sub.id}: vías de match discrepan (metadata=${byMetadata} customer=${byCustomerId} email=${byEmail}) — se usa ${match.matchedBy}`,
        );
      }

      if (!dryRun) {
        try {
          entry.email = await this.repairSubscription(
            sub as unknown as StripeSubLike,
            {
              account,
              customerId,
              userId: match.userId,
            },
          );
          entry.fixed = true;
          this.logger.log(
            `✅ Pass-2 [${account}] RECOVERED ${entry.email ?? match.userId} — sub ${sub.id} sincronizada (match por ${match.matchedBy})`,
          );
        } catch (err) {
          this.logger.error(
            `Pass-2 [${account}] reparación falló para ${match.userId}: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }

      entries.push(entry);
    }

    return { scanned: stripeActives.length, entries };
  }

  /**
   * Escribe la reparación completa en UNA transacción: la fila de
   * `user_subscriptions` y los campos del perfil que hayan quedado stale
   * (premium, customer y CUENTA). Todo o nada — un rescate a medias deja al
   * usuario con premium pero apuntando a la cuenta Stripe equivocada, y
   * cancelar/portal/reembolso operarían contra la otra cuenta.
   *
   * Devuelve el email del usuario (para el log).
   */
  private async repairSubscription(
    sub: StripeSubLike,
    ctx: { account: StripeAccount; customerId: string; userId: string },
  ): Promise<string | null> {
    const item = sub.items?.data?.[0];
    const periodStart =
      sub.current_period_start ?? item?.current_period_start ?? sub.created;
    const periodEnd =
      sub.current_period_end ?? item?.current_period_end ?? null;
    const planType = resolvePlanType(
      item?.price?.recurring?.interval,
      item?.price?.recurring?.interval_count,
    );

    return this.db.transaction(async (tx) => {
      const profileRows = (await tx.execute(sql`
        SELECT id, email, plan_type, stripe_customer_id, payment_account
        FROM user_profiles WHERE id = ${ctx.userId}::uuid LIMIT 1
      `)) as unknown as Array<{
        id: string;
        email: string | null;
        plan_type: string | null;
        stripe_customer_id: string | null;
        payment_account: string | null;
      }>;
      const profile = profileRows[0];
      if (!profile) throw new Error(`user_profiles ${ctx.userId} no existe`);

      await tx.execute(sql`
        INSERT INTO user_subscriptions (
          user_id, stripe_customer_id, stripe_subscription_id, status,
          plan_type, trial_start, trial_end,
          current_period_start, current_period_end
        ) VALUES (
          ${ctx.userId}::uuid,
          ${ctx.customerId},
          ${sub.id},
          ${sub.status},
          ${planType},
          ${sub.trial_start ? new Date(sub.trial_start * 1000).toISOString() : null}::timestamptz,
          ${sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null}::timestamptz,
          ${periodStart ? new Date(periodStart * 1000).toISOString() : null}::timestamptz,
          ${periodEnd ? new Date(periodEnd * 1000).toISOString() : null}::timestamptz
        )
        ON CONFLICT (user_id) DO UPDATE SET
          stripe_customer_id = EXCLUDED.stripe_customer_id,
          stripe_subscription_id = EXCLUDED.stripe_subscription_id,
          status = EXCLUDED.status,
          plan_type = EXCLUDED.plan_type,
          current_period_start = EXCLUDED.current_period_start,
          current_period_end = EXCLUDED.current_period_end
      `);

      const repairs = profileRepairs(
        {
          planType: profile.plan_type,
          stripeCustomerId: profile.stripe_customer_id,
          paymentAccount: profile.payment_account,
        },
        { customerId: ctx.customerId, account: ctx.account },
      );

      if (!isNoOp(repairs)) {
        await tx.execute(sql`
          UPDATE user_profiles SET
            plan_type = ${repairs.grantPremium ? 'premium' : sql`plan_type`},
            requires_payment = ${repairs.grantPremium ? false : sql`requires_payment`},
            stripe_customer_id = ${repairs.stripeCustomerId ?? sql`stripe_customer_id`},
            payment_account = ${repairs.paymentAccount ?? sql`payment_account`}
          WHERE id = ${ctx.userId}::uuid
        `);
      }

      return profile.email;
    });
  }

  /**
   * Aislado para poder sustituirlo en los tests sin tocar la red.
   * `InstanceType<typeof Stripe>` porque stripe v22 no deja usar el import
   * default como tipo (mismo motivo que los `Awaited<ReturnType<>>` de arriba).
   */
  protected createStripe(secretKey: string): InstanceType<typeof Stripe> {
    return new Stripe(secretKey);
  }
}

// ─── Types ────────────────────────────────────────────────────────────────

/**
 * Lo que la reparación necesita de una suscripción de Stripe. Tipo propio (y
 * laxo) porque stripe v22 mueve `current_period_*` entre la sub y su item
 * según la apiVersion, y el import default no se puede usar como tipo.
 */
interface StripeSubLike {
  id: string;
  status: string;
  created: number;
  trial_start?: number | null;
  trial_end?: number | null;
  current_period_start?: number | null;
  current_period_end?: number | null;
  items?: {
    data?: Array<{
      price?: { recurring?: { interval?: string; interval_count?: number } };
      current_period_start?: number | null;
      current_period_end?: number | null;
    }>;
  };
}

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
  account: StripeAccount;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  userId: string | null;
  email: string | null;
  matchedBy: MatchSource | null;
  status: string;
  fixed: boolean;
}

export interface Pass2AccountResult {
  account: StripeAccount;
  /** false = no se pudo mirar esta cuenta (sin key o error de API). */
  readable: boolean;
  error?: string;
  subsScanned: number;
  missing: number;
  fixed: number;
}

export interface Pass2Result {
  stripeMissingInDb: number;
  stripeMissingFixed: number;
  errors: string[];
  /** true si alguna cuenta conocida no se pudo reconciliar. */
  degraded?: boolean;
  accounts?: Pass2AccountResult[];
  sample?: Array<{
    userId: string | null;
    email: string | null;
    subscriptionId: string;
    account?: StripeAccount;
    matchedBy?: MatchSource | null;
  }>;
}

export interface ReconciliationResult {
  pass1: Pass1Result;
  pass2: Pass2Result;
  totalDurationMs: number;
}
