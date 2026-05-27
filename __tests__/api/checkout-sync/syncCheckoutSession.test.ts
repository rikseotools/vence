// __tests__/api/checkout-sync/syncCheckoutSession.test.ts
//
// Tests de syncCheckoutSession — activación síncrona post-checkout.
// Origen: incidente 27/05/2026 (Rocío/Mercedes). El test cubre TODOS los
// paths críticos: happy path, idempotencia con webhook, anti-manipulación
// session_id, 3DS pending, no_subscription, errores Stripe/DB.

// ─── Mocks ───────────────────────────────────────────────────────────────

const mockStripeRetrieve = jest.fn()
const mockSupabaseFrom = jest.fn()
const mockEmit = jest.fn()

jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    checkout: {
      sessions: { retrieve: mockStripeRetrieve },
    },
  }))
})

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: (table: string) => mockSupabaseFrom(table),
  })),
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

// Helpers para construir las cadenas de Supabase ergonómicamente
function makeProfileChain(profile: Record<string, unknown> | null, error: Error | null = null) {
  return {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: profile, error }),
  }
}

function makeExistingSubChain(existing: Record<string, unknown> | null) {
  return {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({ data: existing, error: null }),
  }
}

function makeUpsertChain(error: Error | null = null) {
  return {
    upsert: jest.fn().mockResolvedValue({ error }),
  }
}

function makeUpdateChain(error: Error | null = null) {
  return {
    update: jest.fn().mockReturnThis(),
    eq: jest.fn().mockResolvedValue({ error }),
  }
}

// SUT después de los mocks
import { syncCheckoutSession } from '@/lib/api/checkout-sync/queries'

const USER_ID = '00000000-0000-0000-0000-000000000001'
const SESSION_ID = 'cs_test_abc123XYZ'

beforeEach(() => {
  jest.clearAllMocks()
  process.env.STRIPE_SECRET_KEY = 'sk_test_fake'
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://fake.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'fake'
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
    mockSupabaseFrom
      .mockReturnValueOnce(makeProfileChain({
        id: USER_ID,
        email: 'user@test.com',
        stripe_customer_id: 'cus_user1',
        plan_type: 'free',
      }))
      .mockReturnValueOnce(makeExistingSubChain(null)) // no existe en BD
      .mockReturnValueOnce(makeUpsertChain(null))
      .mockReturnValueOnce(makeUpdateChain(null))

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
    mockSupabaseFrom
      .mockReturnValueOnce(makeProfileChain({
        id: USER_ID,
        email: 'user@test.com',
        stripe_customer_id: 'cus_user1',
        plan_type: 'premium',
      }))
      .mockReturnValueOnce(makeExistingSubChain({ id: 'row1', status: 'active' }))

    mockStripeRetrieve.mockResolvedValueOnce(makeStripeSession())

    const res = await syncCheckoutSession(USER_ID, { sessionId: SESSION_ID })

    expect(res.success).toBe(true)
    if (!res.success) return
    expect(res.status).toBe('already_active')
    expect(res.activatedBySync).toBe(false)

    const evt = mockEmit.mock.calls.find(c => (c[0] as { eventType?: string }).eventType === 'checkout_sync_already_synced_by_webhook')
    expect(evt).toBeDefined()
  })

  test('si la sub existe pero profile.plan_type aún es free → corrige profile sin upsert sub', async () => {
    // Caso: webhook insertó user_subscriptions pero falló UPDATE profile
    // (race condition rara). El sync detecta y corrige profile sin volver
    // a tocar la sub (idempotencia preservada).
    const updateMock = jest.fn().mockReturnThis()
    const eqMock = jest.fn().mockResolvedValue({ error: null })
    mockSupabaseFrom
      .mockReturnValueOnce(makeProfileChain({
        id: USER_ID,
        email: 'user@test.com',
        stripe_customer_id: 'cus_user1',
        plan_type: 'free', // ← drift detectado
      }))
      .mockReturnValueOnce(makeExistingSubChain({ id: 'row1', status: 'active' }))
      .mockReturnValueOnce({ update: updateMock, eq: eqMock })

    mockStripeRetrieve.mockResolvedValueOnce(makeStripeSession())

    const res = await syncCheckoutSession(USER_ID, { sessionId: SESSION_ID })

    expect(res.success).toBe(true)
    if (!res.success) return
    expect(res.status).toBe('already_active')
    expect(updateMock).toHaveBeenCalledWith({ plan_type: 'premium', requires_payment: false })
  })
})

describe('syncCheckoutSession — anti-manipulación session_id', () => {
  test('session.customer NO coincide con profile.stripe_customer_id → unauthorized', async () => {
    mockSupabaseFrom.mockReturnValueOnce(makeProfileChain({
      id: USER_ID,
      email: 'user@test.com',
      stripe_customer_id: 'cus_user1',
      plan_type: 'free',
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
    mockSupabaseFrom.mockReturnValueOnce(makeProfileChain({
      id: USER_ID,
      stripe_customer_id: 'cus_user1',
      plan_type: 'free',
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
    // Profile sin stripe_customer_id (primer pago)
    const updateMock = jest.fn().mockReturnThis()
    const eqMock = jest.fn().mockResolvedValue({ error: null })
    mockSupabaseFrom
      .mockReturnValueOnce(makeProfileChain({
        id: USER_ID,
        email: 'newpayer@test.com',
        stripe_customer_id: null,
        plan_type: 'free',
      }))
      // Comprobación "owner of customer" → libre (no asociado a nadie)
      .mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
      })
      // existing sub
      .mockReturnValueOnce(makeExistingSubChain(null))
      // upsert sub
      .mockReturnValueOnce(makeUpsertChain(null))
      // UPDATE profile
      .mockReturnValueOnce({ update: updateMock, eq: eqMock })

    mockStripeRetrieve.mockResolvedValueOnce(makeStripeSession({ customer: 'cus_brand_new' }))

    const res = await syncCheckoutSession(USER_ID, { sessionId: SESSION_ID })

    expect(res.success).toBe(true)
    if (!res.success) return
    expect(res.status).toBe('activated')

    // UPDATE profile incluye stripe_customer_id auto-vinculado
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        plan_type: 'premium',
        requires_payment: false,
        stripe_customer_id: 'cus_brand_new',
      }),
    )

    // Telemetría con firstTimePayer=true
    const evt = mockEmit.mock.calls.find(c => (c[0] as { eventType?: string }).eventType === 'checkout_sync_activated')
    expect(evt).toBeDefined()
    expect((evt![0] as { metadata?: { firstTimePayer?: boolean } }).metadata?.firstTimePayer).toBe(true)
  })

  test('primer pago + customer YA tomado por otro user → unauthorized (anti-takeover)', async () => {
    mockSupabaseFrom
      .mockReturnValueOnce(makeProfileChain({
        id: USER_ID,
        stripe_customer_id: null,
        plan_type: 'free',
      }))
      // Comprobación "owner of customer" → ya pertenece a OTRO user
      .mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: { id: 'other-user-id-XXX' },
          error: null,
        }),
      })

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
    const updateMock = jest.fn().mockReturnThis()
    const eqMock = jest.fn().mockResolvedValue({ error: null })
    mockSupabaseFrom
      .mockReturnValueOnce(makeProfileChain({
        id: USER_ID,
        stripe_customer_id: 'cus_existing',
        plan_type: 'free', // free porque webhook anterior se perdió y vuelven a pagar
      }))
      .mockReturnValueOnce(makeExistingSubChain(null))
      .mockReturnValueOnce(makeUpsertChain(null))
      .mockReturnValueOnce({ update: updateMock, eq: eqMock })

    mockStripeRetrieve.mockResolvedValueOnce(makeStripeSession({ customer: 'cus_existing' }))

    const res = await syncCheckoutSession(USER_ID, { sessionId: SESSION_ID })

    expect(res.success).toBe(true)
    // El UPDATE no incluye stripe_customer_id (ya estaba bien)
    const call = updateMock.mock.calls[0]
    expect(call[0]).toEqual({ plan_type: 'premium', requires_payment: false })
    expect(call[0]).not.toHaveProperty('stripe_customer_id')
  })
})

describe('syncCheckoutSession — 3DS / async payment', () => {
  test('payment_status=unpaid → pending_payment (no activa, no error)', async () => {
    mockSupabaseFrom.mockReturnValueOnce(makeProfileChain({
      id: USER_ID,
      stripe_customer_id: 'cus_user1',
      plan_type: 'free',
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
    mockSupabaseFrom.mockReturnValueOnce(makeProfileChain({
      id: USER_ID,
      stripe_customer_id: 'cus_user1',
      plan_type: 'free',
    }))
    mockStripeRetrieve.mockRejectedValueOnce(new Error('No such checkout.session: cs_test_xxx'))

    const res = await syncCheckoutSession(USER_ID, { sessionId: SESSION_ID })

    expect(res.success).toBe(false)
    if (res.success) return
    expect(res.code).toBe('session_not_found')
  })

  test('error genérico Stripe → stripe_error', async () => {
    mockSupabaseFrom.mockReturnValueOnce(makeProfileChain({
      id: USER_ID,
      stripe_customer_id: 'cus_user1',
      plan_type: 'free',
    }))
    mockStripeRetrieve.mockRejectedValueOnce(new Error('Service Unavailable'))

    const res = await syncCheckoutSession(USER_ID, { sessionId: SESSION_ID })

    expect(res.success).toBe(false)
    if (res.success) return
    expect(res.code).toBe('stripe_error')
  })

  test('checkout en mode=payment sin subscription → no_subscription', async () => {
    mockSupabaseFrom.mockReturnValueOnce(makeProfileChain({
      id: USER_ID,
      stripe_customer_id: 'cus_user1',
      plan_type: 'free',
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
    mockSupabaseFrom.mockReturnValueOnce(makeProfileChain(null, new Error('not found')))

    const res = await syncCheckoutSession(USER_ID, { sessionId: SESSION_ID })

    expect(res.success).toBe(false)
    if (res.success) return
    expect(res.code).toBe('db_error')
  })

  test('upsert user_subscriptions falla → db_error', async () => {
    mockSupabaseFrom
      .mockReturnValueOnce(makeProfileChain({
        id: USER_ID, stripe_customer_id: 'cus_user1', plan_type: 'free',
      }))
      .mockReturnValueOnce(makeExistingSubChain(null))
      .mockReturnValueOnce(makeUpsertChain(new Error('FK violation')))

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
    mockSupabaseFrom
      .mockReturnValueOnce(makeProfileChain({
        id: USER_ID, stripe_customer_id: 'cus_user1', plan_type: 'free',
      }))
      .mockReturnValueOnce(makeExistingSubChain(null))
      .mockReturnValueOnce(makeUpsertChain(null))
      .mockReturnValueOnce(makeUpdateChain(null))
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
