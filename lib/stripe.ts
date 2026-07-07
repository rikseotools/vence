// lib/stripe.ts
import Stripe from 'stripe'
import { loadStripe } from '@stripe/stripe-js'
import type { Stripe as StripeJS } from '@stripe/stripe-js'

// ============================================================================
// STRIPE MULTI-CUENTA
// ============================================================================
// La app opera N cuentas Stripe a la vez. Hoy: 'manuel' (renovaciones de lo
// existente) y 'nila' (altas nuevas). Cada suscripción/usuario sabe en qué
// cuenta vive (user_profiles.stripe_account); las operaciones resuelven el
// cliente correcto por esa columna.
//
// DISEÑO ESCALABLE: añadir una cuenta nueva = añadir una entrada en
// ACCOUNT_ENV + su bloque de env. Cero cambios de lógica en los consumidores.
//
// - 'manuel' lee las vars SIN sufijo (las históricas) → back-compat total.
// - 'nila'   lee las vars *_NILA.
// ============================================================================

export type StripeAccount = 'manuel' | 'nila'

// Cuenta por defecto: la histórica. `stripe()` sin argumentos = Manuel, para
// que todo el código legacy siga funcionando sin tocar hasta migrarlo.
export const DEFAULT_ACCOUNT: StripeAccount = 'manuel'

export const STRIPE_API_VERSION = '2024-06-20' as Stripe.LatestApiVersion

interface AccountEnv {
  secretKey: string
  webhookSecret: string
  publishableKey: string
  priceMonthly: string
  priceQuarterly: string
  priceSemester: string
}

// Mapa cuenta → nombres de variables de entorno. Es el ÚNICO sitio que sabe
// qué env pertenece a qué cuenta. Añadir una cuenta = añadir una fila aquí.
//
// NOTA POST-FLIP (07/07): las VENTAS van a 'nila'. Las 4 NEXT_PUBLIC_STRIPE_*
// sin sufijo (publishable + prices) apuntan ahora a los VALORES de Nila (=la
// cuenta de checkout ACTIVA del cliente). Por eso 'manuel' abajo las mapea pero
// esos campos quedan LEGACY/no usados: Manuel ya no recibe altas nuevas, solo
// renueva. getStripeFor('manuel') solo depende de su secretKey/webhookSecret
// (STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET), que SIGUEN siendo de Manuel.
const ACCOUNT_ENV: Record<StripeAccount, AccountEnv> = {
  manuel: {
    secretKey: 'STRIPE_SECRET_KEY',
    webhookSecret: 'STRIPE_WEBHOOK_SECRET',
    publishableKey: 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
    priceMonthly: 'NEXT_PUBLIC_STRIPE_PRICE_MONTHLY',
    priceQuarterly: 'NEXT_PUBLIC_STRIPE_PRICE_QUARTERLY',
    priceSemester: 'NEXT_PUBLIC_STRIPE_PRICE_SEMESTER',
  },
  nila: {
    secretKey: 'STRIPE_SECRET_KEY_NILA',
    webhookSecret: 'STRIPE_WEBHOOK_SECRET_NILA',
    publishableKey: 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY_NILA',
    priceMonthly: 'NEXT_PUBLIC_STRIPE_PRICE_MONTHLY_NILA',
    priceQuarterly: 'NEXT_PUBLIC_STRIPE_PRICE_QUARTERLY_NILA',
    priceSemester: 'NEXT_PUBLIC_STRIPE_PRICE_SEMESTER_NILA',
  },
}

const ALL_ACCOUNTS = Object.keys(ACCOUNT_ENV) as StripeAccount[]

/**
 * Normaliza un valor arbitrario (p.ej. user_profiles.stripe_account, que puede
 * venir null en filas legacy) a una cuenta válida. Desconocido/null → default.
 */
export function resolveAccount(value: string | null | undefined): StripeAccount {
  if (value && (ALL_ACCOUNTS as string[]).includes(value)) {
    return value as StripeAccount
  }
  return DEFAULT_ACCOUNT
}

/**
 * Cuenta a la que van las ALTAS NUEVAS. Controlada por
 * STRIPE_NEW_SIGNUPS_ACCOUNT (default 'manuel' = comportamiento histórico).
 * Este es el flag del "flip" — cambiarlo desvía los checkouts nuevos.
 */
export function newSignupAccount(): StripeAccount {
  return resolveAccount(process.env.STRIPE_NEW_SIGNUPS_ACCOUNT)
}

// ── Instancias server-side, cacheadas por cuenta (lazy) ──────────────────────
const _instances: Partial<Record<StripeAccount, Stripe>> = {}

/**
 * Cliente Stripe server-side para una cuenta concreta. Cacheado.
 * Lanza si falta la secret key de esa cuenta (mal configurada).
 */
export function getStripeFor(account: StripeAccount = DEFAULT_ACCOUNT): Stripe {
  const cached = _instances[account]
  if (cached) return cached

  const env = ACCOUNT_ENV[account]
  if (!env) throw new Error(`Cuenta Stripe desconocida: ${account}`)

  const secretKey = process.env[env.secretKey]
  if (!secretKey) {
    throw new Error(`Falta ${env.secretKey} (secret key de la cuenta '${account}')`)
  }

  const instance = new Stripe(secretKey, {
    // NOTE: La app usa API 2024-06-20 aunque el SDK espera 2025-06-30.basil.
    // No actualizar sin verificar breaking changes de Stripe.
    apiVersion: STRIPE_API_VERSION,
    appInfo: { name: 'Vence', version: '1.0.0' },
  })
  _instances[account] = instance
  return instance
}

/**
 * Compat: `stripe()` = cliente de la cuenta por defecto (Manuel). Mantiene la
 * firma histórica para no romper los ~40 call-sites existentes; se van
 * migrando a getStripeFor(account) a medida que se vuelven multi-cuenta.
 */
export const stripe = (): Stripe => getStripeFor(DEFAULT_ACCOUNT)

/**
 * Price IDs de una cuenta. Usado por create-checkout para validar que el
 * priceId entrante pertenece a la cuenta destino (guardrail anti half-flip).
 */
export function getPricesFor(account: StripeAccount): {
  monthly: string | undefined
  quarterly: string | undefined
  semester: string | undefined
} {
  const env = ACCOUNT_ENV[account]
  return {
    monthly: process.env[env.priceMonthly],
    quarterly: process.env[env.priceQuarterly],
    semester: process.env[env.priceSemester],
  }
}

/** true si el priceId pertenece a la cuenta indicada (según env configurado). */
export function priceBelongsToAccount(priceId: string, account: StripeAccount): boolean {
  const prices = getPricesFor(account)
  return priceId === prices.monthly
    || priceId === prices.quarterly
    || priceId === prices.semester
}

/**
 * Todas las cuentas que tienen webhook secret configurado, con su secret.
 * El endpoint de webhook prueba cada una para verificar la firma: la que
 * valida determina de qué cuenta viene el evento.
 */
export function getWebhookAccounts(): Array<{ account: StripeAccount; secret: string }> {
  const out: Array<{ account: StripeAccount; secret: string }> = []
  for (const account of ALL_ACCOUNTS) {
    const secret = process.env[ACCOUNT_ENV[account].webhookSecret]
    if (secret) out.push({ account, secret })
  }
  return out
}

// ── Cliente client-side (browser) ────────────────────────────────────────────
// Usa la publishable de la cuenta de altas nuevas activa en build. Las
// renovaciones no usan cliente browser (Stripe las cobra server-side).
let stripePromise: Promise<StripeJS | null> | null = null
export const getStripe = (): Promise<StripeJS | null> => {
  if (!stripePromise) {
    stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)
  }
  return stripePromise
}

// Verificar configuración (de la cuenta por defecto)
export const isStripeConfigured = (): boolean => {
  return !!(
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY &&
    process.env.STRIPE_SECRET_KEY
  )
}
