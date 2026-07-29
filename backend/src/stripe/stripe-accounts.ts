/**
 * Registro de cuentas Stripe para el backend.
 *
 * Espejo mínimo de `lib/stripe.ts` del frontend (ACCOUNT_ENV): el backend tiene
 * `rootDir: src` y no puede importar de la raíz del repo, así que la lista de
 * cuentas se declara aquí. Solo necesita las secret keys — el backend no cobra
 * ni firma webhooks, solo LEE (salud, reconciliación).
 *
 * REGLA: todo chequeo de negocio tiene que recorrer TODAS las cuentas conocidas,
 * no `STRIPE_SECRET_KEY` a pelo. Incidente 29/07/2026: con las altas nuevas en
 * Nila, leer solo la cuenta histórica daba MRR 0€ en /admin/conversiones y
 * dejaba el webhook de Nila SIN vigilar (falso verde: el cron decía "sano"
 * mirando una cuenta que ya casi no recibe eventos).
 *
 * Añadir una cuenta = una fila aquí + su env.
 */

export type StripeAccount = 'manuel' | 'nila';

/** cuenta → nombre de la variable de entorno con su secret key. */
export const STRIPE_ACCOUNT_SECRET_ENV: Record<StripeAccount, string> = {
  manuel: 'STRIPE_SECRET_KEY',
  nila: 'STRIPE_SECRET_KEY_NILA',
};

/**
 * cuenta → variable con su SIGNING SECRET de webhook.
 *
 * Son secrets DISTINTOS de las secret keys: cada cuenta firma sus eventos con
 * el suyo, y el handler `/api/stripe/webhook` verifica contra todos. Por eso un
 * fallo de firma puede afectar a UNA sola cuenta, y por eso la sonda sintética
 * tiene que firmar una vez por cuenta.
 */
export const STRIPE_ACCOUNT_WEBHOOK_SECRET_ENV: Record<StripeAccount, string> =
  {
    manuel: 'STRIPE_WEBHOOK_SECRET',
    nila: 'STRIPE_WEBHOOK_SECRET_NILA',
  };

/** Todas las cuentas CONOCIDAS (estén configuradas o no en este entorno). */
export const ALL_STRIPE_ACCOUNTS = Object.keys(
  STRIPE_ACCOUNT_SECRET_ENV,
) as StripeAccount[];

export interface StripeAccountKey {
  account: StripeAccount;
  /** null si el entorno no tiene esa secret key → cuenta SIN vigilancia. */
  secretKey: string | null;
  envVar: string;
}

/**
 * Todas las cuentas conocidas con su secret key (o null).
 *
 * Devuelve también las NO configuradas a propósito: una cuenta sin key es un
 * punto ciego de monitorización y el llamante tiene que poder decirlo en voz
 * alta, no omitirla de la lista y dar un verde incompleto.
 */
export function getStripeAccountKeys(
  env: NodeJS.ProcessEnv = process.env,
): StripeAccountKey[] {
  return ALL_STRIPE_ACCOUNTS.map((account) => {
    const envVar = STRIPE_ACCOUNT_SECRET_ENV[account];
    return { account, envVar, secretKey: env[envVar] || null };
  });
}

export interface StripeWebhookSecret {
  account: StripeAccount;
  /** null si este entorno no tiene el signing secret → cuenta SIN sonda. */
  secret: string | null;
  envVar: string;
}

/**
 * Signing secrets de webhook de todas las cuentas conocidas (o null).
 *
 * Misma regla que `getStripeAccountKeys`: se devuelven también las que faltan,
 * porque una cuenta sin sonda es un punto ciego que hay que poder nombrar.
 */
export function getStripeWebhookSecrets(
  env: NodeJS.ProcessEnv = process.env,
): StripeWebhookSecret[] {
  return ALL_STRIPE_ACCOUNTS.map((account) => {
    const envVar = STRIPE_ACCOUNT_WEBHOOK_SECRET_ENV[account];
    return { account, envVar, secret: env[envVar] || null };
  });
}
