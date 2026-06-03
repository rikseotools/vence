// __tests__/api/checkout-sync/reconcileUserPremium.test.ts
//
// Tests del auto-sync silencioso (Sprint B). Cubre el caso "usuario paga
// desde móvil, entra desde laptop sin pasar por success_url" + escenarios
// degenerados (no customer, sin sub, ya premium → no-op).

const mockStripeSubsList = jest.fn()
const mockGetAdminDb = jest.fn()
const mockEmit = jest.fn()

jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    checkout: { sessions: { retrieve: jest.fn() } },
    subscriptions: { list: mockStripeSubsList },
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

import { reconcileUserPremium } from '@/lib/api/checkout-sync/queries'

const USER_ID = '00000000-0000-0000-0000-000000000001'

// Mock del cliente Drizzle (getAdminDb). reconcileUserPremium hace:
//   - SELECT: db.select(cols).from(userProfiles).where(eq).limit(1) -> [profile]
//             (alias snake_case: id, stripe_customer_id, plan_type)
//   - UPSERT: db.insert(userSubscriptions).values(v).onConflictDoUpdate(...)
//   - UPDATE: db.update(userProfiles).set({planType,requiresPayment}).where(eq)
// upsertErr / updateErr simulan throws de Drizzle (no objetos {error} de Supabase).
function makeDb({
  profile,
  upsertErr = null,
  updateErr = null,
}: {
  profile: Record<string, unknown> | null
  upsertErr?: Error | null
  updateErr?: Error | null
}) {
  const limit = jest.fn().mockResolvedValue(profile === null ? [] : [profile])
  const where = jest.fn(() => ({ limit }))
  const from = jest.fn(() => ({ where }))
  const select = jest.fn(() => ({ from }))

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
})

describe('reconcileUserPremium — short-circuits (zero-cost no-ops)', () => {
  test('user sin stripe_customer_id → no Stripe call, no drift', async () => {
    mockGetAdminDb.mockReturnValue(makeDb({
      profile: { id: USER_ID, stripe_customer_id: null, plan_type: 'free' },
    }))

    const res = await reconcileUserPremium(USER_ID)

    expect(res).toEqual({ drift: false, fixed: false, reason: 'no_stripe_customer' })
    expect(mockStripeSubsList).not.toHaveBeenCalled()
  })

  test('user ya premium → no Stripe call (zero cost cuando todo OK)', async () => {
    mockGetAdminDb.mockReturnValue(makeDb({
      profile: { id: USER_ID, stripe_customer_id: 'cus_x', plan_type: 'premium' },
    }))

    const res = await reconcileUserPremium(USER_ID)

    expect(res).toEqual({ drift: false, fixed: false, reason: 'already_premium' })
    expect(mockStripeSubsList).not.toHaveBeenCalled()
  })

  test('user free con customer pero SIN sub active en Stripe → no drift (caso canceled)', async () => {
    mockGetAdminDb.mockReturnValue(makeDb({
      profile: { id: USER_ID, stripe_customer_id: 'cus_x', plan_type: 'free' },
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
    const db = makeDb({
      profile: { id: USER_ID, stripe_customer_id: 'cus_x', plan_type: 'free' },
    })
    mockGetAdminDb.mockReturnValue(db)

    mockStripeSubsList
      .mockResolvedValueOnce({ data: [makeStripeSub()] })
      .mockResolvedValueOnce({ data: [] }) // trialing vacío

    const res = await reconcileUserPremium(USER_ID)

    expect(res.drift).toBe(true)
    expect(res.fixed).toBe(true)

    // user_profiles UPDATE a premium (Drizzle camelCase)
    expect(db._set).toHaveBeenCalledWith({ planType: 'premium', requiresPayment: false })

    // Telemetría: warn porque el webhook NO sincronizó cuando debió
    const evt = mockEmit.mock.calls.find(c => (c[0] as { eventType?: string }).eventType === 'profile_reconcile_fixed')
    expect(evt).toBeDefined()
    expect((evt![0] as { severity?: string }).severity).toBe('warn')
  })

  test('trialing también cuenta como acceso premium', async () => {
    const db = makeDb({
      profile: { id: USER_ID, stripe_customer_id: 'cus_x', plan_type: 'free' },
    })
    mockGetAdminDb.mockReturnValue(db)

    mockStripeSubsList
      .mockResolvedValueOnce({ data: [] }) // active vacío
      .mockResolvedValueOnce({ data: [{ ...makeStripeSub(), status: 'trialing' }] })

    const res = await reconcileUserPremium(USER_ID)
    expect(res.fixed).toBe(true)
  })

  test('upsert sub falla → drift=true, fixed=false (no engaña al caller)', async () => {
    mockGetAdminDb.mockReturnValue(makeDb({
      profile: { id: USER_ID, stripe_customer_id: 'cus_x', plan_type: 'free' },
      upsertErr: new Error('FK violation'),
    }))

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
    mockGetAdminDb.mockReturnValue(makeDb({
      profile: { id: USER_ID, stripe_customer_id: 'cus_x', plan_type: 'free' },
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
