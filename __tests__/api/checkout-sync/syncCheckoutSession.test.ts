// __tests__/api/checkout-sync/syncCheckoutSession.test.ts
//
// Tests de syncCheckoutSession — activación síncrona post-checkout.
// Origen: incidente 27/05/2026 (Rocío/Mercedes). El test cubre TODOS los
// paths críticos: happy path, idempotencia con webhook, anti-manipulación
// session_id, 3DS pending, no_subscription, errores Stripe/DB.

// ─── Mocks ───────────────────────────────────────────────────────────────

const mockStripeRetrieve = jest.fn()
const mockGetAdminDb = jest.fn()
const mockEmit = jest.fn()

jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    checkout: {
      sessions: { retrieve: mockStripeRetrieve },
    },
  }))
})

// El módulo fue migrado de Supabase (createClient/.from) a Drizzle (getAdminDb).
// Mockeamos en la frontera @/db/client siguiendo el patrón de los tests Drizzle
// del repo (ver __tests__/lib/laws/lawSlugParity.test.ts).
jest.mock('@/db/client', () => ({
  getAdminDb: () => mockGetAdminDb(),
}))

jest.mock('@/lib/observability/emit', () => ({
  emit: (...args: unknown[]) => mockEmit(...args),
}))

jest.mock('@/lib/stripe-webhook-handlers', () => ({
  determinePlanType: jest.fn(() => 'premium_monthly'),
}))

jest.mock('@/lib/api/profile', () => ({
  invalidateProfileCache: jest.fn(),
}))

// Mock del cliente Drizzle (getAdminDb). syncCheckoutSession ejecuta, en orden:
//   1. SELECT profile por id        -> [profile]
//   2. (solo primer pago) SELECT owner por stripe_customer_id -> [owner] | []
//   3. SELECT subscription existente -> [existing] | []
//   y luego INSERT...onConflictDoUpdate + UPDATE userProfiles.
// `selects` es la cola de resultados (arrays) que devuelve cada `.limit()` en
// orden de llamada. upsertErr/updateErr simulan throws de Drizzle.
function makeDb({
  selects = [],
  upsertErr = null,
  updateErr = null,
}: {
  selects?: Array<Array<Record<string, unknown>>>
  upsertErr?: Error | null
  updateErr?: Error | null
}) {
  const queue = [...selects]
  const select = jest.fn(() => ({
    from: jest.fn(() => ({
      where: jest.fn(() => ({
        limit: jest.fn().mockResolvedValue(queue.length ? queue.shift() : []),
      })),
    })),
  }))

  const onConflictDoUpdate = upsertErr
    ? jest.fn().mockRejectedValue(upsertErr)
    : jest.fn().mockResolvedValue(undefined)
  const values = jest.fn(() => ({ onConflictDoUpdate }))
  const insert = jest.fn(() => ({ values }))

  const updWhere = updateErr
    ? jest.fn().mockRejectedValue(updateErr)
    : jest.fn().mockResolvedValue(undefined)
  const set = jest.fn(() => ({ where: updWhere }))
  const update = jest.fn(() => ({ set }))

  return { select, insert, update, _set: set, _values: values }
}

// SUT después de los mocks
import { syncCheckoutSession } from '@/lib/api/checkout-sync/queries'

const USER_ID = '00000000-0000-0000-0000-000000000001'
const SESSION_ID = 'cs_test_abc123XYZ'

beforeEach(() => {
  jest.clearAllMocks()
  process.env.STRIPE_SECRET_KEY = 'sk_test_fake'
})

function makeStripeSession(overrides: Record<string, unknown> = {}) {
  return {
    id: SESSION_ID,
    customer: 'cus_user1',
    payment_status: 'paid',
    mode: 'subscription',
    status: 'complete',
    subscription: {
      id: 'sub_abc123',
      status: 'active',
      created: Math.floor(Date.now() / 1000),
      current_period_start: Math.floor(Date.now() / 1000),
      current_period_end: Math.floor(Date.now() / 1000) + 30 * 86400,
      trial_start: null,
      trial_end: null,
      items: {
        data: [{
          price: { recurring: { interval: 'month' } },
          current_period_start: Math.floor(Date.now() / 1000),
          current_period_end: Math.floor(Date.now() / 1000) + 30 * 86400,
        }],
      },
    },
    ...overrides,
  }
}

describe('syncCheckoutSession — happy path', () => {
  test('status=activated cuando paid + nuevo (sub no existe en BD)', async () => {
    mockGetAdminDb.mockReturnValue(makeDb({
      selects: [
        [{ id: USER_ID, email: 'user@test.com', stripe_customer_id: 'cus_user1', plan_type: 'free' }],
        [], // existing sub: no existe en BD
      ],
    }))

    mockStripeRetrieve.mockResolvedValueOnce(makeStripeSession())

    const res = await syncCheckoutSession(USER_ID, { sessionId: SESSION_ID })

    expect(res.success).toBe(true)
    if (!res.success) return
    expect(res.status).toBe('activated')
    expect(res.subscriptionId).toBe('sub_abc123')
    expect(res.planType).toBe('premium_monthly')
    expect(res.activatedBySync).toBe(true)
    expect(res.paymentStatus).toBe('paid')

    // Telemetría
    const activated = mockEmit.mock.calls.find(c => (c[0] as { eventType?: string }).eventType === 'checkout_sync_activated')
    expect(activated).toBeDefined()
    expect((activated![0] as { severity?: string }).severity).toBe('info')
  })
})

describe('syncCheckoutSession — idempotencia con webhook', () => {
  test('si la sub ya existe en BD (webhook llegó primero) → already_active sin upsert', async () => {
    const db = makeDb({
      selects: [
        [{ id: USER_ID, email: 'user@test.com', stripe_customer_id: 'cus_user1', plan_type: 'premium' }],
        [{ id: 'row1', status: 'active' }], // existing sub
      ],
    })
    mockGetAdminDb.mockReturnValue(db)

    mockStripeRetrieve.mockResolvedValueOnce(makeStripeSession())

    const res = await syncCheckoutSession(USER_ID, { sessionId: SESSION_ID })

    expect(res.success).toBe(true)
    if (!res.success) return
    expect(res.status).toBe('already_active')
    expect(res.activatedBySync).toBe(false)
    expect(db._values).not.toHaveBeenCalled() // no upsert

    const evt = mockEmit.mock.calls.find(c => (c[0] as { eventType?: string }).eventType === 'checkout_sync_already_synced_by_webhook')
    expect(evt).toBeDefined()
  })

  test('si la sub existe pero profile.plan_type aún es free → corrige profile sin upsert sub', async () => {
    // Caso: webhook insertó user_subscriptions pero falló UPDATE profile
    // (race condition rara). El sync detecta y corrige profile sin volver
    // a tocar la sub (idempotencia preservada).
    const db = makeDb({
      selects: [
        [{ id: USER_ID, email: 'user@test.com', stripe_customer_id: 'cus_user1', plan_type: 'free' }], // ← drift
        [{ id: 'row1', status: 'active' }], // existing sub
      ],
    })
    mockGetAdminDb.mockReturnValue(db)

    mockStripeRetrieve.mockResolvedValueOnce(makeStripeSession())

    const res = await syncCheckoutSession(USER_ID, { sessionId: SESSION_ID })

    expect(res.success).toBe(true)
    if (!res.success) return
    expect(res.status).toBe('already_active')
    expect(db._values).not.toHaveBeenCalled() // no toca la sub
    expect(db._set).toHaveBeenCalledWith({ planType: 'premium', requiresPayment: false })
  })
})

describe('syncCheckoutSession — anti-manipulación session_id', () => {
  test('session.customer NO coincide con profile.stripe_customer_id → unauthorized', async () => {
    mockGetAdminDb.mockReturnValue(makeDb({
      selects: [[{ id: USER_ID, email: 'user@test.com', stripe_customer_id: 'cus_user1', plan_type: 'free' }]],
    }))

    // Session pertenece a OTRO customer
    mockStripeRetrieve.mockResolvedValueOnce(makeStripeSession({ customer: 'cus_OTHER_user' }))

    const res = await syncCheckoutSession(USER_ID, { sessionId: SESSION_ID })

    expect(res.success).toBe(false)
    if (res.success) return
    expect(res.code).toBe('unauthorized')

    const evt = mockEmit.mock.calls.find(c => (c[0] as { eventType?: string }).eventType === 'checkout_sync_unauthorized')
    expect(evt).toBeDefined()
    expect((evt![0] as { severity?: string }).severity).toBe('warn')
  })

  test('session.customer es null → unauthorized (no asumimos identidad)', async () => {
    mockGetAdminDb.mockReturnValue(makeDb({
      selects: [[{ id: USER_ID, stripe_customer_id: 'cus_user1', plan_type: 'free' }]],
    }))
    mockStripeRetrieve.mockResolvedValueOnce(makeStripeSession({ customer: null }))

    const res = await syncCheckoutSession(USER_ID, { sessionId: SESSION_ID })

    expect(res.success).toBe(false)
    if (res.success) return
    expect(res.code).toBe('unauthorized')
  })
})

describe('syncCheckoutSession — primer pago (profile.stripe_customer_id era null)', () => {
  test('primer pago + customer libre → auto-vincula + activa premium', async () => {
    // Profile sin stripe_customer_id (primer pago); owner del customer libre.
    const db = makeDb({
      selects: [
        [{ id: USER_ID, email: 'newpayer@test.com', stripe_customer_id: null, plan_type: 'free' }],
        [], // owner of customer → libre
        [], // existing sub → no existe
      ],
    })
    mockGetAdminDb.mockReturnValue(db)

    mockStripeRetrieve.mockResolvedValueOnce(makeStripeSession({ customer: 'cus_brand_new' }))

    const res = await syncCheckoutSession(USER_ID, { sessionId: SESSION_ID })

    expect(res.success).toBe(true)
    if (!res.success) return
    expect(res.status).toBe('activated')

    // UPDATE profile incluye stripe_customer_id auto-vinculado (Drizzle camelCase)
    expect(db._set).toHaveBeenCalledWith(
      expect.objectContaining({
        planType: 'premium',
        requiresPayment: false,
        stripeCustomerId: 'cus_brand_new',
      }),
    )

    // Telemetría con firstTimePayer=true
    const evt = mockEmit.mock.calls.find(c => (c[0] as { eventType?: string }).eventType === 'checkout_sync_activated')
    expect(evt).toBeDefined()
    expect((evt![0] as { metadata?: { firstTimePayer?: boolean } }).metadata?.firstTimePayer).toBe(true)
  })

  test('primer pago + customer YA tomado por otro user → unauthorized (anti-takeover)', async () => {
    mockGetAdminDb.mockReturnValue(makeDb({
      selects: [
        [{ id: USER_ID, stripe_customer_id: null, plan_type: 'free' }],
        [{ id: 'other-user-id-XXX' }], // owner of customer → otro user
      ],
    }))

    mockStripeRetrieve.mockResolvedValueOnce(makeStripeSession({ customer: 'cus_stolen' }))

    const res = await syncCheckoutSession(USER_ID, { sessionId: SESSION_ID })

    expect(res.success).toBe(false)
    if (res.success) return
    expect(res.code).toBe('unauthorized')

    // Telemetría con severity error (es ataque, no warning casual)
    const evt = mockEmit.mock.calls.find(c => (c[0] as { eventType?: string }).eventType === 'checkout_sync_unauthorized')
    expect(evt).toBeDefined()
    expect((evt![0] as { severity?: string }).severity).toBe('error')
    expect((evt![0] as { metadata?: { reason?: string } }).metadata?.reason).toBe('customer_owned_by_other_user')
  })

  test('renewal: profile.stripe_customer_id coincide → NO auto-vincula (no añade stripe_customer_id al UPDATE)', async () => {
    const db = makeDb({
      selects: [
        [{ id: USER_ID, stripe_customer_id: 'cus_existing', plan_type: 'free' }], // free porque webhook anterior se perdió
        [], // existing sub
      ],
    })
    mockGetAdminDb.mockReturnValue(db)

    mockStripeRetrieve.mockResolvedValueOnce(makeStripeSession({ customer: 'cus_existing' }))

    const res = await syncCheckoutSession(USER_ID, { sessionId: SESSION_ID })

    expect(res.success).toBe(true)
    // El UPDATE no incluye stripeCustomerId (ya estaba bien)
    const call = db._set.mock.calls[0]
    expect(call[0]).toEqual({ planType: 'premium', requiresPayment: false })
    expect(call[0]).not.toHaveProperty('stripeCustomerId')
  })
})

describe('syncCheckoutSession — 3DS / async payment', () => {
  test('payment_status=unpaid → pending_payment (no activa, no error)', async () => {
    mockGetAdminDb.mockReturnValue(makeDb({
      selects: [[{ id: USER_ID, stripe_customer_id: 'cus_user1', plan_type: 'free' }]],
    }))
    mockStripeRetrieve.mockResolvedValueOnce(makeStripeSession({ payment_status: 'unpaid' }))

    const res = await syncCheckoutSession(USER_ID, { sessionId: SESSION_ID })

    expect(res.success).toBe(true)
    if (!res.success) return
    expect(res.status).toBe('pending_payment')
    expect(res.activatedBySync).toBe(false)
    expect(res.paymentStatus).toBe('unpaid')

    const evt = mockEmit.mock.calls.find(c => (c[0] as { eventType?: string }).eventType === 'checkout_sync_pending_payment')
    expect(evt).toBeDefined()
  })
})

describe('syncCheckoutSession — casos de error', () => {
  test('checkout session no encontrada → session_not_found', async () => {
    mockGetAdminDb.mockReturnValue(makeDb({
      selects: [[{ id: USER_ID, stripe_customer_id: 'cus_user1', plan_type: 'free' }]],
    }))
    mockStripeRetrieve.mockRejectedValueOnce(new Error('No such checkout.session: cs_test_xxx'))

    const res = await syncCheckoutSession(USER_ID, { sessionId: SESSION_ID })

    expect(res.success).toBe(false)
    if (res.success) return
    expect(res.code).toBe('session_not_found')
  })

  test('error genérico Stripe → stripe_error', async () => {
    mockGetAdminDb.mockReturnValue(makeDb({
      selects: [[{ id: USER_ID, stripe_customer_id: 'cus_user1', plan_type: 'free' }]],
    }))
    mockStripeRetrieve.mockRejectedValueOnce(new Error('Service Unavailable'))

    const res = await syncCheckoutSession(USER_ID, { sessionId: SESSION_ID })

    expect(res.success).toBe(false)
    if (res.success) return
    expect(res.code).toBe('stripe_error')
  })

  test('checkout en mode=payment sin subscription → no_subscription', async () => {
    mockGetAdminDb.mockReturnValue(makeDb({
      selects: [[{ id: USER_ID, stripe_customer_id: 'cus_user1', plan_type: 'free' }]],
    }))
    mockStripeRetrieve.mockResolvedValueOnce(makeStripeSession({
      mode: 'payment',
      subscription: null,
    }))

    const res = await syncCheckoutSession(USER_ID, { sessionId: SESSION_ID })

    expect(res.success).toBe(false)
    if (res.success) return
    expect(res.code).toBe('no_subscription')
  })

  test('perfil no existe en BD → db_error', async () => {
    mockGetAdminDb.mockReturnValue(makeDb({ selects: [[]] })) // SELECT profile → vacío

    const res = await syncCheckoutSession(USER_ID, { sessionId: SESSION_ID })

    expect(res.success).toBe(false)
    if (res.success) return
    expect(res.code).toBe('db_error')
  })

  test('upsert user_subscriptions falla → db_error', async () => {
    mockGetAdminDb.mockReturnValue(makeDb({
      selects: [
        [{ id: USER_ID, stripe_customer_id: 'cus_user1', plan_type: 'free' }],
        [], // existing sub → no existe
      ],
      upsertErr: new Error('FK violation'),
    }))

    mockStripeRetrieve.mockResolvedValueOnce(makeStripeSession())

    const res = await syncCheckoutSession(USER_ID, { sessionId: SESSION_ID })

    expect(res.success).toBe(false)
    if (res.success) return
    expect(res.code).toBe('db_error')
  })
})

describe('syncCheckoutSession — telemetría', () => {
  test('cada path emite un evento distinto en observable_events', async () => {
    // Happy path
    mockGetAdminDb.mockReturnValue(makeDb({
      selects: [
        [{ id: USER_ID, stripe_customer_id: 'cus_user1', plan_type: 'free' }],
        [], // existing sub
      ],
    }))
    mockStripeRetrieve.mockResolvedValueOnce(makeStripeSession())

    await syncCheckoutSession(USER_ID, { sessionId: SESSION_ID })

    const events = mockEmit.mock.calls.map(c => (c[0] as { eventType?: string }).eventType)
    expect(events).toContain('checkout_sync_activated')

    // Todos los emits tienen source='fargate' y endpoint correcto
    for (const call of mockEmit.mock.calls) {
      const e = call[0] as { source?: string; endpoint?: string; userId?: string }
      expect(e.source).toBe('fargate')
      expect(e.endpoint).toBe('/api/stripe/checkout-sync')
      expect(e.userId).toBe(USER_ID)
    }
  })
})
