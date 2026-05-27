// __tests__/api/subscription/cancelSubscription.robustness.test.ts
//
// Tests del fix robusto de cancelSubscription (27/05/2026, caso Mariangeles).
//
// Antes: lib/api/subscription/queries.ts:368 filtraba `status: 'active'` y
// rechazaba cualquier suscripción past_due/unpaid/incomplete con 404
// "No active subscription found". Mariangeles (uid b6de5d74...) pulsó cancelar
// 7 veces el 21/05/2026 y los 7 fallaron porque su sub estaba past_due tras
// fallo de cobro.
//
// Ahora: cancelSubscription
//   - Acepta active/trialing/past_due/unpaid/incomplete
//   - Idempotente con cancel_at_period_end=true o canceled
//   - active/trialing → cancel_at_period_end=true (acceso hasta fin de periodo)
//   - past_due/unpaid/incomplete → cancel inmediato + void invoices abiertas

// Mock Stripe ANTES del import (jest hoist)
const mockStripeUpdate = jest.fn()
const mockStripeCancel = jest.fn()
const mockStripeList = jest.fn()
const mockInvoiceList = jest.fn()
const mockInvoiceVoid = jest.fn()

jest.mock('@/lib/stripe', () => ({
  stripe: () => ({
    subscriptions: {
      list: mockStripeList,
      update: mockStripeUpdate,
      cancel: mockStripeCancel,
    },
    invoices: {
      list: mockInvoiceList,
      voidInvoice: mockInvoiceVoid,
    },
  }),
}))

// Mock DB con las dos cadenas que usa cancelSubscription:
//   db.select(...).from(...).where(...).limit(1) → [profile]
//   db.execute(sql...) → ignorar (best-effort)
const mockProfile = {
  stripeCustomerId: 'cus_test123',
  planType: 'premium',
  email: 'test@example.com',
  fullName: 'Test User',
}

const dbSelectChain = {
  from: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  limit: jest.fn().mockResolvedValue([mockProfile]),
}

const mockDb = {
  select: jest.fn(() => dbSelectChain),
  execute: jest.fn().mockResolvedValue({ rows: [] }),
}

jest.mock('@/db/client', () => ({
  __esModule: true,
  getDb: () => mockDb,
}))

jest.mock('@/db/schema', () => ({
  userProfiles: {
    id: 'id',
    stripeCustomerId: 'stripe_customer_id',
    planType: 'plan_type',
    email: 'email',
    fullName: 'full_name',
  },
}))

// Resend dynamic import: stub para evitar fallo si RESEND_API_KEY presente
jest.mock('resend', () => ({ Resend: jest.fn(() => ({ emails: { send: jest.fn() } })) }))

// Mock observability emit — no queremos persistir en BD desde tests.
const mockEmit = jest.fn()
jest.mock('@/lib/observability/emit', () => ({
  emit: (...args: unknown[]) => mockEmit(...args),
  emitFireAndForget: (...args: unknown[]) => mockEmit(...args),
}))

// Import bajo test DESPUÉS de los mocks
import { cancelSubscription } from '@/lib/api/subscription/queries'

// Helper para construir un objeto de suscripción Stripe-like
function makeSub(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sub_test123',
    status: 'active',
    cancel_at_period_end: false,
    current_period_end: Math.floor(new Date('2026-12-31T00:00:00Z').getTime() / 1000),
    items: { data: [{ price: { unit_amount: 2000 } }] },
    ...overrides,
  }
}

const USER_ID = '00000000-0000-0000-0000-000000000001'

beforeEach(() => {
  jest.clearAllMocks()
  // restaurar default del db chain
  dbSelectChain.limit.mockResolvedValue([mockProfile])
  mockInvoiceList.mockResolvedValue({ data: [] })
  mockInvoiceVoid.mockResolvedValue({ status: 'void' })
})

// Helper para verificar que Stripe recibió idempotencyKey.
function expectIdempotencyKey(mockFn: jest.Mock, callIndex = 0) {
  const call = mockFn.mock.calls[callIndex]
  expect(call).toBeDefined()
  const options = call[call.length - 1]
  expect(options).toMatchObject({ idempotencyKey: expect.stringMatching(/^cancel-[\w-]+/) })
}

// Helper para verificar que se emitió un evento de cierto tipo.
function expectEventEmitted(eventType: string, severity?: string) {
  const matchingCall = mockEmit.mock.calls.find((args) => {
    const event = args[0] as { eventType?: string; severity?: string }
    return event?.eventType === eventType && (severity === undefined || event.severity === severity)
  })
  expect(matchingCall).toBeDefined()
  return matchingCall![0]
}

describe('cancelSubscription — estado active/trialing (cancel_at_period_end)', () => {
  test('status=active → cancel_at_period_end=true, mode=at_period_end, no void invoices', async () => {
    mockStripeList.mockResolvedValueOnce({ data: [makeSub({ status: 'active' })] })
    mockStripeUpdate.mockResolvedValueOnce({})

    const res = await cancelSubscription({ userId: USER_ID })

    expect(res.success).toBe(true)
    expect(res.mode).toBe('at_period_end')
    expect(res.voidedInvoices).toBe(0)
    expect(res.alreadyCanceled).toBe(false)
    expect(mockStripeUpdate).toHaveBeenCalledWith(
      'sub_test123',
      { cancel_at_period_end: true },
      expect.objectContaining({ idempotencyKey: expect.stringContaining('-schedule') }),
    )
    expect(mockStripeCancel).not.toHaveBeenCalled()
    expect(mockInvoiceVoid).not.toHaveBeenCalled()
    expectEventEmitted('subscription_cancelled_at_period_end', 'info')
  })

  test('status=trialing → cancel_at_period_end=true (mismo trato que active)', async () => {
    mockStripeList.mockResolvedValueOnce({ data: [makeSub({ status: 'trialing' })] })
    mockStripeUpdate.mockResolvedValueOnce({})

    const res = await cancelSubscription({ userId: USER_ID })

    expect(res.success).toBe(true)
    expect(res.mode).toBe('at_period_end')
    expectIdempotencyKey(mockStripeUpdate)
    expect(mockStripeCancel).not.toHaveBeenCalled()
    expectEventEmitted('subscription_cancelled_at_period_end')
  })
})

describe('cancelSubscription — estado past_due/unpaid/incomplete (cancel inmediato + void)', () => {
  test('status=past_due → cancel inmediato + void de invoices abiertas (caso Mariangeles)', async () => {
    mockStripeList.mockResolvedValueOnce({ data: [makeSub({ status: 'past_due' })] })
    mockStripeCancel.mockResolvedValueOnce({ status: 'canceled' })
    mockInvoiceList.mockResolvedValueOnce({
      data: [
        { id: 'in_open_1', status: 'open' },
        { id: 'in_open_2', status: 'open' },
      ],
    })
    mockInvoiceVoid.mockResolvedValue({ status: 'void' })

    const res = await cancelSubscription({ userId: USER_ID })

    expect(res.success).toBe(true)
    expect(res.mode).toBe('immediate')
    expect(res.voidedInvoices).toBe(2)
    expect(mockStripeCancel).toHaveBeenCalledWith(
      'sub_test123',
      undefined,
      expect.objectContaining({ idempotencyKey: expect.stringContaining('-immediate') }),
    )
    expect(mockStripeUpdate).not.toHaveBeenCalled()
    expect(mockInvoiceVoid).toHaveBeenCalledTimes(2)
    // Cada invoice tiene su propio idempotencyKey (con el ID de la invoice).
    expect(mockInvoiceVoid).toHaveBeenCalledWith(
      'in_open_1',
      undefined,
      expect.objectContaining({ idempotencyKey: expect.stringContaining('-void-in_open_1') }),
    )
    expect(mockInvoiceVoid).toHaveBeenCalledWith(
      'in_open_2',
      undefined,
      expect.objectContaining({ idempotencyKey: expect.stringContaining('-void-in_open_2') }),
    )
    // Telemetría: evento force_canceled_past_due con severidad warn.
    const evt = expectEventEmitted('subscription_force_canceled_past_due', 'warn')
    expect(evt.metadata).toMatchObject({ voidedCount: 2, voidedFailed: 0 })
  })

  test('status=unpaid → cancel inmediato + void', async () => {
    mockStripeList.mockResolvedValueOnce({ data: [makeSub({ status: 'unpaid' })] })
    mockStripeCancel.mockResolvedValueOnce({ status: 'canceled' })
    mockInvoiceList.mockResolvedValueOnce({ data: [{ id: 'in_unpaid_1', status: 'open' }] })

    const res = await cancelSubscription({ userId: USER_ID })

    expect(res.success).toBe(true)
    expect(res.mode).toBe('immediate')
    expect(res.voidedInvoices).toBe(1)
    expectIdempotencyKey(mockStripeCancel)
    expectEventEmitted('subscription_force_canceled_past_due')
  })

  test('status=incomplete → cancel inmediato (sin invoices abiertas también funciona)', async () => {
    mockStripeList.mockResolvedValueOnce({ data: [makeSub({ status: 'incomplete' })] })
    mockStripeCancel.mockResolvedValueOnce({ status: 'canceled' })
    mockInvoiceList.mockResolvedValueOnce({ data: [] })

    const res = await cancelSubscription({ userId: USER_ID })

    expect(res.success).toBe(true)
    expect(res.mode).toBe('immediate')
    expect(res.voidedInvoices).toBe(0)
    expectIdempotencyKey(mockStripeCancel)
    expect(mockInvoiceVoid).not.toHaveBeenCalled()
  })

  test('past_due con error voideando una invoice → emite subscription_void_invoice_failed (severity error) y subscription_force_canceled_past_due sube a error', async () => {
    mockStripeList.mockResolvedValueOnce({ data: [makeSub({ status: 'past_due' })] })
    mockStripeCancel.mockResolvedValueOnce({ status: 'canceled' })
    mockInvoiceList.mockResolvedValueOnce({
      data: [
        { id: 'in_ok', status: 'open' },
        { id: 'in_fail', status: 'open' },
      ],
    })
    mockInvoiceVoid
      .mockResolvedValueOnce({ status: 'void' })
      .mockRejectedValueOnce(new Error('Stripe API down'))

    const res = await cancelSubscription({ userId: USER_ID })

    expect(res.success).toBe(true)
    expect(res.mode).toBe('immediate')
    expect(res.voidedInvoices).toBe(1) // solo la que funcionó
    // Observabilidad ahora detecta el fallo del void.
    const voidFailEvt = expectEventEmitted('subscription_void_invoice_failed', 'error')
    expect(voidFailEvt.metadata).toMatchObject({ invoiceId: 'in_fail' })
    // El evento de fuerza-cancel sube a severity=error porque hubo voids fallidos.
    const forceCancelEvt = expectEventEmitted('subscription_force_canceled_past_due', 'error')
    expect(forceCancelEvt.metadata).toMatchObject({ voidedCount: 1, voidedFailed: 1 })
  })
})

describe('cancelSubscription — idempotencia', () => {
  test('ya cancel_at_period_end=true → success sin re-llamar a Stripe update', async () => {
    mockStripeList.mockResolvedValueOnce({
      data: [makeSub({ status: 'active', cancel_at_period_end: true })],
    })

    const res = await cancelSubscription({ userId: USER_ID })

    expect(res.success).toBe(true)
    expect(res.alreadyCanceled).toBe(true)
    expect(res.mode).toBe('at_period_end')
    expect(mockStripeUpdate).not.toHaveBeenCalled()
    expect(mockStripeCancel).not.toHaveBeenCalled()
  })

  test('todas las subs status=canceled (no cancelable) → alreadyCanceled=true success', async () => {
    // findCancellableSubscription devuelve null → fallback busca canceled
    mockStripeList
      .mockResolvedValueOnce({ data: [makeSub({ status: 'canceled' })] }) // findCancellable
      .mockResolvedValueOnce({ data: [makeSub({ status: 'canceled' })] }) // fallback

    const res = await cancelSubscription({ userId: USER_ID })

    expect(res.success).toBe(true)
    expect(res.alreadyCanceled).toBe(true)
    expect(mockStripeUpdate).not.toHaveBeenCalled()
    expect(mockStripeCancel).not.toHaveBeenCalled()
  })
})

describe('cancelSubscription — casos de error', () => {
  test('perfil sin stripeCustomerId → "No subscription found"', async () => {
    dbSelectChain.limit.mockResolvedValueOnce([{ ...mockProfile, stripeCustomerId: null }])

    const res = await cancelSubscription({ userId: USER_ID })

    expect(res.success).toBe(false)
    expect(res.error).toBe('No subscription found')
    expect(mockStripeList).not.toHaveBeenCalled()
  })

  test('customer sin ninguna suscripción → "No active subscription found"', async () => {
    mockStripeList
      .mockResolvedValueOnce({ data: [] }) // findCancellable
      .mockResolvedValueOnce({ data: [] }) // fallback

    const res = await cancelSubscription({ userId: USER_ID })

    expect(res.success).toBe(false)
    expect(res.error).toBe('No active subscription found')
  })

  test('perfil no existe → "No subscription found"', async () => {
    dbSelectChain.limit.mockResolvedValueOnce([])

    const res = await cancelSubscription({ userId: USER_ID })

    expect(res.success).toBe(false)
    expect(res.error).toBe('No subscription found')
  })
})

describe('cancelSubscription — prioridad cuando hay varias suscripciones', () => {
  test('prefiere active sobre past_due (caso edge: dos subs simultáneas)', async () => {
    // El customer tiene 2 subs: una past_due y otra active. Preferir cancelar la active
    // con cancel_at_period_end (más conservador) en vez de la past_due inmediato.
    mockStripeList.mockResolvedValueOnce({
      data: [
        makeSub({ id: 'sub_past', status: 'past_due' }),
        makeSub({ id: 'sub_active', status: 'active' }),
      ],
    })
    mockStripeUpdate.mockResolvedValueOnce({})

    const res = await cancelSubscription({ userId: USER_ID })

    expect(res.success).toBe(true)
    expect(res.mode).toBe('at_period_end')
    expect(mockStripeUpdate).toHaveBeenCalledWith(
      'sub_active',
      { cancel_at_period_end: true },
      expect.objectContaining({ idempotencyKey: expect.stringContaining('-schedule') }),
    )
    expect(mockStripeCancel).not.toHaveBeenCalled()
  })
})

describe('cancelSubscription — idempotencia end-to-end con key del cliente', () => {
  test('caller pasa idempotencyKey → se respeta y forma parte de las sub-keys', async () => {
    mockStripeList.mockResolvedValueOnce({ data: [makeSub({ status: 'active' })] })
    mockStripeUpdate.mockResolvedValueOnce({})

    await cancelSubscription({
      userId: USER_ID,
      idempotencyKey: 'client-provided-key-abc123',
    })

    // La sub-key '-schedule' debe contener el key del cliente
    const call = mockStripeUpdate.mock.calls[0]
    const options = call[call.length - 1]
    expect(options.idempotencyKey).toBe('client-provided-key-abc123-schedule')
  })
})
