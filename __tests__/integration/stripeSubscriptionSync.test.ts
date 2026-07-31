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
 *
 * ## Agnóstico por contrato
 *
 * Las cuentas NO se enumeran aquí: se leen del registro (`lib/stripe.ts`), que es el único sitio
 * que sabe qué cuentas existen y de qué variable sale cada clave. Una copia de esa lista en el
 * test se separaría del registro el día que se añada una cuenta —y lo haría en silencio, dando
 * verde sobre media realidad, que es justo el defecto que este arreglo corrige—. Añadir una
 * cuenta al registro basta para que este test la cubra, sin tocarlo.
 */
import { testDbConfig } from '../helpers/db'
import dotenv from 'dotenv'
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

// El registro es la ÚNICA fuente de qué cuentas hay. Se importa después de cargar .env.local
// porque `getConfiguredAccounts` mira el entorno.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { STRIPE_ACCOUNTS, getConfiguredAccounts, listSubscriptionsAllAccounts } =
  require('@/lib/stripe') as typeof import('@/lib/stripe')

const DB_URL = process.env.DATABASE_URL
const cuentasConocidas = [...STRIPE_ACCOUNTS]
const cuentasLegibles = getConfiguredAccounts()
const hasCredentials = !!DB_URL && cuentasLegibles.length > 0

interface SubActiva {
  id: string
  cuenta: string
  created: number
}

const describeIfCredentials = hasCredentials ? describe : describe.skip

describeIfCredentials('Stripe ↔ user_subscriptions sync (RDS, todas las cuentas)', () => {
  jest.setTimeout(60_000)

  let client: Client
  let stripeActivas: SubActiva[] = []
  let cuentasIlegibles: string[] = []

  beforeAll(async () => {
    client = new Client(testDbConfig())
    await client.connect()
    await client.query("SET statement_timeout='20000ms'")
    // Mismo barrido multi-cuenta que usa el panel: una implementación, no una copia.
    const { subscriptions, accounts } = await listSubscriptionsAllAccounts()
    cuentasIlegibles = accounts.filter((a) => !a.ok).map((a) => `${a.account}: ${a.error ?? 'sin leer'}`)
    stripeActivas = subscriptions
      .filter((s) => s.status === 'active')
      .map((s) => ({ id: s.id, cuenta: s.stripe_account, created: s.created }))
  })

  afterAll(async () => {
    if (client) await client.end()
  })

  it('cubre TODAS las cuentas del registro, sin nombrar ninguna', () => {
    // No se comprueba "que sean manuel y nila": se comprueba que no falte ninguna de las que el
    // registro declara. Así, añadir una cuenta la cubre sola; nombrarlas aquí obligaría a
    // acordarse de tocar este fichero, y olvidarlo daría verde sobre media realidad.
    expect(cuentasLegibles.sort()).toEqual(cuentasConocidas.sort())
    expect(cuentasIlegibles).toEqual([])
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
            `  - [${s.cuenta}] ${s.id} | creada: ${new Date(s.created * 1000).toISOString().slice(0, 10)}`,
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
