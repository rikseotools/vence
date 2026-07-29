/**
 * @jest-environment node
 */
/**
 * Test de integridad: toda suscripción ACTIVA en Stripe debe tener su fila en
 * `user_subscriptions`, y viceversa.
 *
 * Detecta el bug de gaditadelgado (suscripción activa en Stripe pero no registrada en BD → el
 * usuario paga y no recibe ni el premium ni el email de renovación). Es la MISMA invariante que
 * vigila el Pass-2 de `subscription-reconciliation`, medida desde fuera.
 *
 * ## Dos arreglos (29/07/2026) — llevaba 25 días en rojo sin detectar nada
 *
 * 1. **Miraba SUPABASE, congelado desde el cutover a RDS del 04/07.** Denunciaba 13 suscripciones
 *    "no registradas", todas creadas entre el 4 y el 6 de julio —justo la ventana del cutover—:
 *    comprobado a mano, las 13 están en RDS y `active`. Un test que compara contra una base de
 *    datos que ya nadie escribe no es un falso positivo tolerable: es una vigilancia apagada que
 *    encima entrena a ignorar su rojo.
 * 2. **Leía una sola cuenta Stripe.** Con las altas nuevas en la cuenta de Nila, la suscripción
 *    que este test existe para cazar era justo la que no miraba. Mismo punto ciego que ese día se
 *    corrigió en /admin/conversiones, check-webhook-health, el Pass-2 y el canary del webhook.
 */
import dotenv from 'dotenv'
import https from 'https'
import { Client } from 'pg'

dotenv.config({ path: '.env.local', override: true })
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
// RDS presenta un certificado cuya cadena node no valida por defecto, y `sslmode` en la URL
// GANA sobre la opción `ssl` del cliente: sin normalizarlo, la conexión muere con
// "self-signed certificate in certificate chain". Mismo tratamiento que en
// agnosticismoQueries.integration.test.ts (read-only contra la misma BD).
if (process.env.DATABASE_URL) {
  process.env.DATABASE_URL = /sslmode=/.test(process.env.DATABASE_URL)
    ? process.env.DATABASE_URL.replace(/sslmode=[a-z-]+/, 'sslmode=no-verify')
    : process.env.DATABASE_URL + (process.env.DATABASE_URL.includes('?') ? '&' : '?') + 'sslmode=no-verify'
}

/** Cuentas conocidas → su env. Espejo del registro (lib/stripe.ts): añadir una = una fila. */
const CUENTAS: Array<{ cuenta: string; env: string }> = [
  { cuenta: 'manuel', env: 'STRIPE_SECRET_KEY' },
  { cuenta: 'nila', env: 'STRIPE_SECRET_KEY_NILA' },
]

const DB_URL = process.env.DATABASE_URL
const clavesConfiguradas = CUENTAS.filter((c) => !!process.env[c.env])
const hasCredentials = !!DB_URL && clavesConfiguradas.length > 0

function stripeGet<T = unknown>(secretKey: string, path: string): Promise<T> {
  return new Promise((resolve, reject) => {
    https.get(
      `https://api.stripe.com/v1${path}`,
      { headers: { Authorization: `Bearer ${secretKey}` } },
      (res) => {
        let data = ''
        res.on('data', (chunk) => { data += chunk })
        res.on('end', () => {
          try { resolve(JSON.parse(data)) } catch (e) { reject(e) }
        })
        res.on('error', reject)
      },
    )
  })
}

interface StripeSub {
  id: string
  customer: string
  status: string
  created: number
}

interface StripeListResponse {
  data: StripeSub[]
  has_more: boolean
  error?: { message?: string }
}

/** Todas las subs `active` de UNA cuenta, etiquetadas con ella. */
async function subsActivasDe(
  cuenta: string,
  secretKey: string,
): Promise<Array<StripeSub & { cuenta: string }>> {
  const out: Array<StripeSub & { cuenta: string }> = []
  let hasMore = true
  let startingAfter = ''
  while (hasMore) {
    const params = startingAfter
      ? `status=active&limit=100&starting_after=${startingAfter}`
      : 'status=active&limit=100'
    const batch = await stripeGet<StripeListResponse>(secretKey, `/subscriptions?${params}`)
    if (batch.error) throw new Error(`Stripe [${cuenta}]: ${batch.error.message ?? 'error'}`)
    const data = batch.data ?? []
    out.push(...data.map((s) => ({ ...s, cuenta })))
    hasMore = !!batch.has_more && data.length > 0
    if (data.length > 0) startingAfter = data[data.length - 1].id
  }
  return out
}

const describeIfCredentials = hasCredentials ? describe : describe.skip

describeIfCredentials('Stripe ↔ user_subscriptions sync (RDS, todas las cuentas)', () => {
  jest.setTimeout(60_000)

  let client: Client
  let stripeActivas: Array<StripeSub & { cuenta: string }> = []

  beforeAll(async () => {
    client = new Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } })
    await client.connect()
    await client.query("SET statement_timeout='20000ms'")
    stripeActivas = (
      await Promise.all(clavesConfiguradas.map((c) => subsActivasDe(c.cuenta, process.env[c.env]!)))
    ).flat()
  })

  afterAll(async () => {
    if (client) await client.end()
  })

  it('mira TODAS las cuentas Stripe configuradas, no solo la histórica', () => {
    // Si esta lista se queda corta, los dos tests de abajo dan verde sobre media realidad —
    // que es exactamente lo que pasaba antes del 29/07.
    expect(clavesConfiguradas.map((c) => c.cuenta)).toEqual(['manuel', 'nila'])
    expect(stripeActivas.length).toBeGreaterThan(0)
  })

  it('toda suscripción activa en Stripe tiene su fila en user_subscriptions', async () => {
    const { rows } = await client.query<{ stripe_subscription_id: string }>(
      "SELECT stripe_subscription_id FROM user_subscriptions WHERE status = 'active' AND stripe_subscription_id IS NOT NULL",
    )
    const enBd = new Set(rows.map((r) => r.stripe_subscription_id))
    const faltan = stripeActivas.filter((s) => !enBd.has(s.id))

    if (faltan.length > 0) {
      const detalle = faltan
        .map(
          (s) =>
            `  - [${s.cuenta}] ${s.id} | customer: ${s.customer} | creada: ${new Date(s.created * 1000).toISOString().slice(0, 10)}`,
        )
        .join('\n')
      throw new Error(
        `${faltan.length} suscripción(es) activa(s) en Stripe SIN fila en user_subscriptions:\n${detalle}\n\n` +
          'Es el caso "pagó y no se le aplicó": lo repara el Pass-2 de subscription-reconciliation ' +
          '(cron horario). Si persiste, mirar el webhook de ESA cuenta — cada una tiene su signing secret.',
      )
    }
    expect(faltan).toHaveLength(0)
  })

  it('ninguna fila active de la BD apunta a una suscripción que ya no está activa en Stripe', async () => {
    // `sub_manual_*` son altas manuales sin Stripe detrás: no tienen contraparte que comprobar.
    const { rows } = await client.query<{ stripe_subscription_id: string; user_id: string }>(
      `SELECT stripe_subscription_id, user_id FROM user_subscriptions
        WHERE status = 'active' AND stripe_subscription_id IS NOT NULL
          AND stripe_subscription_id NOT LIKE 'sub_manual_%'`,
    )
    const activasEnStripe = new Set(stripeActivas.map((s) => s.id))
    const fantasma = rows.filter((r) => !activasEnStripe.has(r.stripe_subscription_id))

    if (fantasma.length > 0) {
      const detalle = fantasma
        .map((r) => `  - ${r.stripe_subscription_id} (user ${r.user_id})`)
        .join('\n')
      throw new Error(
        `${fantasma.length} fila(s) active en BD sin suscripción activa en NINGUNA cuenta Stripe:\n${detalle}\n\n` +
          'Es premium regalado: alguien canceló en Stripe y la BD no se enteró (webhook perdido).',
      )
    }
    expect(fantasma).toHaveLength(0)
  })
})
