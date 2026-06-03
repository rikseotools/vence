// __tests__/conversions/recordConversion.test.ts
// El bus encola UNA fila por destino suscrito, idempotente (id determinista),
// y no encola si ningún destino soporta el evento.

import type { ConversionDestination, ConversionEvent } from '@/lib/conversions/types'

// --- Mocks (prefijo `mock` requerido por jest para el factory) ---
const mockOnConflictDoNothing = jest.fn().mockResolvedValue(undefined)
const mockValues = jest.fn(() => ({ onConflictDoNothing: mockOnConflictDoNothing }))
const mockInsert = jest.fn(() => ({ values: mockValues }))

jest.mock('@/db/client', () => ({
  getAdminDb: () => ({ insert: mockInsert }),
}))

const purchaseDest: ConversionDestination = {
  name: 'fake_ads',
  supports: (e) => e.type === 'purchase',
  deliver: async () => ({ ok: true }),
}

jest.mock('@/lib/conversions/registry', () => ({
  getDestinations: () => [purchaseDest],
}))

import { recordConversion } from '@/lib/conversions/recordConversion'

const event: ConversionEvent = {
  dedupId: 'purchase:in_123',
  type: 'purchase',
  userId: 'u1',
  valueCents: 5900,
  currency: 'eur',
  occurredAt: '2026-06-03T10:00:00Z',
  orderId: 'in_123',
  attribution: { gclid: 'G1', emailSha256: 'abc' },
}

describe('recordConversion', () => {
  beforeEach(() => jest.clearAllMocks())

  test('encola una fila por destino suscrito, con id = dedupId:destino', async () => {
    const res = await recordConversion(event)
    expect(res).toEqual({ enqueued: 1 })
    expect(mockInsert).toHaveBeenCalledTimes(1)
    const rows = mockValues.mock.calls[0][0]
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      id: 'purchase:in_123:fake_ads',
      eventType: 'purchase',
      destination: 'fake_ads',
      userId: 'u1',
      valueCents: 5900,
    })
    expect(rows[0].payload).toMatchObject({ orderId: 'in_123' })
    expect(mockOnConflictDoNothing).toHaveBeenCalledTimes(1) // idempotente
  })

  test('no encola si ningún destino soporta el evento', async () => {
    const res = await recordConversion({ ...event, type: 'registration' })
    expect(res).toEqual({ enqueued: 0 })
    expect(mockInsert).not.toHaveBeenCalled()
  })
})
