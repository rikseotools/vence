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
    /** ids de TODAS las subs activas vistas, para la comprobación inversa (Pass-3). */
    const activasEnStripe = new Set<string>();

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
        // Se acumulan para el Pass-3: una sub viva en CUALQUIER cuenta respalda su fila.
        for (const id of result.activasIds) activasEnStripe.add(id);
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

    // Comprobación INVERSA — ver `detectarPremiumSinRespaldo`. Solo si TODAS las cuentas se
    // pudieron leer: con una cuenta ciega, una sub viva de esa cuenta parecería inexistente y
    // acusaríamos de fuga a un cliente que paga.
    const degraded = accounts.some((a) => !a.readable);
    const sinRespaldo = degraded
      ? []
      : await this.detectarPremiumSinRespaldo(activasEnStripe, keys);
    if (degraded) {
      this.logger.warn(
        'Pass-3 (premium sin respaldo) OMITIDO: hay cuentas Stripe ilegibles',
      );
    }

    return {
      stripeMissingInDb: missing.length,
      stripeMissingFixed: missing.filter((m) => m.fixed).length,
      errors,
      degraded,
      accounts,
      sinRespaldo,
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
  ): Promise<{
    scanned: number;
    entries: Pass2MissingEntry[];
    activasIds: string[];
  }> {
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

    return {
      scanned: stripeActives.length,
      entries,
      activasIds: stripeActives.map((s) => s.id),
    };
  }

  /**
   * Pass-3 — PREMIUM SIN RESPALDO: la dirección que nadie vigilaba.
   *
   * Las 8 reglas de alerta sobre suscripciones vigilan que ningún usuario se quede sin lo que
   * pagó, o que la maquinaria funcione. Ninguna miraba lo contrario. Caso real (29/07/2026): un
   * cliente canceló desde la app el 26/05, Stripe terminó su suscripción el 27/05, y su fila se
   * quedó en `active` con el perfil en premium — dos meses y 293 tests regalados. Peor: como la
   * fila decía `active`, el Pass-1 le RENOVABA el premium cada hora.
   *
   * Dos formas del mismo problema:
   *   (a) fila `active` en BD cuya suscripción ya no está activa en NINGUNA cuenta Stripe
   *   (b) perfil `premium` sin ninguna fila viva y SIN concesión declarada
   *
   * `premium_grant_reason` es lo que hace posible (b): sin esa marca, las cuentas internas y el
   * canario son indistinguibles de una fuga y el detector chillaría a diario por algo sano —
   * que es exactamente cómo se acaba ignorando un aviso.
   *
   * SOLO DETECTA. Quitarle el premium a alguien afecta a una persona real y puede tener una
   * razón que no está en la BD; que lo confirme un humano. Y las `sub_manual_*` se excluyen:
   * son altas sin Stripe detrás, no tienen contraparte que comprobar.
   */
  /**
   * ¿Existe esta suscripción en alguna de nuestras cuentas de Stripe, y sigue respaldando el acceso?
   *
   * Se pregunta por ID (no se lista): el Pase 3 solo necesita saber de unos pocos sospechosos, y
   * listar la cartera entera cada hora para responder eso es justo lo que llevó al bug de la
   * ventana de 30 días (T-344).
   *
   * Tres respuestas, y la tercera es la que evita acusar a un cliente:
   *   · `viva`           — existe y su estado NO es terminal ⇒ respalda la fila.
   *   · `no_respalda`    — existe pero está cancelada/expirada, o Stripe dice que no existe.
   *   · `no_comprobable` — la consulta falló por algo que no es «no existe» (red, credenciales).
   *     Ante la duda NO se acusa: un falso positivo aquí es decirle a alguien que paga que no paga.
   */
  private async verificarSubEnStripe(
    subscriptionId: string,
    keys: ReturnType<typeof getStripeAccountKeys>,
  ): Promise<
    | { tipo: 'viva' }
    | { tipo: 'no_respalda'; estado: string }
    | { tipo: 'no_comprobable' }
  > {
    let algunaRespondio = false;
    let ultimoEstado: string | null = null;

    for (const { secretKey } of keys) {
      if (!secretKey) continue;
      try {
        const stripe = this.createStripe(secretKey);
        const sub = await stripe.subscriptions.retrieve(subscriptionId);
        algunaRespondio = true;
        const estado = String((sub as { status?: string }).status ?? 'desconocido');
        if (!ESTADOS_TERMINALES.has(estado)) return { tipo: 'viva' };
        // Encontrada y terminal: ya está la respuesta. Un id de Stripe pertenece a UNA cuenta, así
        // que preguntar en la otra solo gasta una llamada para oír «aquí no está».
        ultimoEstado = estado;
        break;
      } catch (err) {
        // Stripe devuelve `resource_missing` cuando el id no es de esta cuenta: eso NO es un
        // error de comprobación, es la respuesta «aquí no está» — y hay que seguir con la otra
        // cuenta antes de concluir nada.
        const code = (err as { code?: string; statusCode?: number })?.code;
        const status = (err as { statusCode?: number })?.statusCode;
        if (code === 'resource_missing' || status === 404) {
          algunaRespondio = true;
          continue;
        }
        this.logger.warn(
          `Pass-3: no se pudo verificar ${subscriptionId}: ${err instanceof Error ? err.message : String(err)}`,
        );
        return { tipo: 'no_comprobable' };
      }
    }

    if (!algunaRespondio) return { tipo: 'no_comprobable' };
    return { tipo: 'no_respalda', estado: ultimoEstado ?? 'inexistente' };
  }

  private async detectarPremiumSinRespaldo(
    activasEnStripe: Set<string>,
    keys: ReturnType<typeof getStripeAccountKeys>,
  ): Promise<PremiumSinRespaldo[]> {
    const out: PremiumSinRespaldo[] = [];

    const filas = (await this.db.execute(sql`
      SELECT us.user_id, us.stripe_subscription_id, up.email
        FROM user_subscriptions us
        JOIN user_profiles up ON up.id = us.user_id
       WHERE us.status = 'active'
         AND us.stripe_subscription_id IS NOT NULL
         AND us.stripe_subscription_id NOT LIKE 'sub_manual_%'
         AND up.premium_grant_reason IS NULL
    `)) as unknown as Array<{
      user_id: string;
      stripe_subscription_id: string;
      email: string | null;
    }>;

    // ⚠️ NO basta con «no está en `activasEnStripe`» (T-344, 30/07/2026). Ese conjunto lo llena el
    // Pase 2 listando Stripe con `created: { gte: since }` y **`since` son 30 días**, así que toda
    // suscripción más antigua falta de la lista aunque esté viva y al corriente. Medido en
    // producción: **159 usuarios acusados cada hora**, con 172 de las 257 filas activas creadas
    // hace más de 30 días. Se comprobaron cuatro uno a uno (44 a 156 días de antigüedad): los
    // cuatro premium activos con vencimiento futuro.
    //
    // El daño no era el ruido: este detector existe para cazar FUGA de premium (dinero), y con 159
    // falsos por hora la fuga de verdad queda enterrada — la lección de T-047/T-113/T-179.
    //
    // Por eso al sospechoso se le PREGUNTA por su id, que es O(sospechosos) y no O(cartera):
    // `subscriptions.retrieve(id)` en cada cuenta hasta encontrarla. Solo se acusa cuando Stripe
    // confirma que no existe o que está en un estado terminal; si no se puede comprobar (red, auth),
    // NO se acusa — mismo criterio fail-safe que el guard de `degraded`.
    let comprobadas = 0;
    let noComprobables = 0;
    for (const f of filas) {
      if (activasEnStripe.has(f.stripe_subscription_id)) continue;
      if (comprobadas >= MAX_VERIFICACIONES_POR_PASADA) {
        // Tope defensivo: se DICE, no se calla. Un recorte silencioso se lee como «no hay más».
        this.logger.warn(
          `Pass-3: tope de ${MAX_VERIFICACIONES_POR_PASADA} verificaciones alcanzado; el resto se mira en la siguiente pasada`,
        );
        break;
      }
      comprobadas++;
      const veredicto = await this.verificarSubEnStripe(
        f.stripe_subscription_id,
        keys,
      );
      if (veredicto.tipo === 'viva') continue;
      if (veredicto.tipo === 'no_comprobable') {
        noComprobables++;
        continue;
      }
      out.push({
        userId: f.user_id,
        email: f.email,
        motivo: 'fila_active_sin_sub_en_stripe',
        subscriptionId: f.stripe_subscription_id,
        estadoEnStripe: veredicto.estado,
      });
    }
    if (comprobadas > 0) {
      this.logger.log(
        `Pass-3: ${comprobadas} sospechoso(s) verificados por id · ${out.length} confirmados · ${noComprobables} no comprobables`,
      );
    }

    const perfiles = (await this.db.execute(sql`
      SELECT up.id, up.email
        FROM user_profiles up
       WHERE up.plan_type = 'premium'
         AND up.premium_grant_reason IS NULL
         AND NOT EXISTS (
           SELECT 1 FROM user_subscriptions us
            WHERE us.user_id = up.id AND us.status IN ('active','trialing','past_due'))
    `)) as unknown as Array<{ id: string; email: string | null }>;

    for (const p of perfiles) {
      out.push({
        userId: p.id,
        email: p.email,
        motivo: 'premium_sin_suscripcion_ni_concesion',
        subscriptionId: null,
      });
    }

    if (out.length > 0) {
      this.logger.warn(
        `Pass-3: ${out.length} usuario(s) con premium sin respaldo de pago`,
      );
    }
    return out;
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

/**
 * Estados de Stripe en los que una suscripción YA NO respalda el acceso. Todo lo demás (active,
 * trialing, past_due, unpaid…) se considera respaldo: `past_due` es alguien cuyo cobro falló pero
 * que sigue siendo cliente, y tratarlo como fuga sería acusar a quien está a un reintento de pagar.
 */
const ESTADOS_TERMINALES = new Set(['canceled', 'incomplete_expired']);

/**
 * Tope de verificaciones por id en una pasada. Con el bug de la ventana había 159 sospechosos por
 * hora; ya arreglado deberían ser ~0, pero si algo vuelve a inflarlos esto evita gastar una llamada
 * a Stripe por cada fila de la cartera. Si se alcanza, se DICE en el log (nunca un recorte mudo).
 */
const MAX_VERIFICACIONES_POR_PASADA = 300;

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

export interface PremiumSinRespaldo {
  userId: string;
  email: string | null;
  /** fila_active_sin_sub_en_stripe | premium_sin_suscripcion_ni_concesion */
  motivo: string;
  subscriptionId: string | null;
  /**
   * Estado REAL en Stripe cuando se pudo preguntar por id (T-344): `canceled`,
   * `incomplete_expired` o `inexistente`. Va en el hallazgo porque quien lo triaje necesita saber
   * si el cliente canceló o si el id no existe en ninguna cuenta — son dos historias distintas.
   */
  estadoEnStripe?: string;
}

export interface Pass2Result {
  stripeMissingInDb: number;
  stripeMissingFixed: number;
  errors: string[];
  /** true si alguna cuenta conocida no se pudo reconciliar. */
  degraded?: boolean;
  accounts?: Pass2AccountResult[];
  /** Pass-3: premium que nadie está pagando (solo detección). */
  sinRespaldo?: PremiumSinRespaldo[];
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
