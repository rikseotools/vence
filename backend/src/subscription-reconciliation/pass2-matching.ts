/**
 * Decisiones puras del Pass-2 de reconciliación (sin BD ni Stripe).
 *
 * Pass-2 rescata suscripciones que SÍ existen en Stripe pero NO llegaron a la
 * BD porque el webhook falló (incidente Andrea/Rocío/Mercedes, 27/05/2026).
 * Aquí viven las tres decisiones que hay que acertar en ese rescate:
 *
 *   1. ¿A QUÉ USUARIO pertenece la sub? — `pickMatch`
 *   2. ¿QUÉ PLAN es? — `resolvePlanType`
 *   3. ¿QUÉ hay que reparar del perfil además del premium? — `profileRepairs`
 *
 * Son puras a propósito: es la lógica que decide sobre el dinero de un
 * usuario, y así se testea sin red ni base de datos.
 */

/** Cuenta Stripe de la que salió la suscripción. */
export type PaymentAccount = string;

export type PlanType =
  | 'premium_monthly'
  | 'premium_quarterly'
  | 'premium_semester'
  | 'premium_annual';

/**
 * Plan a partir del intervalo de facturación de Stripe.
 *
 * El catálogo es 1 mes (29€), 3 meses (39€), 6 meses (69€) y anual (99€). La
 * versión anterior hacía `interval === 'year' ? annual : monthly`, así que una
 * trimestral o una semestral se guardaban como `premium_monthly` — y Nila vende
 * las dos. Un intervalo desconocido cae a mensual (lo más conservador: no
 * regala meses de acceso que el usuario no pagó).
 */
export function resolvePlanType(
  interval: string | null | undefined,
  intervalCount: number | null | undefined,
): PlanType {
  if (interval === 'year') return 'premium_annual';
  if (interval === 'month') {
    switch (intervalCount) {
      case 12:
        return 'premium_annual';
      case 6:
        return 'premium_semester';
      case 3:
        return 'premium_quarterly';
      default:
        return 'premium_monthly';
    }
  }
  return 'premium_monthly';
}

/** Cómo se localizó al usuario dueño de la suscripción. */
export type MatchSource = 'metadata' | 'customer_id' | 'email';

export interface MatchCandidates {
  /** user_id sacado de subscription.metadata.supabase_user_id (lo pone create-checkout). */
  byMetadata?: string | null;
  /** user_profiles.stripe_customer_id = customer de la sub. */
  byCustomerId?: string | null;
  /** user_profiles.email = email del customer en Stripe. */
  byEmail?: string | null;
}

export interface Match {
  userId: string;
  matchedBy: MatchSource;
  /** true si las vías disponibles no apuntan al mismo usuario. */
  conflict: boolean;
}

/**
 * Elige el usuario dueño de la suscripción, por orden de fiabilidad.
 *
 * `metadata.supabase_user_id` PRIMERO y no por gusto: lo escribe nuestro
 * `create-checkout` al crear la suscripción, antes de que el webhook exista en
 * la historia. `stripe_customer_id` en cambio lo escribe el WEBHOOK — que es
 * justo lo que ha fallado cuando Pass-2 entra en acción. Peor aún con dos
 * cuentas: un usuario de Manuel que re-compra por Nila tiene un `cus_` nuevo, y
 * si el webhook no llegó a grabarlo, el perfil conserva el viejo y el match por
 * customer NO encuentra a nadie. El email es el último recurso (el usuario pudo
 * cambiarlo en Stripe).
 *
 * `conflict` marca que dos vías apuntan a usuarios distintos: se aplica igual la
 * de más prioridad, pero el llamante debe registrarlo — significa datos cruzados.
 */
export function pickMatch(candidates: MatchCandidates): Match | null {
  const order: Array<[MatchSource, string | null | undefined]> = [
    ['metadata', candidates.byMetadata],
    ['customer_id', candidates.byCustomerId],
    ['email', candidates.byEmail],
  ];

  const found = order.filter(
    (entry): entry is [MatchSource, string] => !!entry[1],
  );
  if (found.length === 0) return null;

  const [matchedBy, userId] = found[0];
  const conflict = found.some(([, id]) => id !== userId);
  return { userId, matchedBy, conflict };
}

export interface ProfileState {
  stripeCustomerId: string | null;
  paymentAccount: string | null;
  planType: string | null;
}

export interface ProfileRepairs {
  /** plan_type = 'premium' + requires_payment = false */
  grantPremium: boolean;
  /** valor nuevo de stripe_customer_id, o null si ya está bien */
  stripeCustomerId: string | null;
  /** valor nuevo de payment_account, o null si ya está bien */
  paymentAccount: string | null;
}

/**
 * Qué hay que arreglar del perfil al rescatar una suscripción.
 *
 * Rescatar solo el premium deja al usuario a medias: si la sub vive en Nila y
 * el perfil sigue diciendo `payment_account='manuel'`, cancelar / portal /
 * reembolso resuelven la cuenta EQUIVOCADA. Y si el `stripe_customer_id` quedó
 * apuntando al customer viejo, la siguiente reconciliación vuelve a no
 * encontrarle por customer. Se reparan las tres cosas o ninguna.
 */
export function profileRepairs(
  profile: ProfileState,
  actual: { customerId: string; account: PaymentAccount },
): ProfileRepairs {
  return {
    grantPremium: profile.planType !== 'premium',
    stripeCustomerId:
      profile.stripeCustomerId === actual.customerId ? null : actual.customerId,
    paymentAccount:
      profile.paymentAccount === actual.account ? null : actual.account,
  };
}

/** true si no hay nada que tocar en el perfil. */
export function isNoOp(repairs: ProfileRepairs): boolean {
  return (
    !repairs.grantPremium &&
    repairs.stripeCustomerId === null &&
    repairs.paymentAccount === null
  );
}
