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
  priceAnnual: string
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
    priceAnnual: 'NEXT_PUBLIC_STRIPE_PRICE_ANNUAL',
  },
  nila: {
    secretKey: 'STRIPE_SECRET_KEY_NILA',
    webhookSecret: 'STRIPE_WEBHOOK_SECRET_NILA',
    publishableKey: 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY_NILA',
    priceMonthly: 'NEXT_PUBLIC_STRIPE_PRICE_MONTHLY_NILA',
    priceQuarterly: 'NEXT_PUBLIC_STRIPE_PRICE_QUARTERLY_NILA',
    priceSemester: 'NEXT_PUBLIC_STRIPE_PRICE_SEMESTER_NILA',
    priceAnnual: 'NEXT_PUBLIC_STRIPE_PRICE_ANNUAL_NILA',
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
  annual: string | undefined
} {
  const env = ACCOUNT_ENV[account]
  return {
    monthly: process.env[env.priceMonthly],
    quarterly: process.env[env.priceQuarterly],
    semester: process.env[env.priceSemester],
    annual: process.env[env.priceAnnual],
  }
}

/** true si el priceId pertenece a la cuenta indicada (según env configurado). */
export function priceBelongsToAccount(priceId: string, account: StripeAccount): boolean {
  const prices = getPricesFor(account)
  return priceId === prices.monthly
    || priceId === prices.quarterly
    || priceId === prices.semester
    || priceId === prices.annual
}

export type PriceTier = 'monthly' | 'quarterly' | 'semester' | 'annual'

/**
 * Devuelve el tier (mensual/trimestral/semestral) de un priceId buscándolo en
 * TODAS las cuentas configuradas. `null` si no se reconoce en ninguna.
 * Permite normalizar un precio sin importar de qué cuenta venga.
 */
export function getPriceTier(priceId: string): PriceTier | null {
  for (const account of ALL_ACCOUNTS) {
    const p = getPricesFor(account)
    if (priceId === p.monthly) return 'monthly'
    if (priceId === p.quarterly) return 'quarterly'
    if (priceId === p.semester) return 'semester'
    if (priceId === p.annual) return 'annual'
  }
  return null
}

/**
 * Traduce un priceId al precio equivalente (mismo tier) de la cuenta indicada.
 * Devuelve el priceId de destino, o `null` si el precio de origen no se
 * reconoce o la cuenta destino no tiene ese tier configurado.
 *
 * Robustez: el frontend hornea los `NEXT_PUBLIC_STRIPE_PRICE_*` en build-time,
 * así que puede enviar el precio de una cuenta distinta a la que enruta el flag
 * `STRIPE_NEW_SIGNUPS_ACCOUNT` en runtime. En vez de rechazar (half-flip → 400),
 * el checkout normaliza el precio a la cuenta activa por su tier. Escala a N
 * cuentas y sobrevive a flips en ambos sentidos sin rebuild del frontend.
 */
export function resolvePriceForAccount(priceId: string, account: StripeAccount): string | null {
  const tier = getPriceTier(priceId)
  if (!tier) return null
  return getPricesFor(account)[tier] ?? null
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

// ── Lecturas agregadas multi-cuenta (paneles de negocio) ─────────────────────
// REGLA: cualquier métrica agregada de negocio (MRR, churn, renovaciones,
// antigüedad) tiene que mirar TODAS las cuentas configuradas, no `stripe()`.
// Incidente 29/07/2026: /admin/conversiones barría `/v1/subscriptions` con
// STRIPE_SECRET_KEY (= Manuel, en vaciado y con el 100% de sus subs en
// cancel_at_period_end) → MRR 0€, ARR 0€, renovaciones 0€ y churn saturado,
// mientras Nila tenía 53 subs vivas (~747€/mes) invisibles para el panel.

/** Cuentas con secret key configurada (las que se pueden leer server-side). */
export function getConfiguredAccounts(): StripeAccount[] {
  return ALL_ACCOUNTS.filter(a => !!process.env[ACCOUNT_ENV[a].secretKey])
}

/**
 * Suscripción tal como la devuelve la API REST de Stripe, con lo mínimo que
 * necesitan los paneles + la cuenta de la que salió. Tipo laxo a propósito: se
 * consume el JSON crudo (la app fija apiVersion 2024-06-20, donde
 * current_period_* vive en la sub; en versiones nuevas vive en el item).
 */
export interface StripeSubscriptionLite {
  id: string
  status: string
  cancel_at_period_end: boolean
  current_period_start?: number
  current_period_end?: number
  created: number
  canceled_at?: number
  metadata?: Record<string, string>
  items: {
    data: Array<{
      price?: { recurring?: { interval: string; interval_count: number } }
      current_period_start?: number
      current_period_end?: number
    }>
  }
  /** Cuenta Stripe de la que salió esta suscripción. */
  stripe_account: StripeAccount
}

/** Salud por cuenta de una lectura agregada — para no fallar en silencio. */
export interface StripeAccountReadStatus {
  account: StripeAccount
  ok: boolean
  count: number
  error?: string
}

/** Fetcher inyectable de una página de la API REST (tests sin red). */
export type StripePageFetcher = (args: { secretKey: string; path: string }) => Promise<{
  data?: unknown[]
  has_more?: boolean
  error?: { message?: string }
}>

const httpsPageFetcher: StripePageFetcher = ({ secretKey, path }) =>
  new Promise((resolve, reject) => {
    // require diferido: lib/stripe.ts también se importa desde el browser
    // (getStripe/loadStripe) y `https` no existe ahí.
    import('https').then(({ default: https }) => {
      const req = https.request(
        { hostname: 'api.stripe.com', path, method: 'GET', headers: { Authorization: 'Bearer ' + secretKey } },
        (res) => {
          let data = ''
          res.on('data', (chunk) => { data += chunk })
          res.on('end', () => {
            try { resolve(JSON.parse(data)) } catch { reject(new Error(`Respuesta no-JSON de Stripe (HTTP ${res.statusCode})`)) }
          })
        },
      )
      req.on('error', reject)
      req.end()
    }).catch(reject)
  })

/**
 * Barre TODAS las suscripciones (status=all) de todas las cuentas configuradas,
 * en paralelo, etiquetando cada una con su cuenta.
 *
 * No lanza si una cuenta falla: devuelve lo que sí pudo leer + el estado por
 * cuenta, para que el consumidor avise en vez de mostrar un número corto sin
 * decir nada (que es justo el modo de fallo que originó esta función).
 */
export async function listSubscriptionsAllAccounts(opts: {
  accounts?: StripeAccount[]
  fetchPage?: StripePageFetcher
} = {}): Promise<{ subscriptions: StripeSubscriptionLite[]; accounts: StripeAccountReadStatus[] }> {
  const accounts = opts.accounts ?? getConfiguredAccounts()
  const fetchPage = opts.fetchPage ?? httpsPageFetcher

  const results = await Promise.all(accounts.map(async (account): Promise<{
    subs: StripeSubscriptionLite[]
    status: StripeAccountReadStatus
  }> => {
    const secretKey = process.env[ACCOUNT_ENV[account].secretKey]
    if (!secretKey) {
      return { subs: [], status: { account, ok: false, count: 0, error: `Falta ${ACCOUNT_ENV[account].secretKey}` } }
    }
    const subs: StripeSubscriptionLite[] = []
    try {
      let hasMore = true
      let startingAfter: string | null = null
      while (hasMore) {
        let path = '/v1/subscriptions?limit=100&status=all'
        if (startingAfter) path += '&starting_after=' + startingAfter
        const page = await fetchPage({ secretKey, path })
        if (page.error) throw new Error(page.error.message || 'error de Stripe')
        const rows = (page.data ?? []) as Array<Omit<StripeSubscriptionLite, 'stripe_account'>>
        for (const row of rows) subs.push({ ...row, stripe_account: account })
        hasMore = !!page.has_more
        if (rows.length > 0) startingAfter = rows[rows.length - 1].id
        else hasMore = false
      }
      return { subs, status: { account, ok: true, count: subs.length } }
    } catch (err) {
      return { subs, status: { account, ok: false, count: subs.length, error: (err as Error).message } }
    }
  }))

  return {
    subscriptions: results.flatMap(r => r.subs),
    accounts: results.map(r => r.status),
  }
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
