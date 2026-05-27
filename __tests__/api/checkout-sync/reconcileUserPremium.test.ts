// __tests__/api/checkout-sync/reconcileUserPremium.test.ts
//
// Tests del auto-sync silencioso (Sprint B). Cubre el caso "usuario paga
// desde móvil, entra desde laptop sin pasar por success_url" + escenarios
// degenerados (no customer, sin sub, ya premium → no-op).

const mockStripeSubsList = jest.fn()
const mockSupabaseFrom = jest.fn()
const mockEmit = jest.fn()

jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    checkout: { sessions: { retrieve: jest.fn() } },
    subscriptions: { list: mockStripeSubsList },
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

import { reconcileUserPremium } from '@/lib/api/checkout-sync/queries'

const USER_ID = '00000000-0000-0000-0000-000000000001'

function makeProfileChain(profile: Record<string, unknown> | null) {
  return {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: profile, error: null }),
  }
}

function makeUpsertChain(error: Error | null = null) {
  return { upsert: jest.fn().mockResolvedValue({ error }) }
}

function makeUpdateChain(error: Error | null = null) {
  return {
    update: jest.fn().mockReturnThis(),
    eq: jest.fn().mockResolvedValue({ error }),
  }
}

function makeStripeSub() {
  return {
    id: 'sub_xyz',
    status: 'active',
    created: Math.floor(Date.now() / 1000),
    current_period_start: Math.floor(Date.now() / 1000),
    current_period_end: Math.floor(Date.now() / 1000) + 30 * 86400,
    trial_start: null,
    trial_end: null,
    items: { data: [{ price: { recurring: { interval: 'month' } } }] },
  }
}

beforeEach(() => {
  jest.clearAllMocks()
  process.env.STRIPE_SECRET_KEY = 'sk_test_fake'
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://fake.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'fake'
})

describe('reconcileUserPremium — short-circuits (zero-cost no-ops)', () => {
  test('user sin stripe_customer_id → no Stripe call, no drift', async () => {
    mockSupabaseFrom.mockReturnValueOnce(makeProfileChain({
      id: USER_ID, stripe_customer_id: null, plan_type: 'free',
    }))

    const res = await reconcileUserPremium(USER_ID)

    expect(res).toEqual({ drift: false, fixed: false, reason: 'no_stripe_customer' })
    expect(mockStripeSubsList).not.toHaveBeenCalled()
  })

  test('user ya premium → no Stripe call (zero cost cuando todo OK)', async () => {
    mockSupabaseFrom.mockReturnValueOnce(makeProfileChain({
      id: USER_ID, stripe_customer_id: 'cus_x', plan_type: 'premium',
    }))

    const res = await reconcileUserPremium(USER_ID)

    expect(res).toEqual({ drift: false, fixed: false, reason: 'already_premium' })
    expect(mockStripeSubsList).not.toHaveBeenCalled()
  })

  test('user free con customer pero SIN sub active en Stripe → no drift (caso canceled)', async () => {
    mockSupabaseFrom.mockReturnValueOnce(makeProfileChain({
      id: USER_ID, stripe_customer_id: 'cus_x', plan_type: 'free',
    }))
    mockStripeSubsList
      .mockResolvedValueOnce({ data: [] }) // active
      .mockResolvedValueOnce({ data: [] }) // trialing

    const res = await reconcileUserPremium(USER_ID)

    expect(res).toEqual({ drift: false, fixed: false, reason: 'no_active_sub_in_stripe' })
  })
})

describe('reconcileUserPremium — drift real (caso Rocío/Mercedes/Andrea)', () => {
  test('user free + customer + sub active en Stripe → drift=true, fixed=true', async () => {
    const updateMock = jest.fn().mockReturnThis()
    const eqMock = jest.fn().mockResolvedValue({ error: null })
    mockSupabaseFrom
      .mockReturnValueOnce(makeProfileChain({
        id: USER_ID, stripe_customer_id: 'cus_x', plan_type: 'free',
      }))
      .mockReturnValueOnce(makeUpsertChain(null))
      .mockReturnValueOnce({ update: updateMock, eq: eqMock })

    mockStripeSubsList
      .mockResolvedValueOnce({ data: [makeStripeSub()] })
      .mockResolvedValueOnce({ data: [] }) // trialing vacío

    const res = await reconcileUserPremium(USER_ID)

    expect(res.drift).toBe(true)
    expect(res.fixed).toBe(true)

    // user_profiles UPDATE a premium
    expect(updateMock).toHaveBeenCalledWith({ plan_type: 'premium', requires_payment: false })

    // Telemetría: warn porque el webhook NO sincronizó cuando debió
    const evt = mockEmit.mock.calls.find(c => (c[0] as { eventType?: string }).eventType === 'profile_reconcile_fixed')
    expect(evt).toBeDefined()
    expect((evt![0] as { severity?: string }).severity).toBe('warn')
  })

  test('trialing también cuenta como acceso premium', async () => {
    const updateMock = jest.fn().mockReturnThis()
    const eqMock = jest.fn().mockResolvedValue({ error: null })
    mockSupabaseFrom
      .mockReturnValueOnce(makeProfileChain({
        id: USER_ID, stripe_customer_id: 'cus_x', plan_type: 'free',
      }))
      .mockReturnValueOnce(makeUpsertChain(null))
      .mockReturnValueOnce({ update: updateMock, eq: eqMock })

    mockStripeSubsList
      .mockResolvedValueOnce({ data: [] }) // active vacío
      .mockResolvedValueOnce({ data: [{ ...makeStripeSub(), status: 'trialing' }] })

    const res = await reconcileUserPremium(USER_ID)
    expect(res.fixed).toBe(true)
  })

  test('upsert sub falla → drift=true, fixed=false (no engaña al caller)', async () => {
    mockSupabaseFrom
      .mockReturnValueOnce(makeProfileChain({
        id: USER_ID, stripe_customer_id: 'cus_x', plan_type: 'free',
      }))
      .mockReturnValueOnce(makeUpsertChain(new Error('FK violation')))

    mockStripeSubsList
      .mockResolvedValueOnce({ data: [makeStripeSub()] })
      .mockResolvedValueOnce({ data: [] })

    const res = await reconcileUserPremium(USER_ID)

    expect(res.drift).toBe(true)
    expect(res.fixed).toBe(false)
    expect(res.reason).toContain('FK violation')

    // Emitido como error
    const evt = mockEmit.mock.calls.find(c => (c[0] as { eventType?: string }).eventType === 'profile_reconcile_error')
    expect(evt).toBeDefined()
    expect((evt![0] as { severity?: string }).severity).toBe('error')
  })
})

describe('reconcileUserPremium — robustez', () => {
  test('Stripe API error → drift=false, error logueado, no propaga', async () => {
    mockSupabaseFrom.mockReturnValueOnce(makeProfileChain({
      id: USER_ID, stripe_customer_id: 'cus_x', plan_type: 'free',
    }))
    mockStripeSubsList.mockRejectedValueOnce(new Error('Stripe rate limited'))

    const res = await reconcileUserPremium(USER_ID)

    // No reventamos al caller (después del GET de profile)
    expect(res.drift).toBe(false)
    expect(res.fixed).toBe(false)

    const evt = mockEmit.mock.calls.find(c => (c[0] as { eventType?: string }).eventType === 'profile_reconcile_error')
    expect(evt).toBeDefined()
  })
})
