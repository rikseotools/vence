/**
 * Test de integridad: todas las suscripciones activas en Stripe deben tener
 * una fila correspondiente en user_subscriptions con status 'active'.
 *
 * Detecta el bug de gaditadelgado (suscripción activa en Stripe pero no
 * registrada en user_subscriptions → no recibe email de renovación).
 *
 * Requiere .env.local con STRIPE_SECRET_KEY y credenciales Supabase.
 * Se salta automáticamente si no hay credenciales.
 */
import https from 'https'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local', override: true })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const STRIPE_KEY = process.env.STRIPE_SECRET_KEY

const hasCredentials = !!(
  SUPABASE_URL &&
  SERVICE_KEY &&
  STRIPE_KEY &&
  !SUPABASE_URL.includes('test.supabase.co')
)

// --- Helpers ---

function supabaseGet<T = unknown>(table: string, params: string): Promise<T[]> {
  const url = `${SUPABASE_URL}/rest/v1/${table}?${params}`
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        apikey: SERVICE_KEY!,
        Authorization: `Bearer ${SERVICE_KEY}`,
      },
    }, (res) => {
      let data = ''
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => {
        try { resolve(JSON.parse(data)) }
        catch (e) { reject(e) }
      })
      res.on('error', reject)
    })
  })
}

function stripeGet<T = unknown>(path: string): Promise<T> {
  return new Promise((resolve, reject) => {
    https.get(`https://api.stripe.com/v1${path}`, {
      headers: {
        Authorization: `Bearer ${STRIPE_KEY}`,
      },
    }, (res) => {
      let data = ''
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => {
        try { resolve(JSON.parse(data)) }
        catch (e) { reject(e) }
      })
      res.on('error', reject)
    })
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
}

interface DbSub {
  stripe_subscription_id: string
  status: string
  user_id: string
}

const describeIfCredentials = hasCredentials ? describe : describe.skip

describeIfCredentials('Stripe ↔ user_subscriptions sync', () => {
  jest.setTimeout(30_000)

  it('all active Stripe subscriptions have a matching row in user_subscriptions', async () => {
    // 1. Get all active Stripe subscriptions (paginated)
    const allStripeSubs: StripeSub[] = []
    let hasMore = true
    let startingAfter = ''

    while (hasMore) {
      const params = startingAfter
        ? `status=active&limit=100&starting_after=${startingAfter}`
        : 'status=active&limit=100'
      const batch = await stripeGet<StripeListResponse>(`/subscriptions?${params}`)
      allStripeSubs.push(...batch.data)
      hasMore = batch.has_more
      if (batch.data.length > 0) {
        startingAfter = batch.data[batch.data.length - 1].id
      }
    }

    // 2. Get all active user_subscriptions
    const dbSubs = await supabaseGet<DbSub>(
      'user_subscriptions',
      'select=stripe_subscription_id,status,user_id&status=eq.active'
    )

    const dbSubIds = new Set(dbSubs.map((s) => s.stripe_subscription_id))

    // 3. Find active in Stripe but missing in DB
    const missing = allStripeSubs.filter((s) => !dbSubIds.has(s.id))

    if (missing.length > 0) {
      const details = missing
        .map(
          (s) =>
            `  - ${s.id} | customer: ${s.customer} | created: ${new Date(s.created * 1000).toISOString().slice(0, 10)}`
        )
        .join('\n')

      fail(
        `${missing.length} active Stripe subscription(s) not tracked in user_subscriptions:\n${details}\n\n` +
          'Fix: update user_subscriptions with correct stripe_subscription_id, status=active, and period dates.'
      )
    }

    expect(allStripeSubs.length).toBeGreaterThan(0)
    expect(missing.length).toBe(0)
  })

  it('no user_subscriptions rows with status=active point to a non-active Stripe subscription', async () => {
    // Get all active user_subscriptions that have a real Stripe ID (not sub_manual_*)
    const dbSubs = await supabaseGet<DbSub>(
      'user_subscriptions',
      'select=stripe_subscription_id,status,user_id&status=eq.active&stripe_subscription_id=not.like.sub_manual_*'
    )

    // Build a Set of active Stripe sub IDs (already fetched in prior test or fetch now)
    const allStripeSubs: StripeSub[] = []
    let hasMore = true
    let startingAfter = ''
    while (hasMore) {
      const params = startingAfter
        ? `status=active&limit=100&starting_after=${startingAfter}`
        : 'status=active&limit=100'
      const batch = await stripeGet<StripeListResponse>(`/subscriptions?${params}`)
      allStripeSubs.push(...batch.data)
      hasMore = batch.has_more
      if (batch.data.length > 0) startingAfter = batch.data[batch.data.length - 1].id
    }

    const activeStripeIds = new Set(allStripeSubs.map((s) => s.id))

    // Find DB rows marked active whose Stripe sub is NOT active
    const stale = dbSubs.filter((s) => !activeStripeIds.has(s.stripe_subscription_id))

    if (stale.length > 0) {
      const details = stale
        .map((s) => `  - ${s.stripe_subscription_id} | user: ${s.user_id}`)
        .join('\n')

      fail(
        `${stale.length} user_subscriptions row(s) marked active but not active in Stripe:\n${details}\n\n` +
          'Fix: update status in user_subscriptions to match Stripe.'
      )
    }

    expect(stale.length).toBe(0)
  }, 60_000)
})
